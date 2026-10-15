import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { SessionsModule } from '../sessions/sessions.module';
import { MatchingService } from './matching.service';

@Module({
    imports: [RedisModule, SessionsModule],
    providers: [MatchingService],
    exports: [MatchingService],
})
export class MatchingModule {}
