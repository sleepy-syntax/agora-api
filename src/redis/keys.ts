export const PAIR_KEY_PREFIX = 'agora:pair:';
export const PRESENCE_KEY_PREFIX = 'agora:presence:';

export function queueKey() {
    return 'agora:queue';
}

export function presenceKey(clientId: string) {
    return `${PRESENCE_KEY_PREFIX}${clientId}`;
}

export function pairKey(a: string, b: string) {
    if (a < b) return `${PAIR_KEY_PREFIX}${a}:${b}`;
    return `${PAIR_KEY_PREFIX}${b}:${a}`;
}

export function sessionKey(sessionId: string) {
    return `agora:session:${sessionId}`;
}

export function statsKey() {
    return 'agora:stats:public';
}

export function sweeperLockKey() {
    return 'agora:lock:sweeper';
}

export function rateKey(scope: string, id: string) {
    return `agora:rate:${scope}:${id}`;
}
