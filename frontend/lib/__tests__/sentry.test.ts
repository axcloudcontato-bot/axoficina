import type { ErrorEvent } from '@sentry/browser';
import { describe, expect, it } from 'vitest';
import { scrubEvent, scrubText, scrubUrl } from '../sentry';

describe('sentry scrubbing', () => {
  it('masks e-mails and CPF/CNPJ in free text', () => {
    expect(scrubText('Erro com maria@oficina.com.br e CPF 123.456.789-09 / CNPJ 12.345.678/0001-95'))
      .toBe('Erro com [email] e CPF [documento] / CNPJ [documento]');
  });

  it('drops the query string and masks ids and invite tokens in a page URL', () => {
    expect(scrubUrl('https://ofix.axcloud.com.br/convite/abcdefghijklmnopqrstuvwx1234?email=a@b.com'))
      .toBe('https://ofix.axcloud.com.br/convite/:token');
    expect(scrubUrl('https://ofix.axcloud.com.br/clientes/3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c'))
      .toBe('https://ofix.axcloud.com.br/clientes/:id');
    expect(scrubUrl('https://ofix.axcloud.com.br/painel')).toBe('https://ofix.axcloud.com.br/painel');
  });

  it('keeps only a clean page URL and removes user, breadcrumbs and extras', () => {
    const event = {
      type: undefined,
      user: { id: '1', email: 'a@b.com' },
      request: { url: 'https://ofix.axcloud.com.br/entrar?next=/painel', headers: { 'User-Agent': 'x' }, cookies: { s: '1' } },
      message: 'falhou para joao@x.com',
      exception: { values: [{ type: 'TypeError', value: 'CPF 123.456.789-09 inválido' }] },
      breadcrumbs: [{ message: 'clicou' }],
      extra: { form: 'dados' },
    } as unknown as ErrorEvent;

    const clean = scrubEvent(event);

    expect(clean.user).toBeUndefined();
    expect(clean.request).toEqual({ url: 'https://ofix.axcloud.com.br/entrar' });
    expect(clean.message).toBe('falhou para [email]');
    expect(clean.exception?.values?.[0].value).toBe('CPF [documento] inválido');
    expect(clean.breadcrumbs).toEqual([]);
    expect(clean.extra).toBeUndefined();
  });
});
