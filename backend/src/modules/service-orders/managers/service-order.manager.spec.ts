import { HttpStatus } from '@nestjs/common';
import { ServiceOrderManager } from './service-order.manager';

const actingUser = { userId: 'user-1', tenantId: 'tenant-1', role: 'ADMIN' as const };
const FAKE_TX = {} as never;

function buildManager() {
  const serviceOrderRepository = {
    insert: jest.fn(),
    byId: jest.fn(),
    update: jest.fn(),
    transition: jest.fn(),
    softDelete: jest.fn(),
    listByTenant: jest.fn(),
    listForBusinessSummary: jest.fn(),
    listForProductivity: jest.fn().mockResolvedValue([]),
  };
  const statusHistoryRepository = {
    insert: jest.fn(),
    byServiceOrderId: jest.fn(),
  };
  const itemRepository = {
    insert: jest.fn(),
    byId: jest.fn(),
    byServiceOrderId: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    softDelete: jest.fn(),
    sumTotalsByServiceOrderIds: jest.fn().mockResolvedValue(new Map()),
    financialItemsByServiceOrderIds: jest.fn().mockResolvedValue([]),
  };
  const receiptRepository = {
    byServiceOrderId: jest.fn().mockResolvedValue([]),
    byServiceOrderIds: jest.fn().mockResolvedValue([]),
    receivedSince: jest.fn().mockResolvedValue([]),
    insert: jest.fn(),
    byId: jest.fn(),
    softDelete: jest.fn(),
  };
  const vehicleRepository = {
    byId: jest.fn(),
    byIds: jest.fn().mockResolvedValue([]),
    searchIdsByPlateOrModel: jest.fn().mockResolvedValue([]),
  };
  const customerRepository = {
    byId: jest.fn(),
    byIds: jest.fn().mockResolvedValue([]),
    searchIdsByNameOrDocument: jest.fn().mockResolvedValue([]),
  };
  const userRepository = {
    byId: jest.fn(),
    byIds: jest.fn(),
    listByTenant: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  const prisma = {
    transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(FAKE_TX)),
    client: {
      serviceOrderInstallment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      serviceOrder: { findMany: jest.fn().mockResolvedValue([]) },
    },
  };
  const auditLog = { record: jest.fn() };
  const maintenanceAlertRepository = { resolveOpenByVehicleId: jest.fn() };
  // Default: todos os 6 ângulos cobertos e nenhuma pendência de item, pra
  // não quebrar os testes de transição que não são sobre evidência
  // fotográfica. Os testes dedicados abaixo sobrescrevem pra exercitar o
  // bloqueio.
  const photoRepository = {
    distinctAngles: jest.fn().mockResolvedValue(['FRONT', 'REAR', 'LEFT_SIDE', 'RIGHT_SIDE', 'SPARE_TIRE', 'DASHBOARD']),
    itemCategoryCoverage: jest.fn().mockResolvedValue([]),
  };

  const manager = new ServiceOrderManager(
    serviceOrderRepository as never,
    statusHistoryRepository as never,
    itemRepository as never,
    receiptRepository as never,
    vehicleRepository as never,
    customerRepository as never,
    userRepository as never,
    prisma as never,
    auditLog as never,
    maintenanceAlertRepository as never,
    photoRepository as never,
  );

  return {
    manager,
    serviceOrderRepository,
    statusHistoryRepository,
    itemRepository,
    receiptRepository,
    vehicleRepository,
    customerRepository,
    userRepository,
    prisma,
    auditLog,
    maintenanceAlertRepository,
    photoRepository,
  };
}

const baseCustomer = {
  id: 'customer-1',
  tenantId: 'tenant-1',
  type: 'PF',
  document: '11144477735',
  name: 'João da Silva',
  email: null,
  phone: '11999998888',
  address: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: null,
  deletedAt: null,
};

const baseVehicle = {
  id: 'vehicle-1',
  tenantId: 'tenant-1',
  customerId: 'customer-1',
  brand: 'Fiat',
  model: 'Uno',
  year: 2015,
  engine: null,
  fuelType: null,
  plate: 'ABC1D23',
  chassis: null,
  mileage: null,
  photos: [],
  createdAt: new Date(),
  updatedAt: null,
  deletedAt: null,
};

const baseTechnician = {
  id: 'technician-1',
  tenantId: 'tenant-1',
  email: 'tech@oficina.com',
  passwordHash: 'hash',
  name: 'Carlos Mecânico',
  roleId: 'role-mechanic',
  status: 'active',
  inviteTokenHash: null,
  inviteExpiresAt: null,
  mfaEnabled: false,
  mfaSecret: null,
  createdAt: new Date(),
  updatedAt: null,
  deletedAt: null,
};

const baseServiceOrder = {
  id: 'so-1',
  tenantId: 'tenant-1',
  customerId: 'customer-1',
  vehicleId: 'vehicle-1',
  status: 'OPEN',
  checklist: null,
  diagnosis: null,
  technicianId: null,
  openedAt: new Date('2026-07-17T10:00:00Z'),
  closedAt: null,
  createdAt: new Date('2026-07-17T10:00:00Z'),
  updatedAt: null,
  deletedAt: null,
};

function decimal(value: number) {
  return { toNumber: () => value } as never;
}

function buildItem(overrides: Partial<{ id: string; quantity: number; unitPriceCents: number; type: string; description: string }> = {}) {
  return {
    id: overrides.id ?? 'item-1',
    serviceOrderId: 'so-1',
    type: overrides.type ?? 'PART',
    description: overrides.description ?? 'Filtro de óleo',
    quantity: decimal(overrides.quantity ?? 2),
    unitPriceCents: overrides.unitPriceCents ?? 5000,
    createdAt: new Date('2026-07-17T10:00:00Z'),
    updatedAt: null,
    deletedAt: null,
  };
}

describe('ServiceOrderManager', () => {
  describe('create', () => {
    it('creates a service order linked to a vehicle and derives customerId from it', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.serviceOrderRepository.insert.mockResolvedValue(baseServiceOrder);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      const result = await deps.manager.create(actingUser, { vehicleId: 'vehicle-1' });

      expect(result.serviceOrder.customerId).toBe('customer-1');
      expect(result.serviceOrder.status).toBe('OPEN');
      expect(deps.statusHistoryRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ fromStatus: null, toStatus: 'OPEN' }),
        FAKE_TX,
      );
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'service_order.created' }));
    });

    it('rejects a non-existent vehicleId with 400', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.create(actingUser, { vehicleId: 'missing' })).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        code: 'SERVICE_ORDER_VEHICLE_NOT_FOUND',
      });
      expect(deps.serviceOrderRepository.insert).not.toHaveBeenCalled();
    });

    it('rejects a non-existent technicianId with 400', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.userRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.create(actingUser, { vehicleId: 'vehicle-1', technicianId: 'missing' })).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        code: 'SERVICE_ORDER_TECHNICIAN_NOT_FOUND',
      });
    });

    it('succeeds without a technicianId (optional at creation)', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.serviceOrderRepository.insert.mockResolvedValue(baseServiceOrder);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      const result = await deps.manager.create(actingUser, { vehicleId: 'vehicle-1' });

      expect(result.serviceOrder.technicianId).toBeUndefined();
      expect(deps.userRepository.byId).not.toHaveBeenCalled();
    });

    it('rejects a disabled technicianId with 400', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.userRepository.byId.mockResolvedValue({ ...baseTechnician, status: 'disabled' });

      await expect(deps.manager.create(actingUser, { vehicleId: 'vehicle-1', technicianId: 'technician-1' })).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        code: 'SERVICE_ORDER_TECHNICIAN_NOT_FOUND',
      });
      expect(deps.serviceOrderRepository.insert).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates allowed fields without touching status', async () => {
      const deps = buildManager();
      const updated = { ...baseServiceOrder, diagnosis: 'Pastilha de freio gasta' };
      deps.serviceOrderRepository.byId.mockResolvedValueOnce(baseServiceOrder).mockResolvedValueOnce(updated);
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      const result = await deps.manager.update(actingUser, { id: 'so-1', diagnosis: 'Pastilha de freio gasta' });

      expect(result.serviceOrder.diagnosis).toBe('Pastilha de freio gasta');
      expect(result.serviceOrder.status).toBe('OPEN');
    });

    it('persists installments for credit card and clears them for other methods', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId
        .mockResolvedValueOnce(baseServiceOrder)
        .mockResolvedValueOnce({ ...baseServiceOrder, paymentMethod: 'CREDIT_CARD', paymentInstallments: 6 })
        .mockResolvedValueOnce(baseServiceOrder)
        .mockResolvedValueOnce({ ...baseServiceOrder, paymentMethod: 'PIX', paymentInstallments: null });
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      await deps.manager.update(actingUser, { id: 'so-1', paymentMethod: 'CREDIT_CARD', paymentInstallments: 6 });
      expect(deps.serviceOrderRepository.update).toHaveBeenLastCalledWith('so-1', expect.objectContaining({ paymentMethod: 'CREDIT_CARD', paymentInstallments: 6 }));

      await deps.manager.update(actingUser, { id: 'so-1', paymentMethod: 'PIX', paymentInstallments: 12 });
      expect(deps.serviceOrderRepository.update).toHaveBeenLastCalledWith('so-1', expect.objectContaining({ paymentMethod: 'PIX', paymentInstallments: null }));
    });

    it('rejects an update for a non-existent service order with 404', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.update(actingUser, { id: 'missing' })).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('rejects a disabled technicianId with 400', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue(baseServiceOrder);
      deps.userRepository.byId.mockResolvedValue({ ...baseTechnician, status: 'disabled' });

      await expect(deps.manager.update(actingUser, { id: 'so-1', technicianId: 'technician-1' })).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        code: 'SERVICE_ORDER_TECHNICIAN_NOT_FOUND',
      });
      expect(deps.serviceOrderRepository.update).not.toHaveBeenCalled();
    });

    it('falls back to placeholder names instead of 500 when the vehicle/customer/technician were removed after creation', async () => {
      const deps = buildManager();
      const updated = { ...baseServiceOrder, technicianId: 'technician-1' };
      deps.serviceOrderRepository.byId.mockResolvedValueOnce(baseServiceOrder).mockResolvedValueOnce(updated);
      deps.vehicleRepository.byId.mockResolvedValue(null);
      deps.customerRepository.byId.mockResolvedValue(null);
      deps.userRepository.byId.mockResolvedValue(null);

      const result = await deps.manager.update(actingUser, { id: 'so-1' });

      expect(result.serviceOrder.customerName).toBe('Cliente removido');
      expect(result.serviceOrder.vehiclePlate).toBe('Veículo removido');
    });
  });

  describe('transition', () => {
    it.each([
      ['OPEN', 'AWAITING_APPROVAL'],
      ['OPEN', 'IN_PROGRESS'],
      ['AWAITING_APPROVAL', 'IN_PROGRESS'],
      ['AWAITING_APPROVAL', 'CANCELLED'],
      ['IN_PROGRESS', 'WAITING_PARTS'],
      ['IN_PROGRESS', 'COMPLETED'],
      ['WAITING_PARTS', 'IN_PROGRESS'],
      ['COMPLETED', 'DELIVERED'],
      ['OPEN', 'CANCELLED'],
    ])('allows %s -> %s', async (fromStatus, toStatus) => {
      const deps = buildManager();
      const existing = { ...baseServiceOrder, status: fromStatus };
      const updated = { ...baseServiceOrder, status: toStatus };
      deps.serviceOrderRepository.byId.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
      deps.serviceOrderRepository.transition.mockResolvedValue({ count: 1 });
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      const result = await deps.manager.transition(actingUser, { id: 'so-1', toStatus: toStatus as never });

      expect(result.serviceOrder.status).toBe(toStatus);
      expect(deps.statusHistoryRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ fromStatus, toStatus }),
        FAKE_TX,
      );
    });

    it.each([
      ['AWAITING_APPROVAL', 'COMPLETED'],
      ['OPEN', 'DELIVERED'],
      ['OPEN', 'COMPLETED'],
      ['DELIVERED', 'IN_PROGRESS'],
      ['CANCELLED', 'OPEN'],
    ])('rejects invalid transition %s -> %s with 400', async (fromStatus, toStatus) => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue({ ...baseServiceOrder, status: fromStatus });

      await expect(deps.manager.transition(actingUser, { id: 'so-1', toStatus: toStatus as never })).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        code: 'SERVICE_ORDER_INVALID_STATUS_TRANSITION',
      });
      expect(deps.serviceOrderRepository.transition).not.toHaveBeenCalled();
    });

    it('sets closedAt only when transitioning into DELIVERED or CANCELLED', async () => {
      const deps = buildManager();
      const existing = { ...baseServiceOrder, status: 'COMPLETED' };
      deps.serviceOrderRepository.byId.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ...existing, status: 'DELIVERED' });
      deps.serviceOrderRepository.transition.mockResolvedValue({ count: 1 });
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      await deps.manager.transition(actingUser, { id: 'so-1', toStatus: 'DELIVERED' as never });

      expect(deps.serviceOrderRepository.transition).toHaveBeenCalledWith(FAKE_TX, 'so-1', 'COMPLETED', 'DELIVERED', expect.any(Date));
    });

    it('resolves an open maintenance alert for the vehicle when transitioning into DELIVERED (Edge Case 4)', async () => {
      const deps = buildManager();
      const existing = { ...baseServiceOrder, status: 'COMPLETED' };
      deps.serviceOrderRepository.byId.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ...existing, status: 'DELIVERED' });
      deps.serviceOrderRepository.transition.mockResolvedValue({ count: 1 });
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      await deps.manager.transition(actingUser, { id: 'so-1', toStatus: 'DELIVERED' as never });

      expect(deps.maintenanceAlertRepository.resolveOpenByVehicleId).toHaveBeenCalledWith(FAKE_TX, 'vehicle-1', expect.any(Date));
    });

    it('does not touch maintenance alerts for transitions other than DELIVERED', async () => {
      const deps = buildManager();
      const existing = { ...baseServiceOrder, status: 'OPEN' };
      deps.serviceOrderRepository.byId.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ...existing, status: 'IN_PROGRESS' });
      deps.serviceOrderRepository.transition.mockResolvedValue({ count: 1 });
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      await deps.manager.transition(actingUser, { id: 'so-1', toStatus: 'IN_PROGRESS' as never });

      expect(deps.maintenanceAlertRepository.resolveOpenByVehicleId).not.toHaveBeenCalled();
    });

    it('rejects with 409 when it loses the race against a concurrent transition', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue({ ...baseServiceOrder, status: 'OPEN' });
      deps.serviceOrderRepository.transition.mockResolvedValue({ count: 0 });

      await expect(deps.manager.transition(actingUser, { id: 'so-1', toStatus: 'IN_PROGRESS' as never })).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        code: 'SERVICE_ORDER_INVALID_STATUS_TRANSITION',
      });
      expect(deps.statusHistoryRepository.insert).not.toHaveBeenCalled();
    });

    it.each([
      ['IN_PROGRESS'],
      ['AWAITING_APPROVAL'],
    ])('rejects OPEN -> %s with 400 when ENTRY angles are missing, naming which ones', async (toStatus) => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue({ ...baseServiceOrder, status: 'OPEN' });
      deps.photoRepository.distinctAngles.mockResolvedValue(['FRONT', 'REAR']);

      await expect(deps.manager.transition(actingUser, { id: 'so-1', toStatus: toStatus as never })).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        code: 'SERVICE_ORDER_MISSING_ENTRY_PHOTO',
        message: expect.stringContaining('lateral esquerda'),
      });
      expect(deps.photoRepository.distinctAngles).toHaveBeenCalledWith('so-1', 'ENTRY');
      expect(deps.serviceOrderRepository.transition).not.toHaveBeenCalled();
    });

    it('allows OPEN -> IN_PROGRESS when all 6 ENTRY angles exist', async () => {
      const deps = buildManager();
      const existing = { ...baseServiceOrder, status: 'OPEN' };
      deps.serviceOrderRepository.byId.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ...existing, status: 'IN_PROGRESS' });
      deps.serviceOrderRepository.transition.mockResolvedValue({ count: 1 });
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      const result = await deps.manager.transition(actingUser, { id: 'so-1', toStatus: 'IN_PROGRESS' as never });

      expect(result.serviceOrder.status).toBe('IN_PROGRESS');
    });

    it('rejects IN_PROGRESS -> COMPLETED with 400 when EXIT angles are missing', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue({ ...baseServiceOrder, status: 'IN_PROGRESS' });
      deps.photoRepository.distinctAngles.mockResolvedValue([]);

      await expect(deps.manager.transition(actingUser, { id: 'so-1', toStatus: 'COMPLETED' as never })).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        code: 'SERVICE_ORDER_MISSING_EXIT_PHOTO',
      });
      expect(deps.photoRepository.distinctAngles).toHaveBeenCalledWith('so-1', 'EXIT');
      expect(deps.serviceOrderRepository.transition).not.toHaveBeenCalled();
    });

    it('rejects IN_PROGRESS -> COMPLETED with 400 when an item has no before/after photo pair, naming it', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue({ ...baseServiceOrder, status: 'IN_PROGRESS' });
      deps.itemRepository.byServiceOrderId.mockResolvedValue([
        buildItem({ id: 'item-1', description: 'Troca de pastilha de freio' }),
        buildItem({ id: 'item-2', description: 'Óleo do motor' }),
      ]);
      // item-1 só tem ISSUE (falta RESOLVED); item-2 não tem nenhuma.
      deps.photoRepository.itemCategoryCoverage.mockResolvedValue([{ serviceOrderItemId: 'item-1', category: 'ISSUE' }]);

      await expect(deps.manager.transition(actingUser, { id: 'so-1', toStatus: 'COMPLETED' as never })).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        code: 'SERVICE_ORDER_MISSING_ITEM_PHOTOS',
        message: expect.stringContaining('Troca de pastilha de freio'),
      });
      expect(deps.serviceOrderRepository.transition).not.toHaveBeenCalled();
    });

    it('allows IN_PROGRESS -> COMPLETED when every item has both ISSUE and RESOLVED photos', async () => {
      const deps = buildManager();
      const existing = { ...baseServiceOrder, status: 'IN_PROGRESS' };
      deps.serviceOrderRepository.byId.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ...existing, status: 'COMPLETED' });
      deps.serviceOrderRepository.transition.mockResolvedValue({ count: 1 });
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.itemRepository.byServiceOrderId.mockResolvedValue([buildItem({ id: 'item-1', description: 'Troca de pastilha de freio' })]);
      deps.photoRepository.itemCategoryCoverage.mockResolvedValue([
        { serviceOrderItemId: 'item-1', category: 'ISSUE' },
        { serviceOrderItemId: 'item-1', category: 'RESOLVED' },
      ]);

      const result = await deps.manager.transition(actingUser, { id: 'so-1', toStatus: 'COMPLETED' as never });

      expect(result.serviceOrder.status).toBe('COMPLETED');
    });

    it('does not require photos when cancelling from OPEN', async () => {
      const deps = buildManager();
      const existing = { ...baseServiceOrder, status: 'OPEN' };
      deps.serviceOrderRepository.byId.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ...existing, status: 'CANCELLED' });
      deps.serviceOrderRepository.transition.mockResolvedValue({ count: 1 });
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      const result = await deps.manager.transition(actingUser, { id: 'so-1', toStatus: 'CANCELLED' as never });

      expect(result.serviceOrder.status).toBe('CANCELLED');
      expect(deps.photoRepository.distinctAngles).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('soft deletes regardless of status and records the audit log', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue({ ...baseServiceOrder, status: 'DELIVERED' });
      deps.serviceOrderRepository.softDelete.mockResolvedValue({ count: 1 });
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      await deps.manager.delete(actingUser, 'so-1');

      expect(deps.serviceOrderRepository.softDelete).toHaveBeenCalledWith('so-1');
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'service_order.deleted' }));
    });

    it('rejects with 404 when deleted concurrently between byId and softDelete', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue(baseServiceOrder);
      deps.serviceOrderRepository.softDelete.mockResolvedValue({ count: 0 });

      await expect(deps.manager.delete(actingUser, 'so-1')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  describe('getById', () => {
    it('returns 404 for a non-existent service order', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.getById('missing')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('populates statusHistory in chronological order', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue(baseServiceOrder);
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.statusHistoryRepository.byServiceOrderId.mockResolvedValue([
        { id: 'h1', serviceOrderId: 'so-1', fromStatus: null, toStatus: 'OPEN', changedBy: 'user-1', changedAt: new Date() },
      ]);

      const result = await deps.manager.getById('so-1');

      expect(result.serviceOrder.statusHistory).toHaveLength(1);
      expect(result.serviceOrder.statusHistory?.[0].toStatus).toBe('OPEN');
    });
  });

  describe('list', () => {
    it('batches vehicle/customer/technician lookups instead of N+1', async () => {
      const deps = buildManager();
      const withTechnician = { ...baseServiceOrder, technicianId: 'technician-1' };
      deps.serviceOrderRepository.listByTenant.mockResolvedValue({ items: [withTechnician], total: 1 });
      deps.vehicleRepository.byIds.mockResolvedValue([baseVehicle]);
      deps.customerRepository.byIds.mockResolvedValue([baseCustomer]);
      deps.userRepository.byIds.mockResolvedValue([baseTechnician]);

      const result = await deps.manager.list({ offset: 0, limit: 20 });

      expect(deps.vehicleRepository.byIds).toHaveBeenCalledWith(['vehicle-1']);
      expect(deps.userRepository.byIds).toHaveBeenCalledWith(['technician-1']);
      expect(result.items[0].technicianName).toBe('Carlos Mecânico');
    });

    it('filters by status/vehicleId/technicianId/customerId', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
      deps.vehicleRepository.byIds.mockResolvedValue([]);
      deps.customerRepository.byIds.mockResolvedValue([]);
      deps.userRepository.byIds.mockResolvedValue([]);

      await deps.manager.list({
        offset: 0,
        limit: 20,
        status: 'IN_PROGRESS' as never,
        vehicleId: 'vehicle-1',
        technicianId: 'technician-1',
        customerId: 'customer-1',
      });

      expect(deps.serviceOrderRepository.listByTenant).toHaveBeenCalledWith(0, 20, 'IN_PROGRESS', 'vehicle-1', 'technician-1', 'customer-1', undefined);
    });

    it('resolves matching customer/vehicle ids and parses a numeric term as order number', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
      deps.vehicleRepository.byIds.mockResolvedValue([]);
      deps.customerRepository.byIds.mockResolvedValue([]);
      deps.userRepository.byIds.mockResolvedValue([]);
      deps.customerRepository.searchIdsByNameOrDocument.mockResolvedValue(['customer-9']);
      deps.vehicleRepository.searchIdsByPlateOrModel.mockResolvedValue(['vehicle-9']);

      await deps.manager.list({ offset: 0, limit: 20, search: ' 42 ' });

      expect(deps.customerRepository.searchIdsByNameOrDocument).toHaveBeenCalledWith('42');
      expect(deps.vehicleRepository.searchIdsByPlateOrModel).toHaveBeenCalledWith('42');
      expect(deps.serviceOrderRepository.listByTenant).toHaveBeenCalledWith(0, 20, undefined, undefined, undefined, undefined, {
        orderNumber: 42,
        matchingCustomerIds: ['customer-9'],
        matchingVehicleIds: ['vehicle-9'],
      });
    });

    it('leaves orderNumber undefined for a non-numeric search term', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
      deps.vehicleRepository.byIds.mockResolvedValue([]);
      deps.customerRepository.byIds.mockResolvedValue([]);
      deps.userRepository.byIds.mockResolvedValue([]);
      deps.customerRepository.searchIdsByNameOrDocument.mockResolvedValue([]);
      deps.vehicleRepository.searchIdsByPlateOrModel.mockResolvedValue(['vehicle-9']);

      await deps.manager.list({ offset: 0, limit: 20, search: 'ABC1D23' });

      expect(deps.serviceOrderRepository.listByTenant).toHaveBeenCalledWith(0, 20, undefined, undefined, undefined, undefined, {
        orderNumber: undefined,
        matchingCustomerIds: [],
        matchingVehicleIds: ['vehicle-9'],
      });
    });

    it('aggregates totalAmountCents per order in one batch call, without loading full items', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.listByTenant.mockResolvedValue({ items: [baseServiceOrder], total: 1 });
      deps.vehicleRepository.byIds.mockResolvedValue([baseVehicle]);
      deps.customerRepository.byIds.mockResolvedValue([baseCustomer]);
      deps.userRepository.byIds.mockResolvedValue([]);
      deps.itemRepository.sumTotalsByServiceOrderIds.mockResolvedValue(new Map([['so-1', 12500]]));

      const result = await deps.manager.list({ offset: 0, limit: 20 });

      expect(deps.itemRepository.sumTotalsByServiceOrderIds).toHaveBeenCalledWith(['so-1']);
      expect(result.items[0].totalAmountCents).toBe(12500);
      expect(result.items[0].items).toBeUndefined();
    });
  });

  describe('businessSummary', () => {
    it('calculates revenue, pipeline, overdue deliveries and technician workload', async () => {
      const deps = buildManager();
      const now = new Date('2026-07-27T12:00:00Z');
      deps.serviceOrderRepository.listForBusinessSummary.mockResolvedValue([
        { ...baseServiceOrder, id: 'delivered', status: 'DELIVERED', technicianId: 'technician-1', closedAt: new Date('2026-07-10T12:00:00Z') },
        { ...baseServiceOrder, id: 'active', status: 'IN_PROGRESS', technicianId: 'technician-1', expectedDeliveryAt: new Date('2026-07-26T12:00:00Z') },
      ]);
      deps.itemRepository.sumTotalsByServiceOrderIds.mockResolvedValue(new Map([['delivered', 10000], ['active', 5000]]));
      deps.itemRepository.financialItemsByServiceOrderIds.mockResolvedValue([
        { serviceOrderId: 'delivered', type: 'PART', description: 'Pastilha', lineTotalCents: 6000 },
        { serviceOrderId: 'delivered', type: 'LABOR', description: 'Troca de pastilhas', lineTotalCents: 4000 },
      ]);
      const receipt = { id: 'receipt-1', tenantId: 'tenant-1', serviceOrderId: 'delivered', method: 'PIX', amountCents: 10000, receivedAt: new Date('2026-07-10T12:00:00Z'), confirmedBy: 'user-1', notes: null, createdAt: new Date(), updatedAt: null, deletedAt: null };
      deps.receiptRepository.byServiceOrderIds.mockResolvedValue([receipt]);
      deps.receiptRepository.receivedSince.mockResolvedValue([receipt]);
      deps.userRepository.byIds.mockResolvedValue([baseTechnician]);

      const result = await deps.manager.businessSummary(now);

      expect(result.monthRevenueCents).toBe(10000);
      expect(result.activePipelineCents).toBe(5000);
      expect(result.averageTicketCents).toBe(10000);
      expect(result.partsRevenueCents).toBe(6000);
      expect(result.laborRevenueCents).toBe(4000);
      expect(result.inProgressCents).toBe(5000);
      expect(result.accountsReceivableCents).toBe(5000);
      expect(result.overdueDeliveries).toBe(1);
      expect(result.technicianWorkload[0]).toMatchObject({ technicianName: 'Carlos Mecânico', activeOrders: 1 });
    });
  });

  describe('technicianProductivity', () => {
    it('aggregates completed count, labor revenue and average time per technician, including technicians with no activity in the period', async () => {
      const deps = buildManager();
      const technicianTwo = { ...baseTechnician, id: 'technician-2', name: 'Ana Mecânica' };
      deps.userRepository.listByTenant.mockResolvedValue({ items: [baseTechnician, technicianTwo], total: 2 });
      deps.serviceOrderRepository.listForProductivity.mockResolvedValue([
        { ...baseServiceOrder, id: 'delivered-1', status: 'DELIVERED', technicianId: 'technician-1', openedAt: new Date('2026-07-10T10:00:00Z'), closedAt: new Date('2026-07-10T15:00:00Z') },
        { ...baseServiceOrder, id: 'active-1', status: 'IN_PROGRESS', technicianId: 'technician-1' },
      ]);
      deps.itemRepository.financialItemsByServiceOrderIds.mockResolvedValue([
        { serviceOrderId: 'delivered-1', type: 'LABOR', description: 'Troca de óleo', lineTotalCents: 4000 },
        { serviceOrderId: 'delivered-1', type: 'PART', description: 'Óleo', lineTotalCents: 6000 },
      ]);

      const result = await deps.manager.technicianProductivity({ startAt: '2026-07-01T00:00:00Z', endAt: '2026-07-31T23:59:59Z' });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({ technicianId: 'technician-1', technicianName: 'Carlos Mecânico', completedCount: 1, laborRevenueCents: 4000, avgCompletionHours: 5, activeOrders: 1 });
      expect(result.items[1]).toMatchObject({ technicianId: 'technician-2', technicianName: 'Ana Mecânica', completedCount: 0, laborRevenueCents: 0, avgCompletionHours: null, activeOrders: 0 });
    });
  });

  describe('receipts', () => {
    it('creates a monthly pending schedule when payment is not anticipated', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue(baseServiceOrder);
      deps.itemRepository.byServiceOrderId.mockResolvedValue([{ id: 'item-1', serviceOrderId: 'so-1', type: 'SERVICE', description: 'Serviço', quantity: { toNumber: () => 1 }, unitPriceCents: 10001, createdAt: new Date() }]);
      const createMany = jest.fn().mockResolvedValue({ count: 3 });
      deps.prisma.transaction.mockImplementation(async (fn) => fn({
        $executeRaw: jest.fn(),
        serviceOrderInstallment: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn(), createMany },
        serviceOrder: { updateMany: jest.fn() },
        serviceOrderReceipt: { findFirst: jest.fn().mockResolvedValue(null) },
      }));
      jest.spyOn(deps.manager, 'getById').mockResolvedValue({ serviceOrder: {} as never });

      await deps.manager.configurePayment(actingUser, {
        serviceOrderId: 'so-1',
        method: 'CREDIT_CARD',
        installments: 3,
        anticipated: false,
        firstDueAt: '2026-07-31T12:00:00.000Z',
      });

      expect(createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
        expect.objectContaining({ installmentNumber: 1, amountCents: 3333 }),
        expect.objectContaining({ installmentNumber: 3, amountCents: 3335 }),
      ]) });
    });

    it('creates one full receipt and no schedule for anticipated payment', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue(baseServiceOrder);
      deps.itemRepository.byServiceOrderId.mockResolvedValue([{ id: 'item-1', serviceOrderId: 'so-1', type: 'SERVICE', description: 'Serviço', quantity: { toNumber: () => 1 }, unitPriceCents: 10000, createdAt: new Date() }]);
      const createReceipt = jest.fn().mockResolvedValue({ id: 'receipt-1' });
      const createMany = jest.fn();
      deps.prisma.transaction.mockImplementation(async (fn) => fn({
        $executeRaw: jest.fn(),
        serviceOrderInstallment: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn(), createMany },
        serviceOrder: { updateMany: jest.fn() },
        serviceOrderReceipt: { findFirst: jest.fn().mockResolvedValue(null), create: createReceipt },
      }));
      jest.spyOn(deps.manager, 'getById').mockResolvedValue({ serviceOrder: {} as never });

      await deps.manager.configurePayment(actingUser, {
        serviceOrderId: 'so-1',
        method: 'CREDIT_CARD',
        installments: 6,
        anticipated: true,
      });

      expect(createReceipt).toHaveBeenCalledWith({ data: expect.objectContaining({ amountCents: 10000 }) });
      expect(createMany).not.toHaveBeenCalled();
    });

    it('confirms a receipt only within the outstanding balance', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue({ ...baseServiceOrder, paymentMethod: 'PIX' });
      const createdReceipt = { id: 'receipt-1', tenantId: 'tenant-1', serviceOrderId: 'so-1', method: 'PIX', amountCents: 10000, receivedAt: new Date(), confirmedBy: 'user-1', notes: null, createdAt: new Date(), updatedAt: null, deletedAt: null };
      deps.prisma.transaction.mockImplementation((fn) => fn({
        $executeRaw: jest.fn(),
        serviceOrderItem: { findMany: jest.fn().mockResolvedValue([buildItem({ quantity: 1, unitPriceCents: 10000 })]) },
        serviceOrderReceipt: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue(createdReceipt) },
      }));

      const result = await deps.manager.confirmReceipt(actingUser, { serviceOrderId: 'so-1', method: 'PIX', amountCents: 10000 });

      expect(result.receipt.amountCents).toBe(10000);
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'service_order.receipt_confirmed' }));
    });

    it('rejects a receipt greater than the outstanding balance', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue({ ...baseServiceOrder, paymentMethod: 'PIX' });
      deps.prisma.transaction.mockImplementation((fn) => fn({
        $executeRaw: jest.fn(),
        serviceOrderItem: { findMany: jest.fn().mockResolvedValue([buildItem({ quantity: 1, unitPriceCents: 10000 })]) },
        serviceOrderReceipt: { findMany: jest.fn().mockResolvedValue([{ amountCents: 8000 }]), create: jest.fn() },
      }));

      await expect(deps.manager.confirmReceipt(actingUser, { serviceOrderId: 'so-1', method: 'PIX', amountCents: 3000 })).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });
  });

  describe('getById with items', () => {
    it('includes items and computes totalAmountCents from them', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue(baseServiceOrder);
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.statusHistoryRepository.byServiceOrderId.mockResolvedValue([]);
      deps.itemRepository.byServiceOrderId.mockResolvedValue([
        buildItem({ id: 'item-1', quantity: 2, unitPriceCents: 5000 }),
        buildItem({ id: 'item-2', quantity: 1, unitPriceCents: 3000 }),
      ]);

      const result = await deps.manager.getById('so-1');

      expect(result.serviceOrder.items).toHaveLength(2);
      expect(result.serviceOrder.totalAmountCents).toBe(13000);
    });

    it('returns totalAmountCents 0 and an empty items array for an OS with no items', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue(baseServiceOrder);
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.statusHistoryRepository.byServiceOrderId.mockResolvedValue([]);
      deps.itemRepository.byServiceOrderId.mockResolvedValue([]);

      const result = await deps.manager.getById('so-1');

      expect(result.serviceOrder.totalAmountCents).toBe(0);
      expect(result.serviceOrder.items).toEqual([]);
    });
  });

  describe('addItem', () => {
    it('adds an item to an existing service order and returns its computed lineTotalCents', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue(baseServiceOrder);
      deps.itemRepository.insert.mockResolvedValue(buildItem({ quantity: 2, unitPriceCents: 5000 }));

      const result = await deps.manager.addItem({
        serviceOrderId: 'so-1',
        type: 'PART',
        description: 'Filtro de óleo',
        quantity: 2,
        unitPriceCents: 5000,
      });

      expect(deps.itemRepository.insert).toHaveBeenCalledWith({
        serviceOrderId: 'so-1',
        type: 'PART',
        description: 'Filtro de óleo',
        quantity: 2,
        unitPriceCents: 5000,
      });
      expect(result.item.lineTotalCents).toBe(10000);
    });

    it('rejects adding an item to a non-existent (or another tenant\'s) service order with 404', async () => {
      const deps = buildManager();
      deps.serviceOrderRepository.byId.mockResolvedValue(null);

      await expect(
        deps.manager.addItem({ serviceOrderId: 'missing', type: 'PART', description: 'X', quantity: 1, unitPriceCents: 100 }),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND, code: 'SERVICE_ORDER_NOT_FOUND' });
      expect(deps.itemRepository.insert).not.toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    it('updates an item and returns the recalculated lineTotalCents', async () => {
      const deps = buildManager();
      deps.itemRepository.byId
        .mockResolvedValueOnce(buildItem({ quantity: 2, unitPriceCents: 5000 }))
        .mockResolvedValueOnce(buildItem({ quantity: 3, unitPriceCents: 5000 }));
      deps.serviceOrderRepository.byId.mockResolvedValue(baseServiceOrder);

      const result = await deps.manager.updateItem({ id: 'item-1', quantity: 3 });

      expect(deps.itemRepository.update).toHaveBeenCalledWith('item-1', {
        type: undefined,
        description: undefined,
        quantity: 3,
        unitPriceCents: undefined,
      });
      expect(result.item.lineTotalCents).toBe(15000);
    });

    it('rejects updating a non-existent item with 404', async () => {
      const deps = buildManager();
      deps.itemRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.updateItem({ id: 'missing', quantity: 1 })).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        code: 'SERVICE_ORDER_ITEM_NOT_FOUND',
      });
    });

    it('rejects updating an item whose owning service order is not visible to the current tenant with 404', async () => {
      const deps = buildManager();
      deps.itemRepository.byId.mockResolvedValue(buildItem());
      deps.serviceOrderRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.updateItem({ id: 'item-1', quantity: 1 })).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        code: 'SERVICE_ORDER_ITEM_NOT_FOUND',
      });
      expect(deps.itemRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('soft deletes an item and returns its pre-delete state', async () => {
      const deps = buildManager();
      const item = buildItem();
      deps.itemRepository.byId.mockResolvedValue(item);
      deps.serviceOrderRepository.byId.mockResolvedValue(baseServiceOrder);
      deps.itemRepository.softDelete.mockResolvedValue({ count: 1 });

      const result = await deps.manager.deleteItem('item-1');

      expect(deps.itemRepository.softDelete).toHaveBeenCalledWith('item-1');
      expect(result.item.id).toBe('item-1');
    });

    it('rejects deleting a non-existent item with 404', async () => {
      const deps = buildManager();
      deps.itemRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.deleteItem('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        code: 'SERVICE_ORDER_ITEM_NOT_FOUND',
      });
    });

    it('rejects deleting an item whose owning service order belongs to another tenant with 404', async () => {
      const deps = buildManager();
      deps.itemRepository.byId.mockResolvedValue(buildItem());
      deps.serviceOrderRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.deleteItem('item-1')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        code: 'SERVICE_ORDER_ITEM_NOT_FOUND',
      });
      expect(deps.itemRepository.softDelete).not.toHaveBeenCalled();
    });
  });
});
