'use client';

import { usePathname } from 'next/navigation';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Bell, Car, CalendarBlank, ChartLine, ClipboardText, SquaresFour, Users, UsersThree } from '@phosphor-icons/react';
import { HeaderDock } from '@/components/dashboard/header-dock';

interface PageMeta { title: string; description: string; icon: PhosphorIcon }

const PAGE_META: Record<string, PageMeta> = {
  '/dashboard': { title: 'Visão da oficina', description: 'O que precisa da sua atenção hoje.', icon: SquaresFour },
  '/financial': { title: 'Financeiro', description: 'Indicadores financeiros e desempenho da oficina.', icon: ChartLine },
  '/appointments': { title: 'Agenda', description: 'Organize os atendimentos da oficina.', icon: CalendarBlank },
  '/customers': { title: 'Clientes', description: 'Gerencie os clientes da sua oficina.', icon: Users },
  '/vehicles': { title: 'Veículos', description: 'Gerencie os veículos cadastrados da sua oficina.', icon: Car },
  '/service-orders': { title: 'Ordens de Serviço', description: 'Acompanhe o atendimento dos veículos da sua oficina.', icon: ClipboardText },
  '/maintenance-alerts': { title: 'Alertas de manutenção', description: 'Acompanhe os contatos preventivos pendentes.', icon: Bell },
  '/users': { title: 'Equipe e acesso', description: 'Gerencie usuários, perfis e permissões.', icon: UsersThree },
};

const PREFIX_PAGE_META: Array<{ prefix: string } & PageMeta> = [
  { prefix: '/financial/', title: 'Financeiro', description: 'Fluxo de caixa, lançamentos, categorias e relatórios.', icon: ChartLine },
  { prefix: '/service-orders/', title: 'Ordem de Serviço', description: 'Detalhes, status e histórico desta ordem de serviço.', icon: ClipboardText },
];

function resolveMeta(pathname: string | null): PageMeta | null {
  if (!pathname) return null;
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  return PREFIX_PAGE_META.find((entry) => pathname.startsWith(entry.prefix)) ?? null;
}

export function Topbar() {
  const pathname = usePathname();
  const meta = resolveMeta(pathname);
  const Icon = meta?.icon;

  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-bg px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span key={pathname} data-reveal className="flex size-9 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted">
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-text">{meta?.title}</h1>
          {meta?.description && <p className="hidden truncate text-sm text-text-muted sm:block">{meta.description}</p>}
        </div>
      </div>
      <HeaderDock />
    </header>
  );
}
