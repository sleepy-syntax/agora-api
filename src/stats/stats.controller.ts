import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { IPublicStats } from './types';

@ApiTags('Stats')
@Controller('stats')
export class StatsController {
    constructor(private readonly stats: StatsService) {}

    @Get()
    @ApiOperation({ summary: 'Public aggregate stats' })
    @ApiOkResponse({
        description: 'waitingNow, liveSessions, conversationsToday, conversationsAllTime, averageDurationSeconds, averageRating, ratingCount',
    })
    snapshot(): Promise<IPublicStats> {
        return this.stats.snapshot();
    }
}
