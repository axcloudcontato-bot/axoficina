'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLineDown, ArrowLineUp, ChartBar, BookOpen, Factory, TreeStructure, SquaresFour, Receipt } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/financeiro', label: 'Visão geral', icon: SquaresFour },
  { href: '/financeiro/contas-a-pagar', label: 'Contas a pagar', icon: ArrowLineUp },
  { href: '/financeiro/contas-a-receber', label: 'Contas a receber', icon: ArrowLineDown },
  { href: '/financeiro/fluxo-de-caixa', label: 'Fluxo de caixa', icon: ChartBar },
  { href: '/financeiro/movimentacoes', label: 'Movimentações', icon: Receipt },
  { href: '/financeiro/categorias', label: 'Categorias', icon: TreeStructure },
  { href: '/financeiro/fornecedores', label: 'Fornecedores', icon: Factory },
  { href: '/financeiro/relatorios', label: 'Relatórios', icon: BookOpen },
];

export function FinancialNav() {
  const pathname = usePathname();
  return <nav aria-label="Seções do financeiro" className="flex gap-1 overflow-x-auto rounded-card border border-border bg-card p-1.5 shadow-sm">{ITEMS.map((item) => {
    const Icon = item.icon;
    const active = pathname === item.href;
    return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('flex shrink-0 items-center gap-2 rounded-button px-3 py-2 text-sm font-semibold transition-colors', active ? 'bg-primary text-primary-foreground' : 'text-text-muted hover:bg-muted hover:text-text')}><Icon className="size-4" />{item.label}</Link>;
  })}</nav>;
}
