import { ConfigService } from '@nestjs/config';
import { ENVS } from '../constants/variables';
import { PAIR_KEY_PREFIX, PRESENCE_KEY_PREFIX, pairKey, presenceKey, queueKey } from './keys';
import { DELETE_PRESENCE_IF_SOCKET_SCRIPT } from './presence.script';
import { QUEUE_MATCH_SCRIPT } from './queue.script';
import { RedisService } from './redis.service';

function createService(client: Record<string, jest.Mock>) {
    const configService = {
        get: jest.fn((key: string) => {
            if (key === ENVS.REDIS_HOST) return 'localhost';
            if (key === ENVS.REDIS_PORT) return 6379;
            if (key === ENVS.REDIS_PASSWORD) return 'secret';
            if (key === ENVS.PAIR_BLOCK_TTL_SECONDS) return 3600;
            if (key === ENVS.PRESENCE_TTL_SECONDS) return 15;
            if (key === ENVS.STATS_CACHE_TTL_SECONDS) return 10;
            return undefined;
        }),
    } as unknown as ConfigService;

    const service = new RedisService(configService);
    (service as unknown as { redis: Record<string, jest.Mock> }).redis = client as never;
    return service;
}

describe('RedisService coordination', function () {
    it('setPairBlock uses SET NX EX and does not extend an existing block', async function () {
        const set = jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
        const expire = jest.fn();
        const service = createService({ set, expire });

        const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

        await expect(service.setPairBlock(a, b)).resolves.toBe(true);
        await expect(service.setPairBlock(a, b)).resolves.toBe(false);

        expect(set).toHaveBeenNthCalledWith(1, pairKey(a, b), '1', 'EX', 3600, 'NX');
        expect(set).toHaveBeenNthCalledWith(2, pairKey(a, b), '1', 'EX', 3600, 'NX');
        expect(expire).not.toHaveBeenCalled();
    });

    it('deletePresenceIfSocket evaluates the compare-and-delete script', async function () {
        const evalMock = jest.fn().mockResolvedValue(1);
        const service = createService({ eval: evalMock });
        const clientId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

        await expect(service.deletePresenceIfSocket(clientId, 'socket-old')).resolves.toBe(1);

        expect(evalMock).toHaveBeenCalledWith(DELETE_PRESENCE_IF_SOCKET_SCRIPT, 1, presenceKey(clientId), 'socket-old');
    });

    it('refreshPresence only expires an existing key', async function () {
        const expire = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
        const service = createService({ expire });
        const clientId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

        await expect(service.refreshPresence(clientId)).resolves.toBe(true);
        await expect(service.refreshPresence(clientId)).resolves.toBe(false);

        expect(expire).toHaveBeenCalledWith(presenceKey(clientId), 15);
    });

    it('joinQueue passes queue and prefix arguments to the match script', async function () {
        const evalMock = jest.fn().mockResolvedValue(['QUEUED', '1']);
        const service = createService({ eval: evalMock });
        const userId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

        await expect(service.joinQueue(userId)).resolves.toEqual({ kind: 'queued', position: 1 });

        expect(evalMock).toHaveBeenCalledWith(QUEUE_MATCH_SCRIPT, 1, queueKey(), userId, PAIR_KEY_PREFIX, PRESENCE_KEY_PREFIX);
    });
});
