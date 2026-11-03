import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../shared/prisma/prisma.service';
import { SupportRepository } from './support.repository';

describe('SupportRepository', () => {
  const ticket = { id: 'ticket-1', tenantId: 'tenant-1', createdById: 'user-1', subject: 'Falha na agenda', description: 'A agenda não abre para a oficina.', priority: 'NORMAL', status: 'OPEN', response: null, createdAt: new Date(), updatedAt: new Date() };
  const create = jest.fn().mockResolvedValue(ticket);
  const findMany = jest.fn().mockResolvedValue([ticket]);
  const count = jest.fn().mockResolvedValue(1);
  const tx = {
    supportTicket: { findMany: jest.fn().mockResolvedValue([ticket]), count: jest.fn().mockResolvedValue(1), findUnique: jest.fn().mockResolvedValue(ticket), update: jest.fn().mockResolvedValue(ticket) },
    tenant: { findMany: jest.fn().mockResolvedValue([{ id: 'tenant-1', name: 'Oficina Alfa' }]) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'user-1', tenantId: 'tenant-1', name: 'Ana', email: 'ana@example.invalid' }]) },
  };
  const prisma = { client: { supportTicket: { create, findMany, count } }, unscoped: { $transaction: (work: (client: typeof tx) => unknown) => work(tx) } } as unknown as PrismaService;
  const repository = new SupportRepository(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('records the workshop and author and lists only their tickets', async () => {
    await repository.create('tenant-1', 'user-1', { subject: ticket.subject, description: ticket.description, priority: 'NORMAL' });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ tenantId: 'tenant-1', createdById: 'user-1' }) });
    await repository.listOwn('tenant-1', 'user-1', 20);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-1', createdById: 'user-1' }, skip: 20, take: 20 }));
    expect(count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1', createdById: 'user-1' } });
  });

  it('shows workshop and author context only in the SaaS admin list', async () => {
    const result = await repository.listAdmin({ status: 'OPEN', offset: 0 });
    expect(tx.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'OPEN' }, take: 30 }));
    expect(result.items[0]).toMatchObject({ tenantName: 'Oficina Alfa', authorName: 'Ana', authorEmail: 'ana@example.invalid' });
  });

  it('requires an answer before resolving an unanswered ticket', async () => {
    await expect(repository.updateAdmin('ticket-1', { status: 'RESOLVED' })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.supportTicket.update).not.toHaveBeenCalled();
  });
});
