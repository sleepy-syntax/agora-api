export const SET_PRESENCE_SCRIPT = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local socketId = ARGV[2]
local sessionId = ARGV[3]
redis.call('HSET', key, 'socketId', socketId, 'sessionId', sessionId)
redis.call('EXPIRE', key, ttl)
return 1
`.trim();

export const SET_PRESENCE_SESSION_ID_SCRIPT = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local sessionId = ARGV[2]
if redis.call('EXISTS', key) == 0 then
    return 0
end
redis.call('HSET', key, 'sessionId', sessionId)
redis.call('EXPIRE', key, ttl)
return 1
`.trim();

export const DELETE_PRESENCE_IF_SOCKET_SCRIPT = `
local key = KEYS[1]
local socketId = ARGV[1]
if redis.call('HGET', key, 'socketId') == socketId then
    redis.call('DEL', key)
    return 1
end
return 0
`.trim();
