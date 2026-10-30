import { describe, expect, it } from 'vitest';
import { moduleForPath } from './use-entitlements';

describe('moduleForPath', () => {
  it('maps the screens sold separately to their module', () => {
    expect(moduleForPath('/financeiro')).toBe('financeiro');
    expect(moduleForPath('/financeiro/contas-a-pagar')).toBe('financeiro');
    expect(moduleForPath('/produtividade')).toBe('produtividade');
    expect(moduleForPath('/configuracoes/whatsapp')).toBe('whatsapp');
    expect(moduleForPath('/configuracoes/historico')).toBe('governanca');
  });

  it('leaves the rest of the system open to every plan', () => {
    for (const path of ['/painel', '/ordens-de-servico', '/configuracoes', '/configuracoes/assinatura', '/financeirox', null]) expect(moduleForPath(path)).toBeNull();
  });
});
