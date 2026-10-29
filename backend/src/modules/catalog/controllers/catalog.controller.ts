import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { RoleRepository } from '../../iam/repositories/role.repository';
import { UserRepository } from '../../iam/repositories/user.repository';
import { AdjustStockDto, CatalogReportQueryDto, CreateCatalogItemDto, DeleteCatalogItemDto, DeleteCatalogPackageDto, ImportCatalogDto, SaveCatalogPackageDto, UpdateCatalogItemDto } from '../dto/catalog.dto';
import { CatalogManager, type CatalogViewer } from '../managers/catalog.manager';

// Mesmo acesso dos itens e preços da OS (sem mecânico).
const ROLES = ['ADMIN', 'MANAGER', 'FRONT_DESK'] as const;

@Controller('api/v1/catalog')
export class CatalogController {
  constructor(private readonly manager: CatalogManager, private readonly roles: RoleRepository, private readonly users: UserRepository) {}

  // Cost is financial data: only people with finance access see or set it. The role is read fresh, like PermissionsGuard does.
  private async viewer(user: AuthenticatedUser): Promise<CatalogViewer> {
    const current = await this.users.byId(user.userId);
    const roleId = current && current.tenantId === user.tenantId ? current.roleId : user.roleId;
    const permissions = roleId ? await this.roles.permissionKeys(roleId) : user.permissions ?? [];
    return { canSeeCost: permissions.includes('finance.view') };
  }

  @Roles(...ROLES) @Permissions('service_orders.prices') @Get('items')
  async list(@CurrentUser() user: AuthenticatedUser) { return this.manager.list(await this.viewer(user)); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @Post('items')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCatalogItemDto) { return this.manager.create(user, body, await this.viewer(user)); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @HttpCode(HttpStatus.OK) @Post('items/update')
  async update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateCatalogItemDto) { return this.manager.update(user, body, await this.viewer(user)); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @HttpCode(HttpStatus.OK) @Post('items/delete')
  remove(@CurrentUser() user: AuthenticatedUser, @Body() body: DeleteCatalogItemDto) { return this.manager.remove(user, body.id); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @HttpCode(HttpStatus.OK) @Post('items/seed-defaults')
  async seedDefaults(@CurrentUser() user: AuthenticatedUser) { return this.manager.seedDefaults(user, await this.viewer(user)); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @HttpCode(HttpStatus.OK) @Post('items/stock')
  async stock(@CurrentUser() user: AuthenticatedUser, @Body() body: AdjustStockDto) { return this.manager.adjustStock(user, body, await this.viewer(user)); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @HttpCode(HttpStatus.OK) @Post('items/import')
  async importRows(@CurrentUser() user: AuthenticatedUser, @Body() body: ImportCatalogDto) { return this.manager.importRows(user, body, await this.viewer(user)); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @Get('packages')
  packages() { return this.manager.listPackages(); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @HttpCode(HttpStatus.OK) @Post('packages/save')
  savePackage(@CurrentUser() user: AuthenticatedUser, @Body() body: SaveCatalogPackageDto) { return this.manager.savePackage(user, body); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @HttpCode(HttpStatus.OK) @Post('packages/delete')
  removePackage(@CurrentUser() user: AuthenticatedUser, @Body() body: DeleteCatalogPackageDto) { return this.manager.removePackage(user, body.id); }

  @Roles(...ROLES) @Permissions('service_orders.prices') @Get('report')
  async report(@CurrentUser() user: AuthenticatedUser, @Query() query: CatalogReportQueryDto) { return this.manager.report(user, query.days ?? 90, await this.viewer(user)); }
}
