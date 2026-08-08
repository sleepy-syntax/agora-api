import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { IncomingHttpHeaders } from 'node:http';
import { PinoLogger } from 'nestjs-pino';
import { Observable } from 'rxjs';
import type { FastifyRequest } from 'fastify';

function getPath(url: string): string {
    const queryStart = url.indexOf('?');
    return queryStart === -1 ? url : url.slice(0, queryStart);
}

function getRelevantHeaders(headers: IncomingHttpHeaders) {
    return {
        host: headers.host,
        contentType: headers['content-type'],
        contentLength: headers['content-length'],
        userAgent: headers['user-agent'],
        referer: headers.referer,
        forwardedFor: headers['x-forwarded-for'],
    };
}

@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
    constructor(private readonly logger: PinoLogger) {
        this.logger.setContext(RequestLogInterceptor.name);
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== 'http' || !this.logger.logger.isLevelEnabled('debug')) return next.handle();

        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const originalUrl = request.url;

        const logRequest = {
            ip: request.ip,
            method: request.method,
            originalUrl,
            path: getPath(originalUrl),
            route: request.routeOptions?.url,
            hostname: request.hostname,
            protocol: request.protocol,
            body: request.body,
            query: request.query,
            params: request.params,
            headers: getRelevantHeaders(request.headers),
        };

        this.logger.debug({ request: logRequest }, 'request received');

        return next.handle();
    }
}
