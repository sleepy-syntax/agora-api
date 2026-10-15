export type TJoinResult = { type: 'queued'; position: number } | { type: 'matched'; partnerId: string } | { type: 'rejected'; code: 'already_in_session' };

export type TLeaveResult = { type: 'left' } | { type: 'rejected'; code: 'not_in_queue' };
