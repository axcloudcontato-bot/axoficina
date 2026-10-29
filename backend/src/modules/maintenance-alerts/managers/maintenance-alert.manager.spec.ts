import { MaintenanceAlertManager } from './maintenance-alert.manager';
import { AppException } from '../../../shared/errors/app-exception';
import { monthsSince } from '../utils/months-since';

function buildManager() {
  const maintenanceAlertRepository = { listByTenant: jest.fn(), byId: jest.fn(), resolve: jest.fn(), snooze: jest.fn(), dismiss: jest.fn(), reopen: jest.fn(), addContact: jest.fn(), contactsOf: jest.fn().mockResolvedValue([]), contactsForAlerts: jest.fn().mockResolvedValue([]), contactedAlertIds: jest.fn().mockResolvedValue([]), carePlansForVehicles: jest.fn().mockResolvedValue([]) };
  const vehicleRepository = { byIds: jest.fn().mockResolvedValue([]), byId: jest.fn(), searchIdsByPlateOrModel: jest.fn().mockResolvedValue([]) };
  const customerRepository = { byIds: jest.fn().mockResolvedValue([]), byId: jest.fn(), searchIdsByNameOrDocument: jest.fn().mockResolvedValue([]) };
  const userRepository = { byIds: jest.fn().mockResolvedValue([]), byId: jest.fn().mockResolvedValue(null) };
  const auditLog = { record: jest.fn() };

  const manager = new MaintenanceAlertManager(maintenanceAlertRepository as never, vehicleRepository as never, customerRepository as never, userRepository as never, auditLog as never);

  return { manager, maintenanceAlertRepository, vehicleRepository, customerRepository, userRepository, auditLog };
}

const actingUser = { userId: 'user-1', tenantId: 'tenant-1', role: 'FRONT_DESK' } as never;

describe('MaintenanceAlertManager', () => {
  describe('list', () => {
    it('defaults to status OPEN when none is requested', async () => {
      const deps = buildManager();
      deps.maintenanceAlertRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
      deps.vehicleRepository.byIds.mockResolvedValue([]);
      deps.customerRepository.byIds.mockResolvedValue([]);

      await deps.manager.list({ offset: 0, limit: 20 });

      expect(deps.maintenanceAlertRepository.listByTenant).toHaveBeenCalledWith(0, 20, 'OPEN', expect.any(Date), undefined, undefined);
    });

    it('denormalizes vehicle and customer data and computes monthsOverdue', async () => {
      const deps = buildManager();
      const referenceDate = new Date('2026-01-01T00:00:00.000Z');
      deps.maintenanceAlertRepository.listByTenant.mockResolvedValue({
        items: [
          {
            id: 'alert-1',
            tenantId: 'tenant-1',
            vehicleId: 'vehicle-1',
            customerId: 'customer-1',
            referenceDate,
            status: 'OPEN',
            resolvedAt: null,
            resolvedBy: null,
          },
        ],
        total: 1,
      });
      deps.vehicleRepository.byIds.mockResolvedValue([{ id: 'vehicle-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1234' }]);
      deps.customerRepository.byIds.mockResolvedValue([{ id: 'customer-1', name: 'João' }]);

      const result = await deps.manager.list({ offset: 0, limit: 20, status: 'OPEN' });

      expect(result.items[0]).toMatchObject({
        id: 'alert-1',
        vehicleBrand: 'Fiat',
        vehicleModel: 'Uno',
        vehiclePlate: 'ABC1234',
        customerName: 'João',
        monthsOverdue: monthsSince(referenceDate, new Date()),
      });
    });
  });

  describe('resolve', () => {
    it('resolves an OPEN alert and returns the updated state', async () => {
      const deps = buildManager();
      deps.maintenanceAlertRepository.byId
        .mockResolvedValueOnce({ id: 'alert-1', tenantId: 'tenant-1', vehicleId: 'vehicle-1', customerId: 'customer-1', referenceDate: new Date(), status: 'OPEN', resolvedAt: null, resolvedBy: null })
        .mockResolvedValueOnce({ id: 'alert-1', tenantId: 'tenant-1', vehicleId: 'vehicle-1', customerId: 'customer-1', referenceDate: new Date(), status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: 'user-1' });
      deps.vehicleRepository.byId.mockResolvedValue({ id: 'vehicle-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1234' });
      deps.customerRepository.byId.mockResolvedValue({ id: 'customer-1', name: 'João' });

      const result = await deps.manager.resolve(actingUser, 'alert-1');

      expect(deps.maintenanceAlertRepository.resolve).toHaveBeenCalledWith('alert-1', 'user-1', expect.any(Date));
      expect(result.alert.status).toBe('RESOLVED');
    });

    it('is idempotent — resolving an already RESOLVED alert does not call repository.resolve again', async () => {
      const deps = buildManager();
      const resolvedAlert = {
        id: 'alert-1',
        tenantId: 'tenant-1',
        vehicleId: 'vehicle-1',
        customerId: 'customer-1',
        referenceDate: new Date(),
        status: 'RESOLVED',
        resolvedAt: new Date('2026-01-01T00:00:00.000Z'),
        resolvedBy: 'user-1',
      };
      deps.maintenanceAlertRepository.byId.mockResolvedValue(resolvedAlert);
      deps.vehicleRepository.byId.mockResolvedValue({ id: 'vehicle-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1234' });
      deps.customerRepository.byId.mockResolvedValue({ id: 'customer-1', name: 'João' });

      const result = await deps.manager.resolve(actingUser, 'alert-1');

      expect(deps.maintenanceAlertRepository.resolve).not.toHaveBeenCalled();
      expect(result.alert.resolvedAt).toBe(resolvedAlert.resolvedAt.toISOString());
    });

    it('throws MAINTENANCE_ALERT_NOT_FOUND for an unknown id', async () => {
      const deps = buildManager();
      deps.maintenanceAlertRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.resolve(actingUser, 'missing-id')).rejects.toThrow(AppException);
    });
  });

  describe('postponing, dismissing and reopening', () => {
    const base = { id: 'alert-1', tenantId: 'tenant-1', vehicleId: 'vehicle-1', customerId: 'customer-1', referenceDate: new Date('2026-01-01T00:00:00Z'), status: 'OPEN', resolvedAt: null, resolvedBy: null, snoozedUntil: null, dismissReason: null, dismissNote: null };
    const withRelations = (deps: ReturnType<typeof buildManager>) => {
      deps.vehicleRepository.byIds.mockResolvedValue([{ id: 'vehicle-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1234' }]);
      deps.customerRepository.byIds.mockResolvedValue([{ id: 'customer-1', name: 'João' }]);
    };
    const now = new Date('2026-10-29T12:00:00Z');

    it('postpones an open alert for the chosen days and records it', async () => {
      const deps = buildManager();
      withRelations(deps);
      deps.maintenanceAlertRepository.byId.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, snoozedUntil: new Date('2026-11-28T12:00:00Z') });
      const result = await deps.manager.snooze(actingUser, { id: 'alert-1', days: 30 }, now);
      expect(deps.maintenanceAlertRepository.snooze).toHaveBeenCalledWith('alert-1', new Date('2026-11-28T12:00:00Z'));
      expect(result.alert.snoozedUntil).toBe('2026-11-28T12:00:00.000Z');
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'maintenance_alert.snoozed', entityId: 'alert-1' }));
    });

    it('shows the postponement only while it lasts', async () => {
      const deps = buildManager();
      withRelations(deps);
      deps.maintenanceAlertRepository.byId.mockResolvedValue({ ...base, snoozedUntil: new Date('2026-11-15T12:00:00Z') });
      expect((await deps.manager.snooze(actingUser, { id: 'alert-1', days: 30 }, now)).alert.snoozedUntil).toBe('2026-11-15T12:00:00.000Z');
      expect((await deps.manager.snooze(actingUser, { id: 'alert-1', days: 30 }, new Date('2026-12-01T00:00:00Z'))).alert.snoozedUntil).toBeUndefined();
    });

    it('dismisses an open alert with the reason and the note, and says who did it', async () => {
      const deps = buildManager();
      withRelations(deps);
      deps.userRepository.byIds.mockResolvedValue([{ id: 'user-1', name: 'Ana Recepção' }]);
      deps.maintenanceAlertRepository.byId.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, status: 'DISMISSED', resolvedAt: now, resolvedBy: 'user-1', dismissReason: 'SOLD', dismissNote: 'Vendeu em setembro' });
      const result = await deps.manager.dismiss(actingUser, { id: 'alert-1', reason: 'SOLD', note: ' Vendeu em setembro ' }, now);
      expect(deps.maintenanceAlertRepository.dismiss).toHaveBeenCalledWith('alert-1', 'user-1', now, 'SOLD', 'Vendeu em setembro');
      expect(result.alert).toMatchObject({ status: 'DISMISSED', dismissReason: 'SOLD', dismissNote: 'Vendeu em setembro', resolvedByName: 'Ana Recepção' });
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'maintenance_alert.dismissed', metadata: { reason: 'SOLD' } }));
    });

    it('refuses to postpone or dismiss an alert that is not open, or does not exist', async () => {
      const deps = buildManager();
      deps.maintenanceAlertRepository.byId.mockResolvedValue({ ...base, status: 'RESOLVED' });
      await expect(deps.manager.snooze(actingUser, { id: 'alert-1', days: 30 })).rejects.toThrow('Só alertas em aberto');
      await expect(deps.manager.dismiss(actingUser, { id: 'alert-1', reason: 'OTHER' })).rejects.toThrow('Só alertas em aberto');
      expect(deps.maintenanceAlertRepository.snooze).not.toHaveBeenCalled();
      expect(deps.maintenanceAlertRepository.dismiss).not.toHaveBeenCalled();
      deps.maintenanceAlertRepository.byId.mockResolvedValue(null);
      await expect(deps.manager.snooze(actingUser, { id: 'x', days: 30 })).rejects.toMatchObject({ status: 404 });
    });

    it('reopens what a person closed, but not what the delivery of an order closed by itself', async () => {
      const deps = buildManager();
      withRelations(deps);
      deps.maintenanceAlertRepository.byId.mockResolvedValueOnce({ ...base, status: 'DISMISSED', resolvedBy: 'user-1' }).mockResolvedValueOnce(base);
      const result = await deps.manager.reopen(actingUser, 'alert-1', now);
      expect(deps.maintenanceAlertRepository.reopen).toHaveBeenCalledWith('alert-1');
      expect(result.alert.status).toBe('OPEN');
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'maintenance_alert.reopened' }));

      deps.maintenanceAlertRepository.reopen.mockClear();
      deps.maintenanceAlertRepository.byId.mockResolvedValue({ ...base, status: 'RESOLVED', resolvedBy: 'user-1' });
      await expect(deps.manager.reopen(actingUser, 'alert-1', now)).resolves.toBeDefined();
      deps.maintenanceAlertRepository.byId.mockResolvedValue({ ...base, status: 'RESOLVED', resolvedBy: null });
      await expect(deps.manager.reopen(actingUser, 'alert-1', now)).rejects.toThrow('entrega de uma OS');
      deps.maintenanceAlertRepository.byId.mockResolvedValue(base);
      await expect(deps.manager.reopen(actingUser, 'alert-1', now)).rejects.toThrow('já está em aberto');
    });
  });

  describe('search and history', () => {
    it('finds alerts through the vehicles and the owners that match the search', async () => {
      const deps = buildManager();
      deps.vehicleRepository.searchIdsByPlateOrModel.mockResolvedValue(['vehicle-1']);
      deps.customerRepository.searchIdsByNameOrDocument.mockResolvedValue(['customer-9']);
      deps.maintenanceAlertRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
      deps.vehicleRepository.byIds.mockResolvedValue([]);
      deps.customerRepository.byIds.mockResolvedValue([]);
      await deps.manager.list({ offset: 0, limit: 20, status: 'SNOOZED', search: ' uno ' });
      expect(deps.vehicleRepository.searchIdsByPlateOrModel).toHaveBeenCalledWith('uno');
      expect(deps.maintenanceAlertRepository.listByTenant).toHaveBeenCalledWith(0, 20, 'SNOOZED', expect.any(Date), { vehicleIds: ['vehicle-1'], customerIds: ['customer-9'] }, undefined);
    });

    it('names who resolved an alert, and leaves the name out when an order delivery did', async () => {
      const deps = buildManager();
      const closed = { id: 'a1', tenantId: 't', vehicleId: 'vehicle-1', customerId: 'customer-1', referenceDate: new Date('2026-01-01T00:00:00Z'), status: 'RESOLVED', resolvedAt: new Date('2026-10-01T00:00:00Z'), snoozedUntil: null, dismissReason: null, dismissNote: null };
      deps.maintenanceAlertRepository.listByTenant.mockResolvedValue({ items: [{ ...closed, resolvedBy: 'user-1' }, { ...closed, id: 'a2', resolvedBy: null }], total: 2 });
      deps.vehicleRepository.byIds.mockResolvedValue([{ id: 'vehicle-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1234' }]);
      deps.customerRepository.byIds.mockResolvedValue([{ id: 'customer-1', name: 'João' }]);
      deps.userRepository.byIds.mockResolvedValue([{ id: 'user-1', name: 'Ana Recepção' }]);
      const result = await deps.manager.list({ offset: 0, limit: 20, status: 'RESOLVED' });
      expect(result.items[0].resolvedByName).toBe('Ana Recepção');
      expect(result.items[1].resolvedByName).toBeUndefined();
    });
  });

  it('records who resolved an alert', async () => {
    const deps = buildManager();
    deps.maintenanceAlertRepository.byId.mockResolvedValue({ id: 'alert-1', tenantId: 'tenant-1', vehicleId: 'vehicle-1', customerId: 'customer-1', referenceDate: new Date(), status: 'OPEN', resolvedAt: null, resolvedBy: null, snoozedUntil: null, dismissReason: null, dismissNote: null });
    deps.vehicleRepository.byId.mockResolvedValue(null);
    deps.customerRepository.byId.mockResolvedValue(null);
    await deps.manager.resolve(actingUser, 'alert-1');
    expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'maintenance_alert.resolved', entityId: 'alert-1' }));
  });

  describe('contact attempts, care and filters', () => {
    const open = { id: 'alert-1', tenantId: 'tenant-1', vehicleId: 'vehicle-1', customerId: 'customer-1', referenceDate: new Date('2026-01-01T00:00:00Z'), status: 'OPEN', resolvedAt: null, resolvedBy: null, snoozedUntil: null, dismissReason: null, dismissNote: null };
    const now = new Date('2026-10-29T12:00:00Z');
    const contact = (over: Record<string, unknown>) => ({ id: 'c1', alertId: 'alert-1', outcome: 'NO_ANSWER', note: null, createdBy: 'user-1', createdAt: new Date('2026-10-20T12:00:00Z'), ...over });

    it('records an attempt on an open alert and returns it with the last contact and the count', async () => {
      const deps = buildManager();
      deps.maintenanceAlertRepository.byId.mockResolvedValue(open);
      deps.vehicleRepository.byIds.mockResolvedValue([{ id: 'vehicle-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1234', mileage: 98000 }]);
      deps.customerRepository.byIds.mockResolvedValue([{ id: 'customer-1', name: 'João', phone: '11999998888', careMessagesEnabled: false }]);
      deps.userRepository.byIds.mockResolvedValue([{ id: 'user-1', name: 'Ana Recepção' }]);
      deps.maintenanceAlertRepository.contactsForAlerts.mockResolvedValue([contact({ id: 'c2', outcome: 'WILL_SCHEDULE', note: 'Quer sexta', createdAt: new Date('2026-10-29T11:00:00Z') }), contact({})]);
      const result = await deps.manager.recordContact(actingUser, { id: 'alert-1', outcome: 'WILL_SCHEDULE', note: ' Quer sexta ' }, now);
      expect(deps.maintenanceAlertRepository.addContact).toHaveBeenCalledWith('tenant-1', 'alert-1', 'WILL_SCHEDULE', 'Quer sexta', 'user-1');
      expect(result.alert).toMatchObject({ contactCount: 2, customerPhone: '11999998888', customerCareEnabled: false, vehicleMileage: 98000 });
      expect(result.alert.lastContact).toEqual({ outcome: 'WILL_SCHEDULE', at: '2026-10-29T11:00:00.000Z', byName: 'Ana Recepção', note: 'Quer sexta' });
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'maintenance_alert.contact_recorded' }));
    });

    it('does not record an attempt on an alert that is not open, or unknown', async () => {
      const deps = buildManager();
      deps.maintenanceAlertRepository.byId.mockResolvedValue({ ...open, status: 'DISMISSED' });
      await expect(deps.manager.recordContact(actingUser, { id: 'alert-1', outcome: 'NO_ANSWER' })).rejects.toThrow('Só alertas em aberto');
      expect(deps.maintenanceAlertRepository.addContact).not.toHaveBeenCalled();
      deps.maintenanceAlertRepository.byId.mockResolvedValue(null);
      await expect(deps.manager.recordContact(actingUser, { id: 'x', outcome: 'NO_ANSWER' })).rejects.toMatchObject({ status: 404 });
    });

    it('lists the history of an alert with who did each attempt', async () => {
      const deps = buildManager();
      deps.maintenanceAlertRepository.byId.mockResolvedValue(open);
      deps.maintenanceAlertRepository.contactsOf.mockResolvedValue([contact({ note: 'Caixa postal' }), contact({ id: 'c0', createdBy: null, outcome: 'MESSAGE_SENT' })]);
      deps.userRepository.byIds.mockResolvedValue([{ id: 'user-1', name: 'Ana Recepção' }]);
      const result = await deps.manager.contacts('alert-1');
      expect(result.contacts).toEqual([
        { id: 'c1', outcome: 'NO_ANSWER', at: '2026-10-20T12:00:00.000Z', byName: 'Ana Recepção', note: 'Caixa postal' },
        { id: 'c0', outcome: 'MESSAGE_SENT', at: '2026-10-20T12:00:00.000Z', byName: undefined, note: undefined },
      ]);
      deps.maintenanceAlertRepository.byId.mockResolvedValue(null);
      await expect(deps.manager.contacts('x')).rejects.toMatchObject({ status: 404 });
    });

    it('shows the cares of the car that are already overdue, by time or by mileage', async () => {
      const deps = buildManager();
      deps.maintenanceAlertRepository.listByTenant.mockResolvedValue({ items: [open], total: 1 });
      deps.vehicleRepository.byIds.mockResolvedValue([{ id: 'vehicle-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1234', mileage: 105000 }]);
      deps.maintenanceAlertRepository.carePlansForVehicles.mockResolvedValue([
        { vehicleId: 'vehicle-1', serviceKey: 'OIL_CHANGE', completedAt: new Date('2026-01-10T12:00:00Z'), mileage: 90000, intervalMonths: 6, intervalKm: 10000 },
        { vehicleId: 'vehicle-1', serviceKey: 'BRAKES', completedAt: new Date('2026-09-01T12:00:00Z'), mileage: 94000, intervalMonths: 12, intervalKm: 10000 },
        { vehicleId: 'vehicle-1', serviceKey: 'BRAKE_FLUID', completedAt: new Date('2026-09-01T12:00:00Z'), mileage: 104000, intervalMonths: 24, intervalKm: null },
      ]);
      const result = await deps.manager.list({ offset: 0, limit: 20 }, now);
      expect(result.items[0].overdueCare).toEqual([{ serviceName: 'Óleo e filtro do motor', reason: 'TIME' }, { serviceName: 'Pastilhas, discos e freios', reason: 'KM' }]);
    });

    it('filters by time since the last visit, counted from the given day', async () => {
      const deps = buildManager();
      deps.maintenanceAlertRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
      await deps.manager.list({ offset: 0, limit: 20, minMonths: 9, maxMonths: 12 }, now);
      expect(deps.maintenanceAlertRepository.listByTenant).toHaveBeenCalledWith(0, 20, 'OPEN', now, undefined, { referenceBefore: new Date('2026-01-29T12:00:00Z'), referenceAfter: new Date('2025-10-29T12:00:00Z') });
    });

    it('filters alerts nobody tried to reach, and those someone did, and returns nothing when no one was contacted', async () => {
      const deps = buildManager();
      deps.maintenanceAlertRepository.contactedAlertIds.mockResolvedValue(['alert-9']);
      deps.maintenanceAlertRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
      await deps.manager.list({ offset: 0, limit: 20, contact: 'NEVER' }, now);
      expect(deps.maintenanceAlertRepository.listByTenant).toHaveBeenLastCalledWith(0, 20, 'OPEN', now, undefined, { alertIds: { notIn: ['alert-9'] } });
      await deps.manager.list({ offset: 0, limit: 20, contact: 'CONTACTED' }, now);
      expect(deps.maintenanceAlertRepository.listByTenant).toHaveBeenLastCalledWith(0, 20, 'OPEN', now, undefined, { alertIds: { in: ['alert-9'] } });
      deps.maintenanceAlertRepository.listByTenant.mockClear();
      deps.maintenanceAlertRepository.contactedAlertIds.mockResolvedValue([]);
      expect(await deps.manager.list({ offset: 0, limit: 20, contact: 'CONTACTED' }, now)).toMatchObject({ items: [], total: 0, hasMore: false });
      expect(deps.maintenanceAlertRepository.listByTenant).not.toHaveBeenCalled();
    });
  });
});
