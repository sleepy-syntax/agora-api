import { Logger, LogLevel } from '@nestjs/common';
import { RequestNamespace } from './middlewares/req-log.middleware';
import { REQUEST_NAMESPACE_REQUEST_ID_KEY } from './constants/variables';

export class AppLogger extends Logger {
    getRequestId() {
        return RequestNamespace.get(REQUEST_NAMESPACE_REQUEST_ID_KEY);
    }

    customLog(level: LogLevel, message: unknown, context?: string) {
        const requestId = this.getRequestId();

        if (typeof message === 'string') return super[level]({ requestId }, message, context);
        if (typeof message === 'object' && message !== null) return super[level](JSON.stringify({ requestId, ...message }), context);

        return super[level](message, context);
    }

    log(message: unknown, context?: string) {
        return this.customLog('log', message, context);
    }

    error(message: unknown, context?: string) {
        return this.customLog('error', message, context);
    }

    warn(message: unknown, context?: string) {
        return this.customLog('warn', message, context);
    }
}
