import type { ErrorEvent } from '@sentry/node';
import { scrubEvent, scrubText, scrubUrl } from './sentry';

describe('sentry scrubbing', () => {
  it('masks e-mails and CPF/CNPJ in free text', () => {
    expect(scrubText('Falha ao notificar maria@oficina.com.br (CPF 123.456.789-09, CNPJ 12.345.678/0001-95)'))
      .toBe('Falha ao notificar [email] (CPF [documento], CNPJ [documento])');
  });

  it('drops the query string and masks ids and tokens in a URL', () => {
    expect(scrubUrl('https://ofix.axcloud.com.br/api/v1/customers/3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c?search=maria'))
      .toBe('https://ofix.axcloud.com.br/api/v1/customers/:id');
    expect(scrubUrl('/api/v1/invites/abcdefghijklmnopqrstuvwx1234')).toBe('/api/v1/invites/:token');
    expect(scrubUrl('/api/v1/service-orders')).toBe('/api/v1/service-orders');
  });

  it('keeps only the method and a clean URL of the request and removes user and breadcrumbs', () => {
    const event = {
      type: undefined,
      user: { id: '1', email: 'a@b.com', ip_address: '1.2.3.4' },
      server_name: 'glpi-srv',
      request: { method: 'POST', url: '/api/v1/auth/login?x=1', data: { password: 'segredo' }, headers: { authorization: 'Bearer abc' }, cookies: { s: '1' } },
      message: 'erro para joao@x.com',
      exception: { values: [{ type: 'Error', value: 'CPF 123.456.789-09 inválido' }] },
      breadcrumbs: [{ message: 'clicou' }],
      extra: { body: 'dados' },
    } as unknown as ErrorEvent;

    const clean = scrubEvent(event);

    expect(clean.user).toBeUndefined();
    expect(clean.server_name).toBeUndefined();
    expect(clean.request).toEqual({ method: 'POST', url: '/api/v1/auth/login' });
    expect(clean.message).toBe('erro para [email]');
    expect(clean.exception?.values?.[0].value).toBe('CPF [documento] inválido');
    expect(clean.breadcrumbs).toEqual([]);
    expect(clean.extra).toBeUndefined();
  });
});
