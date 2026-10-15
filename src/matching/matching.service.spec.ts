import { RedisService } from '../redis/redis.service';
import { SessionService } from '../sessions/session.service';
import { MatchingService } from './matching.service';

const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION_ID = '0b1c2d3e-1111-4222-8333-444455556666';

function createService(redis: Partial<RedisService>, sessions: Partial<SessionService>) {
    return new MatchingService(redis as RedisService, sessions as SessionService);
}

describe('MatchingService', function () {
    let joinQueue: jest.Mock;
    let removeFromQueue: jest.Mock;
    let listQueue: jest.Mock;
    let getPresence: jest.Mock;
    let setPairBlock: jest.Mock;
    let findById: jest.Mock;
    let create: jest.Mock;

    beforeEach(function () {
        joinQueue = jest.fn();
        removeFromQueue = jest.fn().mockResolvedValue(undefined);
        listQueue = jest.fn().mockResolvedValue([]);
        getPresence = jest.fn().mockResolvedValue(null);
        setPairBlock = jest.fn();
        findById = jest.fn();
        create = jest.fn();
    });

    describe('join', function () {
        it('maps a queued joinQueue result', async function () {
            joinQueue.mockResolvedValue({ kind: 'queued', position: 2 });

            const service = createService({ joinQueue, getPresence, setPairBlock }, { findById, create });

            await expect(service.join(ID_A)).resolves.toEqual({ type: 'queued', position: 2 });
            expect(joinQueue).toHaveBeenCalledWith(ID_A);
            expect(setPairBlock).not.toHaveBeenCalled();
            expect(create).not.toHaveBeenCalled();
        });

        it('maps a matched joinQueue result', async function () {
            joinQueue.mockResolvedValue({ kind: 'matched', partnerId: ID_B });

            const service = createService({ joinQueue, getPresence, setPairBlock }, { findById, create });

            await expect(service.join(ID_A)).resolves.toEqual({ type: 'matched', partnerId: ID_B });
            expect(setPairBlock).not.toHaveBeenCalled();
            expect(create).not.toHaveBeenCalled();
        });

        it('rejects when presence points at an open session without calling joinQueue', async function () {
            getPresence.mockResolvedValue({ socketId: 'sock-1', sessionId: SESSION_ID });
            findById.mockResolvedValue({ _id: SESSION_ID, endedAt: null });

            const service = createService({ joinQueue, getPresence, setPairBlock }, { findById, create });

            await expect(service.join(ID_A)).resolves.toEqual({ type: 'rejected', code: 'already_in_session' });
            expect(joinQueue).not.toHaveBeenCalled();
            expect(setPairBlock).not.toHaveBeenCalled();
        });

        it('allows join when the session document is already ended', async function () {
            getPresence.mockResolvedValue({ socketId: 'sock-1', sessionId: SESSION_ID });
            findById.mockResolvedValue({ _id: SESSION_ID, endedAt: new Date() });
            joinQueue.mockResolvedValue({ kind: 'queued', position: 1 });

            const service = createService({ joinQueue, getPresence, setPairBlock }, { findById, create });

            await expect(service.join(ID_A)).resolves.toEqual({ type: 'queued', position: 1 });
            expect(joinQueue).toHaveBeenCalledWith(ID_A);
        });

        it('allows join when the session document is missing', async function () {
            getPresence.mockResolvedValue({ socketId: 'sock-1', sessionId: SESSION_ID });
            findById.mockResolvedValue(null);
            joinQueue.mockResolvedValue({ kind: 'queued', position: 1 });

            const service = createService({ joinQueue, getPresence, setPairBlock }, { findById, create });

            await expect(service.join(ID_A)).resolves.toEqual({ type: 'queued', position: 1 });
            expect(joinQueue).toHaveBeenCalledWith(ID_A);
        });
    });

    describe('leave', function () {
        it('rejects when in an open session without removing from the queue', async function () {
            getPresence.mockResolvedValue({ socketId: 'sock-1', sessionId: SESSION_ID });
            findById.mockResolvedValue({ _id: SESSION_ID, endedAt: null });

            const service = createService({ removeFromQueue, getPresence }, { findById });

            await expect(service.leave(ID_A)).resolves.toEqual({ type: 'rejected', code: 'not_in_queue' });
            expect(removeFromQueue).not.toHaveBeenCalled();
        });

        it('removes from the queue and returns left when not in a session', async function () {
            const service = createService({ removeFromQueue, getPresence }, { findById });

            await expect(service.leave(ID_A)).resolves.toEqual({ type: 'left' });
            expect(removeFromQueue).toHaveBeenCalledWith(ID_A);
        });

        it('returns left when session id on presence is stale', async function () {
            getPresence.mockResolvedValue({ socketId: 'sock-1', sessionId: SESSION_ID });
            findById.mockResolvedValue({ _id: SESSION_ID, endedAt: new Date() });

            const service = createService({ removeFromQueue, getPresence }, { findById });

            await expect(service.leave(ID_A)).resolves.toEqual({ type: 'left' });
            expect(removeFromQueue).toHaveBeenCalledWith(ID_A);
        });
    });

    describe('positionOf', function () {
        it('returns a 1-based index from listWaiting order', async function () {
            listQueue.mockResolvedValue([ID_B, ID_A, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc']);

            const service = createService({ listQueue }, {});

            await expect(service.positionOf(ID_A)).resolves.toBe(2);
        });

        it('returns null when the id is not in the list', async function () {
            listQueue.mockResolvedValue([ID_B]);

            const service = createService({ listQueue }, {});

            await expect(service.positionOf(ID_A)).resolves.toBeNull();
        });
    });

    describe('listWaiting', function () {
        it('delegates to listQueue', async function () {
            listQueue.mockResolvedValue([ID_A, ID_B]);

            const service = createService({ listQueue }, {});

            await expect(service.listWaiting()).resolves.toEqual([ID_A, ID_B]);
        });
    });
});
