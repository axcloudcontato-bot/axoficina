'use client';

import * as React from 'react';
import { CaretDown, CaretLeft, CaretRight, CaretUp } from '@phosphor-icons/react';
import { ptBR } from 'date-fns/locale';
import { DayPicker, type DropdownProps } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function CalendarDropdown({ options = [], value, onChange, disabled, 'aria-label': ariaLabel }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === Number(value));

  React.useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    selectedRef.current?.scrollIntoView?.({ block: 'nearest' });
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  return <div ref={rootRef} className="relative inline-flex shrink-0">
    <button type="button" aria-label={ariaLabel} aria-expanded={open} aria-haspopup="listbox" disabled={disabled} className="inline-flex items-center gap-1 rounded-button border border-input bg-card px-2 py-1 text-xs text-foreground hover:border-border-strong disabled:opacity-50" onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); } }}>
      {selected?.label}<CaretDown className="size-4" aria-hidden="true" />
    </button>
    {open && <div role="listbox" aria-label={ariaLabel} className="absolute left-0 top-full z-50 mt-1 max-h-56 min-w-full overflow-y-auto rounded-button border border-border bg-card p-1 shadow-lg">
      {options.map((option) => <button key={option.value} ref={option.value === Number(value) ? selectedRef : undefined} type="button" role="option" aria-selected={option.value === Number(value)} disabled={option.disabled} className="block w-full whitespace-nowrap rounded-button px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-40" onClick={() => { onChange?.({ target: { value: String(option.value) } } as React.ChangeEvent<HTMLSelectElement>); setOpen(false); }}>{option.label}</button>)}
    </div>}
  </div>;
}

/** The shared calendar for individual dates and the blue range selection supplied by the user. */
export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return <DayPicker
    locale={ptBR}
    showOutsideDays={showOutsideDays}
    className={cn('relative w-max rounded-lg bg-popover p-3 text-popover-foreground', className)}
    classNames={{
      months: 'flex flex-col gap-4 sm:flex-row',
      month: 'space-y-3',
      month_caption: 'flex h-10 items-center justify-center',
      caption_label: 'inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold',
      dropdowns: 'flex items-center gap-1',
      dropdown_root: 'relative inline-flex shrink-0 items-center rounded-button border border-input bg-card px-2 py-1 text-xs',
      dropdown: 'absolute inset-0 w-full cursor-pointer opacity-0',
      nav: 'pointer-events-none absolute inset-x-3 top-3 flex justify-between',
      button_previous: 'pointer-events-auto grid size-8 place-items-center rounded-full border border-input bg-background text-foreground hover:bg-accent disabled:opacity-40',
      button_next: 'pointer-events-auto grid size-8 place-items-center rounded-full border border-input bg-background text-foreground hover:bg-accent disabled:opacity-40',
      month_grid: 'w-full border-collapse',
      weekdays: 'flex',
      weekday: 'grid size-10 place-items-center text-xs font-medium text-muted-foreground',
      week: 'mt-1 flex',
      day: 'grid size-10 place-items-center p-0 text-sm',
      day_button: 'grid size-10 place-items-center rounded-full text-sm font-medium text-foreground hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
      today: '[&>button]:font-bold [&>button]:ring-1 [&>button]:ring-blue-500/40',
      outside: '[&>button]:text-muted-foreground/60',
      disabled: '[&>button]:cursor-not-allowed [&>button]:opacity-35',
      selected: '[&>button]:!bg-blue-600 [&>button]:!text-white',
      range_start: 'rounded-l-full bg-blue-100 [&>button]:!rounded-full [&>button]:!bg-blue-600 [&>button]:!text-white',
      range_middle: 'bg-blue-100 [&>button]:!rounded-none [&>button]:!bg-transparent [&>button]:!text-foreground',
      range_end: 'rounded-r-full bg-blue-100 [&>button]:!rounded-full [&>button]:!bg-blue-600 [&>button]:!text-white',
      hidden: 'invisible',
      ...classNames,
    }}
    components={{
      Dropdown: CalendarDropdown,
      Chevron: ({ orientation, className: chevronClass }) => {
        const Icon = orientation === 'left' ? CaretLeft : orientation === 'right' ? CaretRight : orientation === 'up' ? CaretUp : CaretDown;
        return <Icon className={cn('size-4', chevronClass)} aria-hidden="true" />;
      },
    }}
    {...props}
  />;
}
