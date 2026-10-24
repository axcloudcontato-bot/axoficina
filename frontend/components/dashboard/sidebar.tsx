'use client';

import type { PermissionKey } from '@oficina/contracts';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Bell, Buildings, CalendarBlank, Car, ChartBar, ChartLine, ClipboardText, Envelope, Gear, SidebarSimple, SignOut, SquaresFour, Users, UsersThree, Wrench } from '@phosphor-icons/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { hasPermission } from '@/features/auth/permissions';
import { useLogout } from '@/features/auth/hooks/use-auth';
import { AnimatedIcon } from '@/components/ui/animated-icon';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useBranding } from '@/features/settings/hooks/use-settings';

interface NavItem {
  href: string; label: string; shortLabel: string;
  icon: PhosphorIcon;
  permission: PermissionKey;
  group: 'Operação' | 'Relacionamento' | 'Gestão';
  children?: Array<{ href: string; label: string; icon: PhosphorIcon; permission: PermissionKey }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Visão da oficina', shortLabel: 'Visão', icon: SquaresFour, permission: 'dashboard.view', group: 'Operação' },
  { href: '/service-orders', label: 'Ordens de serviço', shortLabel: 'OS', icon: ClipboardText, permission: 'service_orders.view', group: 'Operação' },
  { href: '/appointments', label: 'Agenda', shortLabel: 'Agenda', icon: CalendarBlank, permission: 'appointments.view', group: 'Operação' },
  { href: '/customers', label: 'Clientes', shortLabel: 'Clientes', icon: Users, permission: 'customers.view', group: 'Relacionamento' },
  { href: '/vehicles', label: 'Veículos', shortLabel: 'Veículos', icon: Car, permission: 'vehicles.view', group: 'Relacionamento' },
  { href: '/maintenance-alerts', label: 'Alertas de manutenção', shortLabel: 'Alertas', icon: Bell, permission: 'alerts.view', group: 'Relacionamento' },
  { href: '/financial', label: 'Financeiro', shortLabel: 'Financeiro', icon: ChartLine, permission: 'finance.view', group: 'Gestão' },
  { href: '/productivity', label: 'Produtividade', shortLabel: 'Produtiv.', icon: ChartBar, permission: 'service_orders.prices', group: 'Gestão' },
  { href: '/settings', label: 'Configurações', shortLabel: 'Config.', icon: Gear, permission: 'team.view', group: 'Gestão', children: [
    { href: '/settings/company', label: 'Empresa e marca', icon: Buildings, permission: 'settings.view' },
    { href: '/settings/email', label: 'E-mail', icon: Envelope, permission: 'settings.view' },
    { href: '/settings/team', label: 'Equipe e acesso', icon: UsersThree, permission: 'team.view' },
  ] },
];
const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrador', MANAGER: 'Gestor', MECHANIC: 'Mecânico', FRONT_DESK: 'Recepção' };
const groups = ['Operação', 'Relacionamento', 'Gestão'] as const;
const initials = (name: string) => { const parts = name.trim().split(/\s+/); return ((parts[0]?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase(); };
const isActive = (pathname: string | null, href: string) => pathname === href || Boolean(pathname?.startsWith(`${href}/`));

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const branding = useBranding();
  const [collapsed, setCollapsed] = useState(false);
  const navigationId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const restoreToggleFocus = useRef(false);
  useEffect(() => {
    if (restoreToggleFocus.current) { toggleRef.current?.focus(); restoreToggleFocus.current = false; }
  }, [collapsed]);
  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(user, item.permission) || item.children?.some((child) => hasPermission(user, child.permission)));

  useEffect(() => {
    const value = window.localStorage.getItem('oficina.sidebar.collapsed') === 'true';
    setCollapsed(value);
    document.documentElement.style.setProperty('--sidebar-width', value ? '5rem' : '16rem');
  }, []);

  useEffect(() => {
    const fantasyName = branding.data?.company.name?.trim();
    if (fantasyName) document.title = fantasyName;
  }, [branding.data?.company.name]);
  function toggleSidebar() {
    restoreToggleFocus.current = document.activeElement === toggleRef.current;
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('oficina.sidebar.collapsed', String(next));
      document.documentElement.style.setProperty('--sidebar-width', next ? '5rem' : '16rem');
      return next;
    });
  }

  return <>
    <aside className={cn('fixed inset-y-0 left-0 z-40 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-normal md:flex', collapsed ? 'w-20' : 'w-64')}>
      <div className={cn('flex items-center py-5', collapsed ? 'justify-center px-3' : 'gap-3 px-4')}>
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-button bg-primary text-primary-foreground shadow-sm">{branding.data?.company.logoDataUrl ? <Image src={branding.data.company.logoDataUrl} alt="" width={36} height={36} unoptimized className="size-full object-contain p-1" /> : <Wrench className="size-[18px]" />}</div>
        {!collapsed && <div className="min-w-0 flex-1 leading-tight"><p className="truncate font-bold tracking-tight text-text">{branding.data?.company.name || 'Oficina'}</p><p className="text-xs text-text-muted">Gestão operacional</p></div>}
        {!collapsed && <button type="button" ref={toggleRef} aria-expanded={!collapsed} aria-controls={navigationId} onClick={toggleSidebar} aria-label="Recolher menu lateral" className="group flex size-8 items-center justify-center rounded-button text-text-muted hover:bg-muted hover:text-text"><AnimatedIcon icon={SidebarSimple} className="size-4" /></button>}
      </div>
      <nav id={navigationId} aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {groups.map((group) => {
          const items = visibleItems.filter((item) => item.group === group);
          return items.length ? <div key={group}>{!collapsed && <p className="px-3 pb-2 pt-4 text-[11px] font-bold uppercase tracking-wider text-text-muted">{group}</p>}{items.map((item) => <DesktopNavItem key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />)}</div> : null;
        })}
      </nav>
      {user && <div className={cn('flex items-center border-t border-border py-4', collapsed ? 'justify-center px-3' : 'gap-2.5 px-4')}><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(user.name)}</div>{!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.name}</p><p className="text-xs text-text-muted">{ROLE_LABELS[user.profileName ?? ''] ?? user.profileName ?? ROLE_LABELS[user.role] ?? user.role}</p></div>}<button type="button" aria-label="Sair" onClick={() => logout.mutate()} className="group flex size-9 items-center justify-center rounded-button text-text-muted hover:text-danger"><AnimatedIcon icon={SignOut} className="size-[18px]" /></button></div>}
      {collapsed && <button type="button" ref={toggleRef} aria-expanded={!collapsed} aria-controls={navigationId} onClick={toggleSidebar} aria-label="Expandir menu lateral" className="group absolute right-[-14px] top-5 flex size-7 items-center justify-center rounded-full border border-border bg-background text-text-muted hover:text-text"><AnimatedIcon icon={SidebarSimple} className="size-3.5" /></button>}
    </aside>
    <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-border bg-background px-2 md:hidden">{visibleItems.slice(0, 5).map((item) => { const active = isActive(pathname, item.href); return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('group flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold', active ? 'text-primary' : 'text-text-muted')}><AnimatedIcon icon={item.icon} active={active} className="size-[18px]" /><span className="truncate">{item.shortLabel}</span></Link>; })}</nav>
  </>;
}

function DesktopNavItem({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const children = item.children?.filter((child) => hasPermission(user, child.permission)) ?? [];
  return <div><Link href={children[0]?.href ?? item.href} aria-current={active ? 'page' : undefined} aria-label={item.label} title={collapsed ? item.label : undefined} className={cn('group flex min-h-10 items-center rounded-button text-sm font-semibold', collapsed ? 'justify-center' : 'gap-3 px-3', active ? 'bg-selection text-accent-foreground' : 'text-text-muted hover:bg-accent/60 hover:text-text')}><AnimatedIcon icon={item.icon} active={active} className="size-[18px] shrink-0" />{!collapsed && item.label}</Link>{!collapsed && active && children.length > 0 && <div className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">{children.map((child) => { const childActive = isActive(pathname, child.href); return <Link key={child.href} href={child.href} aria-current={childActive ? 'page' : undefined} className={cn('group flex min-h-9 items-center gap-2 rounded-button px-2 text-xs font-semibold', childActive ? 'text-primary' : 'text-text-muted hover:bg-muted hover:text-text')}><AnimatedIcon icon={child.icon} active={childActive} className="size-3.5" />{child.label}</Link>; })}</div>}</div>;
}
