import { Module } from '@nestjs/common';
import { RtcService } from './rtc.service';

@Module({
    providers: [RtcService],
    exports: [RtcService],
})
export class RtcModule {}
