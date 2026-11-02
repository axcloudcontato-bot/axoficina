import { Module } from '@nestjs/common';
import { CspReportController } from './csp-report.controller';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController, CspReportController],
})
export class HealthModule {}
