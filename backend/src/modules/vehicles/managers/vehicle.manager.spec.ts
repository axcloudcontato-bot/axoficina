import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@oficina/database';
import { VehicleManager } from './vehicle.manager';

const actingUser = { userId: 'user-1', tenantId: 'tenant-1', role: 'ADMIN' as const };

function buildManager() {
  const vehicleRepository = {
    insert: jest.fn(),
    byId: jest.fn(),
    byPlate: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    listByTenant: jest.fn(),
    ordersOf: jest.fn().mockResolvedValue([]),
    carePlansOf: jest.fn().mockResolvedValue([]),
    upcomingAppointmentsOf: jest.fn().mockResolvedValue([]),
    idsDeliveredSince: jest.fn().mockResolvedValue([]),
    idsWithOpenOrders: jest.fn().mockResolvedValue([]),
    transfer: jest.fn(),
    archivedById: jest.fn(),
    restore: jest.fn(),
    archiveImpact: jest.fn(),
  };
  const customerRepository = {
    allForMatching: jest.fn().mockResolvedValue([]),
    byId: jest.fn(),
    byIds: jest.fn(),
    searchIdsByNameOrDocument: jest.fn(),
  };
  const auditLog = { record: jest.fn() };

  const manager = new VehicleManager(vehicleRepository as never, customerRepository as never, auditLog as never);

  return { manager, vehicleRepository, customerRepository, auditLog };
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

describe('VehicleManager', () => {
  describe('create', () => {
    it('creates a vehicle linked to an existing customer and records the audit log', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.vehicleRepository.byPlate.mockResolvedValue(null);
      deps.vehicleRepository.insert.mockResolvedValue(baseVehicle);

      const result = await deps.manager.create(actingUser, {
        customerId: 'customer-1',
        brand: 'Fiat',
        model: 'Uno',
        plate: 'ABC1D23',
      });

      expect(result.vehicle.id).toBe('vehicle-1');
      expect(result.vehicle.customerName).toBe('João da Silva');
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'vehicle.created' }));
    });

    it('rejects a non-existent customerId with 400', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(null);

      await expect(
        deps.manager.create(actingUser, { customerId: 'missing', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23' }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST, code: 'VEHICLE_CUSTOMER_NOT_FOUND' });
      expect(deps.vehicleRepository.insert).not.toHaveBeenCalled();
    });

    it('rejects a duplicate plate within the same tenant with 409', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.vehicleRepository.byPlate.mockResolvedValue(baseVehicle);

      await expect(
        deps.manager.create(actingUser, { customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23' }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });

    it('translates a concurrent unique-constraint violation (P2002) into 409, not 500', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.vehicleRepository.byPlate.mockResolvedValue(null);
      deps.vehicleRepository.insert.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
      );

      await expect(
        deps.manager.create(actingUser, { customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23' }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT, code: 'VEHICLE_PLATE_ALREADY_EXISTS' });
    });
  });

  describe('update', () => {
    it('updates allowed fields', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValueOnce(baseVehicle).mockResolvedValueOnce({ ...baseVehicle, mileage: 50000 });
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      const result = await deps.manager.update(actingUser, { id: 'vehicle-1', mileage: 50000 });

      expect(result.vehicle.mileage).toBe(50000);
    });

    it('rejects an update for a non-existent vehicle with 404', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.update(actingUser, { id: 'missing', brand: 'X' })).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('rejects changing the plate to one already used by another vehicle in the tenant', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.vehicleRepository.byPlate.mockResolvedValue({ ...baseVehicle, id: 'other-vehicle' });

      await expect(deps.manager.update(actingUser, { id: 'vehicle-1', plate: 'XYZ9W88' })).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
    });

    it('does not check plate uniqueness when the plate is unchanged', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValueOnce(baseVehicle).mockResolvedValueOnce(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      await deps.manager.update(actingUser, { id: 'vehicle-1', plate: baseVehicle.plate });

      expect(deps.vehicleRepository.byPlate).not.toHaveBeenCalled();
    });

    it('succeeds with a placeholder customer name instead of 500 when the owning customer was removed after vehicle creation', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValueOnce(baseVehicle).mockResolvedValueOnce({ ...baseVehicle, mileage: 60000 });
      deps.customerRepository.byId.mockResolvedValue(null);

      const result = await deps.manager.update(actingUser, { id: 'vehicle-1', mileage: 60000 });

      expect(result.vehicle.customerName).toBe('Cliente removido');
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'vehicle.updated' }));
    });
  });

  describe('delete', () => {
    it('soft deletes and records the audit log', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.vehicleRepository.softDelete.mockResolvedValue({ count: 1 });
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);

      await deps.manager.delete(actingUser, 'vehicle-1');

      expect(deps.vehicleRepository.softDelete).toHaveBeenCalledWith('vehicle-1');
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'vehicle.deleted' }));
    });

    it('rejects with 404 when the vehicle is deleted concurrently between byId and softDelete', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.vehicleRepository.softDelete.mockResolvedValue({ count: 0 });

      await expect(deps.manager.delete(actingUser, 'vehicle-1')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
      expect(deps.auditLog.record).not.toHaveBeenCalled();
    });

    it('rejects deleting a non-existent vehicle with 404', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.delete(actingUser, 'missing')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  describe('getById', () => {
    it('returns 404 for a non-existent vehicle', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.getById('missing')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('falls back to a placeholder name if the owning customer was removed', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.customerRepository.byId.mockResolvedValue(null);

      const result = await deps.manager.getById('vehicle-1');

      expect(result.vehicle.customerName).toBe('Cliente removido');
    });
  });

  describe('list', () => {
    it('batches customer lookups instead of N+1', async () => {
      const deps = buildManager();
      deps.vehicleRepository.listByTenant.mockResolvedValue({ items: [baseVehicle], total: 1 });
      deps.customerRepository.byIds.mockResolvedValue([baseCustomer]);

      const result = await deps.manager.list({ offset: 0, limit: 20, search: 'Uno' });

      expect(deps.vehicleRepository.listByTenant).toHaveBeenCalledWith(0, 20, 'Uno', undefined, undefined, false, undefined, undefined, undefined);
      expect(deps.customerRepository.byIds).toHaveBeenCalledWith(['customer-1']);
      expect(result.items[0].customerName).toBe('João da Silva');
    });

    it('filters by customerId when provided', async () => {
      const deps = buildManager();
      deps.vehicleRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
      deps.customerRepository.byIds.mockResolvedValue([]);

      await deps.manager.list({ offset: 0, limit: 20, customerId: 'customer-1' });

      expect(deps.customerRepository.searchIdsByNameOrDocument).not.toHaveBeenCalled();
      expect(deps.vehicleRepository.listByTenant).toHaveBeenCalledWith(0, 20, undefined, 'customer-1', undefined, false, undefined, undefined, undefined);
    });

    it('does not match by owner name/document when matchOwner is not set, even with a search term', async () => {
      const deps = buildManager();
      deps.vehicleRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
      deps.customerRepository.byIds.mockResolvedValue([]);

      await deps.manager.list({ offset: 0, limit: 20, search: 'João' });

      expect(deps.customerRepository.searchIdsByNameOrDocument).not.toHaveBeenCalled();
      expect(deps.vehicleRepository.listByTenant).toHaveBeenCalledWith(0, 20, 'João', undefined, undefined, false, undefined, undefined, undefined);
    });

    it('also matches vehicles whose owning customer name or document matches the search term when matchOwner is set', async () => {
      const deps = buildManager();
      deps.customerRepository.searchIdsByNameOrDocument.mockResolvedValue(['customer-1']);
      deps.vehicleRepository.listByTenant.mockResolvedValue({ items: [baseVehicle], total: 1 });
      deps.customerRepository.byIds.mockResolvedValue([baseCustomer]);

      const result = await deps.manager.list({ offset: 0, limit: 20, search: 'João', matchOwner: true });

      expect(deps.customerRepository.searchIdsByNameOrDocument).toHaveBeenCalledWith('João');
      expect(deps.vehicleRepository.listByTenant).toHaveBeenCalledWith(0, 20, 'João', undefined, ['customer-1'], false, undefined, undefined, undefined);
      expect(result.items[0].plate).toBe('ABC1D23');
    });
  });

  describe('plate, chassis, year and mileage rules', () => {
    it('stores the plate upper case without hyphen or spaces, and looks for duplicates by that form', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.vehicleRepository.byPlate.mockResolvedValue(null);
      deps.vehicleRepository.insert.mockResolvedValue(baseVehicle);
      await deps.manager.create(actingUser, { customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate: ' abc-1d23 ' });
      expect(deps.vehicleRepository.byPlate).toHaveBeenCalledWith('ABC1D23');
      expect(deps.vehicleRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ plate: 'ABC1D23' }));
    });

    it('treats the same car written two ways as a duplicate', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.vehicleRepository.byPlate.mockResolvedValue(baseVehicle);
      await expect(deps.manager.create(actingUser, { customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate: 'abc 1d23' })).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
      expect(deps.vehicleRepository.insert).not.toHaveBeenCalled();
    });

    it.each(['ABC12', 'ABCD123', '1234567', 'ABC1D2E', 'AB-1D234'])('refuses the invalid plate %s', async (plate) => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      await expect(deps.manager.create(actingUser, { customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate })).rejects.toThrow('Placa inválida');
    });

    it('accepts the old and the Mercosul formats', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.vehicleRepository.byPlate.mockResolvedValue(null);
      deps.vehicleRepository.insert.mockResolvedValue(baseVehicle);
      await expect(deps.manager.create(actingUser, { customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate: 'ABC-1234' })).resolves.toBeDefined();
      await expect(deps.manager.create(actingUser, { customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23' })).resolves.toBeDefined();
    });

    it('checks chassis and year when given, upper-casing the chassis', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.vehicleRepository.byPlate.mockResolvedValue(null);
      deps.vehicleRepository.insert.mockResolvedValue(baseVehicle);
      await expect(deps.manager.create(actingUser, { customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23', chassis: '9BD1234567890OIQ1' })).rejects.toThrow('Chassi inválido');
      await expect(deps.manager.create(actingUser, { customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23', year: 1800 })).rejects.toThrow('Informe um ano');
      await deps.manager.create(actingUser, { customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23', chassis: '9bd15822753123456', year: new Date().getFullYear() + 1 });
      expect(deps.vehicleRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ chassis: '9BD15822753123456' }));
    });

    it('lets a record saved before these rules be edited without re-validating what did not change', async () => {
      const deps = buildManager();
      const old = { ...baseVehicle, plate: 'XX99', chassis: 'curto', year: 3 };
      deps.vehicleRepository.byId.mockResolvedValue(old);
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      await deps.manager.update(actingUser, { id: 'vehicle-1', plate: 'XX99', chassis: 'curto', year: 3, mileage: 100 });
      expect(deps.vehicleRepository.update).toHaveBeenCalledWith('vehicle-1', expect.objectContaining({ plate: undefined, mileage: 100 }));
    });

    it('asks for confirmation before lowering the mileage, and accepts it once confirmed', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue({ ...baseVehicle, mileage: 98000 });
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      await expect(deps.manager.update(actingUser, { id: 'vehicle-1', mileage: 9800 })).rejects.toMatchObject({ code: 'VEHICLE_MILEAGE_DECREASE' });
      expect(deps.vehicleRepository.update).not.toHaveBeenCalled();
      await deps.manager.update(actingUser, { id: 'vehicle-1', mileage: 9800, confirmMileageDecrease: true });
      expect(deps.vehicleRepository.update).toHaveBeenCalledWith('vehicle-1', expect.objectContaining({ mileage: 9800 }));
      await deps.manager.update(actingUser, { id: 'vehicle-1', mileage: 99000 });
      expect(deps.vehicleRepository.update).toHaveBeenLastCalledWith('vehicle-1', expect.objectContaining({ mileage: 99000 }));
    });
  });

  describe('archived vehicles', () => {
    it('lists the archived ones on request', async () => {
      const deps = buildManager();
      deps.vehicleRepository.listByTenant.mockResolvedValue({ items: [{ ...baseVehicle, deletedAt: new Date('2026-10-01T00:00:00Z') }], total: 1 });
      deps.customerRepository.byIds.mockResolvedValue([baseCustomer]);
      const result = await deps.manager.list({ offset: 0, limit: 20, archived: true });
      expect(deps.vehicleRepository.listByTenant).toHaveBeenCalledWith(0, 20, undefined, undefined, undefined, true, undefined, undefined, undefined);
      expect(result.items[0].archivedAt).toBe('2026-10-01T00:00:00.000Z');
    });

    it('restores an archived vehicle, refusing when another active one has the plate, or when it is unknown', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.vehicleRepository.archivedById.mockResolvedValue({ ...baseVehicle, deletedAt: new Date() });
      deps.vehicleRepository.byPlate.mockResolvedValueOnce({ ...baseVehicle, id: 'other' });
      await expect(deps.manager.restore(actingUser, 'vehicle-1')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
      expect(deps.vehicleRepository.restore).not.toHaveBeenCalled();

      deps.vehicleRepository.byPlate.mockResolvedValue(null);
      const result = await deps.manager.restore(actingUser, 'vehicle-1');
      expect(deps.vehicleRepository.restore).toHaveBeenCalledWith('vehicle-1');
      expect(result.vehicle.archivedAt).toBeUndefined();
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'vehicle.restored' }));

      deps.vehicleRepository.archivedById.mockResolvedValue(null);
      await expect(deps.manager.restore(actingUser, 'nope')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('reports what archiving would leave hanging', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.vehicleRepository.archiveImpact.mockResolvedValue({ openServiceOrders: 1, upcomingAppointments: 2 });
      expect(await deps.manager.archiveImpact('vehicle-1')).toEqual({ openServiceOrders: 1, upcomingAppointments: 2 });
      deps.vehicleRepository.byId.mockResolvedValue(null);
      await expect(deps.manager.archiveImpact('nope')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  describe('the vehicle page and the list numbers', () => {
    const order = (over: Record<string, unknown>) => ({ id: 'so-1', vehicleId: 'vehicle-1', orderNumber: 10, status: 'DELIVERED', openedAt: new Date('2026-08-01T12:00:00Z'), closedAt: new Date('2026-08-03T12:00:00Z'), entryMileage: 90000, exitMileage: 90020, ...over });

    it('adds the number of orders and the last visit to each listed vehicle only when asked', async () => {
      const deps = buildManager();
      deps.vehicleRepository.listByTenant.mockResolvedValue({ items: [baseVehicle], total: 1 });
      deps.customerRepository.byIds.mockResolvedValue([baseCustomer]);
      deps.vehicleRepository.ordersOf.mockResolvedValue([order({}), order({ id: 'so-2', closedAt: new Date('2026-09-20T12:00:00Z') }), order({ id: 'so-3', status: 'CANCELLED', closedAt: null }), order({ id: 'so-4', status: 'IN_PROGRESS', closedAt: null })]);
      const without = await deps.manager.list({ offset: 0, limit: 20 });
      expect(without.items[0]).not.toHaveProperty('stats');
      expect(deps.vehicleRepository.ordersOf).not.toHaveBeenCalled();
      const withStats = await deps.manager.list({ offset: 0, limit: 20, withStats: true });
      expect(withStats.items[0].stats).toEqual({ orderCount: 3, lastVisitAt: '2026-09-20T12:00:00.000Z' });
    });

    it('filters vehicles in service, and those with no delivery in 6 months counted from the given day', async () => {
      const deps = buildManager();
      deps.vehicleRepository.idsWithOpenOrders.mockResolvedValue(['vehicle-1']);
      deps.vehicleRepository.idsDeliveredSince.mockResolvedValue(['vehicle-9']);
      deps.customerRepository.byIds.mockResolvedValue([]);
      deps.vehicleRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
      await deps.manager.list({ offset: 0, limit: 20, filter: 'IN_SERVICE' });
      expect(deps.vehicleRepository.listByTenant).toHaveBeenLastCalledWith(0, 20, undefined, undefined, undefined, false, { in: ['vehicle-1'] }, undefined, undefined);
      await deps.manager.list({ offset: 0, limit: 20, filter: 'INACTIVE' }, new Date('2026-10-29T12:00:00Z'));
      expect(deps.vehicleRepository.idsDeliveredSince).toHaveBeenCalledWith(new Date('2026-05-02T12:00:00Z'));
      expect(deps.vehicleRepository.listByTenant).toHaveBeenLastCalledWith(0, 20, undefined, undefined, undefined, false, { notIn: ['vehicle-9'] }, undefined, undefined);
      deps.vehicleRepository.listByTenant.mockClear();
      deps.vehicleRepository.idsWithOpenOrders.mockResolvedValue([]);
      expect(await deps.manager.list({ offset: 0, limit: 20, filter: 'IN_SERVICE' })).toMatchObject({ items: [], total: 0, hasMore: false });
      expect(deps.vehicleRepository.listByTenant).not.toHaveBeenCalled();
    });

    it('builds the page: orders, appointments, next care and the odometer readings from the orders', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      deps.vehicleRepository.ordersOf.mockResolvedValue([order({}), order({ id: 'so-2', orderNumber: 12, closedAt: new Date('2026-09-20T12:00:00Z'), entryMileage: 95000, exitMileage: null }), order({ id: 'so-3', orderNumber: 13, status: 'IN_PROGRESS', closedAt: null, openedAt: new Date('2026-10-20T12:00:00Z'), entryMileage: 99000, exitMileage: null }), order({ id: 'so-4', status: 'CANCELLED', entryMileage: 1 })]);
      deps.vehicleRepository.upcomingAppointmentsOf.mockResolvedValue([{ id: 'ap-1', startsAt: new Date('2026-11-03T13:00:00Z'), status: 'CONFIRMED', serviceDescription: 'Revisão' }]);
      deps.vehicleRepository.carePlansOf.mockResolvedValue([
        { serviceKey: 'OIL_CHANGE', completedAt: new Date('2026-01-10T12:00:00Z'), mileage: 80000, intervalMonths: 6, intervalKm: 10000 },
        { serviceKey: 'BRAKES', completedAt: new Date('2026-09-01T12:00:00Z'), mileage: 95000, intervalMonths: 12, intervalKm: null },
      ]);
      const result = await deps.manager.overview('vehicle-1', new Date('2026-10-29T12:00:00Z'));
      expect(result).toMatchObject({ orderCount: 3, deliveredCount: 2, lastVisitAt: '2026-09-20T12:00:00.000Z' });
      expect(result.openServiceOrders).toEqual([{ id: 'so-3', orderNumber: 13, status: 'IN_PROGRESS' }]);
      expect(result.upcomingAppointments[0]).toMatchObject({ id: 'ap-1', startsAt: '2026-11-03T13:00:00.000Z' });
      expect(result.care[0]).toMatchObject({ serviceKey: 'OIL_CHANGE', dueAt: '2026-07-10T12:00:00.000Z', dueMileage: 90000, overdue: true });
      expect(result.care[1]).toMatchObject({ serviceKey: 'BRAKES', overdue: false });
      expect(result.care[1].dueMileage).toBe(105000);
      expect(result.mileageHistory.map((reading) => [reading.orderNumber, reading.mileage])).toEqual([[10, 90020], [12, 95000], [13, 99000]]);
      deps.vehicleRepository.byId.mockResolvedValue(null);
      await expect(deps.manager.overview('nope')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  describe('transferring to another owner', () => {
    const other = { ...baseCustomer, id: 'customer-2', name: 'Maria Souza' };

    it('moves the car to the new owner and records it', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValueOnce(baseVehicle).mockResolvedValueOnce({ ...baseVehicle, customerId: 'customer-2' });
      deps.customerRepository.byId.mockResolvedValue(other);
      const now = new Date('2026-10-29T12:00:00Z');
      const result = await deps.manager.transfer(actingUser, { id: 'vehicle-1', customerId: 'customer-2' }, now);
      expect(deps.vehicleRepository.transfer).toHaveBeenCalledWith('vehicle-1', 'customer-2', now);
      expect(result.vehicle).toMatchObject({ customerId: 'customer-2', customerName: 'Maria Souza' });
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'vehicle.transferred', entityId: 'vehicle-1' }));
    });

    it('refuses the same owner, an unknown customer and a car with an order in progress', async () => {
      const deps = buildManager();
      deps.vehicleRepository.byId.mockResolvedValue(baseVehicle);
      await expect(deps.manager.transfer(actingUser, { id: 'vehicle-1', customerId: 'customer-1' })).rejects.toThrow('já é o dono');
      deps.customerRepository.byId.mockResolvedValue(null);
      await expect(deps.manager.transfer(actingUser, { id: 'vehicle-1', customerId: 'customer-2' })).rejects.toMatchObject({ code: 'VEHICLE_CUSTOMER_NOT_FOUND' });
      deps.customerRepository.byId.mockResolvedValue(other);
      deps.vehicleRepository.ordersOf.mockResolvedValue([{ id: 'so-3', vehicleId: 'vehicle-1', orderNumber: 13, status: 'IN_PROGRESS', openedAt: new Date(), closedAt: null, entryMileage: null, exitMileage: null }]);
      await expect(deps.manager.transfer(actingUser, { id: 'vehicle-1', customerId: 'customer-2' })).rejects.toThrow('1 ordem de serviço em andamento');
      expect(deps.vehicleRepository.transfer).not.toHaveBeenCalled();
      deps.vehicleRepository.byId.mockResolvedValue(null);
      await expect(deps.manager.transfer(actingUser, { id: 'nope', customerId: 'customer-2' })).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  it('keeps the colour when registering a vehicle', async () => {
    const deps = buildManager();
    deps.customerRepository.byId.mockResolvedValue(baseCustomer);
    deps.vehicleRepository.byPlate.mockResolvedValue(null);
    deps.vehicleRepository.insert.mockResolvedValue({ ...baseVehicle, color: 'Prata' });
    const result = await deps.manager.create(actingUser, { customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23', color: ' Prata ' });
    expect(deps.vehicleRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ color: 'Prata' }));
    expect(result.vehicle.color).toBe('Prata');
  });

  it('passes the chosen sort and direction to the query', async () => {
    const deps = buildManager();
    deps.vehicleRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
    deps.customerRepository.byIds.mockResolvedValue([]);
    await deps.manager.list({ offset: 0, limit: 20, sort: 'mileage', direction: 'asc' });
    expect(deps.vehicleRepository.listByTenant).toHaveBeenCalledWith(0, 20, undefined, undefined, undefined, false, undefined, 'mileage', 'asc');
  });

  describe('spreadsheet import', () => {
    const owners = [
      { id: 'customer-1', name: 'João da Silva', phone: '11999998888', document: '11144477735' },
      { id: 'customer-2', name: 'Maria Souza', phone: '11988887777', document: '' },
      { id: 'customer-3', name: 'Marcos Souza', phone: '11988887777', document: '' },
    ];
    const row = (over: Record<string, unknown>) => ({ line: 2, plate: 'abc-1d23', brand: 'Fiat', model: 'Uno', ownerDocument: '111.444.777-35', ...over });
    const setupImport = () => {
      const deps = buildManager();
      deps.customerRepository.allForMatching.mockResolvedValue(owners);
      deps.vehicleRepository.byPlate.mockResolvedValue(null);
      deps.vehicleRepository.insert.mockImplementation(async (input: Record<string, unknown>) => ({ ...baseVehicle, ...input }));
      return deps;
    };

    it('creates the valid rows with the plate normalised and the owner found by document or by phone', async () => {
      const deps = setupImport();
      const result = await deps.manager.importRows(actingUser, { rows: [
        row({}),
        row({ line: 3, plate: 'XYZ9K88', ownerDocument: undefined, ownerPhone: '+55 (11) 99999-8888' }),
      ] });
      expect(result).toEqual({ created: 2, problems: [] });
      expect(deps.vehicleRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ plate: 'ABC1D23', customerId: 'customer-1', brand: 'Fiat' }));
      expect(deps.vehicleRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ plate: 'XYZ9K88', customerId: 'customer-1' }));
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'vehicle.imported' }));
    });

    it('uses the name to tell apart customers who share a phone, and refuses when it cannot', async () => {
      const deps = setupImport();
      const result = await deps.manager.importRows(actingUser, { rows: [
        row({ line: 2, plate: 'AAA1A11', ownerDocument: undefined, ownerPhone: '11988887777', ownerName: 'marcos souza' }),
        row({ line: 3, plate: 'BBB2B22', ownerDocument: undefined, ownerPhone: '11988887777' }),
      ] });
      expect(result.created).toBe(1);
      expect(deps.vehicleRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ plate: 'AAA1A11', customerId: 'customer-3' }));
      expect(result.problems).toEqual([{ line: 3, plate: 'BBB2B22', reason: expect.stringContaining('mais de um cliente') }]);
    });

    it('reports each bad row with its line and keeps importing the others', async () => {
      const deps = setupImport();
      deps.vehicleRepository.byPlate.mockImplementation(async (plate: string) => (plate === 'DDD4D44' ? baseVehicle : null));
      const result = await deps.manager.importRows(actingUser, { rows: [
        row({ line: 2, plate: 'ABC12' }),
        row({ line: 3, plate: 'EEE5E55', brand: ' ' }),
        row({ line: 4, plate: 'DDD4D44' }),
        row({ line: 5, plate: 'FFF6F66', ownerDocument: '999.999.999-99' }),
        row({ line: 6, plate: 'GGG7G77', ownerDocument: undefined }),
        row({ line: 7, plate: 'HHH8H88', chassis: 'curto' }),
        row({ line: 8, plate: 'III9I99', year: 1800 }),
        row({ line: 9, plate: 'JJJ1J11' }),
        row({ line: 10, plate: 'jjj-1j11' }),
      ] });
      expect(result.created).toBe(1);
      expect(result.problems.map((problem) => [problem.line, problem.reason])).toEqual([
        [2, expect.stringContaining('Placa inválida')],
        [3, 'Faltam a marca ou o modelo.'],
        [4, 'Já existe um veículo com esta placa.'],
        [5, expect.stringContaining('Nenhum cliente com este documento')],
        [6, 'Informe o documento ou o telefone do dono.'],
        [7, expect.stringContaining('Chassi inválido')],
        [8, expect.stringContaining('Informe um ano')],
        [10, 'Já existe um veículo com esta placa.'],
      ]);
    });
  });
});
