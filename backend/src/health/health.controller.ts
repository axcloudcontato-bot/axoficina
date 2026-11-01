import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { Response } from 'express';
import { Public } from '../shared/decorators/public.decorator';
import { PrismaService } from '../shared/prisma/prisma.service';
import { AUDIT_LOG_QUEUE } from '../shared/queue/queue.module';

type Check = 'ok' | 'down';
const TIMEOUT_MS = 2_000;

// A dependency that does not answer in time counts as down: the monitor must not hang on a stuck database.
async function probe(run: () => Promise<unknown>): Promise<Check> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS); });
  try { await Promise.race([run(), timeout]); return 'ok'; }
  catch { return 'down'; }
  finally { clearTimeout(timer); }
}

// Answers 503 when the database or Redis is out, so the uptime monitor and the container healthcheck see a real outage.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, @InjectQueue(AUDIT_LOG_QUEUE) private readonly queue: Queue) {}

  @Public()
  @Get()
  async check(@Res({ passthrough: true }) response: Response) {
    const [database, redis] = await Promise.all([
      probe(() => this.prisma.unscoped.$queryRaw`SELECT 1`),
      // BullMQ types the connection narrowly; underneath it is an ioredis client, which answers PING.
      probe(async () => ((await this.queue.client) as unknown as { ping(): Promise<string> }).ping()),
    ]);
    const healthy = database === 'ok' && redis === 'ok';
    response.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: healthy ? 'ok' : 'error', checks: { database, redis }, timestamp: new Date().toISOString() };
  }
}
