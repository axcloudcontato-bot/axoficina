'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChartBar, List, ShieldCheck, SignOut, X } from '@phosphor-icons/react';
import { OfixLogo } from '@/components/brand/ofix-logo';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/features/auth/hooks/use-auth';
import { useSaasAdminAccess } from '@/features/subscriptions/hooks/use-subscriptions';
import { useAuthStore } from '@/stores/auth-store';

const sections = [
  { href: '/admin', label: 'Visão geral', icon: ChartBar },
  { href: '/admin/assinaturas', label: 'Oficinas e assinaturas', icon: ShieldCheck },
] as const;

export function SaasAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const access = useSaasAdminAccess();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = sections.find((section) => section.href === pathname) ?? sections[0];

  if (access.isPending) return <p role="status" className="grid min-h-screen place-items-center bg-[#f6f7fb] text-sm text-slate-600">Verificando acesso à administração...</p>;
  if (access.isError) return <div role="alert" className="grid min-h-screen place-content-center gap-4 bg-[#f6f7fb] text-center"><p>Não foi possível verificar seu acesso.</p><Button variant="outline" onClick={() => access.refetch()}>Tentar novamente</Button></div>;
  if (!access.data?.allowed) return <div className="grid min-h-screen place-content-center gap-4 bg-[#f6f7fb] px-5 text-center"><ShieldCheck className="mx-auto size-9 text-slate-500" /><h1 className="text-xl font-bold">Acesso restrito</h1><p className="max-w-md text-sm text-slate-600">Esta área é exclusiva para as contas autorizadas a administrar o SaaS.</p><Button asChild variant="outline"><Link href="/painel">Voltar para a oficina</Link></Button></div>;

  return <div className="saas-admin-surface min-h-screen bg-[#f6f7fb] text-slate-900">
    {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" aria-label="Fechar menu de administração" onClick={() => setMobileOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-gradient-to-b from-[#27344f] via-[#303d62] to-[#4a4289] text-white shadow-xl transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[72px] items-center justify-between border-b border-white/10 px-6"><Link href="/admin" onClick={() => setMobileOpen(false)} aria-label="Ofix administração" className="flex items-center gap-3"><OfixLogo className="w-20 text-white" /><span className="border-l border-white/25 pl-3 text-xs font-bold uppercase tracking-[0.16em] text-white/75">Admin</span></Link><button type="button" aria-label="Fechar menu" className="lg:hidden" onClick={() => setMobileOpen(false)}><X className="size-5" /></button></div>
      <nav aria-label="Administração do SaaS" className="flex-1 px-3 py-7"><p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Gestão da plataforma</p>{sections.map((section) => { const Icon = section.icon; const active = pathname === section.href; return <Link key={section.href} href={section.href} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined} className={`mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${active ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><Icon className="size-[18px]" aria-hidden />{section.label}</Link>; })}</nav>
      <div className="space-y-3 border-t border-white/10 p-4"><Link href="/painel" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white"><ArrowLeft className="size-[18px]" aria-hidden />Voltar à oficina</Link><div className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-3"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold">{user?.name?.slice(0, 2).toUpperCase() || 'AD'}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user?.name || 'Administrador'}</p><p className="text-xs text-white/60">Gestão SaaS</p></div><button type="button" aria-label="Sair" title="Sair" onClick={() => logout.mutate()} className="rounded-md p-1.5 text-white/65 hover:bg-white/10 hover:text-white"><SignOut className="size-[18px]" /></button></div></div>
    </aside>
    <div className="min-h-screen lg:pl-[248px]">
      <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between gap-3 border-b border-[#e6eaf0] bg-white px-4 shadow-sm sm:px-8"><div className="flex min-w-0 items-center gap-3"><button type="button" aria-label="Abrir menu de administração" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><List className="size-5" /></button><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7759de]">Ofix / Administração</p><h1 className="text-base font-bold sm:text-lg">{current.label}</h1></div></div><Link href="/painel" className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:flex"><ArrowLeft className="size-4" />Minha oficina</Link></header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-8">{children}</main>
    </div>
  </div>;
}
