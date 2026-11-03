import { BadRequestException, Injectable } from '@nestjs/common';
import type { SupportTicket } from '@oficina/database';
import type { AuthenticatedUser } from '../../shared/guards/jwt-auth.guard';
import { SupportRepository } from './support.repository';
import type { CreateSupportTicketDto, SupportTicketListDto, UpdateSupportTicketDto } from './support.dto';

@Injectable()
export class SupportService {
  constructor(private readonly tickets: SupportRepository) {}

  create(user: AuthenticatedUser, input: CreateSupportTicketDto): Promise<SupportTicket> { return this.tickets.create(user.tenantId, user.userId, input); }
  listOwn(user: AuthenticatedUser, query: SupportTicketListDto) { return this.tickets.listOwn(user.tenantId, user.userId, query.offset); }
  listAdmin(query: SupportTicketListDto) { return this.tickets.listAdmin(query); }
  updateAdmin(id: string, input: UpdateSupportTicketDto) {
    if (!input.status && !input.response) throw new BadRequestException('Informe uma resposta ou altere a situação do chamado.');
    return this.tickets.updateAdmin(id, input);
  }
}
