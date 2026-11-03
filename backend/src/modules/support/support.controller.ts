import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { SupportTicket } from '@oficina/database';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { SaasAdminGuard } from '../subscriptions/saas-admin.service';
import { CreateSupportTicketDto, SupportTicketListDto, UpdateSupportTicketDto } from './support.dto';
import { SupportService } from './support.service';

@Controller('api/v1/support/tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: SupportTicketListDto) { return this.support.listOwn(user, query); }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateSupportTicketDto): Promise<SupportTicket> { return this.support.create(user, input); }
}

@Controller('api/v1/admin/support/tickets')
@UseGuards(SaasAdminGuard)
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: SupportTicketListDto) { return this.support.listAdmin(query); }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateSupportTicketDto) { return this.support.updateAdmin(id, input); }
}
