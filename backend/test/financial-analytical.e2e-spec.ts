import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { LEGAL_VERSION } from '@oficina/contracts';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { AuditLogService } from '../src/shared/audit-log/audit-log.service';
import { generateValidCpf } from './utils/generate-cpf';

describe('Analytical financial data (HTTP + PostgreSQL)', () => {
  let app: INestApplication; let prisma: PrismaService;
  const tenants: string[] = []; const tokens: string[] = [];
  let customerId: string; let supplierId: string; let categoryId: string; let userId: string; let foreignOrderId: string; let receiptId: string;
  const range = { start_at: '2026-10-01T03:00:00Z', end_at: '2026-11-01T03:00:00Z' };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(AuditLogService).useValue({ record: async () => undefined }).compile();
    app = fixture.createNestApplication({ bodyParser: false }); configureApp(app); await app.listen(0, '127.0.0.1'); prisma = app.get(PrismaService);
    for (let index = 0; index < 2; index++) {
      const result = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({ accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: 'Analytical report fixture', tenant_document: generateValidCpf(), admin_name: 'Financial admin', admin_email: `report-${randomUUID()}@example.invalid`, password: 'supersecret1' }).expect(201);
      tenants.push(result.body.tenant.id); tokens.push(result.body.access_token);
    }
    userId = (await prisma.unscoped.user.findFirstOrThrow({ where: { tenantId: tenants[0] } })).id;
    for (let index = 0; index < 2; index++) {
      const tenantId = tenants[index];
      const customer = await prisma.unscoped.customer.create({ data: { tenantId, type: 'PF', name: index ? 'Cliente de outra oficina' : 'Maria Analítico', phone: '11999998888', document: generateValidCpf() } });
      const vehicle = await prisma.unscoped.vehicle.create({ data: { tenantId, customerId: customer.id, brand: 'Honda', model: 'Fit', plate: index ? 'OUT1A23' : 'FIN1A23' } });
      const order = await prisma.unscoped.serviceOrder.create({ data: { tenantId, customerId: customer.id, vehicleId: vehicle.id, orderNumber: index ? 99 : 12, status: 'DELIVERED', openedAt: new Date('2026-10-01T12:00:00Z') } });
      if (index) { foreignOrderId = order.id; continue; }
      customerId = customer.id;
      supplierId = (await prisma.unscoped.supplier.create({ data: { tenantId, name: 'Autopeças Analítico' } })).id;
      categoryId = (await prisma.unscoped.financialCategory.create({ data: { tenantId, name: 'Despesas analíticas', type: 'EXPENSE' } })).id;
      const incomeCategory = await prisma.unscoped.financialCategory.create({ data: { tenantId, name: 'Receitas analíticas', type: 'INCOME' } });
      await prisma.unscoped.financialEntry.createMany({ data: [
        { tenantId, categoryId, supplierId, createdBy: userId, type: 'EXPENSE', description: 'Pago em outubro, vencido em setembro', amountCents: 2500, dueAt: new Date('2026-09-30T12:00:00Z'), status: 'PAID', paidAt: new Date('2026-10-03T12:00:00Z') },
        { tenantId, categoryId, supplierId, createdBy: userId, type: 'EXPENSE', description: 'Vencido em outubro, pago em novembro', amountCents: 4000, dueAt: new Date('2026-10-15T12:00:00Z'), status: 'PAID', paidAt: new Date('2026-11-02T12:00:00Z'), notes: 'Nota fiscal detalhada' },
        { tenantId, categoryId, supplierId, createdBy: userId, type: 'EXPENSE', description: 'Despesa pendente', amountCents: 6000, dueAt: new Date('2026-10-20T12:00:00Z'), status: 'PENDING' },
        { tenantId, categoryId: incomeCategory.id, customerId, createdBy: userId, type: 'INCOME', description: 'Receita manual', amountCents: 12000, dueAt: new Date('2026-10-05T12:00:00Z'), status: 'PAID', paidAt: new Date('2026-10-06T12:00:00Z') },
      ] });
      const receipt = await prisma.unscoped.serviceOrderReceipt.create({ data: { tenantId, serviceOrderId: order.id, confirmedBy: userId, method: 'PIX', amountCents: 15000, receivedAt: new Date('2026-11-01T02:59:59Z'), notes: 'Pago por PIX, conferido' } }); receiptId = receipt.id;
      await prisma.unscoped.serviceOrderReceipt.create({ data: { tenantId, serviceOrderId: order.id, confirmedBy: userId, method: 'CASH', amountCents: 999, receivedAt: new Date('2026-11-01T03:00:00Z') } });
      await prisma.unscoped.serviceOrderInstallment.createMany({ data: [
        { tenantId, serviceOrderId: order.id, installmentNumber: 1, installmentCount: 2, amountCents: 15000, dueAt: new Date('2026-10-10T12:00:00Z'), status: 'PAID', receiptId: receipt.id },
        { tenantId, serviceOrderId: order.id, installmentNumber: 2, installmentCount: 2, amountCents: 10000, dueAt: new Date('2026-10-18T12:00:00Z'), status: 'PENDING' },
      ] });
    }
  });
  afterAll(async () => {
    if (prisma && tenants.length) {
      const where = { tenantId: { in: tenants } };
      await prisma.unscoped.financialEntry.deleteMany({ where }); await prisma.unscoped.financialCategory.deleteMany({ where });
      await prisma.unscoped.serviceOrderReceipt.deleteMany({ where }); await prisma.unscoped.serviceOrderInstallment.deleteMany({ where });
      await prisma.unscoped.serviceOrder.deleteMany({ where }); await prisma.unscoped.vehicle.deleteMany({ where });
      await prisma.unscoped.customer.deleteMany({ where }); await prisma.unscoped.supplier.deleteMany({ where });
      await prisma.unscoped.user.deleteMany({ where }); await prisma.unscoped.tenant.deleteMany({ where: { id: { in: tenants } } });
    }
    if (app) await app.close();
  });
  function report(body: object, token = tokens[0]) { return request(app.getHttpServer()).post('/api/v1/financial/cash-flow').set('Authorization', `Bearer ${token}`).send(body); }

  it('includes every entry, names, notes and OS details without double-counting a paid installment', async () => {
    const response = await report({ ...range, date_field: 'DUE' }).expect(200);
    expect(response.body.entries).toHaveLength(5);
    expect(response.body).toMatchObject({ realized_income_cents: 27000, realized_expense_cents: 4000, projected_income_cents: 10000, projected_expense_cents: 6000, realized_balance_cents: 23000, projected_balance_cents: 27000 });
    expect(response.body.entries.find((entry: { id: string }) => entry.id === receiptId)).toMatchObject({ customer_id: customerId, customer_name: 'Maria Analítico', service_order_number: 12, vehicle_plate: 'FIN1A23', payment_method: 'PIX', notes: 'Pago por PIX, conferido' });
    expect(response.body.entries.find((entry: { description: string }) => entry.description.startsWith('Vencido em outubro'))).toMatchObject({ supplier_name: 'Autopeças Analítico', notes: 'Nota fiscal detalhada' });
  });
  it('selects payments by actual realization date, even when the due date belongs to another month', async () => {
    const response = await report({ ...range, date_field: 'PAID' }).expect(200);
    expect(response.body.entries).toHaveLength(3);
    expect(response.body).toMatchObject({ realized_income_cents: 27000, realized_expense_cents: 2500, realized_balance_cents: 24500, projected_income_cents: 0, projected_expense_cents: 0 });
    expect(response.body.entries.every((entry: { status: string }) => entry.status === 'PAID')).toBe(true);
    await report({ ...range, date_field: 'PAID', status: 'PENDING' }).expect(400);
    await report({ ...range, date_field: 'UNKNOWN' }).expect(400);
    await report({ start_at: range.end_at, end_at: range.start_at }).expect(400);
  });
  it('does not expose another tenant or enrich a foreign order reference', async () => {
    const other = await report(range, tokens[1]).expect(200); expect(other.body.entries).toHaveLength(0);
    const corrupt = await prisma.unscoped.serviceOrderReceipt.create({ data: { tenantId: tenants[0], serviceOrderId: foreignOrderId, confirmedBy: userId, method: 'PIX', amountCents: 1, receivedAt: new Date('2026-10-07T12:00:00Z') } });
    try {
      const result = await report(range).expect(200); const row = result.body.entries.find((entry: { id: string }) => entry.id === corrupt.id);
      expect(row.customer_name).toBeUndefined(); expect(row.service_order_number).toBeUndefined(); expect(row.vehicle_plate).toBeUndefined();
      expect(JSON.stringify(result.body)).not.toContain('Cliente de outra oficina');
    } finally { await prisma.unscoped.serviceOrderReceipt.delete({ where: { id: corrupt.id } }); }
    await request(app.getHttpServer()).post('/api/v1/financial/cash-flow').send(range).expect(401);
  });
  it('returns more than one hundred records without truncating the analytical data', async () => {
    const ids = Array.from({ length: 120 }, () => randomUUID());
    await prisma.unscoped.financialEntry.createMany({ data: ids.map(id => ({ id, tenantId: tenants[0], categoryId, supplierId, createdBy: userId, type: 'EXPENSE', description: 'Volume analítico', amountCents: 1, dueAt: new Date('2026-10-11T12:00:00Z'), status: 'PENDING' })) });
    try { const result = await report(range).expect(200); expect(result.body.entries).toHaveLength(125); }
    finally { await prisma.unscoped.financialEntry.deleteMany({ where: { id: { in: ids }, tenantId: tenants[0] } }); }
  });
});
