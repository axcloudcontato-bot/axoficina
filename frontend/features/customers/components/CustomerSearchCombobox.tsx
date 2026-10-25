'use client';

import { forwardRef, useEffect, useId, useRef, useState, type ComponentPropsWithoutRef } from 'react';
import type { CustomerListItemResponse } from '@oficina/contracts';
import { Input } from '@/components/ui/input';
import { useCustomersList } from '../hooks/use-customers';
import { useComboboxKeyboard } from '@/components/ui/use-combobox-keyboard';

const SEARCH_DEBOUNCE_MS = 250;

interface CustomerSearchComboboxProps extends Omit<ComponentPropsWithoutRef<typeof Input>, 'value' | 'onChange' | 'type' | 'role'> {
  value: string;
  onChange: (customerId: string, customer?: CustomerListItemResponse) => void;
  initialLabel?: string;
  onSearchChange?: (query: string) => void;
}

export const CustomerSearchCombobox = forwardRef<HTMLInputElement, CustomerSearchComboboxProps>(function CustomerSearchCombobox({ value, onChange, placeholder, initialLabel, onSearchChange, ...rest }, ref) {
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [confirmedLabel, setConfirmedLabel] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const internalChange = useRef(false);

  useEffect(() => {
    if (internalChange.current) { internalChange.current = false; return; }
    if (!value) { setQuery(''); setConfirmedLabel(''); }
    else if (initialLabel) { setQuery(initialLabel); setConfirmedLabel(initialLabel); }
  }, [value, initialLabel]);
  useEffect(() => { const timeout = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS); return () => clearTimeout(timeout); }, [query]);

  const canSearch = debouncedQuery.length >= 2 && query !== confirmedLabel;
  const { data, isFetching, isPlaceholderData } = useCustomersList({ offset: 0, limit: 20, search: debouncedQuery }, { enabled: canSearch && isOpen });
  const results = canSearch && !isFetching && !isPlaceholderData && query.trim() === debouncedQuery ? data?.items ?? [] : [];
  const expanded = isOpen && canSearch;

  function select(customer: CustomerListItemResponse) {
    if (value !== customer.id) internalChange.current = true;
    setQuery(customer.name); setConfirmedLabel(customer.name); setIsOpen(false); onSearchChange?.(''); onChange(customer.id, customer);
  }
  const { activeIndex, setActiveIndex, activeId, onKeyDown } = useComboboxKeyboard({ open: expanded, canOpen: canSearch, setOpen: setIsOpen, count: results.length, resetKey: debouncedQuery, listboxId, select: (index) => select(results[index]) });

  return <div className="relative">
    <Input {...rest} ref={ref} role="combobox" data-keyboard-combobox aria-expanded={expanded} aria-controls={expanded ? listboxId : undefined} aria-autocomplete="list" aria-activedescendant={activeId} placeholder={placeholder ?? 'Buscar por nome, CPF ou CNPJ'} value={query} onChange={(event) => { setQuery(event.target.value); onSearchChange?.(event.target.value); setIsOpen(true); if (event.target.value !== confirmedLabel) { if (value) internalChange.current = true; onChange(''); } }} onFocus={() => setIsOpen(true)} onBlur={() => setIsOpen(false)} onKeyDown={onKeyDown} />
    {expanded && <ul id={listboxId} role="listbox" aria-label="Clientes encontrados" aria-busy={isFetching} className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-button border border-input bg-background shadow-md">
      {isFetching && <li role="presentation" className="px-3 py-2 text-sm text-muted-foreground">Buscando clientes...</li>}
      {!isFetching && !results.length && <li role="presentation" className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado</li>}
      {results.map((customer, index) => <li key={customer.id} role="presentation"><button id={`${listboxId}-option-${index}`} tabIndex={-1} type="button" role="option" aria-selected={index === activeIndex} className={`block w-full px-3 py-2 text-left text-sm hover:bg-selection ${index === activeIndex ? 'bg-selection' : ''}`} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(customer)}>{customer.name}<span className="ml-2 text-xs text-text-muted">{customer.document}</span></button></li>)}
    </ul>}
  </div>;
});
