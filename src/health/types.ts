export type TDependencyStatus = 'up' | 'down';

export interface IHealth {
    status: 'ok' | 'degraded';
    mongo: TDependencyStatus;
    redis: TDependencyStatus;
}
