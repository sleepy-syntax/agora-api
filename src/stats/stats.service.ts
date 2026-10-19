import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import { Review } from '../reviews/review.schema';
import { Session } from '../sessions/session.schema';
import { IPublicStats } from './types';

interface ISessionStatsRow {
    liveSessions: number;
    conversationsToday: number;
    conversationsAllTime: number;
    averageDurationMs: number | null;
}

interface IReviewStatsRow {
    averageRating: number | null;
    ratingCount: number;
}

function startOfUtcDay(now: Date): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isPublicStats(value: unknown): value is IPublicStats {
    if (!isRecord(value)) return false;
    if (Object.keys(value).length !== 7) return false;
    if (!isFiniteNumber(value.waitingNow)) return false;
    if (!isFiniteNumber(value.liveSessions)) return false;
    if (!isFiniteNumber(value.conversationsToday)) return false;
    if (!isFiniteNumber(value.conversationsAllTime)) return false;
    if (!isFiniteNumber(value.averageDurationSeconds)) return false;
    if (value.averageRating !== null && !isFiniteNumber(value.averageRating)) return false;
    if (!isFiniteNumber(value.ratingCount)) return false;
    return true;
}

function parseCached(raw: string): IPublicStats | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch {
        return null;
    }
    if (!isPublicStats(parsed)) return null;
    return parsed;
}

function roundDurationSeconds(averageDurationMs: number | null): number {
    if (averageDurationMs === null) return 0;
    return Math.round(averageDurationMs / 1000);
}

function roundRating(average: number | null): number | null {
    if (average === null) return null;
    return Math.round(average * 100) / 100;
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

function toStats(waitingNow: number, session: ISessionStatsRow | undefined, review: IReviewStatsRow | undefined): IPublicStats {
    return {
        waitingNow,
        liveSessions: session?.liveSessions ?? 0,
        conversationsToday: session?.conversationsToday ?? 0,
        conversationsAllTime: session?.conversationsAllTime ?? 0,
        averageDurationSeconds: roundDurationSeconds(session?.averageDurationMs ?? null),
        averageRating: roundRating(review?.averageRating ?? null),
        ratingCount: review?.ratingCount ?? 0,
    };
}

@Injectable()
export class StatsService {
    constructor(
        @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
        @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
        private readonly redis: RedisService,
    ) {}

    async snapshot(): Promise<IPublicStats> {
        const cached = await this.readCache();
        if (cached) return cached;

        const stats = await this.compute();
        await this.redis.cacheStats(JSON.stringify(stats));
        return stats;
    }

    private async readCache(): Promise<IPublicStats | null> {
        const raw = await this.redis.readStats();
        if (raw === null) return null;
        return parseCached(raw);
    }

    private async compute(): Promise<IPublicStats> {
        const start = startOfUtcDay(new Date());
        const [waitingNow, sessionRows, reviewRows] = await Promise.all([
            this.redis.queueLength(),
            this.sessionModel.aggregate<ISessionStatsRow>(sessionPipeline(start)).exec(),
            this.reviewModel.aggregate<IReviewStatsRow>(reviewPipeline()).exec(),
        ]);

        return toStats(waitingNow, sessionRows[0], reviewRows[0]);
    }
}
