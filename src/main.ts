import { config } from 'dotenv';
config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

const GLOBAL_PREFIX = process.env.GLOBAL_PREFIX ?? 'api/v1';
const PORT = process.env.PORT ?? 3000;

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true, autoFlushLogs: true, logger: ['debug'] });
    app.useLogger(app.get(Logger));
    app.setGlobalPrefix(GLOBAL_PREFIX);
    app.enableCors();
    await app.listen(PORT);
    app.get(Logger).log(`🚀 Server is running on http://localhost:${PORT}/${GLOBAL_PREFIX}`);
}
bootstrap();
