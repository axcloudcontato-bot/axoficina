import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { UsersController } from './controllers/users.controller';
import { AccessProfilesController } from './controllers/access-profiles.controller';
import { AuthManager } from './managers/auth.manager';
import { UserManager } from './managers/user.manager';
import { AccessProfileManager } from './managers/access-profile.manager';
import { TenantRepository } from './repositories/tenant.repository';
import { UserRepository } from './repositories/user.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { RoleRepository } from './repositories/role.repository';
import { PasswordService } from './services/password.service';
import { PasswordResetService } from './services/password-reset.service';
import { TokenService } from './services/token.service';
// Instanciados aqui (em vez de importar SettingsModule) para evitar
// dependência circular: SettingsModule já importa IamModule por causa do
// TenantRepository. São serviços sem estado — ter uma segunda instância
// aqui não tem efeito colateral.
import { SecretEncryptionService } from '../settings/services/secret-encryption.service';
import { TenantMailerService } from '../settings/services/tenant-mailer.service';

// DocumentValidatorService vem do DocumentsModule (@Global(), registrado em
// AppModule) — não precisa estar nos providers aqui.
@Module({
  controllers: [AuthController, UsersController, AccessProfilesController],
  providers: [
    AuthManager,
    UserManager,
    AccessProfileManager,
    TenantRepository,
    UserRepository,
    RefreshTokenRepository,
    RoleRepository,
    PasswordService,
    PasswordResetService,
    TokenService,
    SecretEncryptionService,
    TenantMailerService,
  ],
  // ServiceOrderManager (Feature 5) precisa validar que um technicianId
  // existe e pertence ao tenant — mesmo padrão de export do CustomerRepository.
  // TenantRepository: MaintenanceAlertsModule (Feature Motor de Manutenção
  // Preventiva) precisa iterar todos os tenants no job diário de scan.
  exports: [UserRepository, TenantRepository, RoleRepository],
})
export class IamModule {}
