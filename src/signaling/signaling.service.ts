import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVS } from '../constants/variables';
import { MatchingService } from '../matching/matching.service';
import { RedisService } from '../redis/redis.service';
import { RtcService } from '../rtc/rtc.service';
import { SessionHashWriteError } from '../sessions/session-hash-write.error';
import type { ISession, TEndSession } from '../sessions/session.schema';
import { SessionService } from '../sessions/session.service';
import { ERROR_CODES, SERVER_EVENTS, type TErrorCode } from './events';
import { SignalingTransport } from './signaling-transport';

const MAX_REJOIN_DEPTH = 2;

type TSessionAccess = { ok: true; session: ISession } | { ok: false; code: TErrorCode };

@Injectable()
export class SignalingService {
    private readonly logger = new Logger(SignalingService.name);

    constructor(
        private readonly sessions: SessionService,
        private readonly matching: MatchingService,
        private readonly redis: RedisService,
        private readonly rtc: RtcService,
        private readonly transport: SignalingTransport,
        private readonly config: ConfigService,
    ) {}

    async onMatched(joinerId: string, partnerId: string, depth = 0): Promise<void> {
        let session: ISession;

        try {
            session = await this.sessions.create(joinerId, partnerId);
        } catch (error) {
            if (error instanceof SessionHashWriteError) {
                await this.sessions.end(error.session._id, { endReason: 'connect_failed', endedBy: null });
                await this.rejoinPresent([joinerId, partnerId], depth);
                return;
            }
            await this.rejoinPresent([joinerId, partnerId], depth);
            return;
        }

        const sessionId = session._id;
        const iceServers = this.rtc.iceServers();

        await this.redis.setPresenceSessionId(joinerId, sessionId);
        await this.redis.setPresenceSessionId(partnerId, sessionId);

        for (const clientId of session.participants) {
            const presence = await this.redis.getPresence(clientId);
            if (presence) this.transport.joinSession(presence.socketId, sessionId);

            const role = clientId === session.offererId ? 'offerer' : 'answerer';
            await this.transport.emitTo(clientId, SERVER_EVENTS.sessionMatched, { sessionId, role, iceServers });
        }

        await this.transport.broadcastQueuePositions();
    }

    async onSessionEnd(clientId: string, socketId: string, sessionId: string) {
        const access = await this.requireSessionControl(sessionId, clientId, socketId);
        if (!access.ok) return;

        const ended = await this.finish(sessionId, { endReason: 'user_end', endedBy: clientId });
        if (!ended) return;

        await this.transport.emitTo(clientId, SERVER_EVENTS.sessionEnded, { sessionId, reason: 'user_end', next: 'rating' });

        const partnerId = ended.participants.find(id => id !== clientId);
        if (!partnerId || !(await this.redis.getPresence(partnerId))) return;

        await this.transport.emitTo(partnerId, SERVER_EVENTS.sessionEnded, { sessionId, reason: 'user_end', next: 'waiting' });
        await this.rejoinPresent([partnerId], 0);
    }

    async onSessionNext(clientId: string, socketId: string, sessionId: string) {
        const access = await this.requireSessionControl(sessionId, clientId, socketId);
        if (!access.ok) return;

        const ended = await this.finish(sessionId, { endReason: 'change_partner', endedBy: clientId });
        if (!ended) return;

        await this.deliverWaitingThenRejoin(ended, ended.participants, 0);
    }

    async onDisconnect(sessionId: string, disconnectedClientId: string) {
        const ended = await this.finish(sessionId, { endReason: 'disconnect', endedBy: disconnectedClientId });
        if (!ended) return;

        for (const clientId of ended.participants) {
            if (clientId === disconnectedClientId) continue;
            if (!(await this.redis.getPresence(clientId))) continue;
            await this.transport.emitTo(clientId, SERVER_EVENTS.sessionEnded, { sessionId, reason: 'disconnect', next: 'waiting' });
        }

        const toRejoin = ended.participants.filter(id => id !== disconnectedClientId);
        await this.rejoinPresent(toRejoin, 0);
    }

    async relay(clientId: string, socketId: string, event: string, payload: unknown) {
        const sessionId = (payload as { sessionId?: string }).sessionId;
        if (!sessionId) return;

        const access = await this.requireParticipant(sessionId, clientId, socketId);
        if (!access.ok) return;

        this.transport.relay(sessionId, event, payload, socketId);
    }

    async onMediaConnected(clientId: string, socketId: string, sessionId: string) {
        const access = await this.requireParticipant(sessionId, clientId, socketId);
        if (!access.ok) return;

        const updated = await this.sessions.markConnected(sessionId, new Date());
        if (updated) {
            await this.redis.setPairBlock(updated.participants[0], updated.participants[1]);
            return;
        }

        const session = await this.sessions.findById(sessionId);
        if (!session || session.endedAt) return;
        if (session.connectedAt) await this.redis.setPairBlock(session.participants[0], session.participants[1]);
    }

    async onMediaFailed(clientId: string, socketId: string, sessionId: string) {
        const access = await this.requireParticipant(sessionId, clientId, socketId);
        if (!access.ok) return;

        if (access.session.connectedAt) return;

        await this.finishConnectFailed(sessionId, 0);
    }

    async sweep() {
        if (!(await this.redis.acquireSweeperLock())) return;

        await this.pruneQueueWithoutPresence();
        await this.sweepOpenSessions();
    }

    private async finish(sessionId: string, input: TEndSession): Promise<ISession | null> {
        const ended = await this.sessions.end(sessionId, input);
        if (!ended) return null;

        for (const clientId of ended.participants) {
            if (await this.redis.getPresence(clientId)) await this.redis.setPresenceSessionId(clientId, '');
        }

        this.transport.leaveSession(sessionId);
        return ended;
    }

    private async finishConnectFailed(sessionId: string, depth: number) {
        const ended = await this.finish(sessionId, { endReason: 'connect_failed', endedBy: null });
        if (!ended) return;

        await this.deliverWaitingThenRejoin(ended, ended.participants, depth);
    }

    private async deliverWaitingThenRejoin(ended: ISession, clientIds: string[], depth: number) {
        const reason = ended.endReason ?? 'connect_failed';

        for (const clientId of clientIds) {
            if (!(await this.redis.getPresence(clientId))) continue;
            await this.transport.emitTo(clientId, SERVER_EVENTS.sessionEnded, { sessionId: ended._id, reason, next: 'waiting' });
        }

        await this.rejoinPresent(clientIds, depth);
    }

    private async requireSessionControl(sessionId: string, clientId: string, socketId: string): Promise<TSessionAccess> {
        const session = await this.sessions.findById(sessionId);
        if (!session) {
            this.transport.emitError(socketId, ERROR_CODES.sessionNotFound);
            return { ok: false, code: ERROR_CODES.sessionNotFound };
        }

        if (!session.participants.includes(clientId)) {
            this.transport.emitError(socketId, ERROR_CODES.notAParticipant);
            return { ok: false, code: ERROR_CODES.notAParticipant };
        }

        if (session.endedAt) return { ok: false, code: ERROR_CODES.sessionEnded };

        return { ok: true, session };
    }

    private async requireParticipant(sessionId: string, clientId: string, socketId: string): Promise<TSessionAccess> {
        const session = await this.sessions.findById(sessionId);
        if (!session) {
            this.transport.emitError(socketId, ERROR_CODES.sessionNotFound);
            return { ok: false, code: ERROR_CODES.sessionNotFound };
        }

        if (!session.participants.includes(clientId)) {
            this.transport.emitError(socketId, ERROR_CODES.notAParticipant);
            return { ok: false, code: ERROR_CODES.notAParticipant };
        }

        if (session.endedAt) {
            this.transport.emitError(socketId, ERROR_CODES.sessionEnded);
            return { ok: false, code: ERROR_CODES.sessionEnded };
        }

        return { ok: true, session };
    }

    private async rejoinPresent(clientIds: string[], depth: number) {
        if (depth >= MAX_REJOIN_DEPTH) {
            this.logger.warn('Rejoin chain depth limit reached');
            return;
        }

        for (const clientId of clientIds) {
            if (!(await this.redis.getPresence(clientId))) continue;

            const result = await this.matching.join(clientId);
            if (result.type === 'queued') await this.transport.emitTo(clientId, SERVER_EVENTS.queueWaiting, { position: result.position });
            else if (result.type === 'matched') await this.onMatched(clientId, result.partnerId, depth + 1);
        }
    }

    private async pruneQueueWithoutPresence() {
        const ids = await this.matching.listWaiting();
        let removed = false;

        for (const clientId of ids) {
            if (await this.redis.getPresence(clientId)) continue;
            await this.redis.removeFromQueue(clientId);
            removed = true;
        }

        if (removed) await this.transport.broadcastQueuePositions();
    }

    private async sweepOpenSessions() {
        const timeoutSeconds = this.config.get<number>(ENVS.CONNECT_TIMEOUT_SECONDS);
        if (timeoutSeconds === undefined) throw new Error('CONNECT_TIMEOUT_SECONDS is not set');

        const cutoff = new Date(Date.now() - timeoutSeconds * 1000);
        const open = await this.sessions.findOpen();

        for (const session of open) {
            const [low, high] = session.participants;
            const lowPresence = await this.redis.getPresence(low);
            const highPresence = await this.redis.getPresence(high);

            if (!lowPresence || !highPresence) {
                const endedBy = !lowPresence ? low : high;
                await this.onDisconnect(session._id, endedBy);
                continue;
            }

            if (session.connectedAt !== null) continue;
            if (session.matchedAt > cutoff) continue;

            await this.finishConnectFailed(session._id, 0);
        }
    }
}
