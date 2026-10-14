export interface IPresence {
    socketId: string;
    sessionId: string;
}

export interface ISessionHash {
    participantLow: string;
    participantHigh: string;
    offererId: string;
    matchedAt: string;
    connectedAt: string;
    endedAt: string;
    endReason: string;
    endedBy: string;
}

export type TJoinQueueResult = { kind: 'queued'; position: number } | { kind: 'matched'; partnerId: string };
