import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { ENVS, REQUEST_ID_HEADER } from './constants/variables';
import { setupSwagger } from './swagger';

const GLOBAL_PREFIX = process.env[ENVS.GLOBAL_PREFIX] ?? 'api/v1';
const PORT = process.env[ENVS.PORT] ?? '3000';

async function bootstrap() {
    const adapter = new FastifyAdapter({ requestIdHeader: REQUEST_ID_HEADER, genReqId: () => randomUUID() });

    adapter.getInstance().addHook('onRequest', (request, reply, done) => {
        reply.header(REQUEST_ID_HEADER, request.id);
        done();
    });

    const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { bufferLogs: true, autoFlushLogs: true, logger: ['debug'] });

    app.useLogger(app.get(Logger));
    app.setGlobalPrefix(GLOBAL_PREFIX);
    app.enableCors();

    setupSwagger(app, GLOBAL_PREFIX, PORT);

    await app.listen(PORT);
    app.get(Logger).log(`🚀 Server is running on http://localhost:${PORT}/${GLOBAL_PREFIX}`);
}

bootstrap().catch((error: unknown) => {
    console.error('Failed to start the application', error);
    process.exitCode = 1;
});
