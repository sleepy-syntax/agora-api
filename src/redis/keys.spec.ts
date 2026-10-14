import { PAIR_KEY_PREFIX, PRESENCE_KEY_PREFIX, pairKey, presenceKey, queueKey, rateKey, sessionKey, statsKey, sweeperLockKey } from './keys';

describe('redis keys', function () {
    it('builds queue and stats keys', function () {
        expect(queueKey()).toBe('agora:queue');
        expect(statsKey()).toBe('agora:stats:public');
        expect(sweeperLockKey()).toBe('agora:lock:sweeper');
    });

    it('builds presence keys with the shared prefix', function () {
        expect(PRESENCE_KEY_PREFIX).toBe('agora:presence:');
        expect(presenceKey('7c9e6679-7425-40de-944b-e07fc1f90ae7')).toBe('agora:presence:7c9e6679-7425-40de-944b-e07fc1f90ae7');
    });

    it('orders pair keys lexicographically', function () {
        expect(PAIR_KEY_PREFIX).toBe('agora:pair:');
        expect(pairKey('b', 'a')).toBe('agora:pair:a:b');
        expect(pairKey('a', 'b')).toBe('agora:pair:a:b');
    });

    it('builds session and rate keys', function () {
        expect(sessionKey('sess-1')).toBe('agora:session:sess-1');
        expect(rateKey('join-user', '7c9e6679-7425-40de-944b-e07fc1f90ae7')).toBe('agora:rate:join-user:7c9e6679-7425-40de-944b-e07fc1f90ae7');
    });
});
