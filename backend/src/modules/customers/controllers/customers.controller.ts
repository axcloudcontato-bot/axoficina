import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import type { ImportCustomersResponse, MergeCustomersResponse, CustomerArchiveImpactResponse, CustomerOverviewResponse, CustomerListItemResponse, CustomerResponse, PaginationData } from '@oficina/contracts';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { CustomerManager, type CustomerViewer } from '../managers/customer.manager';
import { RoleRepository } from '../../iam/repositories/role.repository';
import { UserRepository } from '../../iam/repositories/user.repository';
import { CreateCustomerDto, CustomerArchiveImpactDto, CustomerListDto, CustomerOverviewDto, ImportCustomersDto, MergeCustomersDto, DeleteCustomerDto, GetCustomerDto, RestoreCustomerDto, UpdateCustomerDto } from '../dto/customer.dto';
import { PlanLimit } from '../../../shared/decorators/plan-limit.decorator';

// Um único controller sob /api/v1 (não /api/v1/customers) porque a rota de
// leitura individual é singular (`/customer`) e as demais são plurais
// (`/customers`, `/customers/list`, ...) — mesmo padrão de agrupamento por
// prefixo comum descrito em API_DESIGN.md.
@Controller('api/v1')
export class CustomersController {
  constructor(private readonly customerManager: CustomerManager, private readonly roles: RoleRepository, private readonly users: UserRepository) {}

  // Amounts only reach people who may see prices; the role is read fresh, like PermissionsGuard does.
  private async viewer(user: AuthenticatedUser): Promise<CustomerViewer> {
    const current = await this.users.byId(user.userId);
    const roleId = current && current.tenantId === user.tenantId ? current.roleId : user.roleId;
    const permissions = roleId ? await this.roles.permissionKeys(roleId) : user.permissions ?? [];
    return { canViewPrices: permissions.includes('service_orders.prices') };
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('customers.manage')
  @PlanLimit('write')
  @Post('customers')
  async create(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: CreateCustomerDto): Promise<{ customer: CustomerResponse }> {
    return this.customerManager.create(actingUser, body);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('customers.manage')
  @HttpCode(HttpStatus.OK)
  @Post('customers/update')
  async update(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: UpdateCustomerDto): Promise<{ customer: CustomerResponse }> {
    return this.customerManager.update(actingUser, body);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('customers.manage')
  @HttpCode(HttpStatus.OK)
  @Post('customers/delete')
  async delete(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: DeleteCustomerDto): Promise<{ customer: CustomerResponse }> {
    return this.customerManager.delete(actingUser, body.id);
  }

  // Joining registrations moves a customer's whole history: managers only.
  @Roles('ADMIN', 'MANAGER')
  @Permissions('customers.manage')
  @HttpCode(HttpStatus.OK)
  @Post('customers/merge')
  async merge(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: MergeCustomersDto): Promise<MergeCustomersResponse> {
    return this.customerManager.merge(actingUser, body);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('customers.manage')
  @HttpCode(HttpStatus.OK)
  @PlanLimit('write')
  @Post('customers/import')
  async importRows(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: ImportCustomersDto): Promise<ImportCustomersResponse> {
    return this.customerManager.importRows(actingUser, body);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('customers.manage')
  @HttpCode(HttpStatus.OK)
  @Post('customers/restore')
  async restore(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: RestoreCustomerDto): Promise<{ customer: CustomerResponse }> {
    return this.customerManager.restore(actingUser, body.id);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('customers.manage')
  @HttpCode(HttpStatus.OK)
  @Post('customers/archive-impact')
  async archiveImpact(@Body() body: CustomerArchiveImpactDto): Promise<CustomerArchiveImpactResponse> {
    return this.customerManager.archiveImpact(body.id);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
  @Permissions('customers.view')
  @Get('customer')
  async get(@Query() query: GetCustomerDto): Promise<{ customer: CustomerResponse }> {
    return this.customerManager.getById(query.id);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
  @Permissions('customers.view')
  @HttpCode(HttpStatus.OK)
  @Post('customers/list')
  async list(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: CustomerListDto): Promise<PaginationData<CustomerListItemResponse>> {
    return this.customerManager.list(body, await this.viewer(actingUser));
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
  @Permissions('customers.view')
  @HttpCode(HttpStatus.OK)
  @Post('customers/overview')
  async overview(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: CustomerOverviewDto): Promise<CustomerOverviewResponse> {
    return this.customerManager.overview(body.id, await this.viewer(actingUser));
  }
}
