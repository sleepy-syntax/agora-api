import { parseUserId } from './user-id';

const VALID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('parseUserId', function () {
    it('lowercases and trims a valid v4 id', function () {
        expect(parseUserId('  7C9E6679-7425-40DE-944B-E07FC1F90AE7  ')).toBe(VALID);
    });

    it('accepts a lowercase valid v4 id', function () {
        expect(parseUserId(VALID)).toBe(VALID);
    });

    it('rejects non-v4 version nibble', function () {
        expect(parseUserId('7c9e6679-7425-30de-944b-e07fc1f90ae7')).toBeNull();
    });

    it('rejects invalid variant nibble', function () {
        expect(parseUserId('7c9e6679-7425-40de-c44b-e07fc1f90ae7')).toBeNull();
    });

    it('rejects non-strings', function () {
        expect(parseUserId(null)).toBeNull();
        expect(parseUserId(undefined)).toBeNull();
        expect(parseUserId(42)).toBeNull();
        expect(parseUserId({})).toBeNull();
    });

    it('rejects empty or whitespace-only strings', function () {
        expect(parseUserId('')).toBeNull();
        expect(parseUserId('   ')).toBeNull();
    });
});
