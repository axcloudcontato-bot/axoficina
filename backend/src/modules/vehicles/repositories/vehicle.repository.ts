import { Injectable } from '@nestjs/common';
import type { Prisma } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { careSettings } from '../../customer-care/care-policy';

export interface CreateVehicleInput {
  // O Prisma Middleware sobrescreve isto com o tenant do contexto ativo em
  // runtime (ver CREATE_OPERATIONS em tenant-isolation.middleware.ts) — só
  // existe aqui para satisfazer o tipo `VehicleCreateInput` do Prisma.
  tenantId: string;
  customerId: string;
  brand: string;
  model: string;
  plate: string;
  year?: number;
  engine?: string;
  fuelType?: string;
  chassis?: string;
  mileage?: number;
  color?: string;
  photos?: string[];
}

export interface UpdateVehicleInput {
  brand?: string;
  model?: string;
  year?: number;
  engine?: string;
  fuelType?: string;
  plate?: string;
  chassis?: string;
  mileage?: number;
  color?: string;
  photos?: string[];
}

export interface VehicleOrderSummary {
  id: string; vehicleId: string; orderNumber: number; status: string; openedAt: Date; closedAt: Date | null;
  entryMileage: number | null; exitMileage: number | null;
}

@Injectable()
export class VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  // `this.prisma.client` (tenant-scoped): toda operação de Vehicle roda
  // dentro de uma requisição autenticada — o Prisma Middleware injeta
  // tenant_id automaticamente (ver TENANT_SCOPED_MODELS).
  async insert(input: CreateVehicleInput) {
    return this.prisma.client.vehicle.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        brand: input.brand,
        model: input.model,
        plate: input.plate,
        year: input.year,
        engine: input.engine,
        fuelType: input.fuelType,
        chassis: input.chassis,
        mileage: input.mileage,
        color: input.color,
        photos: input.photos ?? [],
      },
    });
  }

  async byId(id: string) {
    return this.prisma.client.vehicle.findFirst({
      where: { id, deletedAt: null },
    });
  }

  // Usado pelo ServiceOrderManager pra denormalizar marca/modelo/placa em
  // telas de listagem de OS sem N+1, mesmo padrão de CustomerRepository.byIds.
  async byIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.client.vehicle.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
  }

  // Escopado ao tenant automaticamente pela extensão — checagem de
  // unicidade da placa é sempre POR TENANT (ver schema.prisma).
  async byPlate(plate: string) {
    return this.prisma.client.vehicle.findFirst({
      where: { plate, deletedAt: null },
    });
  }

  async update(id: string, patch: UpdateVehicleInput) {
    return this.prisma.client.vehicle.updateMany({
      where: { id, deletedAt: null },
      data: patch,
    });
  }

  async archivedById(id: string) {
    return this.prisma.client.vehicle.findFirst({ where: { id, deletedAt: { not: null } } });
  }

  async restore(id: string) {
    return this.prisma.client.vehicle.updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null } });
  }

  // Open orders and appointments still ahead, for the confirmation before archiving.
  async archiveImpact(id: string, now: Date): Promise<{ openServiceOrders: number; upcomingAppointments: number }> {
    const [openServiceOrders, upcomingAppointments] = await Promise.all([
      this.prisma.client.serviceOrder.count({ where: { vehicleId: id, deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } } }),
      this.prisma.client.appointment.count({ where: { vehicleId: id, deletedAt: null, startsAt: { gte: now }, status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_SERVICE'] } } }),
    ]);
    return { openServiceOrders, upcomingAppointments };
  }

  // Orders of a set of vehicles (cancelled ones included; the caller decides what counts).
  async ordersOf(vehicleIds: string[]): Promise<VehicleOrderSummary[]> {
    if (vehicleIds.length === 0) return [];
    return this.prisma.client.serviceOrder.findMany({
      where: { vehicleId: { in: vehicleIds }, deletedAt: null },
      select: { id: true, vehicleId: true, orderNumber: true, status: true, openedAt: true, closedAt: true, entryMileage: true, exitMileage: true },
    });
  }

  // The workshop's care campaigns, with the intervals it chose in Cuidado com o cliente.
  async careCampaigns() {
    return careSettings(await this.prisma.client.customerCareSettings.findFirst()).campaigns;
  }

  async carePlansOf(vehicleId: string) {
    return this.prisma.client.customerCarePlan.findMany({ where: { vehicleId }, orderBy: { completedAt: 'desc' } });
  }

  async upcomingAppointmentsOf(vehicleId: string, from: Date) {
    return this.prisma.client.appointment.findMany({
      where: { vehicleId, deletedAt: null, startsAt: { gte: from }, status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_SERVICE'] } },
      select: { id: true, startsAt: true, status: true, serviceDescription: true },
      orderBy: { startsAt: 'asc' },
      take: 5,
    });
  }

  // Vehicles that left the workshop after a delivered order since `since`.
  async idsDeliveredSince(since: Date): Promise<string[]> {
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { status: 'DELIVERED', closedAt: { gte: since }, deletedAt: null }, select: { vehicleId: true } });
    return [...new Set(orders.map((order) => order.vehicleId))];
  }

  async idsWithOpenOrders(): Promise<string[]> {
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { status: { notIn: ['DELIVERED', 'CANCELLED'] }, deletedAt: null }, select: { vehicleId: true } });
    return [...new Set(orders.map((order) => order.vehicleId))];
  }

  // The car changes hands: it, its future appointments and its care plans go to the new owner, so reminders
  // follow the car. Orders already made keep the owner of their time.
  async transfer(id: string, customerId: string, now: Date) {
    return this.prisma.transaction(async (tx) => {
      await tx.vehicle.updateMany({ where: { id, deletedAt: null }, data: { customerId } });
      await tx.appointment.updateMany({ where: { vehicleId: id, deletedAt: null, startsAt: { gte: now }, status: { in: ['SCHEDULED', 'CONFIRMED'] } }, data: { customerId } });
      await tx.customerCarePlan.updateMany({ where: { vehicleId: id }, data: { customerId } });
      // An alert still open follows the car; the closed ones stay in the name of who had it then.
      await tx.maintenanceAlert.updateMany({ where: { vehicleId: id, status: 'OPEN' }, data: { customerId } });
    });
  }

  async softDelete(id: string) {
    return this.prisma.client.vehicle.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  // `prisma.unscoped` de propósito: só chamado por
  // MaintenanceAlertScanProcessor, que roda fora do AsyncLocalStorage de uma
  // requisição (sem isso, `findMany` num model tenant-scoped sem contexto
  // ativo lança exceção — ver tenant-isolation.middleware.ts). Nunca usar
  // isto num Controller/Manager.
  async listActiveForTenantUnscoped(tenantId: string, offset: number, limit: number) {
    return this.prisma.unscoped.vehicle.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { id: 'asc' },
      skip: offset,
      take: limit,
    });
  }

  // Usado pelo ServiceOrderManager pra casar OS pela placa/marca/modelo do
  // veículo — mesmo padrão de CustomerRepository.searchIdsByNameOrDocument
  // (sem relação FK entre ServiceOrder e Vehicle, o casamento é em duas
  // etapas: aqui só os ids que batem; ServiceOrderRepository.listByTenant
  // faz o OR com número da OS e cliente). `limit` é rede de segurança contra
  // um IN gigante se o termo bater em muitos veículos.
  async searchIdsByPlateOrModel(search: string, limit = 500) {
    const vehicles = await this.prisma.client.vehicle.findMany({
      where: {
        deletedAt: null,
        OR: this.searchTerms(search),
      },
      select: { id: true },
      take: limit,
    });
    return vehicles.map((vehicle) => vehicle.id);
  }

  private searchTerms(search: string): Prisma.VehicleWhereInput[] {
    const plate = search.replace(/[\s-]/g, '').toUpperCase();
    const isPlate = /^[A-Z]{3}\d[A-Z\d]\d{2}$/.test(plate);
    return [
      { brand: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
      { plate: { contains: search, mode: 'insensitive' } },
      { chassis: { contains: search, mode: 'insensitive' } },
      { color: { contains: search, mode: 'insensitive' } },
      ...(isPlate ? [plate, `${plate.slice(0, 3)}-${plate.slice(3)}`, `${plate.slice(0, 3)} ${plate.slice(3)}`].map((value): Prisma.VehicleWhereInput => ({ plate: { contains: value, mode: 'insensitive' } })) : []),
      ...(/^(19|20)\d{2}$/.test(search) ? [{ year: Number(search) }] : []),
    ];
  }

  // `matchingCustomerIds`: ids de clientes cujo nome/documento bateram com
  // `search` (ver CustomerRepository.searchIdsByNameOrDocument) — sem
  // relação FK entre Vehicle e Customer, o casamento por dono é feito assim,
  // adicionado ao mesmo OR de marca/modelo/placa.
  // Empty values go last whatever the direction, so the list never opens on a screenful of blanks.
  private orderBy(archived: boolean, sort: 'recent' | 'plate' | 'year' | 'mileage' = 'recent', direction?: 'asc' | 'desc'): Prisma.VehicleOrderByWithRelationInput[] {
    if (archived) return [{ deletedAt: 'desc' }];
    if (sort === 'plate') return [{ plate: direction ?? 'asc' }];
    if (sort === 'year') return [{ year: { sort: direction ?? 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
    if (sort === 'mileage') return [{ mileage: { sort: direction ?? 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
    return [{ createdAt: direction ?? 'desc' }];
  }

  async listByTenant(offset: number, limit: number, search?: string, customerId?: string, matchingCustomerIds?: string[], archived = false, ids?: { in?: string[]; notIn?: string[] }, sort?: 'recent' | 'plate' | 'year' | 'mileage', direction?: 'asc' | 'desc') {
    const where = {
      deletedAt: archived ? { not: null } : null,
      ...(ids ? { id: ids } : {}),
      ...(customerId ? { customerId } : {}),
      ...(search
        ? {
            OR: [
              ...this.searchTerms(search),
              ...(matchingCustomerIds && matchingCustomerIds.length > 0 ? [{ customerId: { in: matchingCustomerIds } }] : []),
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.vehicle.findMany({
        where,
        orderBy: this.orderBy(archived, sort, direction),
        skip: offset,
        take: limit,
      }),
      this.prisma.client.vehicle.count({ where }),
    ]);

    return { items, total };
  }
}
