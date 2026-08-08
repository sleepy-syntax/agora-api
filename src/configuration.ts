import Joi from 'joi';
import { ENVS } from './constants/variables';

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
});
