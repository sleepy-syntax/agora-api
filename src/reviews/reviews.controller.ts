import { Body, Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { RATE_LIMITS } from '../constants/variables';
import { RedisService } from '../redis/redis.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { IReview } from './review.schema';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
    constructor(
        private readonly reviews: ReviewsService,
        private readonly redis: RedisService,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Submit a rating and optional comment' })
    @ApiCreatedResponse({ description: 'Review stored' })
    @ApiResponse({ status: 400, description: 'Invalid body or comment too long' })
    @ApiResponse({ status: 429, description: 'Too many requests' })
    async create(@Body() body: CreateReviewDto, @Req() request: FastifyRequest): Promise<IReview> {
        const { limit, windowSeconds } = RATE_LIMITS.reviewsPerIp;
        const ip = request.ip ?? 'unknown';
        const allowed = await this.redis.rateLimit('review-ip', ip, limit, windowSeconds);
        if (!allowed) throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);

        return this.reviews.create(body.rating, body.comment);
    }
}
