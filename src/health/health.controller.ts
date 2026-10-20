import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { HealthService } from './health.service';
import type { IHealth } from './types';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(private readonly health: HealthService) {}

    @Get()
    @ApiOperation({ summary: 'Mongo and Redis reachability' })
    @ApiOkResponse({ description: 'Both dependencies are up' })
    @ApiResponse({ status: 503, description: 'Mongo or Redis is down' })
    async check(@Res({ passthrough: true }) reply: FastifyReply): Promise<IHealth> {
        const report = await this.health.check();
        if (report.status === 'degraded') reply.status(HttpStatus.SERVICE_UNAVAILABLE);
        return report;
    }
}
