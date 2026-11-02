import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupCep } from '../cep';

function respond(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('lookupCep', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks ViaCEP for the digits and returns the address in our field names', async () => {
    const fetchMock = respond({ logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' });
    await expect(lookupCep('01310100')).resolves.toEqual({ street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' });
    expect(fetchMock).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/');
  });

  it('fills missing parts with empty text', async () => {
    respond({ localidade: 'Cidade', uf: 'SP' });
    await expect(lookupCep('01001000')).resolves.toEqual({ street: '', neighborhood: '', city: 'Cidade', state: 'SP' });
  });

  it('resolves to null when the CEP does not exist', async () => {
    respond({ erro: true });
    await expect(lookupCep('00000000')).resolves.toBeNull();
  });

  it('throws when the service answers with an error, so callers can fall back to typing', async () => {
    respond({}, false);
    await expect(lookupCep('01310100')).rejects.toThrow('Não foi possível consultar o CEP.');
  });
});
