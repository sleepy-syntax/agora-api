import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { parseUserId } from '../common/user-id';
import { ENVS, RATE_LIMITS } from '../constants/variables';
import { MatchingService } from '../matching/matching.service';
import { RedisService } from '../redis/redis.service';
import { CLIENT_EVENTS, ERROR_CODES, ERROR_MESSAGES, SERVER_EVENTS, type TErrorCode } from './events';
import { emptyPayloadSchema, mediaStateSchema, readPayload, sessionIdPayloadSchema, signalAnswerSchema, signalIceSchema, signalOfferSchema } from './payloads';
import { SignalingService } from './signaling.service';
import { SignalingTransport } from './signaling-transport';
import type { TSignalingServer, TSignalingSocket } from './socket-data';

const SOCKET_PATH = process.env[ENVS.SOCKET_PATH] ?? '/socket.io';
const SOCKET_CORS_ORIGIN = process.env[ENVS.CLIENT_URL] ?? 'http://localhost:3000';

@Injectable()
@WebSocketGateway({ path: SOCKET_PATH, cors: { origin: SOCKET_CORS_ORIGIN, credentials: true } })
export class SignalingGateway implements OnGatewayInit, OnGatewayConnection<TSignalingSocket>, OnGatewayDisconnect<TSignalingSocket>, OnApplicationShutdown {
    @WebSocketServer()
    private server!: TSignalingServer;

    constructor(
        private readonly redis: RedisService,
        private readonly matching: MatchingService,
        private readonly signaling: SignalingService,
        private readonly transport: SignalingTransport,
    ) {}

    afterInit(server: TSignalingServer) {
        this.transport.bind(server);

        server.use((socket, next) => {
            const id = parseUserId(socket.handshake.auth?.userId);
            if (!id) return next(new Error(ERROR_CODES.invalidUserId));
            socket.data.userId = id;
            next();
        });
    }

    async handleConnection(socket: TSignalingSocket) {
        const clientId = socket.data.userId;
        const previous = await this.redis.getPresence(clientId);
        const previousSocketId = previous?.socketId;
        const previousSessionId = previous?.sessionId ?? '';

        await this.redis.setPresence(clientId, socket.id, '');

        if (previousSocketId && previousSocketId !== socket.id) this.server.in(previousSocketId).disconnectSockets(true);

        if (previousSessionId) await this.signaling.onDisconnect(previousSessionId, clientId);
    }

    async handleDisconnect(socket: TSignalingSocket) {
        const clientId = socket.data.userId;
        const presence = await this.redis.getPresence(clientId);
        if (!presence) return;

        const deleted = await this.redis.deletePresenceIfSocket(clientId, socket.id);
        if (deleted === 0) return;

        await this.redis.removeFromQueue(clientId);

        if (presence.sessionId) await this.signaling.onDisconnect(presence.sessionId, clientId);
    }

    @SubscribeMessage(CLIENT_EVENTS.queueJoin)
    async onQueueJoin(@ConnectedSocket() socket: TSignalingSocket, @MessageBody() raw: unknown) {
        if (!(await this.accept(socket, emptyPayloadSchema, raw))) return;

        const clientId = socket.data.userId;
        if (!(await this.allowQueueJoin(socket, clientId))) return;

        const result = await this.matching.join(clientId);

        if (result.type === 'rejected') {
            this.emitError(socket, result.code);
            return;
        }

        if (result.type === 'queued') {
            socket.emit(SERVER_EVENTS.queueWaiting, { position: result.position });
            return;
        }

        await this.signaling.onMatched(clientId, result.partnerId);
    }

    @SubscribeMessage(CLIENT_EVENTS.queueLeave)
    async onQueueLeave(@ConnectedSocket() socket: TSignalingSocket, @MessageBody() raw: unknown) {
        if (!(await this.accept(socket, emptyPayloadSchema, raw))) return;

        const result = await this.matching.leave(socket.data.userId);

        if (result.type === 'rejected') {
            this.emitError(socket, result.code);
            return;
        }

        socket.emit(SERVER_EVENTS.queueLeft, {});
        await this.transport.broadcastQueuePositions();
    }

    @SubscribeMessage(CLIENT_EVENTS.presencePing)
    async onPresencePing(@ConnectedSocket() socket: TSignalingSocket, @MessageBody() raw: unknown) {
        if (!(await this.accept(socket, emptyPayloadSchema, raw))) return;
    }

    @SubscribeMessage(CLIENT_EVENTS.signalOffer)
    async onSignalOffer(@ConnectedSocket() socket: TSignalingSocket, @MessageBody() raw: unknown) {
        const payload = await this.accept(socket, signalOfferSchema(), raw);
        if (!payload) return;
        await this.signaling.relay(socket.data.userId, socket.id, SERVER_EVENTS.signalOffer, payload);
    }

    @SubscribeMessage(CLIENT_EVENTS.signalAnswer)
    async onSignalAnswer(@ConnectedSocket() socket: TSignalingSocket, @MessageBody() raw: unknown) {
        const payload = await this.accept(socket, signalAnswerSchema(), raw);
        if (!payload) return;
        await this.signaling.relay(socket.data.userId, socket.id, SERVER_EVENTS.signalAnswer, payload);
    }

    @SubscribeMessage(CLIENT_EVENTS.signalIce)
    async onSignalIce(@ConnectedSocket() socket: TSignalingSocket, @MessageBody() raw: unknown) {
        const payload = await this.accept(socket, signalIceSchema, raw);
        if (!payload) return;
        await this.signaling.relay(socket.data.userId, socket.id, SERVER_EVENTS.signalIce, payload);
    }

    @SubscribeMessage(CLIENT_EVENTS.mediaState)
    async onMediaState(@ConnectedSocket() socket: TSignalingSocket, @MessageBody() raw: unknown) {
        const payload = await this.accept(socket, mediaStateSchema, raw);
        if (!payload) return;
        await this.signaling.relay(socket.data.userId, socket.id, SERVER_EVENTS.mediaState, payload);
    }

    @SubscribeMessage(CLIENT_EVENTS.mediaConnected)
    async onMediaConnected(@ConnectedSocket() socket: TSignalingSocket, @MessageBody() raw: unknown) {
        const payload = await this.accept(socket, sessionIdPayloadSchema, raw);
        if (!payload) return;
        await this.signaling.onMediaConnected(socket.data.userId, socket.id, payload.sessionId);
    }

    @SubscribeMessage(CLIENT_EVENTS.mediaFailed)
    async onMediaFailed(@ConnectedSocket() socket: TSignalingSocket, @MessageBody() raw: unknown) {
        const payload = await this.accept(socket, sessionIdPayloadSchema, raw);
        if (!payload) return;
        await this.signaling.onMediaFailed(socket.data.userId, socket.id, payload.sessionId);
    }

    @SubscribeMessage(CLIENT_EVENTS.sessionEnd)
    async onSessionEnd(@ConnectedSocket() socket: TSignalingSocket, @MessageBody() raw: unknown) {
        const payload = await this.accept(socket, sessionIdPayloadSchema, raw);
        if (!payload) return;
        await this.signaling.onSessionEnd(socket.data.userId, socket.id, payload.sessionId);
    }

    @SubscribeMessage(CLIENT_EVENTS.sessionNext)
    async onSessionNext(@ConnectedSocket() socket: TSignalingSocket, @MessageBody() raw: unknown) {
        const payload = await this.accept(socket, sessionIdPayloadSchema, raw);
        if (!payload) return;
        await this.signaling.onSessionNext(socket.data.userId, socket.id, payload.sessionId);
    }

    async onApplicationShutdown() {
        const endedSessions = new Set<string>();

        for (const socket of this.server.sockets.sockets.values()) {
            const clientId = socket.data.userId;
            const presence = await this.redis.getPresence(clientId);
            if (!presence || presence.socketId !== socket.id || !presence.sessionId) continue;
            if (endedSessions.has(presence.sessionId)) continue;

            endedSessions.add(presence.sessionId);
            await this.redis.deletePresenceIfSocket(clientId, socket.id);
            await this.redis.removeFromQueue(clientId);
            await this.signaling.onDisconnect(presence.sessionId, clientId);
        }
    }

    async emitTo(clientId: string, event: string, payload: unknown) {
        await this.transport.emitTo(clientId, event, payload);
    }

    socketsJoin(socketId: string, room: string) {
        this.server.in(socketId).socketsJoin(room);
    }

    private async accept<T>(socket: TSignalingSocket, schema: Parameters<typeof readPayload<T>>[1], raw: unknown): Promise<T | null> {
        const payload = readPayload(socket, schema, raw);
        if (!payload) return null;
        await this.redis.refreshPresence(socket.data.userId);
        return payload;
    }

    private async allowQueueJoin(socket: TSignalingSocket, clientId: string): Promise<boolean> {
        const { queueJoinPerClient, queueJoinPerIp } = RATE_LIMITS;
        const address = socket.handshake.address ?? 'unknown';

        const userAllowed = await this.redis.rateLimit('join-user', clientId, queueJoinPerClient.limit, queueJoinPerClient.windowSeconds);
        const ipAllowed = await this.redis.rateLimit('join-ip', address, queueJoinPerIp.limit, queueJoinPerIp.windowSeconds);

        if (userAllowed && ipAllowed) return true;

        this.emitError(socket, ERROR_CODES.rateLimited);
        return false;
    }

    private emitError(socket: TSignalingSocket, code: TErrorCode) {
        socket.emit(SERVER_EVENTS.error, { code, message: ERROR_MESSAGES[code] });
    }
}
