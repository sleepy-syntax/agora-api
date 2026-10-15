import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { SessionService } from '../sessions/session.service';
import type { TJoinResult, TLeaveResult } from './types';

@Injectable()
export class MatchingService {
    constructor(
        private readonly redis: RedisService,
        private readonly sessions: SessionService,
    ) {}

    async join(clientId: string): Promise<TJoinResult> {
        if (await this.hasOpenSession(clientId)) return { type: 'rejected', code: 'already_in_session' };

        const result = await this.redis.joinQueue(clientId);
        if (result.kind === 'queued') return { type: 'queued', position: result.position };
        return { type: 'matched', partnerId: result.partnerId };
    }

    async leave(clientId: string): Promise<TLeaveResult> {
        if (await this.hasOpenSession(clientId)) return { type: 'rejected', code: 'not_in_queue' };

        await this.redis.removeFromQueue(clientId);
        return { type: 'left' };
    }

    listWaiting() {
        return this.redis.listQueue();
    }

    async positionOf(clientId: string): Promise<number | null> {
        const ids = await this.listWaiting();
        const index = ids.indexOf(clientId);
        return index === -1 ? null : index + 1;
    }

    private async hasOpenSession(clientId: string): Promise<boolean> {
        const presence = await this.redis.getPresence(clientId);
        if (!presence?.sessionId) return false;

        const session = await this.sessions.findById(presence.sessionId);
        return session !== null && session.endedAt === null;
    }
}
