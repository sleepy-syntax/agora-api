import type { DefaultEventsMap, Server, Socket } from 'socket.io';

export interface ISocketData {
    userId: string;
}

export type TSignalingSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, ISocketData>;

export type TSignalingServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, ISocketData>;
