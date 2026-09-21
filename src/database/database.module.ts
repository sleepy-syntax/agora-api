import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ENVS } from 'src/constants/variables';

@Module({
    imports: [
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                uri: configService.get<string>(ENVS.MONGODB_URI),
                dbName: configService.get<string>(ENVS.MONGODB_DB_NAME),
                autoCreate: true,
            }),
        }),
    ],
})
export class DatabaseModule {}
