import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SignalingService } from './signaling.service';

const SWEEP_INTERVAL_MS = 5000;

@Injectable()
export class SessionSweeper implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(SessionSweeper.name);
    private timer: NodeJS.Timeout | undefined;

    constructor(private readonly signaling: SignalingService) {}

    onModuleInit() {
        this.timer = setInterval(() => {
            void this.signaling.sweep().catch(error => {
                const message = error instanceof Error ? error.message : 'Sweep failed';
                this.logger.error(message);
            });
        }, SWEEP_INTERVAL_MS);
        this.timer.unref();
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }
}
