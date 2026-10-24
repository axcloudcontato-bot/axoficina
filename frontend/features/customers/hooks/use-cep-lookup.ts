'use client';

import { useQuery } from '@tanstack/react-query';

export interface CepLookupResult {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

// ViaCEP: API pública, sem chave, CORS liberado — não passa pelo apiClient
// (que aponta pro backend do próprio produto, com auth/tenant). Endereço é
// opcional no cadastro, então uma falha aqui nunca deve travar o formulário.
async function fetchCep(digits: string): Promise<CepLookupResult | null> {
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!response.ok) {
    throw new Error('Não foi possível consultar o CEP.');
  }
  const data = await response.json();
  if (data.erro) {
    return null;
  }
  return {
    street: data.logradouro ?? '',
    neighborhood: data.bairro ?? '',
    city: data.localidade ?? '',
    state: data.uf ?? '',
  };
}

export function useCepLookup(zipCode: string, requested = false) {
  const digits = zipCode.replace(/\D/g, '');
  return useQuery({
    queryKey: ['cep-lookup', digits],
    queryFn: () => fetchCep(digits),
    enabled: requested && digits.length === 8,
    staleTime: Infinity,
    retry: 1,
  });
}
