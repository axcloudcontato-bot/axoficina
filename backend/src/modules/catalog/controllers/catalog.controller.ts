import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { CreateCatalogItemDto, DeleteCatalogItemDto, UpdateCatalogItemDto } from '../dto/catalog.dto';
import { CatalogManager } from '../managers/catalog.manager';

// Mesmo acesso dos itens e preços da OS (sem mecânico).
const ROLES = ['ADMIN', 'MANAGER', 'FRONT_DESK'] as const;

@Controller('api/v1/catalog')
export class CatalogController {
  constructor(private readonly manager: CatalogManager) {}

  @Roles(...ROLES) @Permissions('service_orders.prices') @Get('items')
  list() { return this.manager.list(); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @Post('items')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCatalogItemDto) { return this.manager.create(user, body); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @HttpCode(HttpStatus.OK) @Post('items/update')
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateCatalogItemDto) { return this.manager.update(user, body); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @HttpCode(HttpStatus.OK) @Post('items/delete')
  remove(@CurrentUser() user: AuthenticatedUser, @Body() body: DeleteCatalogItemDto) { return this.manager.remove(user, body.id); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @HttpCode(HttpStatus.OK) @Post('items/seed-defaults')
  seedDefaults(@CurrentUser() user: AuthenticatedUser) { return this.manager.seedDefaults(user); }
}
