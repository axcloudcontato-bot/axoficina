'use client';

import { usePathname } from 'next/navigation';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Bell, Buildings, Car, CalendarBlank, ChartBar, ChartLine, ChatCircleText, ClipboardText, Clock, Envelope, Gear, Package, ShieldCheck, SquaresFour, Users, UsersThree, UserCircle, WhatsappLogo, CreditCard, ClockCounterClockwise, Factory, Printer, Receipt } from '@phosphor-icons/react';
import { HeaderDock } from '@/components/dashboard/header-dock';

interface PageMeta { title: string; description: string; icon: PhosphorIcon }

const PAGE_META: Record<string, PageMeta> = {
  '/relacionamento': { title: 'Retornos e lembretes', description: 'Cuidados, aniversários e mensagens automáticas.', icon: Bell },
  '/admin/assinaturas': { title: 'Administração do SaaS', description: 'Gestão global das assinaturas de todas as oficinas.', icon: ShieldCheck },
  '/painel': { title: 'Visão da oficina', description: 'O que precisa da sua atenção hoje.', icon: SquaresFour },
  '/financeiro': { title: 'Financeiro', description: 'Indicadores financeiros e desempenho da oficina.', icon: ChartLine },
  '/agenda': { title: 'Agenda', description: 'Organize os atendimentos da oficina.', icon: CalendarBlank },
  '/chat': { title: 'Chat WhatsApp', description: 'Converse com os clientes sem sair do Ofix.', icon: WhatsappLogo },
  '/clientes': { title: 'Clientes', description: 'Gerencie os clientes da sua oficina.', icon: Users },
  '/veiculos': { title: 'Veículos', description: 'Gerencie os veículos cadastrados da sua oficina.', icon: Car },
  '/ordens-de-servico': { title: 'Ordens de serviço', description: 'Acompanhe o atendimento dos veículos da sua oficina.', icon: ClipboardText },
  '/catalogo': { title: 'Peças e serviços', description: 'O que a oficina vende, para montar orçamentos mais rápido.', icon: Package },
  '/financeiro/fornecedores': { title: 'Fornecedores', description: 'De quem a oficina compra.', icon: Factory },
  '/produtividade': { title: 'Produtividade', description: 'OS entregues, mão de obra gerada e carga por técnico.', icon: ChartBar },
  '/suporte': { title: 'Suporte', description: 'Abra e acompanhe seus chamados com a equipe Ofix.', icon: ChatCircleText },
  '/alertas-de-manutencao': { title: 'Retornos e lembretes', description: 'Carros que estão há muito tempo sem revisão.', icon: Bell },
  '/configuracoes': { title: 'Configurações', description: 'Todas as regras da oficina, por assunto.', icon: Gear },
  '/configuracoes/empresa': { title: 'Empresa e marca', description: 'Dados cadastrais e documentos.', icon: Buildings },
  '/configuracoes/operacao': { title: 'Regras de trabalho', description: 'Horário, garantia, valor da hora, alertas e fotos.', icon: Clock },
  '/configuracoes/nota-fiscal': { title: 'Nota fiscal', description: 'NFS-e, NF-e e certificado digital.', icon: Receipt },
  '/configuracoes/impressao': { title: 'Impressão', description: 'Papel e impressora deste computador.', icon: Printer },
  '/configuracoes/email': { title: 'E-mail', description: 'Servidor, remetente e teste.', icon: Envelope },
  '/configuracoes/whatsapp': { title: 'WhatsApp', description: 'Conexão e recebimento de respostas.', icon: WhatsappLogo },
  '/configuracoes/equipe': { title: 'Usuários e permissões', description: 'Convites, perfis e acessos da equipe.', icon: UsersThree },
  '/configuracoes/privacidade-da-oficina': { title: 'Privacidade da oficina', description: 'Acompanhe os protocolos dos clientes.', icon: ShieldCheck },
  '/configuracoes/assinatura': { title: 'Assinatura e dados', description: 'Seu plano e a exportação dos dados da oficina.', icon: CreditCard },
  '/configuracoes/historico': { title: 'Histórico de alterações', description: 'Quem alterou o quê e quando.', icon: ClockCounterClockwise },
  '/configuracoes/conta': { title: 'Minha conta', description: 'Seus dados de acesso e a sua senha.', icon: UserCircle },
  '/configuracoes/privacidade': { title: 'Privacidade e solicitações', description: 'Seus dados, direitos e protocolos de atendimento.', icon: ShieldCheck },
};

const PREFIX_PAGE_META: Array<{ prefix: string } & PageMeta> = [
  { prefix: '/financeiro/', title: 'Financeiro', description: 'Contas, fluxo de caixa, categorias e relatórios.', icon: ChartLine },
  { prefix: '/ordens-de-servico/', title: 'Ordem de serviço', description: 'Detalhes, status e histórico desta ordem de serviço.', icon: ClipboardText },
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
    // On a phone the dock's children join this row: title and actions on one line, search on the next.
    <header className="relative flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-border bg-bg px-4 py-2 sm:flex-col sm:flex-nowrap sm:items-stretch sm:gap-3 sm:px-6 sm:py-3 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
        {Icon && (
          <span key={pathname} data-reveal className="hidden size-9 shrink-0 items-center justify-center rounded-button bg-muted text-text-muted sm:flex">
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold leading-tight tracking-tight text-text sm:text-lg">{meta?.title}</h1>
          {meta?.description && <p className="hidden truncate text-sm text-text-muted sm:block">{meta.description}</p>}
        </div>
      </div>
      <HeaderDock />
    </header>
  );
}
