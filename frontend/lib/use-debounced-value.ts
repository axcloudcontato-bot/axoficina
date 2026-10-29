'use client';

import { useEffect, useState } from 'react';

// The value only follows after it has stopped changing for `delayMs`: typing in a search box
// should not fire a request per keystroke.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
