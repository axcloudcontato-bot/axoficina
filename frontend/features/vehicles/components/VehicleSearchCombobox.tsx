'use client';

import { forwardRef, useEffect, useId, useRef, useState, type ComponentPropsWithoutRef } from 'react';
import type { VehicleListItemResponse } from '@oficina/contracts';
import { Input } from '@/components/ui/input';
import { useVehiclesList } from '@/features/vehicles/hooks/use-vehicles';
import { useComboboxKeyboard } from '@/components/ui/use-combobox-keyboard';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;
const RESULTS_LIMIT = 20;

interface VehicleSearchComboboxProps extends Omit<ComponentPropsWithoutRef<typeof Input>, 'value' | 'onChange' | 'type' | 'role'> {
  value: string;
  onChange: (vehicleId: string) => void;
  customerId?: string;
  initialLabel?: string;
}

function vehicleLabel(vehicle: VehicleListItemResponse): string {
  return `${vehicle.brand} ${vehicle.model} · ${vehicle.plate} — ${vehicle.customerName}`;
}

// Sem lib de combobox nova (mesma restrição pragmática já aceita na Feature 4)
// — input simples + lista de resultados posicionada por baixo. Aceita
// ...rest/ref pra funcionar dentro de <FormControl> (id/aria-describedby/
// aria-invalid vêm do Slot do shadcn, mesmo padrão de FipeBrandModelFields).
export const VehicleSearchCombobox = forwardRef<HTMLInputElement, VehicleSearchComboboxProps>(function VehicleSearchCombobox(
  { value, onChange, placeholder, customerId, initialLabel, ...rest },
  ref,
) {
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [confirmedLabel, setConfirmedLabel] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const previousCustomerId = useRef<string | undefined>(undefined);
  const internalChange = useRef(false);

  // Reseta o texto exibido quando o form limpa o campo externamente (ex:
  // reabrir o modal) — não reage a toda mudança de `value`, só quando ele
  // volta a vazio, senão apagaria o texto digo logo após uma seleção.
  useEffect(() => {
    if (internalChange.current) { internalChange.current = false; return; }
    if (value === '') {
      setQuery('');
      setConfirmedLabel('');
    } else if (initialLabel) {
      setQuery(initialLabel);
      setConfirmedLabel(initialLabel);
    }
  }, [value, initialLabel]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!customerId) {
      setIsOpen(false);
      previousCustomerId.current = customerId;
      return;
    }

    // Ao trocar o cliente, reinicia o veículo e já apresenta a lista dele.
    if (previousCustomerId.current !== undefined && previousCustomerId.current !== customerId) {
      setQuery('');
      setConfirmedLabel('');
      onChange('');
    }
    setIsOpen(true);
    previousCustomerId.current = customerId;
  }, [customerId, onChange]);

  const isEditingAfterSelection = query !== confirmedLabel;
  const canSearch = debouncedQuery.length >= MIN_SEARCH_LENGTH && isEditingAfterSelection;
  const canLoadCustomerVehicles = Boolean(customerId) && (debouncedQuery.length === 0 || canSearch) && isOpen;

  // `matchOwner: true` — só este combobox (abertura de OS) casa a busca
  // também pelo nome/documento do cliente dono; a tela de Veículos usa
  // useVehiclesList sem essa flag e mantém a busca original (ver
  // VehicleListRequest.matchOwner).
  const { data, isFetching, isPlaceholderData } = useVehiclesList(
    { offset: 0, limit: RESULTS_LIMIT, search: debouncedQuery || undefined, customerId, matchOwner: true },
    { enabled: canLoadCustomerVehicles || (canSearch && isOpen) },
  );

  const results = (canLoadCustomerVehicles || canSearch) && !isFetching && !isPlaceholderData && query.trim() === debouncedQuery ? data?.items ?? [] : [];
  const expanded = isOpen && (canLoadCustomerVehicles || canSearch);

  function handleQueryChange(newQuery: string) {
    setQuery(newQuery);
    setIsOpen(true);
    if (newQuery !== confirmedLabel) {
      if (value) internalChange.current = true;
      onChange('');
    }
  }

  function handleSelect(vehicle: VehicleListItemResponse) {
    if (value !== vehicle.id) internalChange.current = true;
    const label = vehicleLabel(vehicle);
    setQuery(label);
    setConfirmedLabel(label);
    setIsOpen(false);
    onChange(vehicle.id);
  }

  const { activeIndex, setActiveIndex, activeId, onKeyDown } = useComboboxKeyboard({ open: expanded, canOpen: canSearch || Boolean(customerId), setOpen: setIsOpen, count: results.length, resetKey: debouncedQuery, listboxId, select: (index) => handleSelect(results[index]) });

  return (
    <div className="relative">
      <Input
        {...rest}
        ref={ref}
        role="combobox"
        data-keyboard-combobox
        aria-expanded={expanded}
        aria-controls={expanded ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        placeholder={placeholder ?? 'Nome, CPF ou placa do veículo...'}
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={onKeyDown}
      />
      {isOpen && (canLoadCustomerVehicles || canSearch) && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Veículos encontrados"
          aria-busy={isFetching}
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-button border border-input bg-background shadow-md"
        >
          {isFetching && <li className="px-3 py-2 text-sm text-muted-foreground">Buscando...</li>}
          {!isFetching && results.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum veículo encontrado</li>}
          {!isFetching &&
            results.map((vehicle, index) => (
              <li key={vehicle.id}>
                <button
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  tabIndex={-1}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-accent ${index === activeIndex ? 'bg-accent' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(vehicle)}
                >
                  {vehicleLabel(vehicle)}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
});
