'use client';

import { useQuery } from '@tanstack/react-query';
import { lookupCep, type CepAddress } from '@/lib/cep';
import { onlyDigits } from '@/lib/format-br-document';

export type CepLookupResult = CepAddress;

export function useCepLookup(zipCode: string, requested = false) {
  const digits = onlyDigits(zipCode);
  return useQuery({
    queryKey: ['cep-lookup', digits],
    queryFn: () => lookupCep(digits),
    enabled: requested && digits.length === 8,
    staleTime: Infinity,
    retry: 1,
  });
}
