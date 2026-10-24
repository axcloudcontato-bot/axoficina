import { Module } from '@nestjs/common';
import { PasswordService } from '../iam/services/password.service';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { IamModule } from '../iam/iam.module';

@Module({ imports: [IamModule], controllers: [PrivacyController], providers: [PrivacyService, PasswordService] })
export class PrivacyModule {}
