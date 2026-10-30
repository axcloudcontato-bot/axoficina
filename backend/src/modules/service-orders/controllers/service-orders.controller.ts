import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { DashboardBusinessSummaryResponse, DashboardTodayResponse, DueServiceOrderInstallmentsResponse, ServiceOrderInstallmentResponse, ServiceOrderItemResponse, ServiceOrderListResponse, ServiceOrderReceiptResponse, ServiceOrderResponse, TechnicianProductivityResponse, TechnicianProductivityOrdersResponse } from '@oficina/contracts';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { ServiceOrderManager } from '../managers/service-order.manager';
import { RoleRepository } from '../../iam/repositories/role.repository';
import { UserRepository } from '../../iam/repositories/user.repository';
import {
  CreateServiceOrderDto,
  DeleteServiceOrderDto,
  GetServiceOrderDto,
  ServiceOrderListDto,
  TechnicianProductivityDto,
  TechnicianProductivityOrdersDto,
  WorkSessionDto,
  CorrectWorkSessionDto,
  CopyProductivityTargetsDto,
  ProductivityTrendDto,
  MarkWarrantyReturnDto,
  SetCommissionRuleDto,
  StartIdleDto,
  ProductivityTargetDto,
  TransitionServiceOrderDto,
  UpdateServiceOrderDto,
} from '../dto/service-order.dto';
import { DashboardTodayDto } from '../dto/service-order.dto';
import { CreateServiceOrderItemDto, DeleteServiceOrderItemDto, UpdateServiceOrderItemDto } from '../dto/service-order-item.dto';
import { ConfirmServiceOrderReceiptDto, DeleteServiceOrderReceiptDto } from '../dto/service-order-receipt.dto';
import { ConfigureServiceOrderPaymentDto, ConfirmServiceOrderInstallmentDto, ListDueServiceOrderInstallmentsDto } from '../dto/service-order-installment.dto';
import { DeleteServiceOrderPhotoDto, GetServiceOrderPhotoDto, ListServiceOrderPhotosDto, UploadServiceOrderPhotoDto } from '../dto/service-order-photo.dto';
import { ServiceOrderPhotoManager } from '../managers/service-order-photo.manager';
import { ProductivityService } from '../services/productivity.service';

// Todos os 4 papéis têm acesso total a todo endpoint — divergência
// deliberada do padrão de Clientes/Veículos (spec: "todos os papéis fazem
// tudo", reflete que recepção e mecânico mexem na mesma OS em etapas
// diferentes do fluxo real).
const ALL_ROLES = ['ADMIN', 'MANAGER', 'FRONT_DESK', 'MECHANIC'] as const;

// Itens/preço da OS: acesso restrito, sem MECHANIC — decisão explícita da
// spec (Feature 8), diferente do ALL_ROLES usado no resto deste controller.
const ITEM_ROLES = ['ADMIN', 'MANAGER', 'FRONT_DESK'] as const;

@Controller('api/v1')
export class ServiceOrdersController {
  constructor(private readonly serviceOrderManager: ServiceOrderManager, private readonly photoManager: ServiceOrderPhotoManager, private readonly roles: RoleRepository, private readonly users: UserRepository, private readonly productivity: ProductivityService) {}

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.manage')
  @Post('service-orders')
  async create(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: CreateServiceOrderDto): Promise<{ serviceOrder: ServiceOrderResponse }> {
    return this.serviceOrderManager.create(actingUser, body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.manage')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/update')
  async update(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: UpdateServiceOrderDto): Promise<{ serviceOrder: ServiceOrderResponse }> {
    return this.serviceOrderManager.update(actingUser, body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.manage')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/transition')
  async transition(
    @CurrentUser() actingUser: AuthenticatedUser,
    @Body() body: TransitionServiceOrderDto,
  ): Promise<{ serviceOrder: ServiceOrderResponse }> {
    return this.serviceOrderManager.transition(actingUser, body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.manage')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/delete')
  async delete(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: DeleteServiceOrderDto): Promise<{ serviceOrder: ServiceOrderResponse }> {
    return this.serviceOrderManager.delete(actingUser, body.id);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.view')
  @Get('service-order')
  async get(@Query() query: GetServiceOrderDto): Promise<{ serviceOrder: ServiceOrderResponse }> {
    return this.serviceOrderManager.getById(query.id);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.view')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/list')
  async list(@Body() body: ServiceOrderListDto): Promise<ServiceOrderListResponse> {
    return this.serviceOrderManager.list(body);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.view')
  @Get('dashboard/today')
  async dashboardToday(@CurrentUser() actingUser: AuthenticatedUser, @Query() query: DashboardTodayDto): Promise<DashboardTodayResponse> {
    // Amounts only reach people who may see prices; the role is read fresh, like PermissionsGuard does.
    const current = await this.users.byId(actingUser.userId);
    const roleId = current && current.tenantId === actingUser.tenantId ? current.roleId : actingUser.roleId;
    const canViewPrices = roleId ? (await this.roles.permissionKeys(roleId)).includes('service_orders.prices') : Boolean(actingUser.permissions?.includes('service_orders.prices'));
    const today = query.startsAt && query.endsAt ? { startsAt: new Date(query.startsAt), endsAt: new Date(query.endsAt) } : undefined;
    return this.serviceOrderManager.dashboardToday({ userId: actingUser.userId, canViewPrices }, today);
  }

  @Roles(...ALL_ROLES)
  @Permissions('finance.view')
  @Get('dashboard/business-summary')
  async businessSummary(): Promise<DashboardBusinessSummaryResponse> {
    return this.serviceOrderManager.businessSummary();
  }

  @Roles(...ITEM_ROLES)
  @Permissions('service_orders.prices')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/technician-productivity')
  async technicianProductivity(@CurrentUser() user: AuthenticatedUser, @Body() body: TechnicianProductivityDto): Promise<TechnicianProductivityResponse> {
    return this.productivity.report(body, user.tenantId);
  }

  @Roles(...ITEM_ROLES)
  @Permissions('service_orders.prices')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/technician-productivity/trend')
  async productivityTrend(@CurrentUser() user: AuthenticatedUser, @Body() body: ProductivityTrendDto) {
    return this.productivity.trend(body, user.tenantId);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.view')
  @Get('service-orders/warranty-return')
  async warrantyReturn(@Query() query: WorkSessionDto) {
    return this.productivity.warrantyReturn(query.serviceOrderId);
  }

  // Marking a return under warranty puts the rework on the earlier order's technicians.
  @Roles(...ITEM_ROLES)
  @Permissions('service_orders.manage')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/warranty-return')
  async markWarrantyReturn(@CurrentUser() user: AuthenticatedUser, @Body() body: MarkWarrantyReturnDto) {
    return this.productivity.markWarrantyReturn(body, user);
  }

  // What each technician earns is for the owner and managers only.
  @Roles('ADMIN', 'MANAGER')
  @Permissions('service_orders.prices')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/technician-productivity/commissions')
  async commissions(@CurrentUser() user: AuthenticatedUser, @Body() body: TechnicianProductivityDto) {
    return this.productivity.commissions(body, user.tenantId);
  }

  @Roles('ADMIN', 'MANAGER')
  @Permissions('service_orders.prices')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/technician-productivity/commission-rule')
  async setCommissionRule(@CurrentUser() user: AuthenticatedUser, @Body() body: SetCommissionRuleDto) {
    return this.productivity.setCommissionRule(body, user);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.view')
  @Get('service-orders/idle-time')
  async myIdle(@CurrentUser() user: AuthenticatedUser) {
    return this.productivity.myIdle(user);
  }

  @Roles('MECHANIC')
  @Permissions('service_orders.view')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/idle-time/start')
  async startIdle(@CurrentUser() user: AuthenticatedUser, @Body() body: StartIdleDto) {
    return this.productivity.startIdle(body, user);
  }

  @Roles('MECHANIC')
  @Permissions('service_orders.view')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/idle-time/stop')
  async stopIdle(@CurrentUser() user: AuthenticatedUser) {
    return this.productivity.stopIdle(user);
  }

  // A technician's own month; money only for those who may see prices (the role is read fresh, like PermissionsGuard).
  @Roles(...ALL_ROLES)
  @Permissions('service_orders.view')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/technician-productivity/me')
  async myProductivity(@CurrentUser() user: AuthenticatedUser, @Body() body: TechnicianProductivityDto) {
    const current = await this.users.byId(user.userId);
    const roleId = current && current.tenantId === user.tenantId ? current.roleId : user.roleId;
    const canViewPrices = roleId ? (await this.roles.permissionKeys(roleId)).includes('service_orders.prices') : Boolean(user.permissions?.includes('service_orders.prices'));
    return this.productivity.mine(body, user, canViewPrices);
  }

  @Roles('ADMIN', 'MANAGER')
  @Permissions('service_orders.prices')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/productivity-target/copy')
  async copyProductivityTargets(@CurrentUser() user: AuthenticatedUser, @Body() body: CopyProductivityTargetsDto) {
    return this.productivity.copyTargets(body, user);
  }

  // Fixing a timer someone forgot, or removing a wrong one: managers only, with a reason.
  @Roles('ADMIN', 'MANAGER')
  @Permissions('service_orders.prices')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/work-sessions/correct')
  async correctWorkSession(@CurrentUser() user: AuthenticatedUser, @Body() body: CorrectWorkSessionDto) {
    return this.productivity.correctSession(body, user);
  }

  @Roles(...ITEM_ROLES)
  @Permissions('service_orders.prices')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/technician-productivity/orders')
  async technicianProductivityOrders(@CurrentUser() user: AuthenticatedUser, @Body() body: TechnicianProductivityOrdersDto): Promise<TechnicianProductivityOrdersResponse> {
    return this.productivity.orders(body, user.tenantId);
  }

  @Roles('ADMIN', 'MANAGER')
  @Permissions('service_orders.prices')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/productivity-target')
  async setProductivityTarget(@CurrentUser() user: AuthenticatedUser, @Body() body: ProductivityTargetDto) {
    return this.productivity.setTarget(body, user);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.view')
  @Get('service-orders/work-sessions')
  async workSessions(@Query() query: WorkSessionDto) {
    return this.productivity.sessions(query.serviceOrderId);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.manage')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/work-sessions/start')
  async startWork(@CurrentUser() user: AuthenticatedUser, @Body() body: WorkSessionDto) {
    return this.productivity.start(body.serviceOrderId, user);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.manage')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/work-sessions/stop')
  async stopWork(@CurrentUser() user: AuthenticatedUser, @Body() body: WorkSessionDto) {
    return this.productivity.stop(body.serviceOrderId, user);
  }

  @Roles(...ITEM_ROLES)
  @Permissions('service_orders.prices')
  @Post('service-orders/items')
  async addItem(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: CreateServiceOrderItemDto): Promise<{ item: ServiceOrderItemResponse }> {
    return this.serviceOrderManager.addItem(body, actingUser);
  }

  @Roles(...ITEM_ROLES)
  @Permissions('service_orders.prices')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/items/update')
  async updateItem(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: UpdateServiceOrderItemDto): Promise<{ item: ServiceOrderItemResponse }> {
    return this.serviceOrderManager.updateItem(body, actingUser);
  }

  @Roles(...ITEM_ROLES)
  @Permissions('service_orders.prices')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/items/delete')
  async deleteItem(@CurrentUser() actingUser: AuthenticatedUser, @Body() body: DeleteServiceOrderItemDto): Promise<{ item: ServiceOrderItemResponse }> {
    return this.serviceOrderManager.deleteItem(body.id, actingUser, body.editReason);
  }

  @Roles(...ITEM_ROLES)
  @Permissions('receipts.manage')
  @Post('service-orders/receipts')
  async confirmReceipt(@CurrentUser() user: AuthenticatedUser, @Body() body: ConfirmServiceOrderReceiptDto): Promise<{ receipt: ServiceOrderReceiptResponse }> {
    return this.serviceOrderManager.confirmReceipt(user, body);
  }

  @Roles(...ITEM_ROLES)
  @Permissions('receipts.manage')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/receipts/delete')
  async deleteReceipt(@CurrentUser() user: AuthenticatedUser, @Body() body: DeleteServiceOrderReceiptDto): Promise<{ success: true }> {
    return this.serviceOrderManager.deleteReceipt(user, body);
  }

  @Roles(...ITEM_ROLES)
  @Permissions('receipts.manage')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/payment/configure')
  async configurePayment(@CurrentUser() user: AuthenticatedUser, @Body() body: ConfigureServiceOrderPaymentDto): Promise<{ serviceOrder: ServiceOrderResponse }> {
    return this.serviceOrderManager.configurePayment(user, body);
  }

  @Roles(...ITEM_ROLES)
  @Permissions('receipts.manage')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/installments/confirm')
  async confirmInstallment(@CurrentUser() user: AuthenticatedUser, @Body() body: ConfirmServiceOrderInstallmentDto): Promise<{ installment: ServiceOrderInstallmentResponse }> {
    return this.serviceOrderManager.confirmInstallment(user, body);
  }

  @Roles(...ITEM_ROLES)
  @Permissions('receipts.manage')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/installments/due')
  async dueInstallments(@Body() body: ListDueServiceOrderInstallmentsDto): Promise<DueServiceOrderInstallmentsResponse> {
    return this.serviceOrderManager.listDueInstallments(body.limit);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.view')
  @Get('service-orders/photos')
  listPhotos(@Query() query: ListServiceOrderPhotosDto) {
    return this.photoManager.list(query.serviceOrderId);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.view')
  @Get('service-orders/photos/content')
  async photoContent(@Query() query: GetServiceOrderPhotoDto, @Res({ passthrough: true }) response: Response) {
    const photo = await this.photoManager.content(query.id);
    response.setHeader('Content-Type', photo.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(photo.buffer);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.manage')
  @Post('service-orders/photos')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  uploadPhoto(@CurrentUser() user: AuthenticatedUser, @Body() body: UploadServiceOrderPhotoDto, @UploadedFile() file?: Express.Multer.File) {
    return this.photoManager.upload(user, body, file);
  }

  @Roles(...ALL_ROLES)
  @Permissions('service_orders.manage')
  @HttpCode(HttpStatus.OK)
  @Post('service-orders/photos/delete')
  deletePhoto(@CurrentUser() user: AuthenticatedUser, @Body() body: DeleteServiceOrderPhotoDto) {
    return this.photoManager.delete(user, body.id);
  }
}
