'use client';

import { Bell, Heart } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// "Retornos e lembretes" joins the two ways of bringing a customer back: the automatic care messages and the list of cars due for a visit.
const ITEMS = [
  { href: '/relacionamento', label: 'Cuidados e mensagens', icon: Heart },
  { href: '/alertas-de-manutencao', label: 'Carros sem revisão', icon: Bell },
];

export function AftercareNav() {
  const pathname = usePathname();
  // Underlined tabs, so the two halves of the area don't look like the filters each page has below.
  return <nav aria-label="Seções de retornos e lembretes" className="flex gap-6 overflow-x-auto border-b border-border">{ITEMS.map((item) => {
    const Icon = item.icon;
    const active = pathname === item.href;
    return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors ${active ? 'border-primary text-text' : 'border-transparent text-text-muted hover:border-border hover:text-text'}`}><Icon className="size-4" aria-hidden="true" />{item.label}</Link>;
  })}</nav>;
}
