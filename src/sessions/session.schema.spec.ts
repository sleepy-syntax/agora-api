import { SessionSchema } from './session.schema';

describe('SessionSchema', function () {
    it('does not define status or media fields', function () {
        expect(SessionSchema.path('status')).toBeUndefined();
        expect(SessionSchema.path('cameraEnabled')).toBeUndefined();
        expect(SessionSchema.path('micEnabled')).toBeUndefined();
    });

    it('does not use Mongoose timestamps', function () {
        expect(SessionSchema.path('createdAt')).toBeUndefined();
        expect(SessionSchema.path('updatedAt')).toBeUndefined();
    });

    it('registers the four session indexes', function () {
        const indexes = SessionSchema.indexes().map(entry => entry[0]);

        expect(indexes).toEqual(
            expect.arrayContaining([{ matchedAt: -1 }, { endedAt: 1, matchedAt: 1 }, { endedAt: 1, connectedAt: 1 }, { participants: 1, matchedAt: -1 }]),
        );
    });
});
