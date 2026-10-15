import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import { ISession, Session, TEndSession } from './session.schema';

function sortParticipants(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
}

@Injectable()
export class SessionService {
    constructor(
        @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
        private readonly redis: RedisService,
    ) {}

    async create(a: string, b: string): Promise<ISession> {
        const participants = sortParticipants(a, b);
        const matchedAt = new Date();
        const sessionId = randomUUID();

        const doc = await this.sessionModel.create({
            _id: sessionId,
            participants,
            offererId: participants[0],
            matchedAt,
            connectedAt: null,
            endedAt: null,
            endReason: null,
            endedBy: null,
            durationMs: null,
        });

        await this.redis.setSessionHash(sessionId, {
            participantLow: participants[0],
            participantHigh: participants[1],
            offererId: participants[0],
            matchedAt: matchedAt.toISOString(),
            connectedAt: '',
            endedAt: '',
            endReason: '',
            endedBy: '',
        });

        return doc.toObject();
    }

    async markConnected(sessionId: string, at: Date): Promise<ISession | null> {
        const updated = await this.sessionModel
            .findOneAndUpdate({ _id: sessionId, connectedAt: null, endedAt: null }, { $set: { connectedAt: at } }, { new: true })
            .lean()
            .exec();

        if (!updated) return null;

        await this.redis.setSessionHashFields(sessionId, { connectedAt: at.toISOString() });
        return updated;
    }

    async end(sessionId: string, input: TEndSession): Promise<ISession | null> {
        const endedAt = new Date();

        const updated = await this.sessionModel
            .findOneAndUpdate(
                { _id: sessionId, endedAt: null },
                [
                    {
                        $set: {
                            endedAt,
                            endReason: input.endReason,
                            endedBy: input.endedBy,
                            durationMs: {
                                $cond: {
                                    if: { $ne: ['$connectedAt', null] },
                                    then: { $subtract: [endedAt, '$connectedAt'] },
                                    else: 0,
                                },
                            },
                        },
                    },
                ],
                { new: true },
            )
            .lean()
            .exec();

        if (!updated) return null;

        await this.redis.deleteSessionHash(sessionId);
        return updated;
    }

    findById(sessionId: string) {
        return this.sessionModel.findById(sessionId).lean().exec();
    }

    findOpen() {
        return this.sessionModel.find({ endedAt: null }).lean().exec();
    }

    findConnectTimeouts(cutoff: Date) {
        return this.sessionModel
            .find({ endedAt: null, connectedAt: null, matchedAt: { $lte: cutoff } })
            .lean()
            .exec();
    }
}
