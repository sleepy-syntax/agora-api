export interface IIceServerStun {
    urls: string[];
}

export interface IIceServerTurn {
    urls: string[];
    username: string;
    credential: string;
}

export type TIceServer = IIceServerStun | IIceServerTurn;
