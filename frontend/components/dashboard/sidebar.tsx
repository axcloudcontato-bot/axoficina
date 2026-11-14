'use client';

import type { ModuleKey, PermissionKey } from '@oficina/contracts';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Bell, Buildings, CalendarBlank, Car, ChartBar, ChartLine, ChatCircleText, ClipboardText, DotsThree, Factory, Package, Gear, Lock, ShieldCheck, SidebarSimple, SignOut, SquaresFour, UserCircle, Users } from '@phosphor-icons/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { canViewTeam, hasPermission } from '@/features/auth/permissions';
import { useLogout } from '@/features/auth/hooks/use-auth';
import { AnimatedIcon } from '@/components/ui/animated-icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { OfixLogo } from '@/components/brand/ofix-logo';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useBranding } from '@/features/settings/hooks/use-settings';
import { useEntitlements } from '@/features/plan/use-entitlements';
import { useSaasAdminAccess } from '@/features/subscriptions/hooks/use-subscriptions';

interface NavItem {
  href: string; label: string; shortLabel: string;
  icon: PhosphorIcon;
  permission: PermissionKey;
  group: NavGroup;
  module?: ModuleKey;
  /** Other routes that belong to the same area and keep this item highlighted. */
  also?: string[];
  /** Routes under href that belong to another item. */
  except?: string[];
}

// Grouped by what the workshop is doing: today's work, the records it keeps, the customer's return and the business numbers.
type NavGroup = 'Dia a dia' | 'Cadastros' | 'Pós-venda' | 'Gestão';
const NAV_ITEMS: NavItem[] = [
  { href: '/painel', label: 'Visão da oficina', shortLabel: 'Visão', icon: SquaresFour, permission: 'dashboard.view', group: 'Dia a dia' },
  { href: '/agenda', label: 'Agenda', shortLabel: 'Agenda', icon: CalendarBlank, permission: 'appointments.view', group: 'Dia a dia' },
  { href: '/ordens-de-servico', label: 'Ordens de serviço', shortLabel: 'OS', icon: ClipboardText, permission: 'service_orders.view', group: 'Dia a dia' },
  { href: '/clientes', label: 'Clientes', shortLabel: 'Clientes', icon: Users, permission: 'customers.view', group: 'Cadastros' },
  { href: '/veiculos', label: 'Veículos', shortLabel: 'Veículos', icon: Car, permission: 'vehicles.view', group: 'Cadastros' },
  { href: '/catalogo', label: 'Peças e serviços', shortLabel: 'Peças', icon: Package, permission: 'service_orders.prices', group: 'Cadastros' },
  { href: '/financeiro/fornecedores', label: 'Fornecedores', shortLabel: 'Fornec.', icon: Factory, permission: 'finance.manage', group: 'Cadastros', module: 'financeiro' },
  { href: '/relacionamento', label: 'Retornos e lembretes', shortLabel: 'Retornos', icon: Bell, permission: 'alerts.view', group: 'Pós-venda', module: 'cuidado', also: ['/alertas-de-manutencao'] },
  { href: '/financeiro', label: 'Financeiro', shortLabel: 'Financeiro', icon: ChartLine, permission: 'finance.view', group: 'Gestão', module: 'financeiro', except: ['/financeiro/fornecedores'] },
  { href: '/produtividade', label: 'Produtividade', shortLabel: 'Produtiv.', icon: ChartBar, permission: 'service_orders.view', group: 'Gestão', module: 'produtividade' },
];
const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrador', MANAGER: 'Gestor', MECHANIC: 'Mecânico', FRONT_DESK: 'Recepção', FINANCE: 'Financeiro' };
const groups: NavGroup[] = ['Dia a dia', 'Cadastros', 'Pós-venda', 'Gestão'];
const initials = (name: string) => { const parts = name.trim().split(/\s+/); return ((parts[0]?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase(); };
const isActive = (pathname: string | null, href: string) => pathname === href || Boolean(pathname?.startsWith(`${href}/`));
const isItemActive = (pathname: string | null, item: NavItem) => (isActive(pathname, item.href) || Boolean(item.also?.some((href) => isActive(pathname, href)))) && !item.except?.some((href) => isActive(pathname, href));
// My account and my privacy live under /configuracoes but belong to the person, not to the workshop settings.
const isSettingsActive = (pathname: string | null) => isActive(pathname, '/configuracoes') && !['/configuracoes/conta', '/configuracoes/privacidade'].includes(pathname ?? '');

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const branding = useBranding();
  const saasAccess = useSaasAdminAccess();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const navigationId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const restoreToggleFocus = useRef(false);
  useEffect(() => {
    if (restoreToggleFocus.current) { toggleRef.current?.focus(); restoreToggleFocus.current = false; }
  }, [collapsed]);
  const { hasModule } = useEntitlements();
  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(user, item.permission));
  const canOpenSettings = hasPermission(user, 'settings.view') || canViewTeam(user);
  const mobilePrimaryItems = visibleItems.slice(0, 4);
  const mobileMoreItems = visibleItems.slice(4);
  const mobileMoreActive = mobileMoreItems.some((item) => isItemActive(pathname, item)) || isSettingsActive(pathname) || isActive(pathname, '/suporte') || isActive(pathname, '/admin') || isActive(pathname, '/configuracoes/conta') || isActive(pathname, '/configuracoes/privacidade');

  useEffect(() => setMobileMoreOpen(false), [pathname]);

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
    <aside className={cn('dark fixed inset-y-0 left-0 z-40 hidden h-screen shrink-0 flex-col border-r border-border bg-background text-foreground transition-[width] duration-normal md:flex', collapsed ? 'w-20' : 'w-64')}>
      <div className={cn('flex items-center py-5', collapsed ? 'justify-center px-3' : 'gap-3 px-4')}>
        {collapsed ? <OfixLogo variant="mark" className="w-9 shrink-0" /> : branding.data?.company.logoDataUrl ? <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-button bg-white"><Image src={branding.data.company.logoDataUrl} alt="" width={36} height={36} unoptimized className="size-full object-contain p-1" /></div> : null}
        {!collapsed && <div className="min-w-0 flex-1 leading-tight">{branding.data?.company.logoDataUrl ? <><p className="truncate font-bold tracking-tight text-foreground">{branding.data.company.name}</p><p className="text-xs text-muted-foreground">Gestão com Ofix</p></> : <><OfixLogo className="w-24 text-white" /><p className="mt-1 truncate text-xs text-muted-foreground">{branding.data?.company.name || 'Gestão operacional'}</p></>}</div>}
        {!collapsed && <button type="button" ref={toggleRef} aria-expanded={!collapsed} aria-controls={navigationId} onClick={toggleSidebar} aria-label="Recolher menu lateral" className="group flex size-8 items-center justify-center rounded-button text-muted-foreground hover:bg-muted hover:text-foreground"><AnimatedIcon icon={SidebarSimple} className="size-4" /></button>}
      </div>
      <nav id={navigationId} aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {saasAccess.data?.allowed && <Link href="/admin" aria-current={isActive(pathname, '/admin') ? 'page' : undefined} title={collapsed ? 'Administração do SaaS' : undefined} className={cn('mb-3 flex min-h-10 items-center rounded-button text-sm font-semibold', collapsed ? 'justify-center' : 'gap-3 px-3', isActive(pathname, '/admin') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><Buildings className="size-[18px] shrink-0" aria-hidden="true" />{!collapsed && 'Administração do SaaS'}</Link>}
        {groups.map((group) => {
          const items = visibleItems.filter((item) => item.group === group);
          return items.length ? <div key={group}>{!collapsed && <p className="px-3 pb-2 pt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group}</p>}{items.map((item) => <DesktopNavItem key={item.href} item={item} active={isItemActive(pathname, item)} collapsed={collapsed} locked={!hasModule(item.module)} />)}</div> : null;
        })}
      </nav>
      <div className="space-y-1 border-t border-border px-3 py-2">
        {canOpenSettings && <FooterLink href="/configuracoes" label="Configurações" icon={Gear} active={isSettingsActive(pathname)} collapsed={collapsed} />}
        <FooterLink href="/suporte" label="Suporte" icon={ChatCircleText} active={isActive(pathname, '/suporte')} collapsed={collapsed} />
      </div>
      {user && <div className={cn('flex items-center border-t border-border py-4', collapsed ? 'justify-center px-3' : 'gap-2.5 px-4')}><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(user.name)}</div>{!collapsed && <Link href="/configuracoes/conta" title="Minha conta: senha e aparelhos" className="min-w-0 flex-1 rounded-button hover:text-primary"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-muted-foreground">{ROLE_LABELS[user.profileName ?? ''] ?? user.profileName ?? ROLE_LABELS[user.role] ?? user.role} · Minha conta</p></Link>}<button type="button" aria-label="Sair" onClick={() => logout.mutate()} className="group flex size-9 items-center justify-center rounded-button text-muted-foreground hover:text-danger"><AnimatedIcon icon={SignOut} className="size-[18px]" /></button></div>}
      {collapsed && <button type="button" ref={toggleRef} aria-expanded={!collapsed} aria-controls={navigationId} onClick={toggleSidebar} aria-label="Expandir menu lateral" className="group absolute right-[-14px] top-5 flex size-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"><AnimatedIcon icon={SidebarSimple} className="size-3.5" /></button>}
    </aside>
    <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-40 grid h-16 border-t border-border bg-background px-2 md:hidden" style={{ gridTemplateColumns: `repeat(${mobilePrimaryItems.length + 1}, minmax(0, 1fr))` }}>
      {mobilePrimaryItems.map((item) => { const active = isItemActive(pathname, item); return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('group flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold', active ? 'text-primary' : 'text-muted-foreground')}><AnimatedIcon icon={item.icon} active={active} className="size-[18px]" /><span className="truncate">{item.shortLabel}</span></Link>; })}
      <Dialog open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
        <DialogTrigger asChild><button type="button" aria-label="Mais áreas" aria-expanded={mobileMoreOpen} className={cn('flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold', mobileMoreActive || mobileMoreOpen ? 'text-primary' : 'text-muted-foreground')}><DotsThree className="size-[18px]" aria-hidden="true" /><span>Mais</span></button></DialogTrigger>
        <DialogContent className="max-h-[85dvh] overflow-y-auto p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border p-5"><DialogTitle>Áreas do Ofix</DialogTitle></DialogHeader>
          <div className="space-y-4 px-4 pb-5">
            {groups.map((group) => {
              const items = mobileMoreItems.filter((item) => item.group === group);
              return items.length ? <section key={group}><h2 className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-text-muted">{group}</h2>{items.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setMobileMoreOpen(false)} aria-current={isItemActive(pathname, item) ? 'page' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-button px-3 text-sm font-semibold', isItemActive(pathname, item) ? 'bg-primary text-primary-foreground' : 'text-text hover:bg-muted')}><Icon className="size-[18px] shrink-0" aria-hidden="true" />{item.label}{!hasModule(item.module) && <Lock className="ml-auto size-4" aria-label="Fora do plano" />}</Link>; })}</section> : null;
            })}
            <section><h2 className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-text-muted">Ajuda e conta</h2>
              {[
                ...(canOpenSettings ? [{ href: '/configuracoes', label: 'Configurações', icon: Gear }] : []),
                { href: '/suporte', label: 'Suporte', icon: ChatCircleText },
                { href: '/configuracoes/conta', label: 'Minha conta', icon: UserCircle },
                { href: '/configuracoes/privacidade', label: 'Privacidade e solicitações', icon: ShieldCheck },
                ...(saasAccess.data?.allowed ? [{ href: '/admin', label: 'Administração do SaaS', icon: Buildings }] : []),
              ].map((item) => { const Icon = item.icon; const active = item.href === '/configuracoes' ? isSettingsActive(pathname) : isActive(pathname, item.href); return <Link key={item.href} href={item.href} onClick={() => setMobileMoreOpen(false)} aria-current={active ? 'page' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-button px-3 text-sm font-semibold', active ? 'bg-primary text-primary-foreground' : 'text-text hover:bg-muted')}><Icon className="size-[18px] shrink-0" aria-hidden="true" />{item.label}</Link>; })}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  </>;
}

function DesktopNavItem({ item, active, collapsed, locked }: { item: NavItem; active: boolean; collapsed: boolean; locked: boolean }) {
  return <div><Link href={item.href} aria-current={active ? 'page' : undefined} aria-label={item.label} title={collapsed ? item.label : undefined} className={cn('group flex min-h-10 items-center rounded-button text-sm font-semibold', collapsed ? 'justify-center' : 'gap-3 px-3', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><AnimatedIcon icon={item.icon} active={active} className="size-[18px] shrink-0" />{!collapsed && item.label}{locked && <Lock className="ml-auto size-3.5 shrink-0" aria-label="Fora do plano" />}</Link></div>;
}

function FooterLink({ href, label, icon, active, collapsed }: { href: string; label: string; icon: PhosphorIcon; active: boolean; collapsed: boolean }) {
  return <Link href={href} aria-current={active ? 'page' : undefined} aria-label={label} title={collapsed ? label : undefined} className={cn('group flex min-h-10 items-center rounded-button text-sm font-semibold', collapsed ? 'justify-center' : 'gap-3 px-3', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><AnimatedIcon icon={icon} active={active} className="size-[18px] shrink-0" />{!collapsed && label}</Link>;
}
