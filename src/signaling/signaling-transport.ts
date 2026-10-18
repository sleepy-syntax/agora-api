import { Injectable } from '@nestjs/common';
import { MatchingService } from '../matching/matching.service';
import { RedisService } from '../redis/redis.service';
import { ERROR_MESSAGES, SERVER_EVENTS, type TErrorCode } from './events';
import type { TSignalingServer } from './socket-data';

function sessionRoom(sessionId: string) {
    return `session:${sessionId}`;
}

@Injectable()
export class SignalingTransport {
    private server: TSignalingServer | undefined;

    constructor(
        private readonly redis: RedisService,
        private readonly matching: MatchingService,
    ) {}

    bind(server: TSignalingServer) {
        this.server = server;
    }

    async emitTo(clientId: string, event: string, payload: unknown) {
        const presence = await this.redis.getPresence(clientId);
        if (!presence || !this.server) return;
        this.server.to(presence.socketId).emit(event, payload);
    }

    emitError(socketId: string, code: TErrorCode) {
        if (!this.server) return;
        this.server.to(socketId).emit(SERVER_EVENTS.error, { code, message: ERROR_MESSAGES[code] });
    }

    joinSession(socketId: string, sessionId: string) {
        if (!this.server) return;
        this.server.in(socketId).socketsJoin(sessionRoom(sessionId));
    }

    leaveSession(sessionId: string) {
        if (!this.server) return;
        this.server.socketsLeave(sessionRoom(sessionId));
    }

    relay(sessionId: string, event: string, payload: unknown, exceptSocketId: string) {
        if (!this.server) return;
        this.server.to(sessionRoom(sessionId)).except(exceptSocketId).emit(event, payload);
    }

    async broadcastQueuePositions() {
        const ids = await this.matching.listWaiting();
        for (let index = 0; index < ids.length; index++) await this.emitTo(ids[index], SERVER_EVENTS.queueWaiting, { position: index + 1 });
    }
}
