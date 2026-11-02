export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

// ViaCEP: public API, no key, CORS open. It does not go through apiClient (which points at the product's own backend,
// with auth and tenant). The address is optional everywhere, so a failure here must never block a form: callers catch.
// Resolves to null when the CEP does not exist.
export async function lookupCep(digits: string): Promise<CepAddress | null> {
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!response.ok) throw new Error('Não foi possível consultar o CEP.');
  const data = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
  if (data.erro) return null;
  return { street: data.logradouro ?? '', neighborhood: data.bairro ?? '', city: data.localidade ?? '', state: data.uf ?? '' };
}
