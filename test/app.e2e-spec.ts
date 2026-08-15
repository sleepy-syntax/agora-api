import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

void describe('AppController (e2e)', function () {
    let app: NestFastifyApplication;

    beforeEach(async function () {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    it('/ (GET)', async function () {
        await request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
    });

    afterEach(async function () {
        await app.close();
    });
});
