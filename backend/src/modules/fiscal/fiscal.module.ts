import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { SettingsModule } from '../settings/settings.module';
import { FiscalController } from './fiscal.controller';
import { FiscalManager } from './fiscal.manager';
import { FiscalRepository } from './fiscal.repository';
import { FocusNfeClient } from './focus-nfe.client';
import { IbgeCityService } from './ibge-city.service';

@Module({
  imports: [IamModule, SettingsModule],
  controllers: [FiscalController],
  providers: [FiscalManager, FiscalRepository, FocusNfeClient, IbgeCityService],
})
export class FiscalModule {}
