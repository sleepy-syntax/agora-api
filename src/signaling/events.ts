export const CLIENT_EVENTS = {
    queueJoin: 'queue.join',
    queueLeave: 'queue.leave',
    presencePing: 'presence.ping',
    signalOffer: 'signal.offer',
    signalAnswer: 'signal.answer',
    signalIce: 'signal.ice',
    mediaState: 'media.state',
    mediaConnected: 'media.connected',
    mediaFailed: 'media.failed',
    sessionNext: 'session.next',
    sessionEnd: 'session.end',
} as const;

export const SERVER_EVENTS = {
    queueWaiting: 'queue.waiting',
    queueLeft: 'queue.left',
    sessionMatched: 'session.matched',
    signalOffer: 'signal.offer',
    signalAnswer: 'signal.answer',
    signalIce: 'signal.ice',
    mediaState: 'media.state',
    sessionEnded: 'session.ended',
    error: 'error',
} as const;

export const ERROR_CODES = {
    invalidUserId: 'invalid_user_id',
    invalidPayload: 'invalid_payload',
    alreadyInSession: 'already_in_session',
    notInQueue: 'not_in_queue',
    sessionNotFound: 'session_not_found',
    notAParticipant: 'not_a_participant',
    sessionEnded: 'session_ended',
    rateLimited: 'rate_limited',
} as const;

export type TErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface IErrorPayload {
    code: TErrorCode;
    message: string;
}

export const ERROR_MESSAGES: Record<TErrorCode, string> = {
    [ERROR_CODES.invalidUserId]: 'Invalid client id',
    [ERROR_CODES.invalidPayload]: 'Invalid payload',
    [ERROR_CODES.alreadyInSession]: 'Already in a session',
    [ERROR_CODES.notInQueue]: 'Not in the waiting queue',
    [ERROR_CODES.sessionNotFound]: 'Session not found',
    [ERROR_CODES.notAParticipant]: 'Not a session participant',
    [ERROR_CODES.sessionEnded]: 'Session has ended',
    [ERROR_CODES.rateLimited]: 'Too many join attempts',
};
