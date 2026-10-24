'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import useMeasure from 'react-use-measure';
import { useTheme } from 'next-themes';
import { Bell, Desktop, Gear, MagnifyingGlass, Moon, SignOut, Sun, UserCircle, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/features/auth/permissions';
import { useLogout } from '@/features/auth/hooks/use-auth';
import { useMaintenanceAlertsList } from '@/features/maintenance-alerts/hooks/use-maintenance-alerts';
import { useDueServiceOrderInstallments, useServiceOrdersList } from '@/features/service-orders/hooks/use-service-orders';
import { useAuthStore } from '@/stores/auth-store';

type View = 'default' | 'search' | 'alerts' | 'theme' | 'profile';

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrador', MANAGER: 'Gestor', MECHANIC: 'Mecânico', FRONT_DESK: 'Recepção' };
const THEME_OPTIONS: Array<{ key: 'light' | 'dark' | 'system'; icon: PhosphorIcon; label: string }> = [
  { key: 'light', icon: Sun, label: 'Claro' },
  { key: 'dark', icon: Moon, label: 'Escuro' },
  { key: 'system', icon: Desktop, label: 'Sistema' },
];

const rowClass = 'group flex min-h-9 w-full items-center gap-2.5 rounded-button px-3 py-2 text-left text-sm font-semibold text-text-muted transition-colors duration-fast hover:bg-muted hover:text-text';

export function HeaderDock() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelRef, panelBounds] = useMeasure();
  const [hiddenRef, hiddenBounds] = useMeasure();
  const [view, setView] = useState<View>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const { resolvedTheme, theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const alerts = useMaintenanceAlertsList({ offset: 0, limit: 1, status: 'OPEN' });
  const canManageReceipts = hasPermission(user, 'receipts.manage');
  const dueInstallments = useDueServiceOrderInstallments(canManageReceipts ? 1 : 0);
  const maintenanceAlertCount = alerts.data?.total ?? 0;
  const financialAlertCount = canManageReceipts ? (dueInstallments.data?.total ?? 0) : 0;
  const openAlertCount = maintenanceAlertCount + financialAlertCount;
  const financialAlertHref = financialAlertCount > 0 && dueInstallments.data?.items[0]
    ? `/service-orders/${dueInstallments.data.items[0].serviceOrderId}`
    : '/financial';

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => clearTimeout(timeout);
  }, [searchQuery]);
  // Limpa o termo ao fechar pra próxima abertura começar vazia, não com a
  // última busca.
  useEffect(() => {
    if (view !== 'search') { setSearchQuery(''); setDebouncedSearch(''); }
  }, [view]);
  const searchResults = useServiceOrdersList(
    { offset: 0, limit: 8, search: debouncedSearch },
    { enabled: view === 'search' && debouncedSearch.length >= 2 },
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setView('default');
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const ThemeIcon = mounted ? (THEME_OPTIONS.find((option) => option.key === theme)?.icon ?? (resolvedTheme === 'dark' ? Moon : Sun)) : Sun;

  const content = useMemo(() => {
    switch (view) {
      case 'search': {
        const searched = debouncedSearch.length >= 2;
        // `useServiceOrdersList` usa `placeholderData: (prev) => prev` (pra
        // paginação não piscar vazia) — sem essa guarda, reabrir a busca
        // mostraria por um instante o resultado da busca ANTERIOR mesmo com
        // a caixa vazia, porque o React Query devolve esse placeholder
        // enquanto a query atual (desabilitada) não tem dado próprio.
        const items = searched ? (searchResults.data?.items ?? []) : [];
        return <div className="w-[320px] p-2">
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Placa, cliente ou nº da OS"
              aria-label="Buscar ordens de serviço"
              className="h-10 w-full rounded-button border border-border bg-bg pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="mt-2 max-h-72 space-y-0.5 overflow-y-auto" aria-live="polite">
            {!searched && <p className="px-3 py-6 text-center text-xs text-text-muted">Digite ao menos 2 caracteres.</p>}
            {searched && searchResults.isFetching && <p className="px-3 py-6 text-center text-xs text-text-muted">Buscando...</p>}
            {searched && !searchResults.isFetching && items.length === 0 && <p className="px-3 py-6 text-center text-xs text-text-muted">Nenhuma OS encontrada.</p>}
            {items.map((item) => (
              <Link key={item.id} href={`/service-orders/${item.id}`} className={rowClass} onClick={() => setView('default')}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-text">{item.vehicleBrand} {item.vehicleModel} · {item.vehiclePlate}</span>
                  <span className="mt-0.5 block truncate text-xs text-text-muted">{item.customerName} · OS #{String(item.orderNumber).padStart(5, '0')}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>;
      }

      case 'alerts':
        return <div className="min-w-[250px] space-y-0.5 p-1.5">
          {openAlertCount === 0 && <p className="px-3 py-2 text-sm text-text-muted">Nenhum alerta pendente.</p>}
          {maintenanceAlertCount > 0 && <Link href="/maintenance-alerts" className={rowClass} onClick={() => setView('default')}>Alertas de manutenção<span className="ml-auto rounded-pill bg-warning-subtle px-2 py-0.5 text-xs font-bold text-warning-strong">{maintenanceAlertCount}</span></Link>}
          {financialAlertCount > 0 && <Link href={financialAlertHref} className={rowClass} onClick={() => setView('default')}>Parcelas vencidas<span className="ml-auto rounded-pill bg-danger-subtle px-2 py-0.5 text-xs font-bold text-danger-strong">{financialAlertCount}</span></Link>}
        </div>;

      case 'theme':
        return <div className="flex min-w-[250px] items-center justify-between gap-1.5 p-1.5">
          {THEME_OPTIONS.map(({ key, icon: Icon, label }) => <button key={key} type="button" onClick={() => setTheme(key)} className={cn('flex flex-1 flex-col items-center gap-1.5 rounded-button px-3 py-2.5 text-xs font-semibold transition-colors duration-fast', theme === key ? 'bg-selection text-accent-foreground' : 'text-text-muted hover:bg-muted hover:text-text')}><Icon className="size-[18px]" aria-hidden="true" />{label}</button>)}
        </div>;

      case 'profile':
        return <div className="min-w-[230px] p-1.5">
          {user && <div className="px-3 py-2"><p className="truncate text-sm font-bold text-text">{user.name}</p><p className="text-xs text-text-muted">{ROLE_LABELS[user.profileName ?? ''] ?? user.profileName ?? ROLE_LABELS[user.role] ?? user.role}</p></div>}
          {hasPermission(user, 'settings.view') && <><div className="my-1 h-px bg-border" /><Link href="/settings/company" className={rowClass} onClick={() => setView('default')}><Gear className="size-[18px]" aria-hidden="true" />Configurações</Link></>}
          <div className="my-1 h-px bg-border" />
          <button type="button" onClick={() => logout.mutate()} className={cn(rowClass, 'text-danger hover:bg-danger-subtle hover:text-danger')}><SignOut className="size-[18px]" aria-hidden="true" />Sair</button>
        </div>;

      default:
        return null;
    }
  }, [view, searchQuery, debouncedSearch, searchResults.data, searchResults.isFetching, openAlertCount, maintenanceAlertCount, financialAlertCount, financialAlertHref, theme, user, logout]);

  return <div ref={containerRef} className="relative flex items-center">
    <div ref={hiddenRef} style={{ visibility: 'hidden' }} className="pointer-events-none absolute left-0 top-0">
      <div className="rounded-card border border-border bg-popover py-1">{content}</div>
    </div>

    <AnimatePresence>
      {view !== 'default' && <motion.div
        key="dock-panel"
        initial={{ opacity: 0, scale: 0.95, height: 0, width: 0 }}
        animate={{ opacity: 1, scale: 1, height: hiddenBounds.height || 'auto', width: hiddenBounds.width || 'auto' }}
        exit={{ opacity: 0, scale: 0.95, height: 0, width: 0 }}
        transition={{ duration: 0.2, ease: [0.42, 0, 0.58, 1] }}
        style={{ transformOrigin: 'top right', top: 'calc(100% + 10px)' }}
        className="absolute right-0 z-20 overflow-hidden rounded-card border border-border bg-popover shadow-popover"
      >
        <div ref={panelRef}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="py-1">
              {content}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>}
    </AnimatePresence>

    <div className="flex items-center gap-1 rounded-pill border border-border bg-card p-1">
      <button type="button" aria-label="Buscar ordens de serviço" onClick={() => setView(view === 'search' ? 'default' : 'search')} className={cn('flex size-9 items-center justify-center rounded-pill transition-colors duration-fast', view === 'search' ? 'bg-selection text-accent-foreground' : 'text-text-muted hover:bg-muted hover:text-text')}><MagnifyingGlass className="size-[18px]" aria-hidden="true" /></button>
      <button type="button" aria-label="Alertas" onClick={() => setView(view === 'alerts' ? 'default' : 'alerts')} className={cn('relative flex size-9 items-center justify-center rounded-pill transition-colors duration-fast', view === 'alerts' ? 'bg-selection text-accent-foreground' : 'text-text-muted hover:bg-muted hover:text-text')}>
        <Bell className="size-[18px]" aria-hidden="true" />
        {openAlertCount > 0 && <span data-testid="open-alert-indicator" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-warning" aria-hidden="true" />}
      </button>
      <button type="button" aria-label="Tema" onClick={() => setView(view === 'theme' ? 'default' : 'theme')} className={cn('flex size-9 items-center justify-center rounded-pill transition-colors duration-fast', view === 'theme' ? 'bg-selection text-accent-foreground' : 'text-text-muted hover:bg-muted hover:text-text')}><ThemeIcon className="size-[18px]" aria-hidden="true" /></button>
      {user && <button type="button" aria-label="Perfil" onClick={() => setView(view === 'profile' ? 'default' : 'profile')} className={cn('flex size-9 items-center justify-center rounded-pill transition-colors duration-fast', view === 'profile' ? 'bg-selection text-accent-foreground' : 'text-text-muted hover:bg-muted hover:text-text')}><UserCircle className="size-[18px]" aria-hidden="true" /></button>}
    </div>
  </div>;
}
