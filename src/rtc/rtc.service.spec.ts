import { ConfigService } from '@nestjs/config';
import { ENVS } from '../constants/variables';
import { RtcService } from './rtc.service';

describe('RtcService', function () {
    it('returns STUN without credentials and TURN with username and credential', function () {
        const config = {
            get: jest.fn((key: string) => {
                if (key === ENVS.STUN_URLS) return ['stun:stun.example.com:3478'];
                if (key === ENVS.TURN_URLS) return ['turn:turn.example.com:3478'];
                if (key === ENVS.TURN_USERNAME) return 'agora';
                if (key === ENVS.TURN_PASSWORD) return 'secret';
                return undefined;
            }),
        } as unknown as ConfigService;

        const service = new RtcService(config);
        const servers = service.iceServers();

        expect(servers).toEqual([{ urls: ['stun:stun.example.com:3478'] }, { urls: ['turn:turn.example.com:3478'], username: 'agora', credential: 'secret' }]);
        expect(servers[0]).not.toHaveProperty('username');
        expect(servers[0]).not.toHaveProperty('credential');
    });
});
