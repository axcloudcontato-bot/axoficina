import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AUDIT_LOG_QUEUE } from '../queue/queue.module';
import { AuditLogRepository } from './audit-log.repository';
import type { AuditLogEvent } from './audit-log.service';
import { minimizeAuditMetadata } from './audit-metadata';

@Processor(AUDIT_LOG_QUEUE)
export class AuditLogProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditLogProcessor.name);

  constructor(private readonly auditLogRepository: AuditLogRepository) {
    super();
  }

  async process(job: Job<AuditLogEvent>): Promise<void> {
    try {
      await this.auditLogRepository.insert({
        tenantId: job.data.tenantId,
        userId: job.data.userId,
        action: job.data.action,
        entity: job.data.entity,
        entityId: job.data.entityId,
        metadata: minimizeAuditMetadata(job.data.metadata),
      });
    } catch (error) {
      this.logger.warn(`Falha ao gravar audit log (action=${job.data.action})`, error as Error);
      throw error;
    }
  }
}
