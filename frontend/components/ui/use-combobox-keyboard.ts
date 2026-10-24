'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';

export function useComboboxKeyboard({ open, canOpen, setOpen, count, resetKey, listboxId, select }: {
  open: boolean;
  canOpen: boolean;
  setOpen: (open: boolean) => void;
  count: number;
  resetKey: string;
  listboxId: string;
  select: (index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => { setActiveIndex(count > 0 ? 0 : -1); }, [count, resetKey]);
  const activeId = open && activeIndex >= 0 && activeIndex < count ? `${listboxId}-option-${activeIndex}` : undefined;
  useEffect(() => { if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' }); }, [activeId]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' && open) {
      // The first Escape closes suggestions; a second one may close the dialog.
      event.preventDefault(); event.stopPropagation(); setOpen(false); return;
    }
    if (event.defaultPrevented) return;
    if (event.key === 'Tab') { setOpen(false); return; }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && (open || canOpen)) {
      event.preventDefault();
      setOpen(true);
      if (count) setActiveIndex((index) => !open ? (event.key === 'ArrowDown' ? 0 : count - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + count) % count);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (activeIndex >= 0 && activeIndex < count) select(activeIndex);
    }
    // Home/End and editing shortcuts retain their native text input behavior.
  }
  return { activeIndex, setActiveIndex, activeId, onKeyDown };
}
