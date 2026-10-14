import { QUEUE_MATCH_SCRIPT, parseQueueMatchReply } from './queue.script';

describe('QUEUE_MATCH_SCRIPT', function () {
    it('checks pair blocks with EXISTS and never SETs a pair key', function () {
        expect(QUEUE_MATCH_SCRIPT).toMatch(/EXISTS.*pair_key/);
        expect(QUEUE_MATCH_SCRIPT).not.toMatch(/\bSET\b/);
    });

    it('returns the existing position before scanning the queue', function () {
        const lposIndex = QUEUE_MATCH_SCRIPT.indexOf("redis.call('LPOS', queue, userId)");
        const lindexIndex = QUEUE_MATCH_SCRIPT.indexOf("redis.call('LINDEX', queue, idx)");
        expect(lposIndex).toBeGreaterThanOrEqual(0);
        expect(lindexIndex).toBeGreaterThan(lposIndex);
    });
});

describe('parseQueueMatchReply', function () {
    it('maps queued replies', function () {
        expect(parseQueueMatchReply(['QUEUED', '2'])).toEqual({ kind: 'queued', position: 2 });
    });

    it('maps matched replies', function () {
        expect(parseQueueMatchReply(['MATCHED', '7c9e6679-7425-40de-944b-e07fc1f90ae7'])).toEqual({
            kind: 'matched',
            partnerId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        });
    });

    it('rejects malformed replies', function () {
        expect(() => parseQueueMatchReply(['WAITING', '1'])).toThrow('Invalid queue match reply');
        expect(() => parseQueueMatchReply(['QUEUED'])).toThrow('Invalid queue match reply');
        expect(() => parseQueueMatchReply(['QUEUED', '0'])).toThrow('Invalid queue position');
    });
});
