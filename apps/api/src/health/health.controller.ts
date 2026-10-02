import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    // Return 503 if database is unavailable
    if (database === 'down') {
      throw new ServiceUnavailableException('Database connection failed');
    }

    return {
      status: 'ok',
      database,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
