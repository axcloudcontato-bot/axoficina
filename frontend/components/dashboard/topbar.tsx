'use client';

import { usePathname } from 'next/navigation';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Bell, Car, CalendarBlank, ChartBar, ChartLine, ClipboardText, Heart, Package, ShieldCheck, SquaresFour, Users, UsersThree } from '@phosphor-icons/react';
import { HeaderDock } from '@/components/dashboard/header-dock';

interface PageMeta { title: string; description: string; icon: PhosphorIcon }

const PAGE_META: Record<string, PageMeta> = {
  '/relacionamento': { title: 'Cuidado com o cliente', description: 'Presença, prevenção e carinho em cada retorno.', icon: Heart },
  '/admin/assinaturas': { title: 'Administração do SaaS', description: 'Gestão global das assinaturas de todas as oficinas.', icon: ShieldCheck },
  '/painel': { title: 'Visão da oficina', description: 'O que precisa da sua atenção hoje.', icon: SquaresFour },
  '/financeiro': { title: 'Financeiro', description: 'Indicadores financeiros e desempenho da oficina.', icon: ChartLine },
  '/agenda': { title: 'Agenda', description: 'Organize os atendimentos da oficina.', icon: CalendarBlank },
  '/clientes': { title: 'Clientes', description: 'Gerencie os clientes da sua oficina.', icon: Users },
  '/veiculos': { title: 'Veículos', description: 'Gerencie os veículos cadastrados da sua oficina.', icon: Car },
  '/ordens-de-servico': { title: 'Ordens de Serviço', description: 'Acompanhe o atendimento dos veículos da sua oficina.', icon: ClipboardText },
  '/catalogo': { title: 'Peças, produtos e serviços', description: 'Catálogo padrão para montar orçamentos mais rápido.', icon: Package },
  '/produtividade': { title: 'Produtividade', description: 'OS entregues, mão de obra gerada e carga por técnico.', icon: ChartBar },
  '/alertas-de-manutencao': { title: 'Alertas de manutenção', description: 'Acompanhe os contatos preventivos pendentes.', icon: Bell },
  '/usuarios': { title: 'Equipe e acesso', description: 'Gerencie usuários, perfis e permissões.', icon: UsersThree },
  '/configuracoes/privacidade': { title: 'Privacidade e solicitações', description: 'Seus dados, direitos e protocolos de atendimento.', icon: ShieldCheck },
};

const PREFIX_PAGE_META: Array<{ prefix: string } & PageMeta> = [
  { prefix: '/financeiro/', title: 'Financeiro', description: 'Fluxo de caixa, lançamentos, categorias e relatórios.', icon: ChartLine },
  { prefix: '/ordens-de-servico/', title: 'Ordem de Serviço', description: 'Detalhes, status e histórico desta ordem de serviço.', icon: ClipboardText },
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
    <header className="flex min-h-16 shrink-0 flex-col items-stretch justify-between gap-3 border-b border-border bg-bg px-4 py-3 sm:px-6 xl:flex-row xl:items-center">
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
