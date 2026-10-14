import { ENVS } from './constants/variables';
import { ConfigurationSchema } from './configuration';

const validBase = {
    [ENVS.MONGODB_URI]: 'mongodb://localhost:27017/test',
    [ENVS.MONGODB_DB_NAME]: 'test',
    [ENVS.REDIS_HOST]: 'localhost',
    [ENVS.REDIS_PORT]: 6379,
    [ENVS.REDIS_PASSWORD]: 'secret',
    [ENVS.STUN_URLS]: 'stun:stun.example.com:19302',
    [ENVS.TURN_URLS]: 'turn:turn.example.com:3478',
    [ENVS.TURN_USERNAME]: 'agora',
    [ENVS.TURN_PASSWORD]: 'secret',
};

type ValidatedConfiguration = {
    [ENVS.STUN_URLS]: string[];
    [ENVS.TURN_URLS]: string[];
    [ENVS.TURN_USERNAME]: string;
    [ENVS.TURN_PASSWORD]: string;
    [ENVS.PAIR_BLOCK_TTL_SECONDS]: number;
    [ENVS.PRESENCE_TTL_SECONDS]: number;
    [ENVS.CONNECT_TIMEOUT_SECONDS]: number;
    [ENVS.STATS_CACHE_TTL_SECONDS]: number;
};

function expectValid(input: Record<string, unknown>): ValidatedConfiguration {
    const result = ConfigurationSchema.validate(input);
    expect(result.error).toBeUndefined();
    return result.value as ValidatedConfiguration;
}

describe('ConfigurationSchema', function () {
    it('parses comma-separated URL lists into trimmed string arrays', function () {
        const value = expectValid({
            ...validBase,
            [ENVS.STUN_URLS]: ' stun:a:1 , ,stun:b:2,',
            [ENVS.TURN_URLS]: 'turn:one:3478, turns:two:5349 ',
        });

        expect(value[ENVS.STUN_URLS]).toEqual(['stun:a:1', 'stun:b:2']);
        expect(value[ENVS.TURN_URLS]).toEqual(['turn:one:3478', 'turns:two:5349']);
    });

    it('trims TURN credentials', function () {
        const value = expectValid({
            ...validBase,
            [ENVS.TURN_USERNAME]: '  user  ',
            [ENVS.TURN_PASSWORD]: '  pass  ',
        });

        expect(value[ENVS.TURN_USERNAME]).toBe('user');
        expect(value[ENVS.TURN_PASSWORD]).toBe('pass');
    });

    it('applies numeric defaults when timeout vars are unset', function () {
        const value = expectValid(validBase);

        expect(value[ENVS.PAIR_BLOCK_TTL_SECONDS]).toBe(3600);
        expect(value[ENVS.PRESENCE_TTL_SECONDS]).toBe(15);
        expect(value[ENVS.CONNECT_TIMEOUT_SECONDS]).toBe(20);
        expect(value[ENVS.STATS_CACHE_TTL_SECONDS]).toBe(10);
    });

    it.each([ENVS.STUN_URLS, ENVS.TURN_URLS, ENVS.TURN_USERNAME, ENVS.TURN_PASSWORD])('rejects missing %s', function (key) {
        const input = { ...validBase };
        delete (input as Record<string, unknown>)[key];

        const { error } = ConfigurationSchema.validate(input);

        expect(error).toBeDefined();
    });

    it.each([
        [ENVS.STUN_URLS, ''],
        [ENVS.STUN_URLS, ' , , '],
        [ENVS.TURN_URLS, ''],
        [ENVS.TURN_USERNAME, '   '],
        [ENVS.TURN_PASSWORD, ''],
    ])('rejects blank %s', function (key, blank) {
        const { error } = ConfigurationSchema.validate({
            ...validBase,
            [key]: blank,
        });

        expect(error).toBeDefined();
    });

    it.each([
        [ENVS.PRESENCE_TTL_SECONDS, 4],
        [ENVS.CONNECT_TIMEOUT_SECONDS, 4],
        [ENVS.PAIR_BLOCK_TTL_SECONDS, 0],
        [ENVS.STATS_CACHE_TTL_SECONDS, 0],
    ])('rejects %s below minimum', function (key, invalid) {
        const { error } = ConfigurationSchema.validate({
            ...validBase,
            [key]: invalid,
        });

        expect(error).toBeDefined();
    });

    it('rejects non-integer timeout values', function () {
        const { error } = ConfigurationSchema.validate({
            ...validBase,
            [ENVS.PAIR_BLOCK_TTL_SECONDS]: 3600.5,
        });

        expect(error).toBeDefined();
    });
});
