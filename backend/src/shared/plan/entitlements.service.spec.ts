import { EntitlementsService } from './entitlements.service';

function build(tenant: unknown) {
  const findFirst = jest.fn().mockResolvedValue(tenant);
  return { service: new EntitlementsService({ unscoped: { tenant: { findFirst } } } as never), findFirst };
}

describe('EntitlementsService', () => {
  it('combines the plan with the modules sold on top', async () => {
    const { service } = build({ plan: 'profissional', extraModules: ['whatsapp'] });
    const result = await service.forTenant('t1');
    expect(result).toMatchObject({ plan: 'profissional', planName: 'Profissional', modules: ['financeiro', 'produtividade', 'cuidado', 'whatsapp'] });
  });

  it('keeps old workshops on every module', async () => {
    const { service } = build({ plan: 'free', extraModules: [] });
    expect((await service.forTenant('t1')).plan).toBe('completo');
  });

  it('caches for a moment and forgets when the plan changes', async () => {
    const { service, findFirst } = build({ plan: 'essencial', extraModules: [] });
    await service.forTenant('t1');
    await service.forTenant('t1');
    expect(findFirst).toHaveBeenCalledTimes(1);
    service.forget('t1');
    await service.forTenant('t1');
    expect(findFirst).toHaveBeenCalledTimes(2);
  });
});
