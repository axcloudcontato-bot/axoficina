import { MaintenanceAlertScanProcessor } from './maintenance-alert-scan.processor';

function buildProcessor() {
  const tenantRepository = { listAllUnscoped: jest.fn() };
  const vehicleRepository = { listActiveForTenantUnscoped: jest.fn() };
  const serviceOrderRepository = { lastDeliveredClosedAtUnscoped: jest.fn() };
  // Default: todo customerId recebido é considerado ativo — cobre os testes
  // que não se importam com este filtro sem precisar mockar em cada um.
  const customerRepository = {
    activeIdsAmongUnscoped: jest.fn((ids: string[]) => Promise.resolve(ids)),
  };
  const maintenanceAlertRepository = { upsertOpenAlert: jest.fn() };

  const processor = new MaintenanceAlertScanProcessor(
    tenantRepository as never,
    vehicleRepository as never,
    serviceOrderRepository as never,
    customerRepository as never,
    maintenanceAlertRepository as never,
  );

  return { processor, tenantRepository, vehicleRepository, serviceOrderRepository, customerRepository, maintenanceAlertRepository };
}

function job(now: string) {
  return { data: { now } } as never;
}

const NOW = '2026-07-26T00:00:00.000Z';

function onePageThenEmpty<T>(items: T[]) {
  return jest.fn().mockResolvedValueOnce(items).mockResolvedValue([]);
}

describe('MaintenanceAlertScanProcessor', () => {
  it('creates an alert for a vehicle whose last DELIVERED order closed 7 months ago', async () => {
    const deps = buildProcessor();
    deps.tenantRepository.listAllUnscoped.mockImplementation(onePageThenEmpty([{ id: 'tenant-1' }]));
    deps.vehicleRepository.listActiveForTenantUnscoped.mockImplementation(
      onePageThenEmpty([{ id: 'vehicle-1', tenantId: 'tenant-1', customerId: 'customer-1', createdAt: new Date('2020-01-01T00:00:00.000Z') }]),
    );
    deps.serviceOrderRepository.lastDeliveredClosedAtUnscoped.mockResolvedValue(new Date('2025-12-26T00:00:00.000Z'));

    await deps.processor.process(job(NOW));

    expect(deps.maintenanceAlertRepository.upsertOpenAlert).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      vehicleId: 'vehicle-1',
      customerId: 'customer-1',
      referenceDate: new Date('2025-12-26T00:00:00.000Z'),
    });
  });

  it('does not create an alert for a vehicle whose last DELIVERED order closed 3 months ago', async () => {
    const deps = buildProcessor();
    deps.tenantRepository.listAllUnscoped.mockImplementation(onePageThenEmpty([{ id: 'tenant-1' }]));
    deps.vehicleRepository.listActiveForTenantUnscoped.mockImplementation(
      onePageThenEmpty([{ id: 'vehicle-1', tenantId: 'tenant-1', customerId: 'customer-1', createdAt: new Date('2020-01-01T00:00:00.000Z') }]),
    );
    deps.serviceOrderRepository.lastDeliveredClosedAtUnscoped.mockResolvedValue(new Date('2026-04-26T00:00:00.000Z'));

    await deps.processor.process(job(NOW));

    expect(deps.maintenanceAlertRepository.upsertOpenAlert).not.toHaveBeenCalled();
  });

  it('falls back to the vehicle createdAt when it never had a DELIVERED order', async () => {
    const deps = buildProcessor();
    const createdAt = new Date('2025-11-01T00:00:00.000Z');
    deps.tenantRepository.listAllUnscoped.mockImplementation(onePageThenEmpty([{ id: 'tenant-1' }]));
    deps.vehicleRepository.listActiveForTenantUnscoped.mockImplementation(
      onePageThenEmpty([{ id: 'vehicle-1', tenantId: 'tenant-1', customerId: 'customer-1', createdAt }]),
    );
    deps.serviceOrderRepository.lastDeliveredClosedAtUnscoped.mockResolvedValue(null);

    await deps.processor.process(job(NOW));

    expect(deps.maintenanceAlertRepository.upsertOpenAlert).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: 'vehicle-1', referenceDate: createdAt }),
    );
  });

  it('a vehicle failing to evaluate does not stop the others in the same page', async () => {
    const deps = buildProcessor();
    deps.tenantRepository.listAllUnscoped.mockImplementation(onePageThenEmpty([{ id: 'tenant-1' }]));
    deps.vehicleRepository.listActiveForTenantUnscoped.mockImplementation(
      onePageThenEmpty([
        { id: 'vehicle-broken', tenantId: 'tenant-1', customerId: 'customer-1', createdAt: new Date('2020-01-01T00:00:00.000Z') },
        { id: 'vehicle-ok', tenantId: 'tenant-1', customerId: 'customer-2', createdAt: new Date('2020-01-01T00:00:00.000Z') },
      ]),
    );
    deps.serviceOrderRepository.lastDeliveredClosedAtUnscoped.mockImplementation(async (vehicleId: string) => {
      if (vehicleId === 'vehicle-broken') {
        throw new Error('conexão perdida com o banco');
      }
      return new Date('2025-12-26T00:00:00.000Z');
    });

    await expect(deps.processor.process(job(NOW))).resolves.toBeUndefined();

    expect(deps.maintenanceAlertRepository.upsertOpenAlert).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: 'vehicle-ok' }),
    );
    expect(deps.maintenanceAlertRepository.upsertOpenAlert).not.toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: 'vehicle-broken' }),
    );
  });

  it('skips a vehicle whose customer is soft-deleted (Edge Case 5)', async () => {
    const deps = buildProcessor();
    deps.tenantRepository.listAllUnscoped.mockImplementation(onePageThenEmpty([{ id: 'tenant-1' }]));
    deps.vehicleRepository.listActiveForTenantUnscoped.mockImplementation(
      onePageThenEmpty([
        { id: 'vehicle-1', tenantId: 'tenant-1', customerId: 'customer-deleted', createdAt: new Date('2020-01-01T00:00:00.000Z') },
      ]),
    );
    deps.serviceOrderRepository.lastDeliveredClosedAtUnscoped.mockResolvedValue(new Date('2025-12-26T00:00:00.000Z'));
    deps.customerRepository.activeIdsAmongUnscoped.mockResolvedValue([]);

    await deps.processor.process(job(NOW));

    expect(deps.customerRepository.activeIdsAmongUnscoped).toHaveBeenCalledWith(['customer-deleted']);
    expect(deps.maintenanceAlertRepository.upsertOpenAlert).not.toHaveBeenCalled();
  });

  it('stops paginating vehicles after MAX_CHUNKS even if every page comes back full', async () => {
    const deps = buildProcessor();
    deps.tenantRepository.listAllUnscoped.mockImplementation(onePageThenEmpty([{ id: 'tenant-1' }]));
    // Sempre devolve uma página "cheia" (mesmo tamanho do chunk) — sem o
    // guard de MAX_CHUNKS isso rodaria pra sempre.
    const fullPage = Array.from({ length: 500 }, (_, index) => ({
      id: `vehicle-${index}`,
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    }));
    deps.vehicleRepository.listActiveForTenantUnscoped.mockResolvedValue(fullPage);
    deps.serviceOrderRepository.lastDeliveredClosedAtUnscoped.mockResolvedValue(new Date('2026-04-26T00:00:00.000Z'));

    await deps.processor.process(job(NOW));

    expect(deps.vehicleRepository.listActiveForTenantUnscoped.mock.calls.length).toBeLessThan(1000);
  });

  it('uses the months the workshop chose: 3 flags a car 4 months old, 12 does not', async () => {
    const deps = buildProcessor();
    deps.tenantRepository.listAllUnscoped.mockImplementation(onePageThenEmpty([{ id: 'tenant-fleet', maintenanceAlertMonths: 3 }, { id: 'tenant-slow', maintenanceAlertMonths: 12 }]));
    deps.vehicleRepository.listActiveForTenantUnscoped.mockImplementation((tenantId: string, offset: number) => Promise.resolve(offset === 0 ? [{ id: `vehicle-${tenantId}`, tenantId, customerId: 'customer-1', createdAt: new Date('2020-01-01T00:00:00.000Z') }] : []));
    deps.serviceOrderRepository.lastDeliveredClosedAtUnscoped.mockResolvedValue(new Date('2026-03-20T00:00:00.000Z'));

    await deps.processor.process(job(NOW));

    expect(deps.maintenanceAlertRepository.upsertOpenAlert).toHaveBeenCalledTimes(1);
    expect(deps.maintenanceAlertRepository.upsertOpenAlert).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-fleet' }));
  });
});
