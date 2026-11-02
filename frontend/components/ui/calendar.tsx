'use client';

import * as React from 'react';
import { CaretDown, CaretLeft, CaretRight, CaretUp } from '@phosphor-icons/react';
import { ptBR } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

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
      caption_label: 'text-sm font-semibold',
      dropdowns: 'flex items-center gap-1',
      dropdown_root: 'relative rounded-button border border-input bg-background px-2 py-1 text-xs',
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
      Chevron: ({ orientation, className: chevronClass }) => {
        const Icon = orientation === 'left' ? CaretLeft : orientation === 'right' ? CaretRight : orientation === 'up' ? CaretUp : CaretDown;
        return <Icon className={cn('size-4', chevronClass)} aria-hidden="true" />;
      },
    }}
    {...props}
  />;
}
