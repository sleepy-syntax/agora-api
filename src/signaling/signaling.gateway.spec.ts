import { RedisService } from '../redis/redis.service';
import { MatchingService } from '../matching/matching.service';
import { SignalingService } from './signaling.service';
import { SignalingGateway } from './signaling.gateway';
import { SignalingTransport } from './signaling-transport';
import { ERROR_CODES, SERVER_EVENTS } from './events';
import type { TSignalingServer, TSignalingSocket } from './socket-data';

type THandshakeMiddleware = (socket: TSignalingSocket, next: (err?: Error) => void) => void;

const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION_ID = '0b1c2d3e-1111-4222-8333-444455556666';

function createMockSocket(overrides: Partial<TSignalingSocket> = {}) {
    const emit = jest.fn();
    const socket = {
        id: 'socket-new',
        data: { userId: ID_A },
        handshake: { auth: { userId: ID_A }, address: '127.0.0.1' },
        emit,
        ...overrides,
    } as TSignalingSocket;
    return { socket, emit };
}

function createGateway(deps: {
    redis?: Partial<RedisService>;
    matching?: Partial<MatchingService>;
    signaling?: Partial<SignalingService>;
    server?: Record<string, unknown>;
}) {
    const redis = (deps.redis ?? {}) as RedisService;
    const matching = (deps.matching ?? {}) as MatchingService;
    const transport = new SignalingTransport(redis, matching);
    const onMatched = jest.fn();
    const gatewaySignaling =
        (deps.signaling as SignalingService) ??
        ({
            onMatched,
            onDisconnect: jest.fn().mockResolvedValue(undefined),
            onSessionEnd: jest.fn(),
            onSessionNext: jest.fn(),
            relay: jest.fn(),
            onMediaConnected: jest.fn(),
            onMediaFailed: jest.fn(),
        } as unknown as SignalingService);

    const gateway = new SignalingGateway(redis, matching, gatewaySignaling, transport);
    const disconnectSockets = jest.fn();
    const toEmit = jest.fn();
    const inJoin = jest.fn().mockReturnValue({ socketsJoin: jest.fn() });
    const server = {
        use: jest.fn(),
        in: jest.fn().mockReturnValue({ disconnectSockets, socketsJoin: jest.fn() }),
        to: jest.fn().mockReturnValue({ emit: toEmit }),
        ...deps.server,
    } as unknown as TSignalingServer;
    gateway.afterInit(server);
    gateway['server'] = server;
    return { gateway, server, disconnectSockets, toEmit, inJoin, signaling: gatewaySignaling, onMatched };
}

describe('SignalingGateway', function () {
    describe('afterInit middleware', function () {
        it('rejects an invalid handshake user id', function () {
            const { gateway, server } = createGateway({});
            const use = jest.fn<void, [THandshakeMiddleware]>();
            (server as { use: typeof use }).use = use;

            gateway.afterInit(server);

            const middleware = use.mock.calls[0][0];
            const next = jest.fn();
            middleware({ handshake: { auth: {} } } as TSignalingSocket, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: ERROR_CODES.invalidUserId }));
        });

        it('accepts a valid user id on the socket', function () {
            const { gateway, server } = createGateway({});
            const use = jest.fn<void, [THandshakeMiddleware]>();
            (server as { use: typeof use }).use = use;

            gateway.afterInit(server);

            const middleware = use.mock.calls[0][0];
            const socket = { handshake: { auth: { userId: ID_A } }, data: { userId: '' } } as TSignalingSocket;
            const next = jest.fn();
            middleware(socket, next);

            expect(socket.data.userId).toBe(ID_A);
            expect(next).toHaveBeenCalledWith();
        });
    });

    describe('handleConnection', function () {
        it('disconnects the previous socket and ends an open session from the new connection', async function () {
            const onDisconnect = jest.fn().mockResolvedValue(undefined);
            const setPresence = jest.fn().mockResolvedValue(undefined);
            const getPresence = jest.fn().mockResolvedValue({ socketId: 'socket-old', sessionId: SESSION_ID });

            const { gateway, disconnectSockets } = createGateway({
                redis: { getPresence, setPresence },
                signaling: { onDisconnect },
            });

            await gateway.handleConnection(createMockSocket({ id: 'socket-new' }).socket);

            expect(setPresence).toHaveBeenCalledWith(ID_A, 'socket-new', '');
            expect(disconnectSockets).toHaveBeenCalledWith(true);
            expect(onDisconnect).toHaveBeenCalledWith(SESSION_ID, ID_A);
        });
    });

    describe('handleDisconnect', function () {
        it('does nothing when deletePresenceIfSocket returns 0', async function () {
            const removeFromQueue = jest.fn();
            const onDisconnect = jest.fn();
            const { gateway } = createGateway({
                redis: {
                    getPresence: jest.fn().mockResolvedValue({ socketId: 'socket-new', sessionId: '' }),
                    deletePresenceIfSocket: jest.fn().mockResolvedValue(0),
                    removeFromQueue,
                },
                signaling: { onDisconnect },
            });

            await gateway.handleDisconnect(createMockSocket().socket);

            expect(removeFromQueue).not.toHaveBeenCalled();
            expect(onDisconnect).not.toHaveBeenCalled();
        });

        it('removes from queue and ends session when presence is deleted', async function () {
            const removeFromQueue = jest.fn().mockResolvedValue(undefined);
            const onDisconnect = jest.fn().mockResolvedValue(undefined);
            const { gateway } = createGateway({
                redis: {
                    getPresence: jest.fn().mockResolvedValue({ socketId: 'socket-new', sessionId: SESSION_ID }),
                    deletePresenceIfSocket: jest.fn().mockResolvedValue(1),
                    removeFromQueue,
                },
                signaling: { onDisconnect },
            });

            await gateway.handleDisconnect(createMockSocket().socket);

            expect(removeFromQueue).toHaveBeenCalledWith(ID_A);
            expect(onDisconnect).toHaveBeenCalledWith(SESSION_ID, ID_A);
        });
    });

    describe('onQueueJoin', function () {
        let refreshPresence: jest.Mock;
        let rateLimit: jest.Mock;
        let join: jest.Mock;

        beforeEach(function () {
            refreshPresence = jest.fn().mockResolvedValue(true);
            rateLimit = jest.fn().mockResolvedValue(true);
            join = jest.fn();
        });

        it('emits invalid_payload and skips join for malformed body', async function () {
            join.mockResolvedValue({ type: 'queued', position: 1 });
            const { gateway } = createGateway({
                redis: { refreshPresence, rateLimit },
                matching: { join },
            });
            const { socket, emit } = createMockSocket();

            await gateway.onQueueJoin(socket, { extra: true });

            expect(emit).toHaveBeenCalledWith(SERVER_EVENTS.error, expect.objectContaining({ code: ERROR_CODES.invalidPayload }));
            expect(join).not.toHaveBeenCalled();
        });

        it('emits rate_limited when limits are exceeded', async function () {
            rateLimit.mockResolvedValueOnce(false);
            const { gateway } = createGateway({
                redis: { refreshPresence, rateLimit },
                matching: { join },
            });
            const { socket, emit } = createMockSocket();

            await gateway.onQueueJoin(socket, {});

            expect(emit).toHaveBeenCalledWith(SERVER_EVENTS.error, expect.objectContaining({ code: ERROR_CODES.rateLimited }));
            expect(join).not.toHaveBeenCalled();
        });

        it('emits queue.waiting when queued', async function () {
            join.mockResolvedValue({ type: 'queued', position: 3 });
            const { gateway } = createGateway({
                redis: { refreshPresence, rateLimit },
                matching: { join },
            });
            const { socket, emit } = createMockSocket();

            await gateway.onQueueJoin(socket, {});

            expect(emit).toHaveBeenCalledWith(SERVER_EVENTS.queueWaiting, { position: 3 });
        });

        it('calls onMatched without emitting session.matched from the gateway', async function () {
            join.mockResolvedValue({ type: 'matched', partnerId: ID_B });
            const { gateway, onMatched } = createGateway({
                redis: { refreshPresence, rateLimit },
                matching: { join },
            });
            const { socket, emit } = createMockSocket();

            await gateway.onQueueJoin(socket, {});

            expect(onMatched).toHaveBeenCalledWith(ID_A, ID_B);
            expect(emit).not.toHaveBeenCalledWith(SERVER_EVENTS.sessionMatched, expect.anything());
        });
    });

    describe('onSignalOffer', function () {
        it('emits invalid_payload and skips relay for malformed body', async function () {
            const relay = jest.fn();
            const { gateway } = createGateway({
                redis: { refreshPresence: jest.fn() },
                signaling: { relay },
            });
            const { socket, emit } = createMockSocket();

            await gateway.onSignalOffer(socket, { sessionId: 'not-a-uuid' });

            expect(emit).toHaveBeenCalledWith(SERVER_EVENTS.error, expect.objectContaining({ code: ERROR_CODES.invalidPayload }));
            expect(relay).not.toHaveBeenCalled();
        });
    });

    describe('onSessionEnd', function () {
        it('emits invalid_payload and skips service for malformed body', async function () {
            const onSessionEnd = jest.fn();
            const { gateway } = createGateway({
                redis: { refreshPresence: jest.fn() },
                signaling: { onSessionEnd },
            });
            const { socket, emit } = createMockSocket();

            await gateway.onSessionEnd(socket, { sessionId: 'not-a-uuid' });

            expect(emit).toHaveBeenCalledWith(SERVER_EVENTS.error, expect.objectContaining({ code: ERROR_CODES.invalidPayload }));
            expect(onSessionEnd).not.toHaveBeenCalled();
        });
    });

    describe('onApplicationShutdown', function () {
        it('ends each local open session once', async function () {
            const onDisconnect = jest.fn().mockResolvedValue(undefined);
            const deletePresenceIfSocket = jest.fn().mockResolvedValue(1);
            const removeFromQueue = jest.fn().mockResolvedValue(undefined);
            const getPresence = jest.fn().mockResolvedValue({ socketId: 'socket-new', sessionId: SESSION_ID });

            const localSocket = createMockSocket({ id: 'socket-new' }).socket;
            const sockets = new Map([['socket-new', localSocket]]);

            const { gateway } = createGateway({
                redis: { getPresence, deletePresenceIfSocket, removeFromQueue },
                signaling: { onDisconnect },
                server: { sockets: { sockets } },
            });

            await gateway.onApplicationShutdown();

            expect(deletePresenceIfSocket).toHaveBeenCalledWith(ID_A, 'socket-new');
            expect(removeFromQueue).toHaveBeenCalledWith(ID_A);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
            expect(onDisconnect).toHaveBeenCalledWith(SESSION_ID, ID_A);
        });
    });

    describe('onQueueLeave', function () {
        it('emits queue.left and broadcasts positions', async function () {
            const leave = jest.fn().mockResolvedValue({ type: 'left' });
            const listWaiting = jest.fn().mockResolvedValue([ID_A, ID_B]);
            const getPresence = jest.fn().mockResolvedValueOnce({ socketId: 's1', sessionId: '' }).mockResolvedValueOnce({ socketId: 's2', sessionId: '' });
            const { gateway, toEmit } = createGateway({
                redis: { refreshPresence: jest.fn(), getPresence },
                matching: { leave, listWaiting },
            });
            const { socket, emit } = createMockSocket();

            await gateway.onQueueLeave(socket, {});

            expect(emit).toHaveBeenCalledWith(SERVER_EVENTS.queueLeft, {});
            expect(toEmit).toHaveBeenCalledWith(SERVER_EVENTS.queueWaiting, { position: 1 });
            expect(toEmit).toHaveBeenCalledWith(SERVER_EVENTS.queueWaiting, { position: 2 });
        });
    });
});
