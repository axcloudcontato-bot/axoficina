import { cn } from '@/lib/utils';

// Section menu shared by the pages: joined, bordered segments with the selected one in the brand yellow
// (as in the financial menu) and a thin bar under it. Used on both links and tab buttons.
export const segmentedList = 'inline-flex max-w-full overflow-x-auto rounded-button shadow-sm';

export function segmentedItem(active: boolean, className?: string) {
  return cn(
    'relative flex shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap border border-border px-3 py-2 text-sm font-semibold transition-colors',
    '-ml-px first:ml-0 first:rounded-s-button last:rounded-e-button',
    'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5',
    'focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
    active ? 'z-[1] bg-primary text-primary-foreground after:bg-primary-active' : 'bg-card text-text-muted hover:bg-muted hover:text-text',
    className,
  );
}
