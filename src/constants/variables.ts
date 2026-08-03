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
    SWAGGER: 'SWAGGER',
    GLOBAL_PREFIX: 'GLOBAL_PREFIX',
    NODE_ENV: 'NODE_ENV',
    PORT: 'PORT',
} as const;
