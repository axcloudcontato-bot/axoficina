import { BadRequestException, Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { DATA_EXPORT_DATASETS, type DataExportDataset } from '@oficina/contracts';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AuditLogDto } from '../dto/workshop-account.dto';
import { WorkshopAccountService } from '../services/workshop-account.service';

// The account itself (plan, history, own data) belongs to the workshop's administrators only.
@Controller('api/v1/settings')
@Roles('ADMIN')
export class WorkshopAccountController {
  constructor(private readonly account: WorkshopAccountService) {}

  @Get('subscription') @Permissions('settings.manage') @Header('Cache-Control', 'no-store')
  subscription(@CurrentUser() user: AuthenticatedUser) { return this.account.subscription(user); }

  @Post('audit-log') @HttpCode(HttpStatus.OK) @Permissions('settings.manage') @Header('Cache-Control', 'no-store')
  history(@CurrentUser() user: AuthenticatedUser, @Body() body: AuditLogDto) { return this.account.history(body, user); }

  @Get('export/:dataset') @Permissions('settings.manage') @Header('Cache-Control', 'no-store')
  async export(@CurrentUser() user: AuthenticatedUser, @Param('dataset') dataset: string, @Res({ passthrough: true }) response: Response) {
    if (!(DATA_EXPORT_DATASETS as readonly string[]).includes(dataset)) throw new BadRequestException('Escolha clientes, veículos, ordens de serviço ou financeiro.');
    const file = await this.account.export(dataset as DataExportDataset, user);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return new StreamableFile(Buffer.from(file.content, 'utf8'));
  }
}
