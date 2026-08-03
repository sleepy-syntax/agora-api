import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NestLoggerModule } from './logger';
import { ReqLogMiddleware } from './middlewares/req-log.middleware';

@Module({
    imports: [NestLoggerModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(ReqLogMiddleware).forRoutes('/', '*path');
    }
}
