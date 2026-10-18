import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { INestApplicationContext } from '@nestjs/common';
import type { Server, ServerOptions } from 'socket.io';
import type { Redis } from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
    private adapterConstructor: ReturnType<typeof createAdapter> | undefined;
    private pubClient: Redis | undefined;
    private subClient: Redis | undefined;

    constructor(app: INestApplicationContext) {
        super(app);
    }

    async connect(pubClient: Redis, subClient: Redis) {
        if (pubClient.status === 'wait') await pubClient.connect();
        if (subClient.status === 'wait') await subClient.connect();

        this.pubClient = pubClient;
        this.subClient = subClient;
        this.adapterConstructor = createAdapter(pubClient, subClient);
    }

    createIOServer(port: number, options?: ServerOptions): Server {
        const server = super.createIOServer(port, options) as Server;
        if (this.adapterConstructor) server.adapter(this.adapterConstructor);

        server.on('close', () => {
            void this.pubClient?.quit();
            void this.subClient?.quit();
        });

        return server;
    }
}
