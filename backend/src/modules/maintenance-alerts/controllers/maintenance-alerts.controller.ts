import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { MaintenanceAlertContactResponse, MaintenanceAlertListItemResponse, MaintenanceAlertResponse, PaginationData } from '@oficina/contracts';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { MaintenanceAlertManager } from '../managers/maintenance-alert.manager';
import { DismissMaintenanceAlertDto, MaintenanceAlertContactsDto, MaintenanceAlertListDto, RecordMaintenanceAlertContactDto, ReopenMaintenanceAlertDto, ResolveMaintenanceAlertDto, SnoozeMaintenanceAlertDto } from '../dto/maintenance-alert.dto';

// Todos os 4 papéis têm acesso total — mesmo padrão de Ordem de Serviço
// (spec: recepção, gerente e mecânico todos precisam ver quem está devendo
// revisão e podem marcar como resolvido).
const ALL_ROLES = ['ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC'] as const;

@Controller('api/v1')
export class MaintenanceAlertsController {
  constructor(private readonly maintenanceAlertManager: MaintenanceAlertManager) {}

  @Roles(...ALL_ROLES)
  @Permissions('alerts.view')
  @HttpCode(HttpStatus.OK)
  @Post('maintenance-alerts/list')
  async list(@Body() body: MaintenanceAlertListDto): Promise<PaginationData<MaintenanceAlertListItemResponse>> {
    return this.maintenanceAlertManager.list(body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('alerts.manage')
  @HttpCode(HttpStatus.OK)
  @Post('maintenance-alerts/resolve')
  async resolve(
    @CurrentUser() actingUser: AuthenticatedUser,
    @Body() body: ResolveMaintenanceAlertDto,
  ): Promise<{ alert: MaintenanceAlertResponse }> {
    return this.maintenanceAlertManager.resolve(actingUser, body.id);
  }

  @Roles(...ALL_ROLES)
  @Permissions('alerts.manage')
  @HttpCode(HttpStatus.OK)
  @Post('maintenance-alerts/snooze')
  async snooze(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: SnoozeMaintenanceAlertDto): Promise<{ alert: MaintenanceAlertResponse }> {
    return this.maintenanceAlertManager.snooze(actingUser, body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('alerts.manage')
  @HttpCode(HttpStatus.OK)
  @Post('maintenance-alerts/dismiss')
  async dismiss(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: DismissMaintenanceAlertDto): Promise<{ alert: MaintenanceAlertResponse }> {
    return this.maintenanceAlertManager.dismiss(actingUser, body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('alerts.manage')
  @HttpCode(HttpStatus.OK)
  @Post('maintenance-alerts/reopen')
  async reopen(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: ReopenMaintenanceAlertDto): Promise<{ alert: MaintenanceAlertResponse }> {
    return this.maintenanceAlertManager.reopen(actingUser, body.id);
  }

  @Roles(...ALL_ROLES)
  @Permissions('alerts.manage')
  @HttpCode(HttpStatus.OK)
  @Post('maintenance-alerts/contact')
  async recordContact(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: RecordMaintenanceAlertContactDto): Promise<{ alert: MaintenanceAlertResponse }> {
    return this.maintenanceAlertManager.recordContact(actingUser, body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('alerts.view')
  @HttpCode(HttpStatus.OK)
  @Post('maintenance-alerts/contacts')
  async contacts(@Body() body: MaintenanceAlertContactsDto): Promise<{ contacts: MaintenanceAlertContactResponse[] }> {
    return this.maintenanceAlertManager.contacts(body.id);
  }
}
