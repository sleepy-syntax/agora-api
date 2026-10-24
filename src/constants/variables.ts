export const REQUEST_ID_HEADER = 'X-Request-Id';
export const SENSITIVE_LOG_PATHS = [
    'req.headers.authorization',
    'req.headers.cookie',
    'request.body.password',
    'request.body.passwordConfirmation',
    'request.body.token',
    'request.body.accessToken',
    'request.body.refreshToken',
    'request.body.secret',
    'request.body.apiKey',
    'request.body.candidate',
    'req.body.candidate',
    'request.query.token',
    'request.query.accessToken',
    'request.query.apiKey',
];

export const ENVS = {
    /* General */
    NODE_ENV: 'NODE_ENV',
    PORT: 'PORT',
    GLOBAL_PREFIX: 'GLOBAL_PREFIX',
    SWAGGER: 'SWAGGER',
    LOG_LEVEL: 'LOG_LEVEL',
    CLIENT_URL: 'CLIENT_URL',
    SOCKET_PATH: 'SOCKET_PATH',

    /* Database */
    MONGODB_URI: 'MONGODB_URI',
    MONGODB_DB_NAME: 'MONGODB_DB_NAME',

    /* Redis */
    REDIS_HOST: 'REDIS_HOST',
    REDIS_PORT: 'REDIS_PORT',
    REDIS_PASSWORD: 'REDIS_PASSWORD',

    /* RTC and matching */
    STUN_URLS: 'STUN_URLS',
    TURN_URLS: 'TURN_URLS',
    TURN_USERNAME: 'TURN_USERNAME',
    TURN_PASSWORD: 'TURN_PASSWORD',
    PAIR_BLOCK_TTL_SECONDS: 'PAIR_BLOCK_TTL_SECONDS',
    PRESENCE_TTL_SECONDS: 'PRESENCE_TTL_SECONDS',
    CONNECT_TIMEOUT_SECONDS: 'CONNECT_TIMEOUT_SECONDS',
    STATS_CACHE_TTL_SECONDS: 'STATS_CACHE_TTL_SECONDS',
} as const;

export const REVIEW_COMMENT_MAX_LENGTH = 1000;

export const RATE_LIMITS = {
    queueJoinPerClient: { limit: 10, windowSeconds: 60 },
    queueJoinPerIp: { limit: 30, windowSeconds: 60 },
    reviewsPerIp: { limit: 10, windowSeconds: 3600 },
} as const;
