import { ConfigService } from '@nestjs/config';
import { ENVS } from '../constants/variables';
import { MatchingService } from '../matching/matching.service';
import { RedisService } from '../redis/redis.service';
import type { IPresence } from '../redis/types';
import { RtcService } from '../rtc/rtc.service';
import { SessionHashWriteError } from '../sessions/session-hash-write.error';
import type { ISession } from '../sessions/session.schema';
import { SessionService } from '../sessions/session.service';
import { ERROR_CODES, SERVER_EVENTS } from './events';
import { SignalingService } from './signaling.service';
import { SignalingTransport } from './signaling-transport';

const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION_ID = '0b1c2d3e-1111-4222-8333-444455556666';

const ICE = [{ urls: ['stun:x'] }, { urls: ['turn:x'], username: 'u', credential: 'p' }];

function baseSession(overrides: Partial<ISession> = {}): ISession {
    return {
        _id: SESSION_ID,
        participants: [ID_A, ID_B],
        offererId: ID_A,
        matchedAt: new Date('2026-01-01T00:00:00.000Z'),
        connectedAt: null,
        endedAt: null,
        endReason: null,
        endedBy: null,
        durationMs: null,
        ...overrides,
    };
}

function defaultTransport(overrides: Partial<SignalingTransport> = {}): SignalingTransport {
    return {
        emitTo: jest.fn().mockResolvedValue(undefined),
        leaveSession: jest.fn(),
        broadcastQueuePositions: jest.fn().mockResolvedValue(undefined),
        relay: jest.fn(),
        emitError: jest.fn(),
        joinSession: jest.fn(),
        bind: jest.fn(),
        ...overrides,
    } as SignalingTransport;
}

function defaultRedis(overrides: Partial<RedisService> = {}): RedisService {
    return {
        getPresence: jest.fn().mockResolvedValue(null),
        setPresenceSessionId: jest.fn().mockResolvedValue(true),
        setPairBlock: jest.fn(),
        acquireSweeperLock: jest.fn(),
        removeFromQueue: jest.fn(),
        ...overrides,
    } as RedisService;
}

function createService(deps: {
    sessions?: Partial<SessionService>;
    matching?: Partial<MatchingService>;
    redis?: Partial<RedisService>;
    rtc?: Partial<RtcService>;
    transport?: Partial<SignalingTransport>;
    config?: Partial<ConfigService>;
}) {
    return new SignalingService(
        deps.sessions as SessionService,
        deps.matching as MatchingService,
        defaultRedis(deps.redis),
        (deps.rtc as RtcService) ?? ({ iceServers: () => ICE } as RtcService),
        defaultTransport(deps.transport),
        (deps.config as ConfigService) ?? ({ get: () => 20 } as ConfigService),
    );
}

describe('SignalingService', function () {
    describe('onMatched', function () {
        it('emits session.matched with role and iceServers and broadcasts queue positions', async function () {
            const session = baseSession();
            const create = jest.fn().mockResolvedValue(session);
            const setPresenceSessionId = jest.fn().mockResolvedValue(true);
            const getPresence = jest
                .fn()
                .mockResolvedValueOnce({ socketId: 'sock-a', sessionId: SESSION_ID })
                .mockResolvedValueOnce({ socketId: 'sock-b', sessionId: SESSION_ID });
            const joinSession = jest.fn();
            const emitTo = jest.fn<Promise<void>, [string, string, Record<string, unknown>]>().mockResolvedValue(undefined);
            const broadcastQueuePositions = jest.fn().mockResolvedValue(undefined);

            const service = createService({
                sessions: { create },
                redis: { setPresenceSessionId, getPresence },
                transport: { joinSession, emitTo, broadcastQueuePositions },
            });

            await service.onMatched(ID_B, ID_A);

            expect(create).toHaveBeenCalledWith(ID_B, ID_A);
            expect(joinSession).toHaveBeenCalledWith('sock-a', SESSION_ID);
            expect(joinSession).toHaveBeenCalledWith('sock-b', SESSION_ID);
            expect(emitTo).toHaveBeenCalledWith(ID_A, SERVER_EVENTS.sessionMatched, {
                sessionId: SESSION_ID,
                role: 'offerer',
                iceServers: ICE,
            });
            expect(emitTo).toHaveBeenCalledWith(ID_B, SERVER_EVENTS.sessionMatched, {
                sessionId: SESSION_ID,
                role: 'answerer',
                iceServers: ICE,
            });
            const matchedPayload = emitTo.mock.calls.find(call => call[1] === SERVER_EVENTS.sessionMatched)?.[2];
            expect(matchedPayload?.cameraEnabled).toBeUndefined();
            expect(matchedPayload?.micEnabled).toBeUndefined();
            expect(broadcastQueuePositions).toHaveBeenCalled();
        });

        it('ends connect_failed and rejoins when session hash write fails', async function () {
            const session = baseSession();
            const create = jest.fn().mockRejectedValue(new SessionHashWriteError(session, 'redis down'));
            const end = jest.fn().mockResolvedValue(session);
            const join = jest.fn().mockResolvedValue({ type: 'queued', position: 1 });
            const getPresence = jest.fn().mockResolvedValue({ socketId: 's', sessionId: '' });
            const emitTo = jest.fn().mockResolvedValue(undefined);

            const service = createService({
                sessions: { create, end },
                matching: { join },
                redis: { getPresence },
                transport: { emitTo },
            });

            await service.onMatched(ID_A, ID_B);

            expect(end).toHaveBeenCalledWith(SESSION_ID, { endReason: 'connect_failed', endedBy: null });
            expect(join).toHaveBeenCalledWith(ID_A);
            expect(join).toHaveBeenCalledWith(ID_B);
            expect(emitTo).toHaveBeenCalledWith(ID_A, SERVER_EVENTS.queueWaiting, { position: 1 });
        });
    });

    describe('relay', function () {
        it('rejects a non-participant without relaying', async function () {
            const findById = jest.fn().mockResolvedValue(baseSession());
            const relay = jest.fn();
            const emitError = jest.fn();

            const service = createService({
                sessions: { findById },
                transport: { relay, emitError },
            });

            await service.relay('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'sock-x', SERVER_EVENTS.signalOffer, {
                sessionId: SESSION_ID,
                sdp: { type: 'offer', sdp: 'v=0' },
            });

            expect(emitError).toHaveBeenCalledWith('sock-x', ERROR_CODES.notAParticipant);
            expect(relay).not.toHaveBeenCalled();
        });

        it('relays to the session room for a participant', async function () {
            const findById = jest.fn().mockResolvedValue(baseSession());
            const relay = jest.fn();
            const payload = { sessionId: SESSION_ID, sdp: { type: 'offer', sdp: 'v=0' } };

            const service = createService({
                sessions: { findById },
                transport: { relay },
            });

            await service.relay(ID_A, 'sock-a', SERVER_EVENTS.signalOffer, payload);

            expect(relay).toHaveBeenCalledWith(SESSION_ID, SERVER_EVENTS.signalOffer, payload, 'sock-a');
        });
    });

    describe('onMediaConnected', function () {
        it('marks connected and creates the pair block on first success', async function () {
            const session = baseSession();
            const findById = jest.fn().mockResolvedValue(session);
            const markConnected = jest.fn().mockResolvedValue({ ...session, connectedAt: new Date() });
            const setPairBlock = jest.fn().mockResolvedValue(true);

            const service = createService({
                sessions: { findById, markConnected },
                redis: { setPairBlock },
                transport: {},
            });

            await service.onMediaConnected(ID_A, 'sock-a', SESSION_ID);

            expect(markConnected).toHaveBeenCalledWith(SESSION_ID, expect.any(Date));
            expect(setPairBlock).toHaveBeenCalledWith(ID_A, ID_B);
        });

        it('heals pair block when markConnected loses the race but session is connected', async function () {
            const connected = baseSession({ connectedAt: new Date() });
            const findById = jest.fn().mockResolvedValueOnce(baseSession()).mockResolvedValueOnce(connected);
            const markConnected = jest.fn().mockResolvedValue(null);
            const setPairBlock = jest.fn().mockResolvedValue(false);

            const service = createService({
                sessions: { findById, markConnected },
                redis: { setPairBlock },
                transport: {},
            });

            await service.onMediaConnected(ID_A, 'sock-a', SESSION_ID);

            expect(setPairBlock).toHaveBeenCalledWith(ID_A, ID_B);
        });

        it('does not set pair block when session already ended', async function () {
            const ended = baseSession({ endedAt: new Date(), connectedAt: new Date() });
            const findById = jest.fn().mockResolvedValueOnce(baseSession()).mockResolvedValueOnce(ended);
            const markConnected = jest.fn().mockResolvedValue(null);
            const setPairBlock = jest.fn();

            const service = createService({
                sessions: { findById, markConnected },
                redis: { setPairBlock },
                transport: {},
            });

            await service.onMediaConnected(ID_A, 'sock-a', SESSION_ID);

            expect(setPairBlock).not.toHaveBeenCalled();
        });
    });

    describe('onMediaFailed', function () {
        it('ends connect_failed and rejoins when still connecting', async function () {
            const session = baseSession();
            const findById = jest.fn().mockResolvedValue(session);
            const end = jest.fn().mockResolvedValue(session);
            const join = jest.fn().mockResolvedValue({ type: 'queued', position: 1 });
            const getPresence = jest.fn().mockResolvedValue({ socketId: 's', sessionId: '' });
            const emitTo = jest.fn().mockResolvedValue(undefined);
            const leaveSession = jest.fn();
            const setPairBlock = jest.fn();

            const service = createService({
                sessions: { findById, end },
                matching: { join },
                redis: { getPresence, setPairBlock },
                transport: { emitTo, leaveSession },
            });

            await service.onMediaFailed(ID_A, 'sock-a', SESSION_ID);

            expect(end).toHaveBeenCalledWith(SESSION_ID, { endReason: 'connect_failed', endedBy: null });
            expect(emitTo).toHaveBeenCalledWith(ID_A, SERVER_EVENTS.sessionEnded, { sessionId: SESSION_ID, reason: 'connect_failed', next: 'waiting' });
            expect(leaveSession).toHaveBeenCalledWith(SESSION_ID);
            expect(setPairBlock).not.toHaveBeenCalled();
        });

        it('ignores media.failed after connectedAt is set', async function () {
            const session = baseSession({ connectedAt: new Date() });
            const findById = jest.fn().mockResolvedValue(session);
            const end = jest.fn();

            const service = createService({
                sessions: { findById, end },
                transport: {},
            });

            await service.onMediaFailed(ID_A, 'sock-a', SESSION_ID);

            expect(end).not.toHaveBeenCalled();
        });
    });

    describe('sweep', function () {
        it('returns immediately when the sweeper lock is not acquired', async function () {
            const acquireSweeperLock = jest.fn().mockResolvedValue(false);
            const listQueue = jest.fn();

            const service = createService({
                redis: { acquireSweeperLock },
                matching: { listWaiting: listQueue },
            });

            await service.sweep();

            expect(listQueue).not.toHaveBeenCalled();
        });

        it('ends disconnect and rejoins only the participant with presence', async function () {
            const session = baseSession({ endReason: 'disconnect', endedBy: ID_A });
            const acquireSweeperLock = jest.fn().mockResolvedValue(true);
            const listWaiting = jest.fn().mockResolvedValue([]);
            const getPresence = jest.fn((id: string): Promise<IPresence | null> => {
                if (id === ID_A) return Promise.resolve(null);
                return Promise.resolve({ socketId: 'sock-b', sessionId: SESSION_ID });
            });
            const findOpen = jest.fn().mockResolvedValue([session]);
            const end = jest.fn().mockResolvedValue(session);
            const join = jest.fn().mockResolvedValue({ type: 'queued', position: 1 });
            const emitTo = jest.fn().mockResolvedValue(undefined);

            const service = createService({
                sessions: { findOpen, end },
                matching: { join, listWaiting },
                redis: { acquireSweeperLock, getPresence },
                transport: { emitTo, broadcastQueuePositions: jest.fn() },
            });

            await service.sweep();

            expect(end).toHaveBeenCalledWith(SESSION_ID, { endReason: 'disconnect', endedBy: ID_A });
            expect(emitTo).toHaveBeenCalledWith(ID_B, SERVER_EVENTS.sessionEnded, { sessionId: SESSION_ID, reason: 'disconnect', next: 'waiting' });
            expect(join).toHaveBeenCalledTimes(1);
            expect(join).toHaveBeenCalledWith(ID_B);
        });

        it('ends connect_failed on timeout and rejoins present participants', async function () {
            const session = baseSession({ matchedAt: new Date('2020-01-01T00:00:00.000Z'), endReason: 'connect_failed', endedBy: null });
            const acquireSweeperLock = jest.fn().mockResolvedValue(true);
            const listWaiting = jest.fn().mockResolvedValue([]);
            const getPresence = jest.fn((id: string): Promise<IPresence | null> =>
                Promise.resolve({ socketId: id === ID_A ? 'sa' : 'sb', sessionId: SESSION_ID }),
            );
            const findOpen = jest.fn().mockResolvedValue([session]);
            const end = jest.fn().mockResolvedValue(session);
            const join = jest.fn().mockResolvedValue({ type: 'queued', position: 1 });
            const setPairBlock = jest.fn();
            const emitTo = jest.fn().mockResolvedValue(undefined);
            const config = { get: (key: string) => (key === ENVS.CONNECT_TIMEOUT_SECONDS ? 20 : undefined) } as ConfigService;

            const service = createService({
                sessions: { findOpen, end },
                matching: { join, listWaiting },
                redis: { acquireSweeperLock, getPresence, setPairBlock },
                transport: { emitTo, broadcastQueuePositions: jest.fn() },
                config,
            });

            await service.sweep();

            expect(end).toHaveBeenCalledWith(SESSION_ID, { endReason: 'connect_failed', endedBy: null });
            expect(emitTo).toHaveBeenCalledWith(ID_A, SERVER_EVENTS.sessionEnded, expect.objectContaining({ next: 'waiting' }));
            expect(join).toHaveBeenCalledWith(ID_A);
            expect(join).toHaveBeenCalledWith(ID_B);
            expect(setPairBlock).not.toHaveBeenCalled();
        });
    });

    describe('onSessionEnd', function () {
        it('sends rating to the ender and rejoins only the partner', async function () {
            const session = baseSession({ endReason: 'user_end', endedBy: ID_A });
            const findById = jest.fn().mockResolvedValue(session);
            const end = jest.fn().mockResolvedValue(session);
            const join = jest.fn().mockResolvedValue({ type: 'queued', position: 2 });
            const getPresence = jest.fn((id: string): Promise<IPresence | null> =>
                Promise.resolve({ socketId: id === ID_A ? 'sock-a' : 'sock-b', sessionId: SESSION_ID }),
            );
            const emitTo = jest.fn().mockResolvedValue(undefined);
            const setPairBlock = jest.fn();

            const service = createService({
                sessions: { findById, end },
                matching: { join },
                redis: { getPresence, setPairBlock },
                transport: { emitTo },
            });

            await service.onSessionEnd(ID_A, 'sock-a', SESSION_ID);

            expect(setPairBlock).not.toHaveBeenCalled();
            expect(emitTo).toHaveBeenNthCalledWith(1, ID_A, SERVER_EVENTS.sessionEnded, { sessionId: SESSION_ID, reason: 'user_end', next: 'rating' });
            expect(emitTo).toHaveBeenNthCalledWith(2, ID_B, SERVER_EVENTS.sessionEnded, { sessionId: SESSION_ID, reason: 'user_end', next: 'waiting' });
            expect(join).toHaveBeenCalledTimes(1);
            expect(join).toHaveBeenCalledWith(ID_B);
        });

        it('does nothing when end loses the race', async function () {
            const session = baseSession();
            const findById = jest.fn().mockResolvedValue(session);
            const end = jest.fn().mockResolvedValue(null);
            const join = jest.fn();
            const emitTo = jest.fn();

            const service = createService({
                sessions: { findById, end },
                matching: { join },
                transport: { emitTo },
            });

            await service.onSessionEnd(ID_A, 'sock-a', SESSION_ID);

            expect(emitTo).not.toHaveBeenCalled();
            expect(join).not.toHaveBeenCalled();
        });
    });

    describe('onSessionNext', function () {
        it('rejoins both participants after change partner', async function () {
            const session = baseSession({ endReason: 'change_partner', endedBy: ID_A });
            const findById = jest.fn().mockResolvedValue(session);
            const end = jest.fn().mockResolvedValue(session);
            const join = jest.fn().mockResolvedValue({ type: 'queued', position: 1 });
            const getPresence = jest.fn((id: string): Promise<IPresence | null> =>
                Promise.resolve({ socketId: id === ID_A ? 'sa' : 'sb', sessionId: SESSION_ID }),
            );
            const emitTo = jest.fn().mockResolvedValue(undefined);

            const service = createService({
                sessions: { findById, end },
                matching: { join },
                redis: { getPresence },
                transport: { emitTo },
            });

            await service.onSessionNext(ID_A, 'sock-a', SESSION_ID);

            expect(join).toHaveBeenCalledWith(ID_A);
            expect(join).toHaveBeenCalledWith(ID_B);
            expect(emitTo).toHaveBeenCalledWith(ID_A, SERVER_EVENTS.sessionEnded, expect.objectContaining({ reason: 'change_partner', next: 'waiting' }));
        });
    });

    describe('onDisconnect', function () {
        it('does not rejoin the disconnected client', async function () {
            const session = baseSession({ endReason: 'disconnect', endedBy: ID_A });
            const end = jest.fn().mockResolvedValue(session);
            const join = jest.fn().mockResolvedValue({ type: 'queued', position: 1 });
            const getPresence = jest.fn((id: string): Promise<IPresence | null> =>
                Promise.resolve(id === ID_B ? { socketId: 'sock-b', sessionId: SESSION_ID } : null),
            );
            const emitTo = jest.fn().mockResolvedValue(undefined);

            const service = createService({
                sessions: { end },
                matching: { join },
                redis: { getPresence },
                transport: { emitTo },
            });

            await service.onDisconnect(SESSION_ID, ID_A);

            expect(join).toHaveBeenCalledTimes(1);
            expect(join).toHaveBeenCalledWith(ID_B);
            expect(emitTo).not.toHaveBeenCalledWith(ID_A, expect.anything(), expect.anything());
        });
    });
});
