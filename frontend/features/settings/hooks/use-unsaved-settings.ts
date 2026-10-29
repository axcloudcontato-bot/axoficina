'use client';

import { useEffect } from 'react';

const reviewedClicks = new WeakSet<Event>();

export function useUnsavedSettings(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const onNavigate = (event: MouseEvent) => {
      if (reviewedClicks.has(event)) return;
      const target = event.target;
      const anchor = target instanceof Element ? target.closest('a[href]') : null;
      if (!anchor || anchor.getAttribute('target') === '_blank') return;
      const destination = new URL(anchor.getAttribute('href')!, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
      reviewedClicks.add(event);
      if (!window.confirm('Há alterações não salvas. Deseja sair desta seção?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onNavigate, true);
    return () => { window.removeEventListener('beforeunload', onBeforeUnload); document.removeEventListener('click', onNavigate, true); };
  }, [dirty]);
}
