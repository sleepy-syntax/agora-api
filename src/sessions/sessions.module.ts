import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from '../redis/redis.module';
import { Session, SessionSchema } from './session.schema';
import { SessionService } from './session.service';

@Module({
    imports: [MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]), RedisModule],
    providers: [SessionService],
    exports: [SessionService],
})
export class SessionsModule {}
