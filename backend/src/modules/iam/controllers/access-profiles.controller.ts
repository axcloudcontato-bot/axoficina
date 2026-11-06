import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AccessProfileResponse } from '@oficina/contracts';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { RequiresModule } from '../../../shared/decorators/requires-module.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AssignUserProfileDto, CreateAccessProfileDto, UpdateAccessProfileDto } from '../dto/access-profile.dto';
import { AccessProfileManager } from '../managers/access-profile.manager';
import { PlanLimit } from '../../../shared/decorators/plan-limit.decorator';

@Controller('api/v1/access-profiles')
@Roles('ADMIN')
@Permissions('profiles.manage')
export class AccessProfilesController {
  constructor(private readonly manager: AccessProfileManager) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser): Promise<{ items: AccessProfileResponse[] }> { return this.manager.list(user); }
  @PlanLimit('write') @Post() @RequiresModule('governanca') create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAccessProfileDto) { return this.manager.create(user, body); }
  @PlanLimit('write') @Post('update') @HttpCode(HttpStatus.OK) @RequiresModule('governanca') update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateAccessProfileDto) { return this.manager.update(user, body); }
  @PlanLimit('write') @Post('assign') @HttpCode(HttpStatus.OK) assign(@CurrentUser() user: AuthenticatedUser, @Body() body: AssignUserProfileDto) { return this.manager.assign(user, body); }
}
