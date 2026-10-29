import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AppointmentManager } from '../managers/appointment.manager';
import { AppointmentNotificationService } from '../services/appointment-notification.service';
import {
  AppointmentListDto,
  CreateAppointmentDto,
  NotifyAppointmentDto,
  RetryReminderDto,
  StartAppointmentDto,
  TransitionAppointmentDto,
  UpdateAppointmentDto,
} from '../dto/appointment.dto';

const ALL_ROLES = ['ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC'] as const;

@Controller('api/v1/appointments')
export class AppointmentsController {
  constructor(private readonly manager: AppointmentManager, private readonly notifications: AppointmentNotificationService) {}

  @Roles('ADMIN', 'MANAGER')
  @Permissions('settings.view')
  @Get('reminder-health')
  reminderHealth(@CurrentUser() user: AuthenticatedUser) { return this.notifications.reminderHealth(user.tenantId); }

  @Roles('ADMIN', 'MANAGER')
  @Permissions('appointments.manage')
  @Post('reminder-retry') @HttpCode(HttpStatus.OK)
  retryReminder(@CurrentUser() user: AuthenticatedUser, @Body() body: RetryReminderDto) { return this.notifications.retryReminder(user.tenantId, body.id); }

  @Roles(...ALL_ROLES)
  @Permissions('appointments.manage')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAppointmentDto) {
    return this.manager.create(user, body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('appointments.manage')
  @HttpCode(HttpStatus.OK)
  @Post('update')
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateAppointmentDto) {
    return this.manager.update(user, body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('appointments.view')
  @HttpCode(HttpStatus.OK)
  @Post('list')
  list(@Body() body: AppointmentListDto) {
    return this.manager.list(body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('appointments.manage')
  @HttpCode(HttpStatus.OK)
  @Post('transition')
  transition(@CurrentUser() user: AuthenticatedUser, @Body() body: TransitionAppointmentDto) {
    return this.manager.transition(user, body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('appointments.manage')
  @HttpCode(HttpStatus.OK)
  @Post('notify')
  notify(@CurrentUser() user: AuthenticatedUser, @Body() body: NotifyAppointmentDto) {
    return this.manager.notify(user, body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('appointments.manage')
  @HttpCode(HttpStatus.OK)
  @Post('start')
  start(@CurrentUser() user: AuthenticatedUser, @Body() body: StartAppointmentDto) {
    return this.manager.start(user, body);
  }
}
