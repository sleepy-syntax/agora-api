import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';
import { REVIEW_COMMENT_MAX_LENGTH } from '../../constants/variables';

const createReviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(REVIEW_COMMENT_MAX_LENGTH).optional(),
});

export class CreateReviewDto extends createZodDto(createReviewSchema) {}
