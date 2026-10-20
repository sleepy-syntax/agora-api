import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { RequestLogInterceptor } from './interceptors/request-log.interceptor';
import { AppService } from './app.service';
import { NestLoggerModule } from './logger';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationSchema } from './configuration';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { MatchingModule } from './matching/matching.module';
import { SessionsModule } from './sessions/sessions.module';
import { HealthModule } from './health/health.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SignalingModule } from './signaling/signaling.module';
import { StatsModule } from './stats/stats.module';

@Module({
    imports: [
        NestLoggerModule,
        ConfigModule.forRoot({ isGlobal: true, validationSchema: ConfigurationSchema, validationOptions: { abortEarly: true } }),
        DatabaseModule,
        RedisModule,
        SessionsModule,
        MatchingModule,
        SignalingModule,
        ReviewsModule,
        StatsModule,
        HealthModule,
    ],
    controllers: [AppController],
    providers: [AppService, { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor }],
})
export class AppModule {}
