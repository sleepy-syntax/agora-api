import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from '../redis/redis.module';
import { Review, ReviewSchema } from '../reviews/review.schema';
import { Session, SessionSchema } from '../sessions/session.schema';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Session.name, schema: SessionSchema },
            { name: Review.name, schema: ReviewSchema },
        ]),
        RedisModule,
    ],
    controllers: [StatsController],
    providers: [StatsService],
})
export class StatsModule {}
