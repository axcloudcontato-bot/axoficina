'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChartBar, ChatCircleText, List, ShieldCheck, SignOut, X } from '@phosphor-icons/react';
import { OfixLogo } from '@/components/brand/ofix-logo';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/features/auth/hooks/use-auth';
import { useSaasAdminAccess } from '@/features/subscriptions/hooks/use-subscriptions';
import { useAuthStore } from '@/stores/auth-store';

const sections = [
  { href: '/admin', label: 'Visão geral', icon: ChartBar },
  { href: '/admin/assinaturas', label: 'Oficinas e assinaturas', icon: ShieldCheck },
  { href: '/admin/suporte', label: 'Chamados de suporte', icon: ChatCircleText },
] as const;

export function SaasAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const access = useSaasAdminAccess();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = sections.find((section) => section.href === pathname) ?? sections[0];

  if (access.isPending) return <p role="status" className="grid min-h-screen place-items-center bg-bg text-sm text-text-muted">Verificando acesso à administração...</p>;
  if (access.isError) return <div role="alert" className="grid min-h-screen place-content-center gap-4 bg-bg text-center"><p>Não foi possível verificar seu acesso.</p><Button variant="outline" onClick={() => access.refetch()}>Tentar novamente</Button></div>;
  if (!access.data?.allowed) return <div className="grid min-h-screen place-content-center gap-4 bg-bg px-5 text-center"><ShieldCheck className="mx-auto size-9 text-text-muted" /><h1 className="text-xl font-bold">Acesso restrito</h1><p className="max-w-md text-sm text-text-muted">Esta área é exclusiva para as contas autorizadas a administrar o SaaS.</p><Button asChild variant="outline"><Link href="/painel">Voltar para a oficina</Link></Button></div>;

  return <div className="min-h-screen bg-bg text-text">
    {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-black/50 lg:hidden" aria-label="Fechar menu de administração" onClick={() => setMobileOpen(false)} />}
    <aside className={`dark fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background text-foreground transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[72px] items-center justify-between border-b border-border px-5"><Link href="/admin" onClick={() => setMobileOpen(false)} aria-label="Ofix administração" className="flex items-center gap-3"><OfixLogo className="w-20 text-white" /><span className="border-l border-border pl-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Admin</span></Link><button type="button" aria-label="Fechar menu" className="rounded-button p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden" onClick={() => setMobileOpen(false)}><X className="size-5" /></button></div>
      <nav aria-label="Administração do SaaS" className="flex-1 space-y-1 overflow-y-auto px-3 py-5"><p className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gestão da plataforma</p>{sections.map((section) => { const Icon = section.icon; const active = pathname === section.href; return <Link key={section.href} href={section.href} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined} className={`flex min-h-10 items-center gap-3 rounded-button px-3 text-sm font-semibold ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="size-[18px]" aria-hidden />{section.label}</Link>; })}</nav>
      <div className="border-t border-border p-3"><Link href="/painel" className="flex min-h-10 items-center gap-3 rounded-button px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-[18px]" aria-hidden />Voltar à oficina</Link></div>
      <div className="flex items-center gap-2.5 border-t border-border px-4 py-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{user?.name?.slice(0, 2).toUpperCase() || 'AD'}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user?.name || 'Administrador'}</span><span className="block text-xs text-muted-foreground">Gestão SaaS</span></span><button type="button" aria-label="Sair" onClick={() => logout.mutate()} className="rounded-button p-2 text-muted-foreground hover:text-danger"><SignOut className="size-[18px]" /></button></div>
    </aside>
    <div className="min-h-screen lg:pl-64">
      <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between gap-3 border-b border-border bg-bg px-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><button type="button" aria-label="Abrir menu de administração" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="rounded-button p-2 text-text-muted hover:bg-muted hover:text-text lg:hidden"><List className="size-5" /></button><div><p className="text-xs font-semibold text-text-muted">Administração do Ofix</p><h1 className="text-lg font-bold tracking-tight">{current.label}</h1></div></div><Button asChild variant="outline" size="sm" className="hidden sm:inline-flex"><Link href="/painel"><ArrowLeft className="size-4" />Minha oficina</Link></Button></header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  </div>;
}
