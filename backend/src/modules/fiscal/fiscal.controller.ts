import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { FiscalAttachmentResponse, FiscalDocumentResponse, FiscalPreviewResponse, FiscalSettingsResponse } from '@oficina/contracts';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { PlanLimit } from '../../shared/decorators/plan-limit.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { CancelFiscalDocumentDto, FiscalDocumentIdDto, FiscalPreviewDto, IssueFiscalDocumentDto, ListFiscalDocumentsDto, RegisterFiscalDocumentDto, UpdateFiscalSettingsDto, UploadFiscalCertificateDto } from './fiscal.dto';
import { FiscalManager } from './fiscal.manager';

// Whoever confirms payments also issues the order's notes (same audience as the payment section of the order).
const DOCUMENT_ROLES = ['ADMIN', 'MANAGER', 'FRONT_DESK', 'FINANCE'] as const;

@Controller('api/v1/fiscal')
export class FiscalController {
  constructor(private readonly manager: FiscalManager) {}

  @Roles('ADMIN', 'MANAGER') @Permissions('settings.view')
  @Get('settings') @Header('Cache-Control', 'no-store')
  settings(@CurrentUser() user: AuthenticatedUser): Promise<FiscalSettingsResponse> { return this.manager.getSettings(user); }

  @Roles('ADMIN', 'MANAGER') @Permissions('settings.manage')
  @PlanLimit('write') @Post('settings') @HttpCode(HttpStatus.OK)
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateFiscalSettingsDto): Promise<FiscalSettingsResponse> { return this.manager.updateSettings(user, body); }

  @Roles('ADMIN') @Permissions('settings.manage')
  @PlanLimit('write') @Post('certificate') @HttpCode(HttpStatus.OK)
  certificate(@CurrentUser() user: AuthenticatedUser, @Body() body: UploadFiscalCertificateDto): Promise<FiscalSettingsResponse> { return this.manager.uploadCertificate(user, body); }

  @Roles(...DOCUMENT_ROLES) @Permissions('receipts.manage')
  @Post('documents/list') @HttpCode(HttpStatus.OK) @Header('Cache-Control', 'no-store')
  list(@Body() body: ListFiscalDocumentsDto): Promise<FiscalDocumentResponse[]> { return this.manager.list(body.serviceOrderId); }

  @Roles(...DOCUMENT_ROLES) @Permissions('receipts.manage')
  @Post('documents/preview') @HttpCode(HttpStatus.OK) @Header('Cache-Control', 'no-store')
  preview(@CurrentUser() user: AuthenticatedUser, @Body() body: FiscalPreviewDto): Promise<FiscalPreviewResponse> { return this.manager.preview(user, body.serviceOrderId, body.kind); }

  @Roles(...DOCUMENT_ROLES) @Permissions('receipts.manage')
  @PlanLimit('write') @Post('documents/issue') @HttpCode(HttpStatus.OK)
  issue(@CurrentUser() user: AuthenticatedUser, @Body() body: IssueFiscalDocumentDto): Promise<FiscalDocumentResponse> { return this.manager.issue(user, body); }

  @Roles(...DOCUMENT_ROLES) @Permissions('receipts.manage')
  @Post('documents/refresh') @HttpCode(HttpStatus.OK) @Header('Cache-Control', 'no-store')
  refresh(@CurrentUser() user: AuthenticatedUser, @Body() body: FiscalDocumentIdDto): Promise<FiscalDocumentResponse> { return this.manager.refresh(user, body.id); }

  @Roles(...DOCUMENT_ROLES) @Permissions('receipts.manage')
  @PlanLimit('write') @Post('documents/cancel') @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthenticatedUser, @Body() body: CancelFiscalDocumentDto): Promise<FiscalDocumentResponse> { return this.manager.cancel(user, body); }

  @Roles(...DOCUMENT_ROLES) @Permissions('receipts.manage')
  @PlanLimit('write') @Post('documents/register') @HttpCode(HttpStatus.OK)
  register(@CurrentUser() user: AuthenticatedUser, @Body() body: RegisterFiscalDocumentDto): Promise<FiscalDocumentResponse> { return this.manager.register(user, body); }

  @Roles(...DOCUMENT_ROLES) @Permissions('receipts.manage')
  @PlanLimit('write') @Post('documents/delete') @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: AuthenticatedUser, @Body() body: FiscalDocumentIdDto): Promise<{ success: true }> { return this.manager.remove(user, body.id); }

  @Roles(...DOCUMENT_ROLES) @Permissions('receipts.manage')
  @Post('documents/attachment') @HttpCode(HttpStatus.OK) @Header('Cache-Control', 'no-store')
  attachment(@Body() body: FiscalDocumentIdDto): Promise<FiscalAttachmentResponse> { return this.manager.attachment(body.id); }
}
