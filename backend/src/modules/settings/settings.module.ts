import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { SettingsController } from './controllers/settings.controller';
import { SettingsManager } from './managers/settings.manager';
import { SecretEncryptionService } from './services/secret-encryption.service';
import { TenantMailerService } from './services/tenant-mailer.service';
import { WaAkgService } from './services/wa-akg.service';
import { WhatsAppSettingsController } from './controllers/whatsapp-settings.controller';
import { WorkshopAccountController } from './controllers/workshop-account.controller';
import { WorkshopAccountService } from './services/workshop-account.service';

@Module({
  imports: [IamModule],
  controllers: [SettingsController, WhatsAppSettingsController, WorkshopAccountController],
  providers: [SettingsManager, SecretEncryptionService, TenantMailerService, WaAkgService, WorkshopAccountService],
  exports: [TenantMailerService, WaAkgService, SecretEncryptionService],
})
export class SettingsModule {}
