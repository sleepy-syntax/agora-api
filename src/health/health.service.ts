import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ConnectionStates, type Connection } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import type { IHealth, TDependencyStatus } from './types';

@Injectable()
export class HealthService {
    constructor(
        @InjectConnection() private readonly connection: Connection,
        private readonly redis: RedisService,
    ) {}

    async check(): Promise<IHealth> {
        const mongo = this.mongoStatus();
        const redis = await this.redisStatus();
        const status = mongo === 'up' && redis === 'up' ? 'ok' : 'degraded';
        return { status, mongo, redis };
    }

    private mongoStatus(): TDependencyStatus {
        return this.connection.readyState === ConnectionStates.connected ? 'up' : 'down';
    }

    private async redisStatus(): Promise<TDependencyStatus> {
        try {
            const reply = await this.redis.ping();
            return reply === 'PONG' ? 'up' : 'down';
        } catch {
            return 'down';
        }
    }
}
