import { AppointmentManager } from './appointment.manager';

const user = { userId: '00000000-0000-4000-8000-000000000001', tenantId: '00000000-0000-4000-8000-000000000002', role: 'FRONT_DESK' } as const;
const request = {
  customerId: '00000000-0000-4000-8000-000000000003',
  vehicleId: '00000000-0000-4000-8000-000000000004',
  technicianId: '00000000-0000-4000-8000-000000000005',
  startsAt: '2026-07-28T12:00:00.000Z',
  endsAt: '2026-07-28T13:00:00.000Z',
  serviceDescription: 'Revisão',
};

function setup(conflicts: unknown[] = [], bays: number | null = null) {
  const appointments = {
    conflicts: jest.fn().mockResolvedValue(conflicts),
    byId: jest.fn(),
    transition: jest.fn().mockResolvedValue({ count: 1 }),
    listByPeriod: jest.fn().mockResolvedValue([]),
    linkServiceOrder: jest.fn().mockResolvedValue({ count: 1 }),
    overlapping: jest.fn().mockResolvedValue(0),
    insert: jest.fn().mockResolvedValue({
      id: 'a1', tenantId: user.tenantId, customerId: request.customerId, vehicleId: request.vehicleId,
      technicianId: request.technicianId, serviceOrderId: null, startsAt: new Date(request.startsAt),
      endsAt: new Date(request.endsAt), serviceDescription: 'Revisão', notes: null, status: 'SCHEDULED',
      createdBy: user.userId, cancelledAt: null, createdAt: new Date(), updatedAt: null, deletedAt: null,
    }),
  };
  const customer = { id: request.customerId, name: 'Maria', phone: '11999990000' };
  const vehicle = { id: request.vehicleId, customerId: request.customerId, brand: 'Fiat', model: 'Uno', plate: 'ABC1D23' };
  const technician = { id: request.technicianId, name: 'Carlos', status: 'active' };
  const customers = { byId: jest.fn().mockResolvedValue(customer), byIds: jest.fn().mockResolvedValue([customer]) };
  const vehicles = { byId: jest.fn().mockResolvedValue(vehicle), byIds: jest.fn().mockResolvedValue([vehicle]) };
  const users = { byId: jest.fn().mockResolvedValue(technician), byIds: jest.fn().mockResolvedValue([technician]) };
  const serviceOrders = { create: jest.fn().mockResolvedValue({ serviceOrder: { id: 'so-1' } }) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const tenants = { byId: jest.fn().mockResolvedValue({ id: user.tenantId, agendaBays: bays }) };
  const notifications = { sendConfirmation: jest.fn().mockResolvedValue(undefined) };
  const manager = new AppointmentManager(appointments as never, customers as never, vehicles as never, users as never, serviceOrders as never, audit as never, tenants as never, notifications as never);
  return { manager, appointments, customers, serviceOrders, audit, notifications };
}

describe('AppointmentManager', () => {
  it('rejeita intervalo invertido', async () => {
    const { manager } = setup();
    await expect(manager.create(user as never, { ...request, endsAt: request.startsAt })).rejects.toMatchObject({ code: 'APPOINTMENT_INVALID_INTERVAL' });
  });

  it('exige confirmação quando o técnico tem conflito', async () => {
    const { manager, appointments } = setup([{ id: 'conflict' }]);
    await expect(manager.create(user as never, request)).rejects.toMatchObject({ code: 'APPOINTMENT_CONFLICT' });
    expect(appointments.insert).not.toHaveBeenCalled();
  });

  it('permite salvar conflito confirmado', async () => {
    const { manager, appointments } = setup([{ id: 'conflict' }]);
    await manager.create(user as never, { ...request, confirmConflict: true });
    expect(appointments.insert).toHaveBeenCalled();
  });

  const stored = (over: Record<string, unknown> = {}) => ({
    id: 'a1', tenantId: user.tenantId, customerId: request.customerId, vehicleId: request.vehicleId, technicianId: request.technicianId, serviceOrderId: null,
    startsAt: new Date(request.startsAt), endsAt: new Date(request.endsAt), serviceDescription: 'Barulho no freio', notes: 'Cliente espera no local', status: 'SCHEDULED',
    createdBy: user.userId, cancelledAt: null, createdAt: new Date(), updatedAt: null, deletedAt: null, ...over,
  });

  it('lista o período com uma consulta por tabela relacionada e traz o telefone do cliente', async () => {
    const { manager, appointments, customers } = setup();
    appointments.listByPeriod.mockResolvedValue([stored(), stored({ id: 'a2' }), stored({ id: 'a3' })]);
    const result = await manager.list({ startsAt: '2026-07-27T00:00:00.000Z', endsAt: '2026-08-03T00:00:00.000Z' });
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toMatchObject({ customerName: 'Maria', customerPhone: '11999990000', technicianName: 'Carlos' });
    expect(customers.byIds).toHaveBeenCalledTimes(1);
    expect(customers.byId).not.toHaveBeenCalled();
  });

  it('exige motivo para cancelar e registra o motivo na auditoria', async () => {
    const { manager, appointments, audit } = setup();
    appointments.byId.mockResolvedValue(stored());
    await expect(manager.transition(user as never, { id: 'a1', toStatus: 'CANCELLED' })).rejects.toThrow('motivo do cancelamento');
    expect(appointments.transition).not.toHaveBeenCalled();
    await manager.transition(user as never, { id: 'a1', toStatus: 'CANCELLED', reason: ' Cliente remarcou por telefone ' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ toStatus: 'CANCELLED', reason: 'Cliente remarcou por telefone' }) }));
  });

  it('só marca falta depois do horário agendado', async () => {
    const { manager, appointments } = setup();
    appointments.byId.mockResolvedValue(stored({ startsAt: new Date(Date.now() + 3_600_000) }));
    await expect(manager.transition(user as never, { id: 'a1', toStatus: 'NO_SHOW' })).rejects.toThrow('depois do horário');
    appointments.byId.mockResolvedValue(stored({ startsAt: new Date(Date.now() - 3_600_000) }));
    await expect(manager.transition(user as never, { id: 'a1', toStatus: 'NO_SHOW' })).resolves.toBeDefined();
  });

  it('ao iniciar, leva o pedido do cliente como solicitação da OS, não como diagnóstico', async () => {
    const { manager, appointments, serviceOrders } = setup();
    appointments.byId.mockResolvedValue(stored());
    await manager.start(user as never, { id: 'a1' });
    expect(serviceOrders.create).toHaveBeenCalledWith(user, expect.objectContaining({ customerComplaint: 'Barulho no freio', receptionNotes: 'Cliente espera no local' }));
    expect(serviceOrders.create.mock.calls[0][1]).not.toHaveProperty('diagnosis');
  });

  it('respeita a capacidade da oficina e permite encaixe confirmado', async () => {
    const { manager, appointments } = setup([], 2);
    appointments.overlapping.mockResolvedValue(2);
    await expect(manager.create(user as never, { ...request, technicianId: undefined })).rejects.toMatchObject({ code: 'APPOINTMENT_CONFLICT' });
    expect(appointments.insert).not.toHaveBeenCalled();
    await manager.create(user as never, { ...request, technicianId: undefined, confirmConflict: true });
    expect(appointments.insert).toHaveBeenCalled();
  });

  it('sem capacidade definida não limita o número de carros', async () => {
    const { manager, appointments } = setup([], null);
    appointments.overlapping.mockResolvedValue(50);
    await manager.create(user as never, request);
    expect(appointments.overlapping).not.toHaveBeenCalled();
    expect(appointments.insert).toHaveBeenCalled();
  });

  it('pede confirmação por WhatsApp só de agendamento ainda não atendido', async () => {
    const { manager, appointments, notifications, audit } = setup();
    appointments.byId.mockResolvedValue(stored());
    await manager.notify(user as never, { id: 'a1' });
    expect(notifications.sendConfirmation).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'appointment.confirmation_sent' }));
    appointments.byId.mockResolvedValue(stored({ status: 'COMPLETED' }));
    await expect(manager.notify(user as never, { id: 'a1' })).rejects.toThrow('ainda não atendido');
  });
});
