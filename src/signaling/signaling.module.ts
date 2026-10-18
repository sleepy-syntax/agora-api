import { Module } from '@nestjs/common';
import { MatchingModule } from '../matching/matching.module';
import { RedisModule } from '../redis/redis.module';
import { RtcModule } from '../rtc/rtc.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SessionSweeper } from './session.sweeper';
import { SignalingGateway } from './signaling.gateway';
import { SignalingService } from './signaling.service';
import { SignalingTransport } from './signaling-transport';

@Module({
    imports: [RedisModule, MatchingModule, SessionsModule, RtcModule],
    providers: [SignalingTransport, SignalingService, SignalingGateway, SessionSweeper],
})
export class SignalingModule {}
