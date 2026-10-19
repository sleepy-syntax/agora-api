import { PipelineStage } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import { StatsService } from './stats.service';
import { IPublicStats } from './types';

const CACHED: IPublicStats = {
    waitingNow: 3,
    liveSessions: 1,
    conversationsToday: 12,
    conversationsAllTime: 400,
    averageDurationSeconds: 95,
    averageRating: 4.25,
    ratingCount: 20,
};

const NOW = new Date('2026-10-19T15:30:00.000Z');
const START_OF_UTC_DAY = new Date('2026-10-19T00:00:00.000Z');

function aggregateOf<T>(rows: T[]) {
    return { exec: () => Promise.resolve(rows) };
}

function sessionPipeline(start: Date): PipelineStage[] {
    return [
        {
            $group: {
                _id: null,
                liveSessions: {
                    $sum: {
                        $cond: [{ $and: [{ $eq: ['$endedAt', null] }, { $ne: ['$connectedAt', null] }] }, 1, 0],
                    },
                },
                conversationsToday: {
                    $sum: {
                        $cond: [{ $gte: ['$connectedAt', start] }, 1, 0],
                    },
                },
                conversationsAllTime: {
                    $sum: {
                        $cond: [{ $ne: ['$connectedAt', null] }, 1, 0],
                    },
                },
                averageDurationMs: {
                    $avg: {
                        $cond: [{ $and: [{ $ne: ['$connectedAt', null] }, { $ne: ['$endedAt', null] }] }, '$durationMs', null],
                    },
                },
            },
        },
    ];
}

function reviewPipeline(): PipelineStage[] {
    return [
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                ratingCount: { $sum: 1 },
            },
        },
    ];
}

function createService(sessionAggregate: jest.Mock, reviewAggregate: jest.Mock, redis: Partial<RedisService>) {
    return new StatsService({ aggregate: sessionAggregate } as never, { aggregate: reviewAggregate } as never, redis as RedisService);
}

describe('StatsService', function () {
    let sessionAggregate: jest.Mock;
    let reviewAggregate: jest.Mock;
    let readStats: jest.Mock;
    let cacheStats: jest.Mock;
    let queueLength: jest.Mock;

    beforeEach(function () {
        jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate', 'setTimeout', 'setInterval'] });
        sessionAggregate = jest.fn().mockReturnValue(aggregateOf([]));
        reviewAggregate = jest.fn().mockReturnValue(aggregateOf([]));
        readStats = jest.fn().mockResolvedValue(null);
        cacheStats = jest.fn().mockResolvedValue(undefined);
        queueLength = jest.fn().mockResolvedValue(0);
    });

    afterEach(function () {
        jest.useRealTimers();
    });

    function service() {
        return createService(sessionAggregate, reviewAggregate, { readStats, cacheStats, queueLength });
    }

    it('returns a cached snapshot without querying Mongo or the queue', async function () {
        readStats.mockResolvedValue(JSON.stringify(CACHED));

        await expect(service().snapshot()).resolves.toEqual(CACHED);

        expect(sessionAggregate).not.toHaveBeenCalled();
        expect(reviewAggregate).not.toHaveBeenCalled();
        expect(queueLength).not.toHaveBeenCalled();
        expect(cacheStats).not.toHaveBeenCalled();
    });

    it('recomputes when the cached payload is invalid or contains a review comment', async function () {
        readStats.mockResolvedValueOnce('not-json').mockResolvedValueOnce(JSON.stringify({ comment: 'The wait was short.', waitingNow: 1 }));
        queueLength.mockResolvedValue(2);

        const first = await service().snapshot();
        const second = await service().snapshot();

        expect(first).toEqual({
            waitingNow: 2,
            liveSessions: 0,
            conversationsToday: 0,
            conversationsAllTime: 0,
            averageDurationSeconds: 0,
            averageRating: null,
            ratingCount: 0,
        });
        expect(second).toEqual(first);
        expect(Object.keys(second)).not.toContain('comment');
        expect(sessionAggregate).toHaveBeenCalledTimes(2);
        expect(reviewAggregate).toHaveBeenCalledTimes(2);
    });

    it('does not aggregate again after the snapshot is cached', async function () {
        let stored: string | null = null;
        readStats.mockImplementation(() => Promise.resolve(stored));
        cacheStats.mockImplementation((payload: string) => {
            stored = payload;
            return Promise.resolve();
        });
        queueLength.mockResolvedValue(3);
        sessionAggregate.mockReturnValue(
            aggregateOf([
                {
                    liveSessions: 1,
                    conversationsToday: 12,
                    conversationsAllTime: 400,
                    averageDurationMs: 95500,
                },
            ]),
        );
        reviewAggregate.mockReturnValue(aggregateOf([{ averageRating: 4.256, ratingCount: 20 }]));

        const stats = service();
        const first = await stats.snapshot();
        const second = await stats.snapshot();

        expect(first).toEqual({
            waitingNow: 3,
            liveSessions: 1,
            conversationsToday: 12,
            conversationsAllTime: 400,
            averageDurationSeconds: 96,
            averageRating: 4.26,
            ratingCount: 20,
        });
        expect(second).toEqual(first);
        expect(Object.keys(first)).toEqual([
            'waitingNow',
            'liveSessions',
            'conversationsToday',
            'conversationsAllTime',
            'averageDurationSeconds',
            'averageRating',
            'ratingCount',
        ]);
        expect(cacheStats).toHaveBeenCalledTimes(1);
        expect(cacheStats).toHaveBeenCalledWith(JSON.stringify(first));
        expect(sessionAggregate).toHaveBeenCalledTimes(1);
        expect(reviewAggregate).toHaveBeenCalledTimes(1);
    });

    it('counts only connected sessions, uses UTC midnight for today, and averages duration after both timestamps are set', async function () {
        await service().snapshot();

        expect(sessionAggregate).toHaveBeenCalledWith(sessionPipeline(START_OF_UTC_DAY));
    });

    it('averages review ratings without reading comments', async function () {
        await service().snapshot();

        expect(reviewAggregate).toHaveBeenCalledWith(reviewPipeline());
    });

    it('maps a null duration average to zero and an empty review set to a null rating', async function () {
        sessionAggregate.mockReturnValue(
            aggregateOf([
                {
                    liveSessions: 1,
                    conversationsToday: 0,
                    conversationsAllTime: 1,
                    averageDurationMs: null,
                },
            ]),
        );

        await expect(service().snapshot()).resolves.toEqual({
            waitingNow: 0,
            liveSessions: 1,
            conversationsToday: 0,
            conversationsAllTime: 1,
            averageDurationSeconds: 0,
            averageRating: null,
            ratingCount: 0,
        });
    });
});
