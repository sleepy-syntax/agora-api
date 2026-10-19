import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { IPublicStats } from './types';

const STATS: IPublicStats = {
    waitingNow: 3,
    liveSessions: 1,
    conversationsToday: 12,
    conversationsAllTime: 400,
    averageDurationSeconds: 95,
    averageRating: 4.25,
    ratingCount: 20,
};

describe('StatsController', function () {
    let app: NestFastifyApplication;
    let snapshot: jest.Mock;

    beforeEach(async function () {
        snapshot = jest.fn().mockResolvedValue(STATS);

        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [StatsController],
            providers: [{ provide: StatsService, useValue: { snapshot } }],
        }).compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        app.setGlobalPrefix('api/v1');
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterEach(async function () {
        await app.close();
    });

    it('GET /api/v1/stats returns the seven public fields', async function () {
        const response = await request(app.getHttpServer()).get('/api/v1/stats').expect(200);

        expect(response.body).toEqual(STATS);
        expect(Object.keys(response.body as IPublicStats)).toEqual([
            'waitingNow',
            'liveSessions',
            'conversationsToday',
            'conversationsAllTime',
            'averageDurationSeconds',
            'averageRating',
            'ratingCount',
        ]);
        expect(snapshot).toHaveBeenCalledTimes(1);
    });
});
