'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLineDown, ArrowLineUp, ChartBar, BookOpen, Factory, TreeStructure, SquaresFour, Receipt } from '@phosphor-icons/react';
import { segmentedItem, segmentedList } from '@/components/ui/segmented';

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
  return <nav aria-label="Seções do financeiro" className={segmentedList}>{ITEMS.map((item) => {
    const Icon = item.icon;
    const active = pathname === item.href;
    return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={segmentedItem(active)}><Icon className="size-4" />{item.label}</Link>;
  })}</nav>;
}
