import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IReview, Review } from './review.schema';

function normalizeComment(comment: string | undefined): string | null {
    if (comment === undefined) return null;
    const trimmed = comment.trim();
    if (!trimmed) return null;
    return trimmed;
}

@Injectable()
export class ReviewsService {
    constructor(@InjectModel(Review.name) private readonly reviewModel: Model<Review>) {}

    async create(rating: number, comment: string | undefined): Promise<IReview> {
        const storedComment = normalizeComment(comment);

        const doc = await this.reviewModel.create({ rating, comment: storedComment });
        const row = doc.toObject();

        return row;
    }
}
