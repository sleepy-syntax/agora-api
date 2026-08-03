import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { createNamespace } from 'cls-hooked';
import { randomUUID } from 'crypto';
import { AppLogger } from 'src/app.logger';
import { REQUEST_ID_HEADER, REQUEST_NAMESPACE_NAME, REQUEST_NAMESPACE_REQUEST_ID_KEY } from 'src/constants/variables';

@Injectable()
export class ReqLogMiddleware implements NestMiddleware {
    private readonly logger = new AppLogger(ReqLogMiddleware.name);

    use(req: Request, res: Response, next: NextFunction) {
        const { ip, method, originalUrl, path, query, params, headers } = req;
        const body = req.body as unknown;
        const userAgent = req.get('user-agent');

        let id = req.get(REQUEST_ID_HEADER);

        if (!id) {
            id = randomUUID();
            res.header(REQUEST_ID_HEADER, id);
        }

        this.logger.debug(
            {
                request: { ip, method, originalUrl, path, body, query, params, headers, userAgent },
                requestId: id,
            },
            'request received',
        );

        RequestNamespace.run(() => {
            RequestNamespace.set(REQUEST_NAMESPACE_REQUEST_ID_KEY, id);
            next();
        });
    }
}

export const RequestNamespace = createNamespace<{ [REQUEST_NAMESPACE_REQUEST_ID_KEY]: string }>(REQUEST_NAMESPACE_NAME);
