import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../shared/audit-log/audit-log.module';
import { CatalogController } from './controllers/catalog.controller';
import { CatalogManager } from './managers/catalog.manager';
import { CatalogRepository } from './repositories/catalog.repository';

@Module({
  imports: [AuditLogModule],
  controllers: [CatalogController],
  providers: [CatalogManager, CatalogRepository],
})
export class CatalogModule {}
