import type { TJoinQueueResult } from './types';

export const QUEUE_MATCH_SCRIPT = `
local queue = KEYS[1]
local userId = ARGV[1]
local pairPrefix = ARGV[2]
local presencePrefix = ARGV[3]

local function pair_key(a, b)
    if a < b then
        return pairPrefix .. a .. ':' .. b
    end
    return pairPrefix .. b .. ':' .. a
end

local existing = redis.call('LPOS', queue, userId)
if existing then
    return { 'QUEUED', tostring(existing + 1) }
end

local len = redis.call('LLEN', queue)
local idx = 0
while idx < len do
    local candidate = redis.call('LINDEX', queue, idx)
    if not candidate then
        break
    end
    if redis.call('EXISTS', presencePrefix .. candidate) == 0 then
        redis.call('LREM', queue, 1, candidate)
        len = len - 1
    elseif redis.call('EXISTS', pair_key(userId, candidate)) == 0 then
        redis.call('LREM', queue, 0, candidate)
        return { 'MATCHED', candidate }
    else
        idx = idx + 1
    end
end

redis.call('RPUSH', queue, userId)
local pos = redis.call('LPOS', queue, userId)
return { 'QUEUED', tostring(pos + 1) }
`.trim();

function isTwoStringTuple(reply: unknown): reply is [string, string] {
    return Array.isArray(reply) && reply.length === 2 && typeof reply[0] === 'string' && typeof reply[1] === 'string';
}

export function parseQueueMatchReply(reply: unknown): TJoinQueueResult {
    if (!isTwoStringTuple(reply)) throw new Error('Invalid queue match reply');

    const [tag, value] = reply;

    if (tag === 'QUEUED') {
        const position = Number.parseInt(value, 10);
        if (!Number.isFinite(position) || position < 1) throw new Error('Invalid queue position');
        return { kind: 'queued', position };
    }

    if (tag === 'MATCHED') return { kind: 'matched', partnerId: value };
    throw new Error('Invalid queue match reply');
}
