import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { SettingsController } from './controllers/settings.controller';
import { SettingsManager } from './managers/settings.manager';
import { SecretEncryptionService } from './services/secret-encryption.service';
import { TenantMailerService } from './services/tenant-mailer.service';
import { WaAkgService } from './services/wa-akg.service';
import { WhatsAppSettingsController } from './controllers/whatsapp-settings.controller';

@Module({
  imports: [IamModule],
  controllers: [SettingsController, WhatsAppSettingsController],
  providers: [SettingsManager, SecretEncryptionService, TenantMailerService, WaAkgService],
  exports: [TenantMailerService, WaAkgService],
})
export class SettingsModule {}
