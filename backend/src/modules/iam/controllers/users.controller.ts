import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse, InviteUserResponse, PaginationData, UserListItemResponse } from '@oficina/contracts';
import { Public } from '../../../shared/decorators/public.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { AUTH_THROTTLE } from '../../../shared/constants/throttle.constants';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { UserManager } from '../managers/user.manager';
import { AcceptInviteDto, InviteUserDto, ManageUserAccessDto, RenameUserDto, UserListDto } from '../dto/user.dto';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly userManager: UserManager) {}

  @Roles('ADMIN', 'MANAGER')
  @Permissions('team.manage')
  @Post('invite')
  async invite(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: InviteUserDto): Promise<InviteUserResponse> {
    return this.userManager.invite(actingUser, body);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('accept-invite')
  async acceptInvite(@Body() body: AcceptInviteDto): Promise<AuthResponse> {
    return this.userManager.acceptInvite(body);
  }

  @Roles('ADMIN', 'MANAGER')
  @Permissions('team.view')
  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: UserListDto): Promise<PaginationData<UserListItemResponse>> {
    return this.userManager.list(body, actingUser);
  }

  @Roles('ADMIN', 'MANAGER')
  @Permissions('team.manage')
  @HttpCode(HttpStatus.OK)
  @Post('rename')
  async rename(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: RenameUserDto) {
    return this.userManager.rename(actingUser, body);
  }

  @Roles('ADMIN', 'MANAGER')
  @Permissions('team.manage')
  @HttpCode(HttpStatus.OK)
  @Post('disable')
  async disable(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: ManageUserAccessDto) {
    return this.userManager.disable(actingUser, body);
  }

  @Roles('ADMIN', 'MANAGER') @Permissions('team.manage') @HttpCode(HttpStatus.OK) @Post('enable')
  enable(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: ManageUserAccessDto) { return this.userManager.enable(actingUser, body); }

  @Roles('ADMIN', 'MANAGER') @Permissions('team.manage') @HttpCode(HttpStatus.OK) @Post('resend-invite')
  resendInvite(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: ManageUserAccessDto) { return this.userManager.resendInvite(actingUser, body); }

  @Roles('ADMIN', 'MANAGER') @Permissions('team.manage') @HttpCode(HttpStatus.OK) @Post('password-reset-link')
  passwordResetLink(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: ManageUserAccessDto) { return this.userManager.passwordResetLink(actingUser, body); }

  @Roles('ADMIN', 'MANAGER')
  @Permissions('team.manage')
  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: ManageUserAccessDto) {
    return this.userManager.delete(actingUser, body);
  }
}
