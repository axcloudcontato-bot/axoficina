import { entitledModules, MODULE_KEYS, PLANS, resolvePlan } from '@oficina/contracts';

describe('plans', () => {
  it('grows module by module and prices each step higher', () => {
    expect(PLANS.essencial.modules).toEqual([]);
    expect(PLANS.profissional.modules).toEqual(['financeiro', 'produtividade', 'cuidado']);
    expect(PLANS.completo.modules).toEqual(MODULE_KEYS);
    expect([PLANS.essencial, PLANS.profissional, PLANS.completo].map(plan => plan.monthlyPriceCents)).toEqual([12990, 15990, 19990]);
  });

  it('keeps workshops from before plans existed on everything', () => {
    for (const legacy of ['free', '', null, undefined, 'inexistente']) expect(resolvePlan(legacy).code).toBe('completo');
  });

  it('adds extra modules to the plan without duplicates or unknown keys', () => {
    expect(entitledModules('essencial', ['whatsapp', 'whatsapp', 'bogus'])).toEqual(['whatsapp']);
    expect(entitledModules('profissional', ['financeiro'])).toEqual(['financeiro', 'produtividade', 'cuidado']);
  });
});
