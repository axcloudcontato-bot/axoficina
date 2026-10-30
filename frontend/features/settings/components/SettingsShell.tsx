'use client';

import { Buildings, ClockCounterClockwise, CreditCard, Envelope, UsersThree, ShieldCheck, WhatsappLogo, SquaresFour, Clock, UserCircle, Lock } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';
import { useEntitlements } from '@/features/plan/use-entitlements';

const items = [
  { href: '/configuracoes', label: 'Visão geral', description: 'Estado das configurações', icon: SquaresFour, permission: null },
  { href: '/configuracoes/empresa', label: 'Empresa e marca', description: 'Identidade e documentos', icon: Buildings, permission: 'settings.view' as const },
  { href: '/configuracoes/operacao', label: 'Operação', description: 'Agenda e fotos', icon: Clock, permission: 'settings.view' as const },
  { href: '/configuracoes/email', label: 'E-mail', description: 'Servidor e remetente', icon: Envelope, permission: 'settings.view' as const },
  { href: '/configuracoes/whatsapp', label: 'WhatsApp', description: 'Conexão com WA-AKG', icon: WhatsappLogo, permission: 'settings.view' as const, module: 'whatsapp' as const },
  { href: '/configuracoes/equipe', label: 'Equipe e acesso', description: 'Usuários e permissões', icon: UsersThree, permission: 'team.view' as const },
  { href: '/configuracoes/assinatura', label: 'Assinatura e dados', description: 'Plano e exportação', icon: CreditCard, permission: 'settings.manage' as const },
  { href: '/configuracoes/historico', label: 'Histórico', description: 'Quem alterou o quê', icon: ClockCounterClockwise, permission: 'settings.manage' as const, module: 'governanca' as const },
  { href: '/configuracoes/privacidade-da-oficina', label: 'Privacidade da oficina', description: 'Protocolos dos clientes', icon: ShieldCheck, permission: 'settings.manage' as const },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { hasModule } = useEntitlements();
  // The personal area (my account, my privacy) is for everyone and has its own tabs.
  const privacy = pathname === '/configuracoes/privacidade' || pathname === '/configuracoes/conta';
  const tabs = privacy ? [{ href: '/configuracoes/conta', label: 'Minha conta', icon: UserCircle }, { href: '/configuracoes/privacidade', label: 'Privacidade e solicitações', icon: ShieldCheck }] : items.filter((item) => (item.permission === null || hasPermission(user, item.permission)) && (!['/configuracoes/privacidade-da-oficina', '/configuracoes/assinatura', '/configuracoes/historico'].includes(item.href) || user?.role === 'ADMIN'));
  return <div className="space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{privacy ? 'Minha conta' : 'Administração'}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-text">{privacy ? 'Minha conta' : 'Configurações'}</h1>
      <p className="mt-1 text-sm text-text-muted">{privacy ? 'Sua senha, seus dados e seus pedidos de privacidade.' : 'Personalize a oficina, as comunicações e o acesso da equipe.'}</p>
      {privacy && (hasPermission(user, 'settings.view') || hasPermission(user, 'team.view')) && <Link href="/configuracoes" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Voltar às configurações</Link>}
    </header>
    <nav aria-label="Seções das configurações" className="flex flex-wrap gap-x-0.5 border-b border-border">
      {tabs.map((tab) => {
        const { href, label, icon: Icon } = tab;
        const locked = 'module' in tab && !hasModule(tab.module);
        const active = pathname === href;
        return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-bold transition-colors', active ? 'border-primary text-primary-strong' : 'border-transparent text-text-muted hover:border-border hover:text-text')}>
          <Icon className="size-[18px] shrink-0" aria-hidden="true" />
          {label}
          {locked && <Lock className="size-3.5" aria-label="Fora do plano" />}
        </Link>;
      })}
    </nav>
    <div className="min-w-0">{children}</div>
  </div>;
}
