import { LoggerModule } from 'nestjs-pino';
import { RequestMethod } from '@nestjs/common';
import { SENSITIVE_LOG_PATHS } from './constants/variables';

const isProduction = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug');

export const NestLoggerModule = LoggerModule.forRoot({
    forRoutes: [{ path: '*path', method: RequestMethod.ALL }],

    pinoHttp: {
        name: 'nestjs-app',

        level,
        quietReqLogger: true,
        redact: { paths: SENSITIVE_LOG_PATHS, censor: '[REDACTED]' },

        customLogLevel: (_request, response, error) => {
            if (error || response.statusCode >= 500) return 'error';
            if (response.statusCode >= 400) return 'warn';
            return 'info';
        },

        transport: isProduction ? undefined : { target: 'pino-pretty', options: { singleLine: true, colorize: true, translateTime: 'SYS:standard' } },
    },
});
