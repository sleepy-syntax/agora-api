import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { ZodValidationPipe } from 'nestjs-zod';
import { GlobalExceptionFilter } from '../filters/global-exception.filter';
import { RedisService } from '../redis/redis.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

interface IErrorBody {
    statusCode: number;
    message: string;
    errors?: { path: string; message: string }[];
}

function readErrorBody(text: string): IErrorBody {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Expected an error body');
    return parsed as IErrorBody;
}

describe('ReviewsController', function () {
    let app: NestFastifyApplication;
    let create: jest.Mock;
    let rateLimit: jest.Mock;

    beforeEach(async function () {
        create = jest.fn();
        rateLimit = jest.fn().mockResolvedValue(true);

        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [ReviewsController],
            providers: [
                { provide: ReviewsService, useValue: { create } },
                { provide: RedisService, useValue: { rateLimit } },
            ],
        }).compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        app.setGlobalPrefix('api/v1');
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new GlobalExceptionFilter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterEach(async function () {
        await app.close();
    });

    it('POST /api/v1/reviews returns 201 with null comment when omitted', async function () {
        const createdAt = '2026-10-14T00:00:00.000Z';
        create.mockResolvedValue({
            id: '665f0c0b9a0c4e8a12345678',
            rating: 5,
            comment: null,
            createdAt,
        });

        const response = await request(app.getHttpServer()).post('/api/v1/reviews').send({ rating: 5 }).expect(201);

        expect(response.body).toEqual({
            id: '665f0c0b9a0c4e8a12345678',
            rating: 5,
            comment: null,
            createdAt,
        });
        expect(rateLimit).toHaveBeenCalledWith('review-ip', expect.any(String), 10, 3600);
        expect(create).toHaveBeenCalledWith(5, undefined);
    });

    it('returns 400 with errors when rating is out of range', async function () {
        const badZero = await request(app.getHttpServer()).post('/api/v1/reviews').send({ rating: 0 }).expect(400);

        expect(readErrorBody(badZero.text).errors).toBeDefined();
        expect(create).not.toHaveBeenCalled();

        const badSix = await request(app.getHttpServer()).post('/api/v1/reviews').send({ rating: 6 }).expect(400);

        expect(readErrorBody(badSix.text).errors).toBeDefined();
        expect(create).not.toHaveBeenCalled();
    });

    it('returns 400 with errors when the comment exceeds the max length', async function () {
        const response = await request(app.getHttpServer())
            .post('/api/v1/reviews')
            .send({ rating: 4, comment: 'a'.repeat(1001) })
            .expect(400);

        expect(readErrorBody(response.text).errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'comment' })]));
        expect(create).not.toHaveBeenCalled();
    });

    it('returns 429 when the review rate limit fails', async function () {
        rateLimit.mockResolvedValue(false);

        const response = await request(app.getHttpServer()).post('/api/v1/reviews').send({ rating: 4 }).expect(429);

        expect(response.body).toEqual({ statusCode: 429, message: 'Too many requests' });
        expect(create).not.toHaveBeenCalled();
    });

    it('does not expose GET /api/v1/reviews', async function () {
        await request(app.getHttpServer()).get('/api/v1/reviews').expect(404);
    });
});
