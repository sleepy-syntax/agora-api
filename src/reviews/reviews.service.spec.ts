import { ReviewsService } from './reviews.service';

function createService(create: jest.Mock) {
    return new ReviewsService({ create } as never);
}

describe('ReviewsService', function () {
    let create: jest.Mock;

    beforeEach(function () {
        create = jest.fn();
    });

    it('stores null when comment is omitted', async function () {
        const createdAt = new Date('2026-10-14T00:00:00.000Z');
        create.mockResolvedValue({
            toObject: () => ({
                id: '665f0c0b9a0c4e8a12345678',
                rating: 5,
                comment: null,
                createdAt,
            }),
        });

        const service = createService(create);
        const result = await service.create(5, undefined);

        expect(create).toHaveBeenCalledWith({ rating: 5, comment: null });
        expect(result).toEqual({
            id: '665f0c0b9a0c4e8a12345678',
            rating: 5,
            comment: null,
            createdAt,
        });
    });

    it('stores null for empty or whitespace-only comments', async function () {
        create.mockResolvedValue({
            toObject: () => ({
                id: '665f0c0b9a0c4e8a12345678',
                rating: 4,
                comment: null,
                createdAt: new Date(),
            }),
        });

        const service = createService(create);

        await service.create(4, '');
        await service.create(4, '   \n\t');

        expect(create).toHaveBeenNthCalledWith(1, { rating: 4, comment: null });
        expect(create).toHaveBeenNthCalledWith(2, { rating: 4, comment: null });
    });

    it('trims surrounding whitespace before insert', async function () {
        create.mockResolvedValue({
            toObject: () => ({
                id: '665f0c0b9a0c4e8a12345678',
                rating: 3,
                comment: 'Nice chat.',
                createdAt: new Date(),
            }),
        });

        const service = createService(create);
        await service.create(3, '  Nice chat.  ');

        expect(create).toHaveBeenCalledWith({ rating: 3, comment: 'Nice chat.' });
    });
});
