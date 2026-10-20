import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { RedisService } from '../redis/redis.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', function () {
    let app: NestFastifyApplication;
    let ping: jest.Mock;
    let connection: { readyState: number };

    beforeEach(async function () {
        ping = jest.fn().mockResolvedValue('PONG');
        connection = { readyState: 1 };

        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [HealthService, { provide: RedisService, useValue: { ping } }, { provide: getConnectionToken(), useValue: connection }],
        }).compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        app.setGlobalPrefix('api/v1');
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterEach(async function () {
        await app.close();
    });

    it('returns 200 when Mongo and Redis are up', async function () {
        const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

        expect(response.body).toEqual({ status: 'ok', mongo: 'up', redis: 'up' });
    });

    it('returns 503 when Redis PING throws', async function () {
        ping.mockRejectedValueOnce(new Error('connection closed'));

        const response = await request(app.getHttpServer()).get('/api/v1/health').expect(503);

        expect(response.body).toEqual({ status: 'degraded', mongo: 'up', redis: 'down' });
    });

    it('returns 503 when Redis PING is not PONG', async function () {
        ping.mockResolvedValueOnce('LOADING');

        const response = await request(app.getHttpServer()).get('/api/v1/health').expect(503);

        expect(response.body).toEqual({ status: 'degraded', mongo: 'up', redis: 'down' });
    });

    it('returns 503 when Mongo is not connected', async function () {
        connection.readyState = 0;

        const response = await request(app.getHttpServer()).get('/api/v1/health').expect(503);

        expect(response.body).toEqual({ status: 'degraded', mongo: 'down', redis: 'up' });
    });
});
