import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { REQUEST_ID_HEADER } from './constants/variables';
import { RequestMethod } from '@nestjs/common';

export const NestLoggerModule = LoggerModule.forRoot({
    forRoutes: [
        { path: '/', method: RequestMethod.ALL },
        { path: '*path', method: RequestMethod.ALL },
    ],

    pinoHttp: {
        name: 'nestjs-app',

        level: 'debug',
        quietReqLogger: true,

        genReqId: (req, res) => {
            const id = req.id || req.headers[REQUEST_ID_HEADER];
            if (id) return id;

            const newId = randomUUID();
            res.setHeader(REQUEST_ID_HEADER, newId);
            return newId;
        },

        transport: { level: 'debug', target: 'pino-pretty', options: { singleLine: true, colorize: true, translateTime: 'SYS:standard' } },
    },
});
