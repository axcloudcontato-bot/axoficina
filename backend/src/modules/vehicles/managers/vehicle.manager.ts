import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@oficina/database';
import { isValidChassis, isValidPlate, normalizePlate } from '@oficina/contracts';
import { addMonthsClamped } from '../../customer-care/care-policy';
import type {
  CreateVehicleRequest,
  ImportVehiclesProblem,
  ImportVehiclesRequest,
  ImportVehiclesResponse,
  TransferVehicleRequest,
  VehicleOverviewResponse,
  VehicleArchiveImpactResponse,
  PaginationData,
  UpdateVehicleRequest,
  VehicleListItemResponse,
  VehicleListRequest,
  VehicleResponse,
} from '@oficina/contracts';
import type { Customer as CustomerEntity, Vehicle as VehicleEntity } from '@oficina/database';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import { AppException } from '../../../shared/errors/app-exception';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { CustomerRepository } from '../../customers/repositories/customer.repository';
import { VehicleRepository } from '../repositories/vehicle.repository';

const normalizeName = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
// Same number whatever the mask or the country code.
const phoneKey = (value: string) => { const digits = value.replace(/\D/g, ''); return digits.startsWith('55') && [12, 13].includes(digits.length) ? digits.slice(2) : digits; };

@Injectable()
export class VehicleManager {
  constructor(
    private readonly vehicleRepository: VehicleRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(actingUser: AuthenticatedUser, request: CreateVehicleRequest): Promise<{ vehicle: VehicleResponse }> {
    const customer = await this.customerRepository.byId(request.customerId);
    if (!customer) {
      throw new AppException(AppErrorCode.VEHICLE_CUSTOMER_NOT_FOUND, 'Cliente informado não encontrado.', HttpStatus.BAD_REQUEST);
    }

    const plate = this.validPlate(request.plate);
    const chassis = this.validChassis(request.chassis);
    this.validateYear(request.year);
    const existingPlate = await this.vehicleRepository.byPlate(plate);
    if (existingPlate) {
      throw new AppException(AppErrorCode.VEHICLE_PLATE_ALREADY_EXISTS, 'Já existe um veículo cadastrado com esta placa.', HttpStatus.CONFLICT);
    }

    // Mesma rede de segurança contra corrida do CustomerManager.create —
    // ver comentário lá.
    let vehicle: VehicleEntity;
    try {
      vehicle = await this.vehicleRepository.insert({
        tenantId: actingUser.tenantId,
        customerId: request.customerId,
        brand: request.brand,
        model: request.model,
        plate,
        year: request.year,
        engine: request.engine,
        fuelType: request.fuelType,
        chassis,
        mileage: request.mileage,
        color: request.color?.trim() || undefined,
        photos: request.photos,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(AppErrorCode.VEHICLE_PLATE_ALREADY_EXISTS, 'Já existe um veículo cadastrado com esta placa.', HttpStatus.CONFLICT);
      }
      throw error;
    }

    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'vehicle.created',
      entity: 'vehicle',
      entityId: vehicle.id,
      metadata: { plate: vehicle.plate, customerId: vehicle.customerId },
    });

    return { vehicle: this.toResponse(vehicle, customer) };
  }

  async update(actingUser: AuthenticatedUser, request: UpdateVehicleRequest): Promise<{ vehicle: VehicleResponse }> {
    const existing = await this.vehicleRepository.byId(request.id);
    if (!existing) {
      throw new AppException(AppErrorCode.VEHICLE_NOT_FOUND, 'Veículo não encontrado.', HttpStatus.NOT_FOUND);
    }

    // Only what changed is checked: a record saved before these rules existed can still be edited.
    const plate = request.plate !== undefined && normalizePlate(request.plate) !== existing.plate ? this.validPlate(request.plate) : undefined;
    const chassis = request.chassis !== undefined && request.chassis.trim().toUpperCase() !== (existing.chassis ?? '').toUpperCase() ? this.validChassis(request.chassis) : undefined;
    if (request.year !== undefined && request.year !== existing.year) this.validateYear(request.year);
    if (request.mileage !== undefined && existing.mileage != null && request.mileage < existing.mileage && !request.confirmMileageDecrease) {
      throw new AppException(AppErrorCode.VEHICLE_MILEAGE_DECREASE, `A quilometragem informada (${request.mileage.toLocaleString('pt-BR')} km) é menor que a atual (${existing.mileage.toLocaleString('pt-BR')} km). Confirme para corrigir.`, HttpStatus.BAD_REQUEST, [{ field: 'mileage', message: 'Menor que a quilometragem atual.' }]);
    }
    if (plate) {
      const conflictingPlate = await this.vehicleRepository.byPlate(plate);
      if (conflictingPlate) {
        throw new AppException(AppErrorCode.VEHICLE_PLATE_ALREADY_EXISTS, 'Já existe um veículo cadastrado com esta placa.', HttpStatus.CONFLICT);
      }
    }

    try {
      await this.vehicleRepository.update(request.id, {
        brand: request.brand,
        model: request.model,
        year: request.year,
        engine: request.engine,
        fuelType: request.fuelType,
        plate,
        chassis: request.chassis === undefined ? undefined : chassis ?? existing.chassis ?? undefined,
        mileage: request.mileage,
        color: request.color === undefined ? undefined : request.color.trim(),
        photos: request.photos,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(AppErrorCode.VEHICLE_PLATE_ALREADY_EXISTS, 'Já existe um veículo cadastrado com esta placa.', HttpStatus.CONFLICT);
      }
      throw error;
    }

    const updated = await this.vehicleRepository.byId(request.id);
    if (!updated) {
      throw new AppException(AppErrorCode.VEHICLE_NOT_FOUND, 'Veículo não encontrado.', HttpStatus.NOT_FOUND);
    }

    // Sem throw se o cliente não existir mais: a mutação do veículo já foi
    // persistida (linha acima), e o cliente pode ter sido legitimamente
    // soft-deletado depois que o veículo foi criado (POST /customers/delete
    // permite isso de propósito). Lançar aqui devolveria 500 pra uma edição
    // que na verdade teve sucesso — mesmo fallback de toResponse() usado por
    // getById/delete/list.
    const customer = await this.customerRepository.byId(updated.customerId);

    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'vehicle.updated',
      entity: 'vehicle',
      entityId: updated.id,
      metadata: {},
    });

    return { vehicle: this.toResponse(updated, customer) };
  }

  async delete(actingUser: AuthenticatedUser, id: string): Promise<{ vehicle: VehicleResponse }> {
    const existing = await this.vehicleRepository.byId(id);
    if (!existing) {
      throw new AppException(AppErrorCode.VEHICLE_NOT_FOUND, 'Veículo não encontrado.', HttpStatus.NOT_FOUND);
    }

    const { count } = await this.vehicleRepository.softDelete(id);
    if (count === 0) {
      throw new AppException(AppErrorCode.VEHICLE_NOT_FOUND, 'Veículo não encontrado.', HttpStatus.NOT_FOUND);
    }

    const customer = await this.customerRepository.byId(existing.customerId);

    await this.auditLog.record({
      tenantId: actingUser.tenantId,
      userId: actingUser.userId,
      action: 'vehicle.deleted',
      entity: 'vehicle',
      entityId: id,
      metadata: {},
    });

    return { vehicle: this.toResponse(existing, customer) };
  }

  async restore(actingUser: AuthenticatedUser, id: string): Promise<{ vehicle: VehicleResponse }> {
    const archived = await this.vehicleRepository.archivedById(id);
    if (!archived) throw new AppException(AppErrorCode.VEHICLE_NOT_FOUND, 'Veículo arquivado não encontrado.', HttpStatus.NOT_FOUND);
    // The plate is unique among active vehicles: the same car may have been registered again meanwhile.
    if (await this.vehicleRepository.byPlate(archived.plate)) {
      throw new AppException(AppErrorCode.VEHICLE_PLATE_ALREADY_EXISTS, 'Já existe um veículo ativo com esta placa. Arquive ou corrija o outro cadastro antes de reativar.', HttpStatus.CONFLICT);
    }
    try {
      await this.vehicleRepository.restore(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppException(AppErrorCode.VEHICLE_PLATE_ALREADY_EXISTS, 'Já existe um veículo ativo com esta placa.', HttpStatus.CONFLICT);
      throw error;
    }
    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'vehicle.restored', entity: 'vehicle', entityId: id, metadata: {} });
    const customer = await this.customerRepository.byId(archived.customerId);
    return { vehicle: this.toResponse({ ...archived, deletedAt: null }, customer) };
  }

  async archiveImpact(id: string, now = new Date()): Promise<VehicleArchiveImpactResponse> {
    if (!(await this.vehicleRepository.byId(id))) throw new AppException(AppErrorCode.VEHICLE_NOT_FOUND, 'Veículo não encontrado.', HttpStatus.NOT_FOUND);
    return this.vehicleRepository.archiveImpact(id, now);
  }

  async getById(id: string): Promise<{ vehicle: VehicleResponse }> {
    const vehicle = await this.vehicleRepository.byId(id);
    if (!vehicle) {
      throw new AppException(AppErrorCode.VEHICLE_NOT_FOUND, 'Veículo não encontrado.', HttpStatus.NOT_FOUND);
    }

    const customer = await this.customerRepository.byId(vehicle.customerId);
    return { vehicle: this.toResponse(vehicle, customer) };
  }

  async list(request: VehicleListRequest, now = new Date()): Promise<PaginationData<VehicleListItemResponse>> {
    // `matchOwner` opt-in (default false): the order screen and the vehicles screen turn it on to find
    // a car by its owner's name or document; other callers keep the original plate/model search.
    const matchingCustomerIds =
      request.search && request.matchOwner ? await this.customerRepository.searchIdsByNameOrDocument(request.search) : undefined;
    const ids = await this.filterIds(request.filter, now);
    // A filter that matches nothing is an empty page, not an unfiltered one.
    if (ids && ids.in && ids.in.length === 0) return { items: [], total: 0, offset: request.offset, limit: request.limit, hasMore: false };

    const { items, total } = await this.vehicleRepository.listByTenant(
      request.offset,
      request.limit,
      request.search,
      request.customerId,
      matchingCustomerIds,
      request.archived === true,
      ids,
      request.sort,
      request.direction,
    );

    const customerIds = [...new Set(items.map((item) => item.customerId))];
    const customers = await this.customerRepository.byIds(customerIds);
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const orders = request.withStats ? await this.vehicleRepository.ordersOf(items.map((item) => item.id)) : [];

    return {
      items: items.map((vehicle) => ({
        ...this.toResponse(vehicle, customerById.get(vehicle.customerId) ?? null),
        ...(request.withStats ? { stats: this.statsOf(orders.filter((order) => order.vehicleId === vehicle.id)) } : {}),
      })),
      total,
      offset: request.offset,
      limit: request.limit,
      hasMore: request.offset + items.length < total,
    };
  }

  // Spreadsheet import. The owner is found by document, then by phone (and name when a phone is shared); a row with
  // invalid data, an unknown owner or a plate already registered is reported instead of imported, and the rest go in.
  async importRows(actingUser: AuthenticatedUser, request: ImportVehiclesRequest): Promise<ImportVehiclesResponse> {
    const customers = await this.customerRepository.allForMatching();
    const plates = new Set<string>();
    const problems: ImportVehiclesProblem[] = [];
    let created = 0;

    for (const row of request.rows) {
      const fail = (reason: string) => problems.push({ line: row.line, plate: row.plate.trim() || '(sem placa)', reason });
      const brand = row.brand.trim();
      const model = row.model.trim();
      if (!brand || !model) { fail('Faltam a marca ou o modelo.'); continue; }
      let plate: string;
      let chassis: string | undefined;
      try {
        plate = this.validPlate(row.plate);
        chassis = this.validChassis(row.chassis);
        this.validateYear(row.year);
      } catch (error) {
        fail(error instanceof AppException ? error.message : 'Dados inválidos.');
        continue;
      }
      if (plates.has(plate) || (await this.vehicleRepository.byPlate(plate))) { fail('Já existe um veículo com esta placa.'); continue; }
      const owner = this.findOwner(customers, row);
      if (typeof owner === 'string') { fail(owner); continue; }
      try {
        await this.vehicleRepository.insert({ tenantId: actingUser.tenantId, customerId: owner.id, brand, model, plate, year: row.year, color: row.color?.trim() || undefined, fuelType: row.fuelType?.trim() || undefined, chassis, mileage: row.mileage });
        plates.add(plate);
        created += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { fail('Já existe um veículo com esta placa.'); continue; }
        throw error;
      }
    }
    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'vehicle.imported', entity: 'vehicle', entityId: actingUser.tenantId, metadata: {} });
    return { created, problems };
  }

  // The customer a row belongs to, or the reason it cannot be found.
  private findOwner(customers: Array<{ id: string; name: string; phone: string; document: string }>, row: ImportVehiclesRequest['rows'][number]): { id: string } | string {
    const document = row.ownerDocument?.replace(/\D/g, '');
    if (document) {
      const byDocument = customers.find((customer) => customer.document === document);
      return byDocument ?? 'Nenhum cliente com este documento. Cadastre o cliente antes.';
    }
    const phone = phoneKey(row.ownerPhone ?? '');
    if (phone.length >= 8) {
      const sharing = customers.filter((customer) => phoneKey(customer.phone) === phone);
      if (sharing.length === 1) return sharing[0];
      if (sharing.length > 1) {
        const byName = row.ownerName ? sharing.filter((customer) => normalizeName(customer.name) === normalizeName(row.ownerName as string)) : [];
        return byName.length === 1 ? byName[0] : 'Há mais de um cliente com este telefone. Informe também o nome exato ou o documento do dono.';
      }
      return 'Nenhum cliente com este telefone. Cadastre o cliente antes.';
    }
    return 'Informe o documento ou o telefone do dono.';
  }

  // Everything the vehicle's page needs in one call.
  async overview(id: string, now = new Date()): Promise<VehicleOverviewResponse> {
    if (!(await this.vehicleRepository.byId(id))) throw new AppException(AppErrorCode.VEHICLE_NOT_FOUND, 'Veículo não encontrado.', HttpStatus.NOT_FOUND);
    const [orders, plans, appointments, campaigns] = await Promise.all([
      this.vehicleRepository.ordersOf([id]),
      this.vehicleRepository.carePlansOf(id),
      this.vehicleRepository.upcomingAppointmentsOf(id, now),
      this.vehicleRepository.careCampaigns(),
    ]);
    const stats = this.statsOf(orders);
    const live = orders.filter((order) => order.status !== 'CANCELLED');
    return {
      ...stats,
      deliveredCount: live.filter((order) => order.status === 'DELIVERED').length,
      openServiceOrders: live.filter((order) => order.status !== 'DELIVERED').sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime()).map((order) => ({ id: order.id, orderNumber: order.orderNumber, status: order.status })),
      upcomingAppointments: appointments.map((appointment) => ({ id: appointment.id, startsAt: appointment.startsAt.toISOString(), status: appointment.status, serviceDescription: appointment.serviceDescription })),
      care: plans.map((plan) => {
        const campaign = campaigns.find((item) => item.key === plan.serviceKey);
        const dueAt = addMonthsClamped(plan.completedAt, plan.intervalMonths ?? campaign?.intervalMonths ?? 12);
        const intervalKm = plan.intervalKm ?? campaign?.intervalKm ?? null;
        return { serviceKey: plan.serviceKey, serviceName: campaign?.name ?? plan.serviceKey, completedAt: plan.completedAt.toISOString(), dueAt: dueAt.toISOString(), dueMileage: plan.mileage !== null && intervalKm !== null ? plan.mileage + intervalKm : undefined, overdue: dueAt.getTime() < now.getTime() };
      }).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
      mileageHistory: live
        .map((order) => ({ at: (order.closedAt ?? order.openedAt).toISOString(), mileage: Math.max(order.entryMileage ?? 0, order.exitMileage ?? 0), orderNumber: order.orderNumber }))
        .filter((reading) => reading.mileage > 0)
        .sort((a, b) => a.at.localeCompare(b.at)),
    };
  }

  // Sells the car to another customer. An order still open belongs to the old owner and must be closed first.
  async transfer(actingUser: AuthenticatedUser, request: TransferVehicleRequest, now = new Date()): Promise<{ vehicle: VehicleResponse }> {
    const vehicle = await this.vehicleRepository.byId(request.id);
    if (!vehicle) throw new AppException(AppErrorCode.VEHICLE_NOT_FOUND, 'Veículo não encontrado.', HttpStatus.NOT_FOUND);
    if (vehicle.customerId === request.customerId) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Esse cliente já é o dono do veículo.', HttpStatus.BAD_REQUEST);
    const customer = await this.customerRepository.byId(request.customerId);
    if (!customer) throw new AppException(AppErrorCode.VEHICLE_CUSTOMER_NOT_FOUND, 'Cliente informado não encontrado.', HttpStatus.BAD_REQUEST);
    const open = (await this.vehicleRepository.ordersOf([vehicle.id])).filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status)).length;
    if (open > 0) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, `Este veículo tem ${open} ${open === 1 ? 'ordem de serviço em andamento' : 'ordens de serviço em andamento'}. Entregue ou cancele antes de transferir para outro dono.`, HttpStatus.BAD_REQUEST);
    }
    await this.vehicleRepository.transfer(vehicle.id, customer.id, now);
    await this.auditLog.record({ tenantId: actingUser.tenantId, userId: actingUser.userId, action: 'vehicle.transferred', entity: 'vehicle', entityId: vehicle.id, metadata: { customerId: customer.id } });
    const updated = await this.vehicleRepository.byId(vehicle.id);
    return { vehicle: this.toResponse(updated ?? { ...vehicle, customerId: customer.id }, customer) };
  }

  private async filterIds(filter: VehicleListRequest['filter'], now: Date): Promise<{ in?: string[]; notIn?: string[] } | undefined> {
    if (filter === 'IN_SERVICE') return { in: await this.vehicleRepository.idsWithOpenOrders() };
    if (filter === 'INACTIVE') return { notIn: await this.vehicleRepository.idsDeliveredSince(new Date(now.getTime() - 180 * 86_400_000)) };
    return undefined;
  }

  private statsOf(orders: Array<{ status: string; closedAt: Date | null }>): { orderCount: number; lastVisitAt?: string } {
    const live = orders.filter((order) => order.status !== 'CANCELLED');
    const visits = live.filter((order) => order.status === 'DELIVERED' && order.closedAt).map((order) => (order.closedAt as Date).getTime());
    return { orderCount: live.length, lastVisitAt: visits.length ? new Date(Math.max(...visits)).toISOString() : undefined };
  }

  private toResponse(vehicle: VehicleEntity, customer: CustomerEntity | null): VehicleResponse {
    return {
      id: vehicle.id,
      tenantId: vehicle.tenantId,
      customerId: vehicle.customerId,
      customerName: customer?.name ?? 'Cliente removido',
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year ?? undefined,
      engine: vehicle.engine ?? undefined,
      fuelType: vehicle.fuelType ?? undefined,
      plate: vehicle.plate,
      chassis: vehicle.chassis ?? undefined,
      mileage: vehicle.mileage ?? undefined,
      color: vehicle.color ?? undefined,
      photos: vehicle.photos,
      createdAt: vehicle.createdAt.toISOString(),
      archivedAt: vehicle.deletedAt?.toISOString(),
    };
  }

  private validPlate(raw: string): string {
    const plate = normalizePlate(raw);
    if (!isValidPlate(plate)) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Placa inválida. Use o formato ABC1234 ou ABC1D23.', HttpStatus.BAD_REQUEST, [{ field: 'plate', message: 'Use o formato ABC1234 ou ABC1D23.' }]);
    }
    return plate;
  }

  private validChassis(raw: string | undefined): string | undefined {
    const chassis = raw?.trim().toUpperCase();
    if (!chassis) return undefined;
    if (!isValidChassis(chassis)) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Chassi inválido. Ele tem 17 letras e números (sem I, O e Q).', HttpStatus.BAD_REQUEST, [{ field: 'chassis', message: 'O chassi tem 17 caracteres, sem I, O e Q.' }]);
    }
    return chassis;
  }

  private validateYear(year: number | undefined) {
    if (year === undefined) return;
    const latest = new Date().getFullYear() + 1;
    if (year < 1900 || year > latest) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, `Informe um ano entre 1900 e ${latest}.`, HttpStatus.BAD_REQUEST, [{ field: 'year', message: `Entre 1900 e ${latest}.` }]);
    }
  }
}
