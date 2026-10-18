import Joi from 'joi';
import { ENVS } from './constants/variables';

function parseRequiredUrlList(value: unknown, helpers: Joi.CustomHelpers<string[]>): string[] | Joi.ErrorReport {
    if (value === undefined || value === null || value === '') return helpers.error('any.required');
    if (typeof value !== 'string') return helpers.error('any.invalid');

    const urls = value
        .split(',')
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0);

    if (urls.length === 0) return helpers.error('any.invalid');
    return urls;
}

function parseRequiredTrimmedString(value: unknown, helpers: Joi.CustomHelpers<string>): string | Joi.ErrorReport {
    if (value === undefined || value === null || value === '') return helpers.error('any.required');
    if (typeof value !== 'string') return helpers.error('any.invalid');
    const trimmed = value.trim();
    if (trimmed.length === 0) return helpers.error('any.invalid');
    return trimmed;
}

const requiredUrlList = (description: string) => Joi.custom(parseRequiredUrlList).required().description(description);

const requiredTrimmedString = (description: string) => Joi.custom(parseRequiredTrimmedString).required().description(description);

export const ConfigurationSchema = Joi.object({
    /* General */
    [ENVS.NODE_ENV]: Joi.string()
        .valid('development', 'production', 'test')
        .default('development')
        .description('The environment the application is running in'),
    [ENVS.SWAGGER]: Joi.boolean().default(false).description('Enable swagger'),
    [ENVS.GLOBAL_PREFIX]: Joi.string().default('api/v1').description('The global prefix of the application'),
    [ENVS.PORT]: Joi.number().default(3000).description('The port the application will listen to'),
    [ENVS.LOG_LEVEL]: Joi.string().valid('debug', 'info', 'warn', 'error').default('info').description('The level of logging'),
    [ENVS.CLIENT_URL]: Joi.string().uri().default('http://localhost:3000').description('The URL of the client'),
    [ENVS.SOCKET_PATH]: Joi.string().trim().min(1).pattern(/^\//).default('/socket.io').description('Socket.IO path. Not under the HTTP prefix'),

    /* Database */
    [ENVS.MONGODB_URI]: Joi.string().uri().required().description('The URI of the MongoDB database'),
    [ENVS.MONGODB_DB_NAME]: Joi.string().required().description('The name of the MongoDB database'),

    /* Redis */
    [ENVS.REDIS_HOST]: Joi.string().required().description('The host of the Redis database'),
    [ENVS.REDIS_PORT]: Joi.number().required().description('The port of the Redis database'),
    [ENVS.REDIS_PASSWORD]: Joi.string().required().description('The password of the Redis database'),

    /* RTC and matching */
    [ENVS.STUN_URLS]: requiredUrlList('Comma-separated STUN URLs. Required. At least one URL after trim. No default.'),
    [ENVS.TURN_URLS]: requiredUrlList('Comma-separated TURN URLs. Required. At least one URL after trim. No default.'),
    [ENVS.TURN_USERNAME]: requiredTrimmedString('TURN username'),
    [ENVS.TURN_PASSWORD]: requiredTrimmedString('TURN credential'),
    [ENVS.PAIR_BLOCK_TTL_SECONDS]: Joi.number().integer().min(1).default(3600).description('Pair-block TTL from the moment WebRTC connects'),
    [ENVS.PRESENCE_TTL_SECONDS]: Joi.number().integer().min(5).default(15).description('Presence key TTL, refreshed by pings'),
    [ENVS.CONNECT_TIMEOUT_SECONDS]: Joi.number().integer().min(5).default(20).description('How long a session may stay without connectedAt'),
    [ENVS.STATS_CACHE_TTL_SECONDS]: Joi.number().integer().min(1).default(10).description('Public stats cache TTL'),
});
