'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { useTheme } from 'next-themes';
import { Bell, Desktop, Gear, Keyboard, MagnifyingGlass, Moon, SignOut, Sparkle, Sun, UserCircle, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { focusableElements, isTextInput, restoreFocus } from '@/lib/keyboard';
import { NAVIGATION_DESTINATIONS, normalizeNavigationSearch } from '@/lib/navigation';
import { hasPermission } from '@/features/auth/permissions';
import { useLogout } from '@/features/auth/hooks/use-auth';
import { useMaintenanceAlertsList } from '@/features/maintenance-alerts/hooks/use-maintenance-alerts';
import { useDueServiceOrderInstallments, useServiceOrdersList } from '@/features/service-orders/hooks/use-service-orders';
import { useAuthStore } from '@/stores/auth-store';
import { useCustomerReplyNotifications } from '@/features/notifications/hooks/use-customer-reply-notifications';
import { CustomerReplyNotifications } from '@/features/notifications/components/CustomerReplyNotifications';
import { SystemUpdates } from '@/features/updates/SystemUpdates';
import { useSystemUpdates } from '@/features/updates/use-system-updates';

type View = 'default' | 'search' | 'alerts' | 'theme' | 'profile' | 'help' | 'updates';
const VIEW_LABELS = { search: 'Buscar e navegar', alerts: 'Alertas', theme: 'Escolher tema', profile: 'Perfil', help: 'Atalhos de teclado', updates: 'Novidades do sistema' };
const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrador', MANAGER: 'Gestor', MECHANIC: 'Mecânico', FRONT_DESK: 'Recepção' };
const THEME_OPTIONS: Array<{ key: 'light' | 'dark' | 'system'; icon: PhosphorIcon; label: string }> = [
  { key: 'light', icon: Sun, label: 'Claro' }, { key: 'dark', icon: Moon, label: 'Escuro' }, { key: 'system', icon: Desktop, label: 'Sistema' },
];
const rowClass = 'group flex min-h-9 w-full items-center gap-2.5 rounded-button px-3 py-2 text-left text-sm font-semibold text-text-muted transition-colors duration-fast hover:bg-muted hover:text-text';

export function HeaderDock() {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const initialFocus = useRef<'first' | 'last' | 'search'>('first');
  const panelId = useId();
  const pathname = usePathname();
  const [view, setView] = useState<View>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const { resolvedTheme, theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const updates = useSystemUpdates(view === 'updates');
  useEffect(() => setMounted(true), []);

  const closePanel = useCallback((restore = false) => {
    setView('default');
    if (restore) requestAnimationFrame(() => restoreFocus(returnFocus.current));
  }, []);
  const openPanel = useCallback((next: Exclude<View, 'default'>, edge?: 'first' | 'last') => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialFocus.current = edge ?? (next === 'search' ? 'search' : 'first');
    setView(next);
  }, []);
  useEffect(() => { closePanel(); setSearchQuery(''); setDebouncedSearch(''); }, [pathname, closePanel]);
  useEffect(() => {
    if (view === 'default') return;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const items = focusableElements(panel);
      (initialFocus.current === 'search' ? searchRef.current : initialFocus.current === 'last' ? items.at(-1) ?? panel : items[0] ?? panel)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => clearTimeout(timeout);
  }, [searchQuery]);
  useEffect(() => {
    function clickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) closePanel();
    }
    function shortcut(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey)) return;
      if (document.querySelector('[role="dialog"][data-state="open"]:not([data-page])') || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
      const next = event.key.toLowerCase() === 'k' ? 'search' : event.key === '/' ? 'help' : null;
      if (!next) return;
      event.preventDefault();
      if (next === 'search') {
        openPanel('search');
        requestAnimationFrame(() => { searchRef.current?.focus(); searchRef.current?.select(); });
      } else if (view === next) closePanel(true); else openPanel(next);
    }
    document.addEventListener('mousedown', clickOutside);
    document.addEventListener('keydown', shortcut);
    return () => { document.removeEventListener('mousedown', clickOutside); document.removeEventListener('keydown', shortcut); };
  }, [view, closePanel, openPanel]);

  const alerts = useMaintenanceAlertsList({ offset: 0, limit: 1, status: 'OPEN' });
  const openNotifications = useCallback(() => openPanel('alerts'), [openPanel]);
  const replies = useCustomerReplyNotifications(openNotifications);
  const canManageReceipts = hasPermission(user, 'receipts.manage');
  const dueInstallments = useDueServiceOrderInstallments(canManageReceipts ? 1 : 0);
  const maintenanceAlertCount = alerts.data?.total ?? 0;
  const financialAlertCount = canManageReceipts ? (dueInstallments.data?.total ?? 0) : 0;
  const openAlertCount = maintenanceAlertCount + financialAlertCount + replies.unreadCount;
  const financialAlertHref = financialAlertCount > 0 && dueInstallments.data?.items[0] ? `/ordens-de-servico/${dueInstallments.data.items[0].serviceOrderId}` : '/financeiro';
  const canSearchOrders = hasPermission(user, 'service_orders.view');
  const searchResults = useServiceOrdersList({ offset: 0, limit: 8, search: debouncedSearch }, { enabled: view === 'search' && debouncedSearch.length >= 2 && canSearchOrders });
  const searched = debouncedSearch.length >= 2 && searchQuery.trim() === debouncedSearch && canSearchOrders;
  const orders = searched ? searchResults.data?.items ?? [] : [];
  const pages = NAVIGATION_DESTINATIONS.filter((item) => (!item.permission || hasPermission(user, item.permission)) && normalizeNavigationSearch(item.label).includes(normalizeNavigationSearch(searchQuery)));
  const ThemeIcon = mounted ? (THEME_OPTIONS.find((option) => option.key === theme)?.icon ?? (resolvedTheme === 'dark' ? Moon : Sun)) : Sun;

  function searchKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' && view === 'search') { event.preventDefault(); closePanel(true); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (view !== 'search') openPanel('search', event.key === 'ArrowDown' ? 'first' : 'last');
    else if (panelRef.current) {
      const items = focusableElements(panelRef.current);
      (event.key === 'ArrowDown' ? items[0] : items.at(-1))?.focus();
    }
  }

  function panelKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || !panelRef.current) return;
    const items = focusableElements(panelRef.current);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(true); return; }
    if (event.key === 'Tab' && ((event.shiftKey && index <= 0) || (!event.shiftKey && index === items.length - 1))) {
      event.preventDefault();
      const origin = returnFocus.current;
      closePanel();
      if (event.shiftKey) restoreFocus(origin);
      else {
        const outside = focusableElements(document).filter((item) => !panelRef.current?.contains(item));
        const next = origin ? outside[outside.indexOf(origin) + 1] : undefined;
        (next ?? origin)?.focus();
      }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const forward = event.key === 'ArrowDown' || (view === 'theme' && event.key === 'ArrowRight');
    const backward = event.key === 'ArrowUp' || (view === 'theme' && event.key === 'ArrowLeft');
    const home = event.key === 'Home' && !isTextInput(event.target);
    const end = event.key === 'End' && !isTextInput(event.target);
    if (items.length && (forward || backward || home || end)) {
      event.preventDefault();
      const next = home ? 0 : end ? items.length - 1 : (index + (forward ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  }
  function triggerKeys(event: KeyboardEvent<HTMLButtonElement>, next: Exclude<View, 'default'>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (view === next && panelRef.current) {
      const items = focusableElements(panelRef.current);
      (event.key === 'ArrowDown' ? items[0] : items.at(-1))?.focus();
    } else openPanel(next, event.key === 'ArrowDown' ? 'first' : 'last');
  }
  function trigger(next: Exclude<View, 'default'>, label: string, Icon: PhosphorIcon) {
    return <button key={next} type="button" title={label} aria-label={label} aria-expanded={view === next} aria-controls={view === next ? panelId : undefined} aria-haspopup="dialog" aria-keyshortcuts={next === 'help' ? 'Control+/ Meta+/' : undefined} onKeyDown={(event) => triggerKeys(event, next)} onClick={() => view === next ? closePanel(true) : openPanel(next)} className={cn('relative flex size-9 items-center justify-center rounded-pill transition-colors duration-fast', view === next ? 'bg-selection text-accent-foreground' : 'text-text-muted hover:bg-muted hover:text-text')}>
      <Icon className="size-[18px]" aria-hidden="true" />{next === 'alerts' && openAlertCount > 0 && <span data-testid="open-alert-indicator" className="absolute -right-1 -top-1 min-w-4 rounded-pill bg-warning px-1 text-center text-[10px] font-bold leading-4 text-black"><span className="sr-only">Notificações pendentes: </span>{openAlertCount > 99 ? '99+' : openAlertCount}</span>}
      {next === 'updates' && updates.unread && <span data-testid="unread-updates-indicator" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary"><span className="sr-only">Novidades disponíveis</span></span>}
    </button>;
  }

  return <div ref={containerRef} className="relative flex w-full flex-wrap items-center gap-2 xl:w-[min(44rem,70%)]" onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) closePanel(); }}>
    <div className="order-2 flex min-w-0 flex-1 basis-full items-center rounded-pill border border-border bg-card pr-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring sm:order-1 sm:basis-52">
      <button type="button" aria-label="Buscar ordens de serviço" title="Buscar (Ctrl+K)" aria-keyshortcuts="Control+k Meta+k" className="flex size-10 shrink-0 items-center justify-center rounded-pill text-text-muted hover:text-text" onClick={() => { openPanel('search'); searchRef.current?.focus(); }}><MagnifyingGlass className="size-[18px]" aria-hidden="true" /></button>
      <input ref={searchRef} value={searchQuery} aria-label="Buscar páginas e ordens de serviço" aria-haspopup="dialog" aria-controls={view === 'search' ? panelId : undefined} placeholder="Cliente, placa, CPF ou página..." onClick={() => { if (view !== 'search') openPanel('search'); }} onChange={(event) => { setSearchQuery(event.target.value); if (view !== 'search') openPanel('search'); }} onKeyDown={searchKeys} className="h-10 min-w-0 flex-1 rounded-pill bg-transparent text-sm text-text outline-none placeholder:text-text-muted" />
    </div>
    <div role="group" aria-label="Ações do cabeçalho" className="order-1 ml-auto flex shrink-0 items-center gap-1 rounded-pill border border-border bg-card p-1 sm:order-2">
      {trigger('alerts', 'Alertas', Bell)}{trigger('updates', 'Novidades do sistema', Sparkle)}{trigger('theme', 'Tema', ThemeIcon)}
      {user && trigger('profile', 'Perfil', UserCircle)}{trigger('help', 'Atalhos de teclado', Keyboard)}
    </div>
      {view !== 'default' && <motion.div key="dock-panel" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="absolute right-0 top-[calc(100%+10px)] z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-border bg-popover shadow-popover">
        <div ref={panelRef} id={panelId} role="dialog" aria-label={VIEW_LABELS[view]} tabIndex={-1} onKeyDown={panelKeys} className="max-h-[calc(100dvh-13rem)] overflow-y-auto p-2 sm:max-h-[calc(100dvh-10rem)] xl:max-h-[calc(100dvh-7rem)]">
          {view === 'search' && <>
            <p className="px-3 py-2 text-xs text-text-muted">Ctrl+K ou ⌘K · Setas para navegar · Enter para abrir · Esc para fechar</p>
            <nav aria-label="Páginas do sistema"><p className="px-3 py-2 text-xs font-bold uppercase text-text-muted">Navegar para</p>{pages.map((item) => <Link key={item.href} href={item.href} className={rowClass} onClick={() => closePanel()}>{item.label}</Link>)}{!pages.length && <p className="px-3 py-2 text-xs text-text-muted">Nenhuma página encontrada.</p>}</nav>
            {canSearchOrders && <div className="mt-2 border-t border-border pt-2"><p className="px-3 py-2 text-xs font-bold uppercase text-text-muted">Ordens de serviço</p><div role="status" className="px-3 text-xs text-text-muted">{!searched ? 'Digite ao menos 2 caracteres para buscar uma OS.' : searchResults.isFetching ? 'Buscando...' : searchResults.isError ? 'Não foi possível pesquisar. Tente novamente.' : !orders.length ? 'Nenhuma OS encontrada.' : `${orders.length} ordens encontradas.`}</div>{!searchResults.isFetching && !searchResults.isError && orders.map((item) => <Link key={item.id} href={`/ordens-de-servico/${item.id}`} className={rowClass} onClick={() => closePanel()}><span className="min-w-0 flex-1"><span className="block truncate font-bold text-text">{item.customerName}</span><span className="mt-0.5 block truncate text-xs text-text-muted">{item.vehicleBrand} {item.vehicleModel} · {item.vehiclePlate} · OS #{String(item.orderNumber).padStart(5, '0')}</span></span></Link>)}</div>}
          </>}
          {view === 'alerts' && <><CustomerReplyNotifications notifications={replies} onOpen={() => closePanel()} />{maintenanceAlertCount + financialAlertCount === 0 && <p className="px-3 py-2 text-sm text-text-muted">Nenhum alerta de manutenção ou financeiro pendente.</p>}{maintenanceAlertCount > 0 && <Link href="/alertas-de-manutencao" className={rowClass} onClick={() => closePanel()}>Alertas de manutenção<span className="ml-auto text-xs font-bold text-warning-strong">{maintenanceAlertCount}</span></Link>}{financialAlertCount > 0 && <Link href={financialAlertHref} className={rowClass} onClick={() => closePanel()}>Parcelas vencidas<span className="ml-auto text-xs font-bold text-danger-strong">{financialAlertCount}</span></Link>}</>}
          {view === 'theme' && <div role="group" aria-label="Tema da interface" className="flex gap-1.5">{THEME_OPTIONS.map(({ key, icon: Icon, label }) => <button key={key} type="button" aria-pressed={theme === key} onClick={() => setTheme(key)} className={cn('flex flex-1 flex-col items-center gap-1.5 rounded-button px-3 py-2.5 text-xs font-semibold', theme === key ? 'bg-selection text-accent-foreground' : 'text-text-muted hover:bg-muted hover:text-text')}><Icon className="size-[18px]" aria-hidden="true" />{label}</button>)}</div>}
          {view === 'updates' && <SystemUpdates />}
          {view === 'profile' && <>{user && <div className="px-3 py-2"><p className="truncate text-sm font-bold text-text">{user.name}</p><p className="text-xs text-text-muted">{ROLE_LABELS[user.profileName ?? ''] ?? user.profileName ?? ROLE_LABELS[user.role] ?? user.role}</p></div>}{hasPermission(user, 'settings.view') && <Link href="/configuracoes/empresa" className={rowClass} onClick={() => closePanel()}><Gear className="size-[18px]" aria-hidden="true" />Configurações</Link>}<Link href="/configuracoes/privacidade" className={rowClass} onClick={() => closePanel()}>Privacidade e solicitações</Link><button type="button" onClick={() => logout.mutate()} className={cn(rowClass, 'text-danger hover:bg-danger-subtle')}><SignOut className="size-[18px]" aria-hidden="true" />Sair</button></>}
          {view === 'help' && <div className="space-y-4 p-3 text-sm"><h2 className="font-bold">Atalhos de teclado</h2><dl className="space-y-3"><div><dt className="font-semibold">Ctrl+K / ⌘K</dt><dd className="text-text-muted">Buscar e acessar páginas e ordens de serviço.</dd></div><div><dt className="font-semibold">Ctrl+/ / ⌘/</dt><dd className="text-text-muted">Abrir esta ajuda.</dd></div><div><dt className="font-semibold">Tab / Shift+Tab</dt><dd className="text-text-muted">Avançar ou voltar entre os controles.</dd></div><div><dt className="font-semibold">Enter / Espaço</dt><dd className="text-text-muted">Ativar links e botões conforme o controle.</dd></div><div><dt className="font-semibold">Setas</dt><dd className="text-text-muted">Percorrer buscas e menus; na agenda, mudar de dia (↑ e ↓ mudam a semana).</dd></div><div><dt className="font-semibold">Escape</dt><dd className="text-text-muted">Fechar sugestões, menus ou a janela atual e retornar ao controle anterior.</dd></div></dl><button type="button" className={rowClass} onClick={() => closePanel(true)}>Fechar atalhos</button></div>}
        </div>
      </motion.div>}
  </div>;
}
