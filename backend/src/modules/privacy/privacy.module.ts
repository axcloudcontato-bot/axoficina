import { Module } from '@nestjs/common';
import { PasswordService } from '../iam/services/password.service';
import { GoogleIdentityService } from '../iam/services/google-identity.service';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { IamModule } from '../iam/iam.module';

// Google sign-in accounts confirm irreversible actions with Google, as they have no password.
@Module({ imports: [IamModule], controllers: [PrivacyController], providers: [PrivacyService, PasswordService, GoogleIdentityService] })
export class PrivacyModule {}
