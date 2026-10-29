import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@oficina/database';
import type { DocumentValidationResult } from '../../../shared/documents/document-validator.service';
import { CustomerManager } from './customer.manager';

const actingUser = { userId: 'user-1', tenantId: 'tenant-1', role: 'ADMIN' as const };

function buildManager() {
  const customerRepository = {
    insert: jest.fn(),
    byId: jest.fn(),
    byDocument: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    listByTenant: jest.fn(),
    vehiclesOf: jest.fn().mockResolvedValue([]),
    ordersOf: jest.fn().mockResolvedValue({ orders: [], items: [] }),
    openOrdersOf: jest.fn().mockResolvedValue([]),
    pendingCentsOf: jest.fn().mockResolvedValue(0),
    upcomingAppointmentsOf: jest.fn().mockResolvedValue([]),
    idsWithDebt: jest.fn().mockResolvedValue([]),
    idsDeliveredSince: jest.fn().mockResolvedValue([]),
    archivedById: jest.fn(),
    restore: jest.fn(),
    archiveImpact: jest.fn(),
  };
  const documentValidator = {
    validate: jest.fn<DocumentValidationResult, [string]>(() => ({ valid: true, type: 'CPF', normalized: '11144477735' })),
  };
  const auditLog = { record: jest.fn() };

  const manager = new CustomerManager(customerRepository as never, documentValidator as never, auditLog as never);

  return { manager, customerRepository, documentValidator, auditLog };
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

describe('CustomerManager', () => {
  describe('create', () => {
    it('creates a customer and records the audit log', async () => {
      const deps = buildManager();
      deps.customerRepository.byDocument.mockResolvedValue(null);
      deps.customerRepository.insert.mockResolvedValue(baseCustomer);

      const result = await deps.manager.create(actingUser, {
        type: 'PF',
        document: '111.444.777-35',
        name: 'João da Silva',
        phone: '11999998888',
      });

      expect(result.customer.id).toBe('customer-1');
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'customer.created' }));
    });

    it('rejects an invalid document', async () => {
      const deps = buildManager();
      deps.documentValidator.validate.mockReturnValue({ valid: false, type: null, normalized: '123' });

      await expect(
        deps.manager.create(actingUser, { type: 'PF', document: '123', name: 'X', phone: '119999' }),
      ).rejects.toThrow();
    });

    it('rejects a duplicate document within the same tenant with 409', async () => {
      const deps = buildManager();
      deps.customerRepository.byDocument.mockResolvedValue(baseCustomer);

      await expect(
        deps.manager.create(actingUser, {
          type: 'PF',
          document: '111.444.777-35',
          name: 'João da Silva',
          phone: '11999998888',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });

    it('translates a concurrent unique-constraint violation (P2002) into 409, not 500', async () => {
      const deps = buildManager();
      deps.customerRepository.byDocument.mockResolvedValue(null);
      deps.customerRepository.insert.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
      );

      await expect(
        deps.manager.create(actingUser, {
          type: 'PF',
          document: '111.444.777-35',
          name: 'João da Silva',
          phone: '11999998888',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT, code: 'CUSTOMER_DOCUMENT_ALREADY_EXISTS' });
    });

    it('persists the Feature 6 optional fields when provided', async () => {
      const deps = buildManager();
      deps.customerRepository.byDocument.mockResolvedValue(null);
      deps.customerRepository.insert.mockResolvedValue({
        ...baseCustomer,
        rg: '12.345.678-9',
        secondaryContactName: 'Maria da Silva',
        secondaryContactPhone: '11988887777',
        secondaryContactRelation: 'Cônjuge',
        preferredContactChannel: 'WHATSAPP',
        preferredContactTime: 'AFTERNOON',
      });

      await deps.manager.create(actingUser, {
        type: 'PF',
        document: '111.444.777-35',
        name: 'João da Silva',
        phone: '11999998888',
        rg: '12.345.678-9',
        secondaryContactName: 'Maria da Silva',
        secondaryContactPhone: '11988887777',
        secondaryContactRelation: 'Cônjuge',
        preferredContactChannel: 'WHATSAPP',
        preferredContactTime: 'AFTERNOON',
      });

      expect(deps.customerRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          rg: '12.345.678-9',
          secondaryContactName: 'Maria da Silva',
          secondaryContactPhone: '11988887777',
          secondaryContactRelation: 'Cônjuge',
          preferredContactChannel: 'WHATSAPP',
          preferredContactTime: 'AFTERNOON',
        }),
      );
    });

    it('rethrows unrelated database errors', async () => {
      const deps = buildManager();
      deps.customerRepository.byDocument.mockResolvedValue(null);
      deps.customerRepository.insert.mockRejectedValue(new Error('connection lost'));

      await expect(
        deps.manager.create(actingUser, {
          type: 'PF',
          document: '111.444.777-35',
          name: 'João da Silva',
          phone: '11999998888',
        }),
      ).rejects.toThrow('connection lost');
    });
  });

  describe('update', () => {
    it('updates allowed fields and ignores type/document changes', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValueOnce(baseCustomer).mockResolvedValueOnce({ ...baseCustomer, phone: '11888887777' });

      const result = await deps.manager.update(actingUser, { id: 'customer-1', phone: '11888887777' });

      expect(deps.customerRepository.update).toHaveBeenCalledWith(
        'customer-1',
        expect.not.objectContaining({ type: expect.anything(), document: expect.anything() }),
      );
      expect(result.customer.phone).toBe('11888887777');
    });

    it('updates only the Feature 6 fields that were sent, ignoring the rest', async () => {
      const deps = buildManager();
      deps.customerRepository.byId
        .mockResolvedValueOnce(baseCustomer)
        .mockResolvedValueOnce({ ...baseCustomer, secondaryContactName: 'Maria da Silva' });

      await deps.manager.update(actingUser, { id: 'customer-1', secondaryContactName: 'Maria da Silva' });

      expect(deps.customerRepository.update).toHaveBeenCalledWith(
        'customer-1',
        expect.objectContaining({ secondaryContactName: 'Maria da Silva' }),
      );
    });

    it('rejects an update for a non-existent customer with 404', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.update(actingUser, { id: 'missing', name: 'X' })).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('delete', () => {
    it('soft deletes and records the audit log', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.customerRepository.softDelete.mockResolvedValue({ count: 1 });

      await deps.manager.delete(actingUser, 'customer-1');

      expect(deps.customerRepository.softDelete).toHaveBeenCalledWith('customer-1');
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'customer.deleted' }));
    });

    it('rejects with 404 when the customer is deleted concurrently between byId and softDelete', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.customerRepository.softDelete.mockResolvedValue({ count: 0 });

      await expect(deps.manager.delete(actingUser, 'customer-1')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
      expect(deps.auditLog.record).not.toHaveBeenCalled();
    });

    it('rejects deleting a non-existent customer with 404', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.delete(actingUser, 'missing')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  describe('getById', () => {
    it('returns 404 for a non-existent customer', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(null);

      await expect(deps.manager.getById('missing')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  describe('list', () => {
    it('filters by search term across name/document', async () => {
      const deps = buildManager();
      deps.customerRepository.listByTenant.mockResolvedValue({ items: [baseCustomer], total: 1 });

      const result = await deps.manager.list({ offset: 0, limit: 20, search: 'João' });

      expect(deps.customerRepository.listByTenant).toHaveBeenCalledWith(0, 20, 'João', false, undefined);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('changing the type', () => {
    it('lets a person become a company when the document on file is a CNPJ, clearing birth date and RG', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValueOnce({ ...baseCustomer, document: '11222333000181' }).mockResolvedValueOnce({ ...baseCustomer, type: 'PJ' });
      deps.documentValidator.validate.mockReturnValue({ valid: true, type: 'CNPJ', normalized: '11222333000181' });
      await deps.manager.update(actingUser, { id: 'customer-1', type: 'PJ' });
      expect(deps.customerRepository.update).toHaveBeenCalledWith('customer-1', expect.objectContaining({ type: 'PJ', rg: null, birthDate: null }));
    });

    it('refuses a type that does not fit the document, in both directions', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      await expect(deps.manager.update(actingUser, { id: 'customer-1', type: 'PJ' })).rejects.toThrow('Pessoa jurídica usa CNPJ');
      deps.documentValidator.validate.mockReturnValue({ valid: true, type: 'CNPJ', normalized: '11222333000181' });
      await expect(deps.manager.create(actingUser, { type: 'PF', document: '11.222.333/0001-81', name: 'Oficina X', phone: '11999998888' })).rejects.toThrow('Pessoa física usa CPF');
      expect(deps.customerRepository.update).not.toHaveBeenCalled();
    });

    it('allows the type to change when there is no document yet', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValueOnce({ ...baseCustomer, document: '' }).mockResolvedValueOnce({ ...baseCustomer, document: '', type: 'PJ' });
      await deps.manager.update(actingUser, { id: 'customer-1', type: 'PJ' });
      expect(deps.customerRepository.update).toHaveBeenCalledWith('customer-1', expect.objectContaining({ type: 'PJ' }));
    });
  });

  describe('archived customers', () => {
    it('lists the archived ones on request', async () => {
      const deps = buildManager();
      deps.customerRepository.listByTenant.mockResolvedValue({ items: [{ ...baseCustomer, deletedAt: new Date('2026-10-01T00:00:00Z') }], total: 1 });
      const result = await deps.manager.list({ offset: 0, limit: 20, archived: true });
      expect(deps.customerRepository.listByTenant).toHaveBeenCalledWith(0, 20, undefined, true, undefined);
      expect(result.items[0].archivedAt).toBe('2026-10-01T00:00:00.000Z');
    });

    it('restores an archived customer and records it', async () => {
      const deps = buildManager();
      deps.customerRepository.archivedById.mockResolvedValue({ ...baseCustomer, deletedAt: new Date() });
      deps.customerRepository.byDocument.mockResolvedValue(null);
      const result = await deps.manager.restore(actingUser, 'customer-1');
      expect(deps.customerRepository.restore).toHaveBeenCalledWith('customer-1');
      expect(result.customer.archivedAt).toBeUndefined();
      expect(deps.auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'customer.restored', entityId: 'customer-1' }));
    });

    it('does not restore over another active customer with the same document, nor an unknown one', async () => {
      const deps = buildManager();
      deps.customerRepository.archivedById.mockResolvedValue({ ...baseCustomer, deletedAt: new Date() });
      deps.customerRepository.byDocument.mockResolvedValue({ ...baseCustomer, id: 'customer-2' });
      await expect(deps.manager.restore(actingUser, 'customer-1')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
      expect(deps.customerRepository.restore).not.toHaveBeenCalled();
      deps.customerRepository.archivedById.mockResolvedValue(null);
      await expect(deps.manager.restore(actingUser, 'nope')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('reports what archiving would leave hanging', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.customerRepository.archiveImpact.mockResolvedValue({ openServiceOrders: 2, pendingCents: 35000 });
      expect(await deps.manager.archiveImpact('customer-1')).toEqual({ openServiceOrders: 2, pendingCents: 35000 });
      deps.customerRepository.byId.mockResolvedValue(null);
      await expect(deps.manager.archiveImpact('nope')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  describe('what the list and the page show about a customer', () => {
    const order = (over: Record<string, unknown>) => ({ id: 'so-1', customerId: 'customer-1', status: 'DELIVERED', closedAt: new Date('2026-09-10T12:00:00Z'), discountCents: 0, ...over });
    const item = (over: Record<string, unknown>) => ({ serviceOrderId: 'so-1', quantity: 1, unitPriceCents: 10000, ...over });
    const history = {
      orders: [order({}), order({ id: 'so-2', closedAt: new Date('2026-10-01T12:00:00Z'), discountCents: 2000 }), order({ id: 'so-3', status: 'IN_PROGRESS', closedAt: null }), order({ id: 'so-4', status: 'CANCELLED', closedAt: null })],
      items: [item({}), item({ serviceOrderId: 'so-2', quantity: 2, unitPriceCents: 5000 })],
    };

    it('adds plates, visits and spend to each listed customer, with the discount taken off and cancelled orders left out', async () => {
      const deps = buildManager();
      deps.customerRepository.listByTenant.mockResolvedValue({ items: [baseCustomer], total: 1 });
      deps.customerRepository.vehiclesOf.mockResolvedValue([{ id: 'v1', customerId: 'customer-1', plate: 'ABC1D23' }]);
      deps.customerRepository.ordersOf.mockResolvedValue(history);
      const result = await deps.manager.list({ offset: 0, limit: 20 }, { canViewPrices: true });
      expect(result.items[0].stats).toEqual({ plates: ['ABC1D23'], orderCount: 3, lastVisitAt: '2026-10-01T12:00:00.000Z', totalSpentCents: 18000 });
    });

    it('leaves the money out for people who may not see prices', async () => {
      const deps = buildManager();
      deps.customerRepository.listByTenant.mockResolvedValue({ items: [baseCustomer], total: 1 });
      deps.customerRepository.ordersOf.mockResolvedValue(history);
      const result = await deps.manager.list({ offset: 0, limit: 20 });
      expect(result.items[0].stats).not.toHaveProperty('totalSpentCents');
      expect(result.items[0].stats?.orderCount).toBe(3);
    });

    it('filters customers with debt, and returns an empty page when nobody has any', async () => {
      const deps = buildManager();
      deps.customerRepository.idsWithDebt.mockResolvedValue(['customer-1']);
      deps.customerRepository.listByTenant.mockResolvedValue({ items: [baseCustomer], total: 1 });
      await deps.manager.list({ offset: 0, limit: 20, filter: 'DEBT' });
      expect(deps.customerRepository.listByTenant).toHaveBeenCalledWith(0, 20, undefined, false, { in: ['customer-1'] });
      deps.customerRepository.listByTenant.mockClear();
      deps.customerRepository.idsWithDebt.mockResolvedValue([]);
      const empty = await deps.manager.list({ offset: 0, limit: 20, filter: 'DEBT' });
      expect(empty).toMatchObject({ items: [], total: 0, hasMore: false });
      expect(deps.customerRepository.listByTenant).not.toHaveBeenCalled();
    });

    it('filters customers with no delivery in the last 6 months, counting from the given day', async () => {
      const deps = buildManager();
      deps.customerRepository.idsDeliveredSince.mockResolvedValue(['customer-9']);
      deps.customerRepository.listByTenant.mockResolvedValue({ items: [], total: 0 });
      const now = new Date('2026-10-29T12:00:00Z');
      await deps.manager.list({ offset: 0, limit: 20, filter: 'INACTIVE' }, undefined, now);
      expect(deps.customerRepository.idsDeliveredSince).toHaveBeenCalledWith(new Date('2026-05-02T12:00:00Z'));
      expect(deps.customerRepository.listByTenant).toHaveBeenCalledWith(0, 20, undefined, false, { notIn: ['customer-9'] });
    });

    it('builds the customer page: vehicles, open orders, appointments and, for price viewers, spend and what is owed', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue(baseCustomer);
      deps.customerRepository.vehiclesOf.mockResolvedValue([{ id: 'v1', customerId: 'customer-1', brand: 'Fiat', model: 'Uno', plate: 'ABC1D23', year: 2012, mileage: 98000 }]);
      deps.customerRepository.ordersOf.mockResolvedValue(history);
      deps.customerRepository.openOrdersOf.mockResolvedValue([{ id: 'so-3', orderNumber: 41, status: 'IN_PROGRESS', vehicleId: 'v1' }]);
      deps.customerRepository.upcomingAppointmentsOf.mockResolvedValue([{ id: 'ap-1', startsAt: new Date('2026-11-03T13:00:00Z'), status: 'CONFIRMED', serviceDescription: 'Revisão' }]);
      deps.customerRepository.pendingCentsOf.mockResolvedValue(7500);
      const result = await deps.manager.overview('customer-1', { canViewPrices: true });
      expect(result).toMatchObject({
        vehicles: [{ plate: 'ABC1D23', year: 2012, mileage: 98000 }], orderCount: 3, deliveredCount: 2,
        openServiceOrders: [{ orderNumber: 41, vehicleLabel: 'Fiat Uno · ABC1D23' }],
        upcomingAppointments: [{ id: 'ap-1', startsAt: '2026-11-03T13:00:00.000Z' }],
        money: { totalSpentCents: 18000, averageTicketCents: 9000, pendingCents: 7500 },
      });
      const hidden = await deps.manager.overview('customer-1');
      expect(hidden).not.toHaveProperty('money');
      deps.customerRepository.byId.mockResolvedValue(null);
      await expect(deps.manager.overview('nope')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  describe('consent source', () => {
    it('keeps how and by whom the consent was given when it is recorded, on create and when turned on later', async () => {
      const deps = buildManager();
      deps.customerRepository.byDocument.mockResolvedValue(null);
      deps.customerRepository.insert.mockResolvedValue(baseCustomer);
      await deps.manager.create(actingUser, { type: 'PF', name: 'Maria', phone: '11999998888', careMessagesEnabled: true, careConsentSource: 'COUNTER' });
      expect(deps.customerRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ careConsentSource: 'COUNTER', careConsentBy: 'user-1', careConsentAt: expect.any(Date) }));

      deps.customerRepository.byId.mockResolvedValue({ ...baseCustomer, careMessagesEnabled: false });
      await deps.manager.update(actingUser, { id: 'customer-1', careMessagesEnabled: true, careConsentSource: 'WHATSAPP' });
      expect(deps.customerRepository.update).toHaveBeenCalledWith('customer-1', expect.objectContaining({ careConsentSource: 'WHATSAPP', careConsentBy: 'user-1' }));
    });

    it('does not rewrite the original consent when an already-consenting customer is edited', async () => {
      const deps = buildManager();
      deps.customerRepository.byId.mockResolvedValue({ ...baseCustomer, careMessagesEnabled: true });
      await deps.manager.update(actingUser, { id: 'customer-1', careMessagesEnabled: true, careConsentSource: 'PHONE' });
      expect(deps.customerRepository.update).toHaveBeenCalledWith('customer-1', expect.objectContaining({ careConsentSource: undefined, careConsentBy: undefined, careConsentAt: undefined }));
    });
  });
});
