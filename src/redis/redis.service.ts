import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { ENVS } from 'src/constants/variables';

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
}
