import type { ISession } from './session.schema';

export class SessionHashWriteError extends Error {
    constructor(
        readonly session: ISession,
        message: string,
    ) {
        super(message);
        this.name = 'SessionHashWriteError';
    }
}
