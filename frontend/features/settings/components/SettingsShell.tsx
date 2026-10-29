'use client';

import { Buildings, Envelope, UsersThree, ShieldCheck, WhatsappLogo } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';

const items = [
  { href: '/configuracoes/empresa', label: 'Empresa e marca', description: 'Identidade e documentos', icon: Buildings, permission: 'settings.view' as const },
  { href: '/configuracoes/email', label: 'E-mail', description: 'Servidor e remetente', icon: Envelope, permission: 'settings.view' as const },
  { href: '/configuracoes/whatsapp', label: 'WhatsApp', description: 'Conexão com WA-AKG', icon: WhatsappLogo, permission: 'settings.view' as const },
  { href: '/configuracoes/equipe', label: 'Equipe e acesso', description: 'Usuários e permissões', icon: UsersThree, permission: 'team.view' as const },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const tabs = [{ href: '/configuracoes/privacidade', label: 'Privacidade e solicitações', icon: ShieldCheck }, ...items.filter((item) => hasPermission(user, item.permission))];
  return <div className="space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Administração</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-text">Configurações</h1>
      <p className="mt-1 text-sm text-text-muted">Personalize a oficina, as comunicações e o acesso da equipe.</p>
    </header>
    <nav aria-label="Seções das configurações" className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors', active ? 'border-primary text-primary-strong' : 'border-transparent text-text-muted hover:border-border hover:text-text')}>
          <Icon className="size-[18px] shrink-0" aria-hidden="true" />
          {label}
        </Link>;
      })}
    </nav>
    <div className="min-w-0">{children}</div>
  </div>;
}
