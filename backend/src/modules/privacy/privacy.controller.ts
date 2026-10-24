import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AUTH_THROTTLE } from '../../shared/constants/throttle.constants';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { CreatePrivacyRequestDto, EraseAccountDto, EraseCustomerDto, ExportCustomerDto, ResolvePrivacyRequestDto } from './privacy.dto';
import { PrivacyService } from './privacy.service';

@Controller('api/v1/privacy')
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}

  @Post('requests')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePrivacyRequestDto) { return this.service.create(user, body); }

  @Get('requests') @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: AuthenticatedUser) { return this.service.list(user); }

  @Get('requests/manage') @Roles('ADMIN') @Permissions('settings.manage') @Header('Cache-Control', 'no-store')
  manage(@CurrentUser() user: AuthenticatedUser) { return this.service.list(user, true); }

  @Post('requests/resolve') @HttpCode(HttpStatus.OK) @Roles('ADMIN') @Permissions('settings.manage')
  resolve(@CurrentUser() user: AuthenticatedUser, @Body() body: ResolvePrivacyRequestDto) { return this.service.resolve(user, body); }

  @Get('export') @Header('Cache-Control', 'no-store')
  exportSelf(@CurrentUser() user: AuthenticatedUser) { return this.service.exportSelf(user); }

  @Post('customers/export') @HttpCode(HttpStatus.OK) @Roles('ADMIN') @Permissions('customers.manage') @Header('Cache-Control', 'no-store')
  exportCustomer(@CurrentUser() user: AuthenticatedUser, @Body() body: ExportCustomerDto) { return this.service.exportCustomer(user, body.id); }

  @Post('customers/erase') @HttpCode(HttpStatus.OK) @Roles('ADMIN') @Permissions('customers.manage', 'settings.manage') @Throttle(AUTH_THROTTLE)
  erase(@CurrentUser() user: AuthenticatedUser, @Body() body: EraseCustomerDto) { return this.service.eraseCustomer(user, body.requestId, body.password); }

  @Post('account/erase') @HttpCode(HttpStatus.OK) @Throttle(AUTH_THROTTLE)
  eraseAccount(@CurrentUser() user: AuthenticatedUser, @Body() body: EraseAccountDto) { return this.service.eraseAccount(user, body.requestId, body.password); }
}
