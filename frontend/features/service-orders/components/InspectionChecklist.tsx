'use client';

import { Check, Minus, Warning } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { InspectionItem, InspectionStatus } from '../checklist';

interface InspectionChecklistProps {
  items: InspectionItem[];
  onChange: (items: InspectionItem[]) => void;
  disabled?: boolean;
}

const STATUS_OPTIONS: Array<{ value: InspectionStatus; label: string; icon: React.ComponentType<{ className?: string }>; className: string; selectedClassName: string }> = [
  { value: 'ok', label: 'Está bom', icon: Check, className: 'text-success hover:bg-success-subtle', selectedClassName: 'border-success/60 bg-success-subtle text-success-strong shadow-sm ring-2 ring-success/20 ring-offset-1' },
  { value: 'attention', label: 'Atenção', icon: Warning, className: 'text-warning hover:bg-warning-subtle', selectedClassName: 'border-warning/60 bg-warning-subtle text-warning-strong shadow-sm ring-2 ring-warning/20 ring-offset-1' },
  { value: 'critical', label: 'Crítico', icon: Warning, className: 'text-danger hover:bg-danger-subtle', selectedClassName: 'border-danger/60 bg-danger-subtle text-danger-strong shadow-sm ring-2 ring-danger/20 ring-offset-1' },
  { value: 'na', label: 'Não se aplica', icon: Minus, className: 'text-text-muted hover:bg-muted', selectedClassName: 'border-border-strong bg-muted text-text shadow-sm ring-2 ring-border/50 ring-offset-1' },
];

export function InspectionChecklist({ items, onChange, disabled = false }: InspectionChecklistProps) {
  const completed = items.filter((item) => item.status !== 'unchecked').length;
  const attention = items.filter((item) => item.status === 'attention' || item.status === 'critical').length;

  function updateItem(id: string, patch: Partial<InspectionItem>) {
    onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  return (
    <section aria-labelledby="inspection-title" className="overflow-hidden rounded-card border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex items-center gap-2"><h3 id="inspection-title" className="text-lg font-bold tracking-tight text-text">Inspeção visual</h3>{attention > 0 && <span className="size-2 rounded-full bg-warning" aria-label={`${attention} itens exigem atenção`} />}</div>
          <p className="mt-1 text-sm text-text-muted">Registre o estado de cada ponto antes de aprovar o serviço.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-text-muted"><span className="tabular-nums">{completed}/{items.length} verificados</span><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-normal" style={{ width: `${items.length ? (completed / items.length) * 100 : 0}%` }} /></div></div>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text">{item.label}</p>{(item.note || item.status === 'attention' || item.status === 'critical') && <Input aria-label={`Observação de ${item.label}`} className="mt-2 h-8 max-w-md text-xs" placeholder="Adicionar observação" value={item.note} disabled={disabled} onChange={(event) => updateItem(item.id, { note: event.target.value })} />}</div>
            <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Estado de ${item.label}`}>
              {STATUS_OPTIONS.map((option) => { const Icon = option.icon; const isSelected = item.status === option.value; return <button key={option.value} type="button" aria-pressed={isSelected} title={isSelected ? `${option.label} — selecionado` : option.label} disabled={disabled} onClick={() => updateItem(item.id, { status: isSelected ? 'unchecked' : option.value })} className={cn('flex min-h-9 items-center justify-center gap-1.5 rounded-button border border-transparent px-2 text-xs font-semibold transition-[background-color,border-color,box-shadow,color,transform] duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', option.className, isSelected && option.selectedClassName)}><Icon className="size-4" aria-hidden="true" /><span>{option.label}</span></button>; })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
