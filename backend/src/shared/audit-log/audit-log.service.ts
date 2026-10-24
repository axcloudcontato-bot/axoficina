import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AUDIT_LOG_QUEUE } from '../queue/queue.module';
import { minimizeAuditMetadata } from './audit-metadata';

export interface AuditLogEvent {
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  constructor(@InjectQueue(AUDIT_LOG_QUEUE) private readonly queue: Queue<AuditLogEvent>) {}

  async record(event: AuditLogEvent): Promise<void> {
    await this.queue.add('record', { ...event, metadata: minimizeAuditMetadata(event.metadata) });
  }
}
