import { Injectable, Logger } from '@nestjs/common';
import type { CustomerAddress } from '@oficina/contracts';
import { Prisma } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export interface CreateCustomerInput {
  // O Prisma Middleware sobrescreve isto com o tenant do contexto ativo em
  // runtime (ver CREATE_OPERATIONS em tenant-isolation.middleware.ts) — só
  // existe aqui para satisfazer o tipo `CustomerCreateInput` do Prisma.
  tenantId: string;
  type: string;
  document: string;
  name: string;
  phone: string;
  email?: string;
  address?: CustomerAddress;
  notes?: string;
  rg?: string;
  stateRegistration?: string;
  secondaryContactName?: string;
  secondaryContactPhone?: string;
  secondaryContactRelation?: string;
  preferredContactChannel?: string;
  preferredContactTime?: string;
}

export interface UpdateCustomerInput {
  document?: string;
  name?: string;
  phone?: string;
  email?: string | null;
  address?: CustomerAddress | null;
  notes?: string | null;
  rg?: string | null;
  stateRegistration?: string | null;
  secondaryContactName?: string | null;
  secondaryContactPhone?: string | null;
  secondaryContactRelation?: string | null;
  preferredContactChannel?: string | null;
  preferredContactTime?: string | null;
}

export interface ListCustomersResult<T> {
  items: T[];
  total: number;
}

@Injectable()
export class CustomerRepository {
  private readonly logger = new Logger(CustomerRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // `this.prisma.client` (tenant-scoped): toda operação de Customer roda
  // dentro de uma requisição autenticada — o Prisma Middleware injeta
  // tenant_id automaticamente (ver TENANT_SCOPED_MODELS em
  // tenant-isolation.middleware.ts).
  async insert(input: CreateCustomerInput) {
    return this.prisma.client.customer.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        document: input.document,
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: input.address as Prisma.InputJsonValue | undefined,
        notes: input.notes,
        rg: input.rg,
        stateRegistration: input.stateRegistration,
        secondaryContactName: input.secondaryContactName,
        secondaryContactPhone: input.secondaryContactPhone,
        secondaryContactRelation: input.secondaryContactRelation,
        preferredContactChannel: input.preferredContactChannel,
        preferredContactTime: input.preferredContactTime,
      },
    });
  }

  async byId(id: string) {
    return this.prisma.client.customer.findFirst({
      where: { id, deletedAt: null },
    });
  }

  // Usado pelo VehicleManager pra denormalizar o nome do dono em telas de
  // listagem de veículos sem N+1 (uma query em lote em vez de uma por
  // veículo).
  async byIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.client.customer.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
  }

  // `prisma.unscoped` de propósito: só chamado por
  // MaintenanceAlertScanProcessor, que roda fora do AsyncLocalStorage de uma
  // requisição. Usado pra filtrar veículos de cliente soft-deletado antes de
  // gerar/manter um alerta (spec, Edge Case 5) — sem relação FK entre Vehicle
  // e Customer (SCHEMA.md: sem REFERENCES), então o filtro é feito em
  // aplicação via lote, mesmo padrão N+1-safe de `byIds`. Nunca usar isto num
  // Controller/Manager.
  async activeIdsAmongUnscoped(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    const customers = await this.prisma.unscoped.customer.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    return customers.map((customer) => customer.id);
  }

  // Usado por VehicleManager.list pra casar veículos pelo nome/documento do
  // cliente dono — sem relação FK entre Vehicle e Customer (SCHEMA.md: sem
  // REFERENCES), o casamento é em duas etapas: aqui só os ids que batem;
  // VehicleRepository.listByTenant faz o OR com marca/modelo/placa. `limit`
  // é uma rede de segurança contra uma cláusula IN gigante se o termo bater
  // em muitos clientes.
  async searchIdsByNameOrDocument(search: string, limit = 500) {
    const customers = await this.prisma.client.customer.findMany({
      where: {
        deletedAt: null,
        OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { document: { contains: search } }],
      },
      select: { id: true },
      take: limit,
    });
    if (customers.length === limit) {
      this.logger.warn(`searchIdsByNameOrDocument truncou em ${limit} resultados para o termo de busca — resultado pode estar incompleto`);
    }
    return customers.map((customer) => customer.id);
  }

  // Escopado ao tenant automaticamente pela extensão — checagem de
  // unicidade do documento é sempre POR TENANT (ver schema.prisma).
  async byDocument(document: string) {
    return this.prisma.client.customer.findFirst({
      where: { document, deletedAt: null },
    });
  }

  async update(id: string, patch: UpdateCustomerInput) {
    return this.prisma.client.customer.updateMany({
      where: { id, deletedAt: null },
      data: { ...patch, address: patch.address === null ? Prisma.DbNull : patch.address as Prisma.InputJsonValue | undefined },
    });
  }

  async softDelete(id: string) {
    return this.prisma.client.customer.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async listByTenant(offset: number, limit: number, search?: string) {
    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { document: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.client.customer.count({ where }),
    ]);

    return { items, total };
  }
}
