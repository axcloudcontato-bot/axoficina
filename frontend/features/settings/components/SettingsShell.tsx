'use client';

import { Buildings, Envelope, UsersThree, ShieldCheck, WhatsappLogo } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';

const items = [
  { href: '/settings/company', label: 'Empresa e marca', description: 'Identidade e documentos', icon: Buildings, permission: 'settings.view' as const },
  { href: '/settings/email', label: 'E-mail', description: 'Servidor e remetente', icon: Envelope, permission: 'settings.view' as const },
  { href: '/settings/whatsapp', label: 'WhatsApp', description: 'Conexão com WA-AKG', icon: WhatsappLogo, permission: 'settings.view' as const },
  { href: '/settings/team', label: 'Equipe e acesso', description: 'Usuários e permissões', icon: UsersThree, permission: 'team.view' as const },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  return <div className="space-y-6">
    <header className="border-b border-border pb-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Administração</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-text">Configurações</h1>
      <p className="mt-1 text-sm text-text-muted">Personalize a oficina, as comunicações e o acesso da equipe.</p>
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label="Seções das configurações" className="flex gap-2 overflow-x-auto lg:sticky lg:top-24 lg:flex-col">
        <Link href="/settings/privacy" className={cn('flex min-w-[190px] items-center gap-3 rounded-button border px-3 py-3 lg:min-w-0', pathname === '/settings/privacy' ? 'border-primary/30 bg-primary-subtle text-primary-strong' : 'border-transparent text-text-muted hover:border-border hover:bg-muted')}><ShieldCheck className="size-5 shrink-0" aria-hidden="true" /><span><span className="block text-sm font-bold">Privacidade e solicitações</span><span className="block text-[11px]">Seus dados e direitos</span></span></Link>
        {items.filter((item) => hasPermission(user, item.permission)).map(({ href, label, description, icon: Icon }) => {
          const active = pathname === href;
          return <Link key={href} href={href} className={cn('flex min-w-[190px] items-center gap-3 rounded-button border px-3 py-3 transition-colors lg:min-w-0', active ? 'border-primary/30 bg-primary-subtle text-primary-strong' : 'border-transparent text-text-muted hover:border-border hover:bg-muted')}>
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span><span className="block text-sm font-bold">{label}</span><span className="block text-[11px]">{description}</span></span>
          </Link>;
        })}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  </div>;
}
