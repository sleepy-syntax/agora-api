import { RedisService } from '../redis/redis.service';
import { ISession } from './session.schema';
import { SessionService } from './session.service';

const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

type TCreatePayload = {
    _id: string;
    participants: [string, string];
    offererId: string;
    matchedAt: Date;
    connectedAt: null;
    endedAt: null;
    endReason: null;
    endedBy: null;
    durationMs: null;
};

function chainLean<T>(value: T) {
    return { lean: () => ({ exec: () => Promise.resolve(value) }) };
}

function createService(model: Record<string, jest.Mock>, redis: Partial<RedisService>) {
    return new SessionService(model as never, redis as RedisService);
}

describe('SessionService', function () {
    let setSessionHash: jest.Mock;
    let setSessionHashFields: jest.Mock;
    let deleteSessionHash: jest.Mock;
    let setPairBlock: jest.Mock;
    let create: jest.MockedFunction<(payload: TCreatePayload) => Promise<{ toObject: () => ISession }>>;
    let findOneAndUpdate: jest.MockedFunction<(filter: unknown, update: unknown, options: unknown) => { lean: () => { exec: () => Promise<unknown> } }>;

    beforeEach(function () {
        setSessionHash = jest.fn().mockResolvedValue(undefined);
        setSessionHashFields = jest.fn().mockResolvedValue(undefined);
        deleteSessionHash = jest.fn().mockResolvedValue(undefined);
        setPairBlock = jest.fn();
        create = jest.fn();
        findOneAndUpdate = jest.fn() as typeof findOneAndUpdate;
    });

    describe('create', function () {
        it('sorts participants and sets offererId to the smaller id', async function () {
            create.mockImplementation((payload: TCreatePayload) =>
                Promise.resolve({
                    toObject: (): ISession => payload,
                }),
            );

            const service = createService({ create, findOneAndUpdate }, { setSessionHash, setSessionHashFields, deleteSessionHash, setPairBlock });

            await service.create(ID_A, ID_B);

            const insert = create.mock.calls[0][0];
            const sessionId = insert._id;

            expect(create).toHaveBeenCalledWith({
                _id: sessionId,
                participants: [ID_A, ID_B],
                offererId: ID_A,
                matchedAt: insert.matchedAt,
                connectedAt: null,
                endedAt: null,
                endReason: null,
                endedBy: null,
                durationMs: null,
            });

            expect(setSessionHash).toHaveBeenCalledWith(sessionId, {
                participantLow: ID_A,
                participantHigh: ID_B,
                offererId: ID_A,
                matchedAt: insert.matchedAt.toISOString(),
                connectedAt: '',
                endedAt: '',
                endReason: '',
                endedBy: '',
            });

            const extraFields = insert as Record<string, unknown>;
            expect(extraFields.status).toBeUndefined();
            expect(extraFields.cameraEnabled).toBeUndefined();
            expect(extraFields.micEnabled).toBeUndefined();
            expect(setPairBlock).not.toHaveBeenCalled();
        });

        it('propagates a Redis hash failure without ending the session', async function () {
            create.mockResolvedValue({ toObject: () => ({ _id: 'session-id' }) });
            setSessionHash.mockRejectedValue(new Error('redis down'));

            const end = jest.fn();
            const service = createService({ create, findOneAndUpdate, end }, { setSessionHash, setSessionHashFields, deleteSessionHash, setPairBlock });

            await expect(service.create(ID_A, ID_B)).rejects.toThrow('redis down');
            expect(end).not.toHaveBeenCalled();
        });
    });

    describe('markConnected', function () {
        it('updates only when connectedAt and endedAt are still null', async function () {
            const sessionId = '0b1c2d3e-1111-4222-8333-444455556666';
            const at = new Date('2026-01-02T00:00:00.000Z');
            const updated = { _id: sessionId, connectedAt: at } as ISession;
            findOneAndUpdate.mockReturnValue(chainLean(updated));

            const service = createService({ create, findOneAndUpdate }, { setSessionHash, setSessionHashFields, deleteSessionHash, setPairBlock });

            await expect(service.markConnected(sessionId, at)).resolves.toEqual(updated);

            expect(findOneAndUpdate).toHaveBeenCalledWith({ _id: sessionId, connectedAt: null, endedAt: null }, { $set: { connectedAt: at } }, { new: true });
            expect(setSessionHashFields).toHaveBeenCalledWith(sessionId, { connectedAt: at.toISOString() });
            expect(setPairBlock).not.toHaveBeenCalled();
        });

        it('returns null without touching Redis when the filter misses', async function () {
            findOneAndUpdate.mockReturnValue(chainLean(null));

            const service = createService({ create, findOneAndUpdate }, { setSessionHash, setSessionHashFields, deleteSessionHash, setPairBlock });

            await expect(service.markConnected('0b1c2d3e-1111-4222-8333-444455556666', new Date())).resolves.toBeNull();
            expect(setSessionHashFields).not.toHaveBeenCalled();
        });
    });

    describe('end', function () {
        it('uses an endedAt-null filter and deletes the session hash on success', async function () {
            const sessionId = '0b1c2d3e-1111-4222-8333-444455556666';
            const ended = {
                _id: sessionId,
                connectedAt: null,
                endedAt: new Date(),
                durationMs: 0,
            } as ISession;
            findOneAndUpdate.mockReturnValue(chainLean(ended));

            const service = createService({ create, findOneAndUpdate }, { setSessionHash, setSessionHashFields, deleteSessionHash, setPairBlock });

            await expect(service.end(sessionId, { endReason: 'connect_failed', endedBy: null })).resolves.toEqual(ended);

            expect(findOneAndUpdate).toHaveBeenCalledWith({ _id: sessionId, endedAt: null }, expect.any(Array), { new: true });

            const pipeline = findOneAndUpdate.mock.calls[0][1] as Record<string, unknown>[];
            const setStage = pipeline?.[0]?.$set as Record<string, unknown> | undefined;
            expect(setStage?.endReason).toBe('connect_failed');
            expect(setStage?.endedBy).toBeNull();
            const durationMs = setStage?.durationMs as {
                $cond: { if: unknown; then: { $subtract: unknown[] }; else: number };
            };
            expect(durationMs.$cond.if).toEqual({ $ne: ['$connectedAt', null] });
            expect(durationMs.$cond.else).toBe(0);
            expect(durationMs.$cond.then.$subtract).toHaveLength(2);

            expect(deleteSessionHash).toHaveBeenCalledWith(sessionId);
            expect(setPairBlock).not.toHaveBeenCalled();
        });

        it('returns null without deleting the hash when the session is already over', async function () {
            findOneAndUpdate.mockReturnValue(chainLean(null));

            const service = createService({ create, findOneAndUpdate }, { setSessionHash, setSessionHashFields, deleteSessionHash, setPairBlock });

            await expect(service.end('0b1c2d3e-1111-4222-8333-444455556666', { endReason: 'user_end', endedBy: ID_A })).resolves.toBeNull();
            expect(deleteSessionHash).not.toHaveBeenCalled();
        });

        it('lets only the first concurrent end delete the hash', async function () {
            const sessionId = '0b1c2d3e-1111-4222-8333-444455556666';
            const ended = { _id: sessionId, durationMs: 5000 } as ISession;
            findOneAndUpdate.mockReturnValueOnce(chainLean(ended)).mockReturnValueOnce(chainLean(null));

            const service = createService({ create, findOneAndUpdate }, { setSessionHash, setSessionHashFields, deleteSessionHash, setPairBlock });

            await expect(service.end(sessionId, { endReason: 'user_end', endedBy: ID_A })).resolves.toEqual(ended);
            await expect(service.end(sessionId, { endReason: 'user_end', endedBy: ID_A })).resolves.toBeNull();

            expect(deleteSessionHash).toHaveBeenCalledTimes(1);
        });
    });
});
