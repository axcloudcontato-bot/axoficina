'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function KeyboardNavigation() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const frame = requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return <a href="#main-content" className="skip-link print:hidden" onClick={(event) => {
    const main = document.getElementById('main-content');
    if (main) { event.preventDefault(); main.focus(); main.scrollIntoView({ block: 'start' }); }
  }}>Pular para o conteúdo principal</a>;
}
