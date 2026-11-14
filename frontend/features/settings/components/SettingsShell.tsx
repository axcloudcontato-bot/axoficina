'use client';

import type { ModuleKey, PermissionKey, UserResponse } from '@oficina/contracts';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { ArrowSquareOut, Bell, Buildings, ChartBar, ClockCounterClockwise, CreditCard, Envelope, UsersThree, ShieldCheck, WhatsappLogo, SquaresFour, Clock, UserCircle, Lock, Receipt, Printer } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PageHero } from '@/components/dashboard/PageHero';
import { segmentedItem, segmentedList } from '@/components/ui/segmented';
import { canViewTeam, hasPermission } from '@/features/auth/permissions';
import { useEntitlements } from '@/features/plan/use-entitlements';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

interface SettingsItem {
  href: string; label: string; description: string; icon: PhosphorIcon;
  /** Who may open it. */
  allowed: (user: UserResponse | null) => boolean;
  module?: ModuleKey;
  /** The rule is edited next to the work it changes: the entry is a shortcut to that screen. */
  shortcut?: string;
}

const can = (permission: PermissionKey) => (user: UserResponse | null) => hasPermission(user, permission);
const ownerOnly = (permission: PermissionKey) => (user: UserResponse | null) => hasPermission(user, permission) && user?.role === 'ADMIN';
const anyone = () => true;

// Every rule of the workshop starts here, in blocks the owner recognizes.
export const SETTINGS_GROUPS: Array<{ title: string; items: SettingsItem[] }> = [
  { title: 'Oficina', items: [
    { href: '/configuracoes', label: 'Visão geral', description: 'O que falta para a oficina ficar pronta', icon: SquaresFour, allowed: anyone },
    { href: '/configuracoes/empresa', label: 'Empresa e marca', description: 'Dados, logo e documentos impressos', icon: Buildings, allowed: can('settings.view') },
    { href: '/configuracoes/operacao', label: 'Regras de trabalho', description: 'Horário, garantia, valor da hora, alertas e fotos', icon: Clock, allowed: can('settings.view') },
    { href: '/configuracoes/nota-fiscal', label: 'Nota fiscal', description: 'NFS-e, NF-e e certificado digital', icon: Receipt, allowed: can('settings.view') },
  ] },
  { title: 'Comunicação', items: [
    { href: '/configuracoes/email', label: 'E-mail', description: 'Servidor e remetente', icon: Envelope, allowed: can('settings.view') },
    { href: '/configuracoes/whatsapp', label: 'WhatsApp', description: 'Conexão com WA-AKG', icon: WhatsappLogo, allowed: can('settings.view'), module: 'whatsapp' },
    { href: '/relacionamento?aba=ajustes', label: 'Régua de lembretes', description: 'Canal, horário e limite de mensagens', icon: Bell, allowed: can('alerts.view'), module: 'cuidado', shortcut: 'Abre em Retornos e lembretes' },
  ] },
  { title: 'Equipe', items: [
    { href: '/configuracoes/equipe', label: 'Usuários e permissões', description: 'Convites, perfis e acessos', icon: UsersThree, allowed: canViewTeam },
    { href: '/produtividade', label: 'Metas e comissões', description: 'Metas do mês e percentual de cada técnico', icon: ChartBar, allowed: (user) => hasPermission(user, 'service_orders.prices') && Boolean(user && ['ADMIN', 'MANAGER'].includes(user.role)), module: 'produtividade', shortcut: 'Abre em Produtividade, junto dos resultados' },
  ] },
  { title: 'Conta da oficina', items: [
    { href: '/configuracoes/assinatura', label: 'Assinatura e dados', description: 'Plano, pagamento e exportação', icon: CreditCard, allowed: ownerOnly('settings.manage') },
    { href: '/configuracoes/historico', label: 'Histórico de alterações', description: 'Quem alterou o quê e quando', icon: ClockCounterClockwise, allowed: ownerOnly('settings.manage'), module: 'governanca' },
    { href: '/configuracoes/privacidade-da-oficina', label: 'Privacidade da oficina', description: 'Pedidos de dados dos clientes', icon: ShieldCheck, allowed: ownerOnly('settings.manage') },
  ] },
  { title: 'Este computador', items: [
    { href: '/configuracoes/impressao', label: 'Impressão', description: 'Papel e impressora deste computador', icon: Printer, allowed: anyone },
  ] },
];

const PERSONAL_TABS = [{ href: '/configuracoes/conta', label: 'Minha conta', icon: UserCircle }, { href: '/configuracoes/privacidade', label: 'Privacidade e solicitações', icon: ShieldCheck }];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { hasModule } = useEntitlements();
  // The personal area (my account, my privacy) is for everyone and has its own tabs.
  const personal = PERSONAL_TABS.some((tab) => tab.href === pathname);

  if (personal) return <div className="space-y-6">
    <PageHero eyebrow="Minha conta" title="Minha conta" description="Sua senha, seus aparelhos e seus pedidos de privacidade." actions={(hasPermission(user, 'settings.view') || canViewTeam(user)) && <Link href="/configuracoes" className="text-sm font-semibold text-primary hover:underline">Ir para as configurações da oficina</Link>} />
    <nav aria-label="Seções da minha conta" className={segmentedList}>{PERSONAL_TABS.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className={segmentedItem(pathname === href)}><Icon className="size-4 shrink-0" aria-hidden="true" />{label}</Link>)}</nav>
    <div className="min-w-0">{children}</div>
  </div>;

  const groups = SETTINGS_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => item.allowed(user)) })).filter((group) => group.items.length);
  const currentGroup = groups.find((group) => group.items.some((item) => item.href === pathname));
  const current = currentGroup?.items.find((item) => item.href === pathname);
  const isOverview = pathname === '/configuracoes';

  return <div className="space-y-6">
    <PageHero eyebrow={isOverview || !currentGroup ? 'Configurações' : `Configurações · ${currentGroup.title}`} title={isOverview ? 'Configurações' : current?.label ?? 'Configurações'} description={isOverview ? 'Todas as regras da oficina em um só lugar, separadas por assunto.' : current?.description ?? ''} />
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav aria-label="Seções das configurações" className="flex gap-4 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:block lg:space-y-5 lg:self-start lg:overflow-visible lg:pb-0">
        {groups.map((group) => <div key={group.title} className="shrink-0">
          <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">{group.title}</p>
          <ul className="flex gap-1 lg:block lg:space-y-0.5">{group.items.map((item) => {
            const Icon = item.icon;
            const active = item.href === pathname;
            const locked = item.module && !hasModule(item.module);
            return <li key={item.href}><Link href={item.href} aria-current={active ? 'page' : undefined} title={item.shortcut} className={cn('flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-button px-3 text-sm font-semibold transition-colors', active ? 'bg-primary text-primary-foreground' : 'text-text hover:bg-selection')}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {locked && <Lock className="size-3.5 shrink-0" aria-label="Fora do plano" />}
              {item.shortcut && <ArrowSquareOut className="size-3.5 shrink-0 text-text-muted" aria-label={item.shortcut} />}
            </Link></li>;
          })}</ul>
        </div>)}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  </div>;
}
