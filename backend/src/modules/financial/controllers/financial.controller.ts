import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { RequiresModule } from '../../../shared/decorators/requires-module.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AddFinancialPaymentDto, CreateFinancialCategoryDto, CreateFinancialEntryDto, CreateSupplierDto, DeleteFinancialCategoryDto, DeleteFinancialEntryDto, DeleteSupplierDto, FinancialAttachmentDto, ListFinancialAttachmentsDto, ListFinancialEntriesDto, ReconcileFinancialMovementDto, ReverseFinancialPaymentDto, SaveFinancialCashBaselineDto, SettleFinancialEntryDto, UpdateFinancialCategoryDto, UpdateFinancialEntryDto, UpdateSupplierDto, UploadFinancialAttachmentDto } from '../dto/financial.dto';
import { FinancialManager } from '../managers/financial.manager';

const ROLES = ['ADMIN', 'MANAGER'] as const;

@Controller('api/v1/financial')
@RequiresModule('financeiro')
export class FinancialController {
  constructor(private readonly manager: FinancialManager) {}

  @Roles(...ROLES) @Permissions('finance.view') @Get('categories')
  categories(@CurrentUser() user: AuthenticatedUser) { return this.manager.listCategories(user); }

  @Roles(...ROLES) @Permissions('finance.manage') @Post('categories')
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateFinancialCategoryDto) { return this.manager.createCategory(user, body); }

  @Roles(...ROLES) @Permissions('finance.manage') @HttpCode(HttpStatus.OK) @Post('categories/update')
  updateCategory(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateFinancialCategoryDto) { return this.manager.updateCategory(user, body); }

  @Roles(...ROLES) @Permissions('finance.manage') @HttpCode(HttpStatus.OK) @Post('categories/delete')
  deleteCategory(@CurrentUser() user: AuthenticatedUser, @Body() body: DeleteFinancialCategoryDto) { return this.manager.deleteCategory(user, body.id); }

  @Roles(...ROLES) @Permissions('finance.manage') @Post('entries')
  createEntry(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateFinancialEntryDto) { return this.manager.createEntry(user, body); }

  @Roles(...ROLES) @Permissions('finance.manage') @HttpCode(HttpStatus.OK) @Post('entries/update')
  updateEntry(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateFinancialEntryDto) { return this.manager.updateEntry(user, body); }

  @Roles(...ROLES) @Permissions('finance.manage') @HttpCode(HttpStatus.OK) @Post('entries/settle')
  settleEntry(@CurrentUser() user: AuthenticatedUser, @Body() body: SettleFinancialEntryDto) { return this.manager.settleEntry(user, body.id, body.paidAt); }

  @Roles(...ROLES) @Permissions('finance.manage') @HttpCode(HttpStatus.OK) @Post('entries/payment')
  addPayment(@CurrentUser() user: AuthenticatedUser, @Body() body: AddFinancialPaymentDto) { return this.manager.addPayment(user, body); }

  @Roles(...ROLES) @Permissions('finance.manage') @HttpCode(HttpStatus.OK) @Post('entries/payment/reverse')
  reversePayment(@CurrentUser() user: AuthenticatedUser, @Body() body: ReverseFinancialPaymentDto) { return this.manager.reversePayment(user, body); }

  @Roles(...ROLES) @Permissions('finance.manage') @HttpCode(HttpStatus.OK) @Post('reconcile')
  reconcile(@CurrentUser() user: AuthenticatedUser, @Body() body: ReconcileFinancialMovementDto) { return this.manager.reconcileMovement(user, body); }

  @Roles(...ROLES) @Permissions('finance.manage') @Post('attachments')
  uploadAttachment(@CurrentUser() user: AuthenticatedUser, @Body() body: UploadFinancialAttachmentDto) { return this.manager.uploadAttachment(user, body); }

  @Roles(...ROLES) @Permissions('finance.view') @HttpCode(HttpStatus.OK) @Post('attachments/list')
  attachments(@Body() body: ListFinancialAttachmentsDto) { return this.manager.listAttachments(body.entryId); }

  @Roles(...ROLES) @Permissions('finance.view') @HttpCode(HttpStatus.OK) @Post('attachments/download')
  downloadAttachment(@Body() body: FinancialAttachmentDto) { return this.manager.downloadAttachment(body.entryId, body.attachmentId); }

  @Roles(...ROLES) @Permissions('finance.manage') @HttpCode(HttpStatus.OK) @Post('entries/delete')
  deleteEntry(@CurrentUser() user: AuthenticatedUser, @Body() body: DeleteFinancialEntryDto) { return this.manager.deleteEntry(user, body.id, body.reason); }

  @Roles(...ROLES) @Permissions('finance.view') @HttpCode(HttpStatus.OK) @Post('cash-flow')
  cashFlow(@Body() body: ListFinancialEntriesDto) { return this.manager.cashFlow(body); }

  @Roles(...ROLES) @Permissions('finance.manage') @HttpCode(HttpStatus.OK) @Post('cash-baseline')
  saveCashBaseline(@CurrentUser() user: AuthenticatedUser, @Body() body: SaveFinancialCashBaselineDto) { return this.manager.saveCashBaseline(user, body); }

  @Roles(...ROLES) @Permissions('finance.view') @Get('suppliers')
  suppliers() { return this.manager.listSuppliers(); }

  @Roles(...ROLES) @Permissions('finance.manage') @Post('suppliers')
  createSupplier(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateSupplierDto) { return this.manager.createSupplier(user, body); }

  @Roles(...ROLES) @Permissions('finance.manage') @HttpCode(HttpStatus.OK) @Post('suppliers/update')
  updateSupplier(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateSupplierDto) { return this.manager.updateSupplier(user, body); }

  @Roles(...ROLES) @Permissions('finance.manage') @HttpCode(HttpStatus.OK) @Post('suppliers/delete')
  deleteSupplier(@CurrentUser() user: AuthenticatedUser, @Body() body: DeleteSupplierDto) { return this.manager.deleteSupplier(user, body.id); }
}
