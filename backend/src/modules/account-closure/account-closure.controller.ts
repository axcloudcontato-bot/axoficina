import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { AUTH_THROTTLE } from '../../shared/constants/throttle.constants';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { AccountClosureService } from './account-closure.service';
import { CloseAccountDto } from './account-closure.dto';

// The workshop's own administrator closing the whole account. Irreversible for the workshop: only the SaaS manager can restore it.
@Controller('api/v1/account')
export class AccountClosureController {
  constructor(private readonly closure: AccountClosureService) {}

  @Post('close') @HttpCode(HttpStatus.OK) @Roles('ADMIN') @Permissions('settings.manage') @Throttle(AUTH_THROTTLE)
  close(@CurrentUser() user: AuthenticatedUser, @Body() body: CloseAccountDto) { return this.closure.closeAsOwner(user, body); }
}
