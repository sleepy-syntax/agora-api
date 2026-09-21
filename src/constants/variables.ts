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

    /* Database */
    MONGODB_URI: 'MONGODB_URI',
    MONGODB_DB_NAME: 'MONGODB_DB_NAME',
} as const;
