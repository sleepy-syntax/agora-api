import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { ENVS } from 'src/constants/variables';
import { PAIR_KEY_PREFIX, PRESENCE_KEY_PREFIX, pairKey, presenceKey, queueKey, rateKey, sessionKey, statsKey, sweeperLockKey } from './keys';
import { DELETE_PRESENCE_IF_SOCKET_SCRIPT, SET_PRESENCE_SCRIPT, SET_PRESENCE_SESSION_ID_SCRIPT } from './presence.script';
import { QUEUE_MATCH_SCRIPT, parseQueueMatchReply } from './queue.script';
import { RATE_LIMIT_SCRIPT } from './rate.script';
import type { IPresence, ISessionHash, TJoinQueueResult } from './types';

const SWEEPER_LOCK_TTL_SECONDS = 8;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    readonly logger = new Logger(RedisService.name);

    private redis: Redis | undefined;

    constructor(private readonly configService: ConfigService) {}

    async onModuleInit() {
        const redisHost = this.configService.get<string>(ENVS.REDIS_HOST);
        const redisPort = this.configService.get<number>(ENVS.REDIS_PORT);
        const redisPassword = this.configService.get<string>(ENVS.REDIS_PASSWORD);

        if (!redisHost) throw new Error('REDIS_HOST is not set');
        if (!redisPort) throw new Error('REDIS_PORT is not set');
        if (!redisPassword) throw new Error('REDIS_PASSWORD is not set');

        this.redis = new Redis({ lazyConnect: true, password: redisPassword, host: redisHost, port: redisPort });
        await this.redis.connect();

        const result = await this.redis.ping();
        if (result !== 'PONG') throw new Error('Failed to connect to Redis');

        this.logger.log('Redis connected successfully');
    }

    async onModuleDestroy() {
        if (!this.redis) return;
        await this.redis.quit();
        this.logger.log('Redis disconnected successfully');
    }

    getClient() {
        if (!this.redis) throw new Error('Redis is not connected');
        return this.redis;
    }

    ping() {
        return this.getClient().ping();
    }

    duplicate() {
        return this.getClient().duplicate();
    }

    async joinQueue(userId: string): Promise<TJoinQueueResult> {
        const reply = await this.getClient().eval(QUEUE_MATCH_SCRIPT, 1, queueKey(), userId, PAIR_KEY_PREFIX, PRESENCE_KEY_PREFIX);
        return parseQueueMatchReply(reply);
    }

    async removeFromQueue(clientId: string) {
        await this.getClient().lrem(queueKey(), 0, clientId);
    }

    async queueLength() {
        return this.getClient().llen(queueKey());
    }

    async listQueue() {
        return this.getClient().lrange(queueKey(), 0, -1);
    }

    async setPresence(clientId: string, socketId: string, sessionId: string) {
        const ttl = this.configService.get<number>(ENVS.PRESENCE_TTL_SECONDS);
        if (ttl === undefined) throw new Error('PRESENCE_TTL_SECONDS is not set');

        await this.getClient().eval(SET_PRESENCE_SCRIPT, 1, presenceKey(clientId), ttl, socketId, sessionId);
    }

    async setPresenceSessionId(clientId: string, sessionId: string) {
        const ttl = this.configService.get<number>(ENVS.PRESENCE_TTL_SECONDS);
        if (ttl === undefined) throw new Error('PRESENCE_TTL_SECONDS is not set');

        const result = await this.getClient().eval(SET_PRESENCE_SESSION_ID_SCRIPT, 1, presenceKey(clientId), ttl, sessionId);
        return result === 1;
    }

    async refreshPresence(clientId: string) {
        const ttl = this.configService.get<number>(ENVS.PRESENCE_TTL_SECONDS);
        if (ttl === undefined) throw new Error('PRESENCE_TTL_SECONDS is not set');

        const refreshed = await this.getClient().expire(presenceKey(clientId), ttl);
        return refreshed === 1;
    }

    async getPresence(clientId: string): Promise<IPresence | null> {
        const raw = await this.getClient().hgetall(presenceKey(clientId));
        if (!raw.socketId) return null;

        return { socketId: raw.socketId, sessionId: raw.sessionId ?? '' };
    }

    async deletePresenceIfSocket(clientId: string, socketId: string) {
        const result = await this.getClient().eval(DELETE_PRESENCE_IF_SOCKET_SCRIPT, 1, presenceKey(clientId), socketId);
        return result === 1 ? 1 : 0;
    }

    async setPairBlock(a: string, b: string) {
        const ttl = this.configService.get<number>(ENVS.PAIR_BLOCK_TTL_SECONDS);
        if (ttl === undefined) throw new Error('PAIR_BLOCK_TTL_SECONDS is not set');

        const created = await this.getClient().set(pairKey(a, b), '1', 'EX', ttl, 'NX');
        return created === 'OK';
    }

    async hasPairBlock(a: string, b: string) {
        const exists = await this.getClient().exists(pairKey(a, b));
        return exists === 1;
    }

    async setSessionHash(sessionId: string, fields: ISessionHash) {
        await this.getClient().hset(sessionKey(sessionId), fields);
    }

    async setSessionHashFields(sessionId: string, fields: Partial<ISessionHash>) {
        if (Object.keys(fields).length === 0) return;
        await this.getClient().hset(sessionKey(sessionId), fields);
    }

    async getSessionHash(sessionId: string): Promise<ISessionHash | null> {
        const raw = await this.getClient().hgetall(sessionKey(sessionId));

        if (!raw.participantLow) return null;

        return {
            participantLow: raw.participantLow,
            participantHigh: raw.participantHigh,
            offererId: raw.offererId,
            matchedAt: raw.matchedAt ?? '',
            connectedAt: raw.connectedAt ?? '',
            endedAt: raw.endedAt ?? '',
            endReason: raw.endReason ?? '',
            endedBy: raw.endedBy ?? '',
        };
    }

    async deleteSessionHash(sessionId: string) {
        await this.getClient().del(sessionKey(sessionId));
    }

    async rateLimit(scope: string, id: string, limit: number, windowSeconds: number) {
        const result = await this.getClient().eval(RATE_LIMIT_SCRIPT, 1, rateKey(scope, id), limit, windowSeconds);
        return result === 1;
    }

    async acquireSweeperLock() {
        const acquired = await this.getClient().set(sweeperLockKey(), '1', 'EX', SWEEPER_LOCK_TTL_SECONDS, 'NX');
        return acquired === 'OK';
    }

    async cacheStats(payload: string) {
        const ttl = this.configService.get<number>(ENVS.STATS_CACHE_TTL_SECONDS);
        if (ttl === undefined) throw new Error('STATS_CACHE_TTL_SECONDS is not set');
        await this.getClient().set(statsKey(), payload, 'EX', ttl);
    }

    async readStats() {
        return this.getClient().get(statsKey());
    }
}
