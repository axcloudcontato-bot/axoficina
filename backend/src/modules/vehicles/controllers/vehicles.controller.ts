import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import type { ImportVehiclesResponse, PaginationData, VehicleArchiveImpactResponse, VehicleListItemResponse, VehicleOverviewResponse, VehicleResponse } from '@oficina/contracts';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { VehicleManager } from '../managers/vehicle.manager';
import { CreateVehicleDto, DeleteVehicleDto, GetVehicleDto, ImportVehiclesDto, RestoreVehicleDto, TransferVehicleDto, UpdateVehicleDto, VehicleArchiveImpactDto, VehicleListDto, VehicleOverviewDto } from '../dto/vehicle.dto';
import { PlanLimit } from '../../../shared/decorators/plan-limit.decorator';

// Mesmo padrão de agrupamento de CustomersController: um único controller
// sob /api/v1 porque a rota de leitura individual é singular (/vehicle) e
// as demais são plurais (/vehicles, /vehicles/list, ...).
@Controller('api/v1')
export class VehiclesController {
  constructor(private readonly vehicleManager: VehicleManager) {}

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('vehicles.manage')
  @PlanLimit('write')
  @Post('vehicles')
  async create(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: CreateVehicleDto): Promise<{ vehicle: VehicleResponse }> {
    return this.vehicleManager.create(actingUser, body);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('vehicles.manage')
  @HttpCode(HttpStatus.OK)
  @Post('vehicles/update')
  async update(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: UpdateVehicleDto): Promise<{ vehicle: VehicleResponse }> {
    return this.vehicleManager.update(actingUser, body);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('vehicles.manage')
  @HttpCode(HttpStatus.OK)
  @Post('vehicles/delete')
  async delete(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: DeleteVehicleDto): Promise<{ vehicle: VehicleResponse }> {
    return this.vehicleManager.delete(actingUser, body.id);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('vehicles.manage')
  @HttpCode(HttpStatus.OK)
  @Post('vehicles/restore')
  async restore(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: RestoreVehicleDto): Promise<{ vehicle: VehicleResponse }> {
    return this.vehicleManager.restore(actingUser, body.id);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('vehicles.manage')
  @HttpCode(HttpStatus.OK)
  @Post('vehicles/archive-impact')
  async archiveImpact(@Body() body: VehicleArchiveImpactDto): Promise<VehicleArchiveImpactResponse> {
    return this.vehicleManager.archiveImpact(body.id);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('vehicles.manage')
  @HttpCode(HttpStatus.OK)
  @PlanLimit('write')
  @Post('vehicles/import')
  async importRows(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: ImportVehiclesDto): Promise<ImportVehiclesResponse> {
    return this.vehicleManager.importRows(actingUser, body);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK')
  @Permissions('vehicles.manage')
  @HttpCode(HttpStatus.OK)
  @Post('vehicles/transfer')
  async transfer(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: TransferVehicleDto): Promise<{ vehicle: VehicleResponse }> {
    return this.vehicleManager.transfer(actingUser, body);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
  @Permissions('vehicles.view')
  @HttpCode(HttpStatus.OK)
  @Post('vehicles/overview')
  async overview(@Body() body: VehicleOverviewDto): Promise<VehicleOverviewResponse> {
    return this.vehicleManager.overview(body.id);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
  @Permissions('vehicles.view')
  @Get('vehicle')
  async get(@Query() query: GetVehicleDto): Promise<{ vehicle: VehicleResponse }> {
    return this.vehicleManager.getById(query.id);
  }

  @Roles('ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC')
  @Permissions('vehicles.view')
  @HttpCode(HttpStatus.OK)
  @Post('vehicles/list')
  async list(@Body() body: VehicleListDto): Promise<PaginationData<VehicleListItemResponse>> {
    return this.vehicleManager.list(body);
  }
}
