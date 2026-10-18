import { Prop, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/database/base.schema';
import { Schema } from 'src/decorators/schema.decorator';

export interface IReview {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
}

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ collection: 'reviews', timestamps: { createdAt: true, updatedAt: false } })
export class Review extends BaseSchema {
    @Prop({ type: Number, required: true, min: 1, max: 5 })
    rating!: number;

    @Prop({ type: String, default: null })
    comment!: string | null;

    createdAt!: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ createdAt: -1 });
