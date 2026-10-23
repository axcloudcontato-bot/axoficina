'use client';

import { useEffect, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { CheckCircle, CircleNotch } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { formatCEP } from '@/lib/format-br-document';
import { useCepLookup } from '../../hooks/use-cep-lookup';
import type { CustomerFormValues } from '../CustomerFormModal';

interface CustomerAddressTabProps {
  form: UseFormReturn<CustomerFormValues>;
}

export function CustomerAddressTab({ form }: CustomerAddressTabProps) {
  const zipCode = form.watch('address.zipCode') ?? '';
  const digits = zipCode.replace(/\D/g, '');
  const lookup = useCepLookup(zipCode);
  // Evita reaplicar o mesmo CEP (ex.: ao trocar de aba e voltar) e evita
  // brigar com edição manual do usuário depois do preenchimento automático.
  const appliedFor = useRef<string | null>(null);

  useEffect(() => {
    if (digits.length !== 8 || !lookup.data || appliedFor.current === digits) {
      return;
    }
    appliedFor.current = digits;
    form.setValue('address.street', lookup.data.street, { shouldDirty: true });
    form.setValue('address.neighborhood', lookup.data.neighborhood, { shouldDirty: true });
    form.setValue('address.city', lookup.data.city, { shouldDirty: true });
    form.setValue('address.state', lookup.data.state, { shouldDirty: true });
  }, [digits, lookup.data, form]);

  const notFound = digits.length === 8 && lookup.isFetched && !lookup.isFetching && lookup.data === null;
  const found = digits.length === 8 && !lookup.isFetching && Boolean(lookup.data);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <FormField
          control={form.control}
          name="address.zipCode"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>CEP</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="00000-000"
                    inputMode="numeric"
                    className="pr-9"
                    {...field}
                    onChange={(event) => {
                      appliedFor.current = null;
                      field.onChange(formatCEP(event.target.value));
                    }}
                  />
                  {lookup.isFetching && <CircleNotch className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-text-muted" aria-hidden="true" />}
                  {found && <CheckCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-success" aria-hidden="true" />}
                </div>
              </FormControl>
              {notFound ? (
                <p className="text-xs text-warning">CEP não encontrado — preencha o endereço manualmente.</p>
              ) : lookup.isError ? (
                <p className="text-xs text-text-muted">Não foi possível consultar o CEP agora — preencha o endereço manualmente.</p>
              ) : (
                <p className="text-xs text-text-muted">Preenche rua, bairro, cidade e UF automaticamente.</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="address.street"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Rua</FormLabel>
              <FormControl>
                <Input placeholder="Rua das Flores" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address.number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número</FormLabel>
              <FormControl>
                <Input placeholder="123" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="address.complement"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Complemento</FormLabel>
              <FormControl>
                <Input placeholder="Apto 12" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address.neighborhood"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bairro</FormLabel>
              <FormControl>
                <Input placeholder="Centro" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="address.city"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Cidade</FormLabel>
              <FormControl>
                <Input placeholder="São Paulo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address.state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>UF</FormLabel>
              <FormControl>
                <Input placeholder="SP" maxLength={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
