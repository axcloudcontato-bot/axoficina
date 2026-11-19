'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LEGAL_VERSION } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { readPrivacyChoice, savePrivacyChoice } from '../cookie-preferences';

export function PrivacyControls() {
  const pathname = usePathname();
  const [notice, setNotice] = useState(false);
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => { setNotice(!readPrivacyChoice()); }, []);
  if (pathname?.includes('/imprimir') || pathname?.startsWith('/impressao/')) return null;
  function openPreferences() {
    setAnalytics(readPrivacyChoice()?.analytics === true);
    setOpen(true);
  }
  function save(withAnalytics: boolean) {
    setStorageError(!savePrivacyChoice(new Date(), { analytics: withAnalytics }));
    setNotice(false);
    setOpen(false);
  }
  return <>
    <footer className="border-t border-border bg-surface px-4 py-5 text-xs text-text-muted print:hidden">
      <nav aria-label="Políticas e privacidade" className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-3">
        <Link href="/privacidade" className="hover:underline">Privacidade</Link><Link href="/termos" className="hover:underline">Termos de uso</Link><Link href="/reembolso" className="hover:underline">Cancelamento e reembolso</Link><Link href="/cookies" className="hover:underline">Cookies</Link><Link href="/configuracoes/privacidade" className="hover:underline">Meus dados e solicitações</Link>
        <button type="button" onClick={openPreferences} className="text-primary hover:underline">Preferências de cookies</button>
      </nav>
      {storageError && <p role="status" className="mt-3 text-center">Seu navegador não permitiu salvar a escolha. Apenas armazenamento necessário continua em uso.</p>}
    </footer>
    {notice && <section role="region" aria-label="Aviso de cookies e armazenamento" className="fixed inset-x-3 bottom-20 z-40 mx-auto max-h-[55vh] max-w-3xl overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg md:bottom-4 print:hidden">
      <h2 className="font-bold text-text">Sua privacidade no navegador</h2>
      <p className="mt-2 text-sm leading-6 text-text-muted">Utilizamos armazenamento necessário à sessão e preferências que você escolhe. Com sua permissão, também usamos o Google Analytics para contar visitas e entender quais páginas são mais usadas. Não usamos cookies de publicidade. <Link href="/cookies" className="text-primary underline">Veja os detalhes</Link>.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => save(false)}>Somente necessários</Button><Button type="button" variant="outline" onClick={() => save(true)}>Aceitar estatísticas</Button><Button type="button" variant="outline" onClick={openPreferences}>Gerenciar preferências</Button></div>
    </section>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Preferências de cookies</DialogTitle><DialogDescription>Controle do armazenamento no navegador · versão {LEGAL_VERSION}.</DialogDescription></DialogHeader>
      <div className="space-y-5 text-sm text-text-muted">
        <section><h3 className="font-bold text-text">Necessários — sempre ativos</h3><p className="mt-1">Sessão, segurança, registro desta escolha e preferências de interface solicitadas por você. Não são usados para publicidade.</p></section>
        <section>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="mt-1 size-4 accent-primary" />
            <span><span className="font-bold text-text">Estatísticas — opcional</span><span className="mt-1 block">Google Analytics, carregado pelo Google Tag Manager, para contar visitas e páginas acessadas. Desativado até você marcar. Desmarcar apaga os cookies do Analytics deste navegador.</span></span>
          </label>
        </section>
        <section><h3 className="font-bold text-text">Publicidade — não utilizada</h3><p className="mt-1">Não há cookies de publicidade. Nenhuma autorização para finalidades futuras será presumida.</p></section>
        <p>Você pode voltar aqui pelo rodapé a qualquer momento. <Link href="/cookies" className="text-primary underline">Consultar inventário</Link>.</p>
      </div>
      <DialogFooter className="gap-2"><Button variant="outline" onClick={() => save(false)}>Salvar somente necessários</Button><Button onClick={() => save(analytics)}>Salvar preferências</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
