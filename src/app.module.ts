import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { RequestLogInterceptor } from './interceptors/request-log.interceptor';
import { AppService } from './app.service';
import { NestLoggerModule } from './logger';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationSchema } from './configuration';
import { DatabaseModule } from './database/database.module';

@Module({
    imports: [
        NestLoggerModule,
        ConfigModule.forRoot({ isGlobal: true, validationSchema: ConfigurationSchema, validationOptions: { abortEarly: true } }),
        DatabaseModule,
    ],
    controllers: [AppController],
    providers: [AppService, { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor }],
})
export class AppModule {}
