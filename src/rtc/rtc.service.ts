import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVS } from '../constants/variables';
import type { TIceServer } from './types';

@Injectable()
export class RtcService {
    constructor(private readonly config: ConfigService) {}

    iceServers(): TIceServer[] {
        const stunUrls = this.config.get<string[]>(ENVS.STUN_URLS);
        const turnUrls = this.config.get<string[]>(ENVS.TURN_URLS);
        const username = this.config.get<string>(ENVS.TURN_USERNAME);
        const credential = this.config.get<string>(ENVS.TURN_PASSWORD);

        if (!stunUrls?.length) throw new Error('STUN_URLS is not set');
        if (!turnUrls?.length) throw new Error('TURN_URLS is not set');
        if (!username) throw new Error('TURN_USERNAME is not set');
        if (!credential) throw new Error('TURN_PASSWORD is not set');

        return [{ urls: stunUrls }, { urls: turnUrls, username, credential }];
    }
}
