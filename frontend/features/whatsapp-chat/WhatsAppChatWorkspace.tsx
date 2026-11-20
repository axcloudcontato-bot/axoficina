'use client';

import Link from 'next/link';
import { ArrowSquareOut, WhatsappLogo } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/features/settings/hooks/use-settings';
import { WA_AKG_CHAT_URL } from '@/lib/site';

// The WA-AKG chat screen, shown inside Ofix. Each workshop signs in with its own WA-AKG user, which only sees that
// workshop's session: the separation between workshops is enforced by WA-AKG, not by this page.
export function WhatsAppChatWorkspace() {
  const branding = useBranding();

  if (branding.isPending) return <p role="status" className="text-sm text-text-muted">Carregando o chat...</p>;

  if (!branding.data?.whatsappEnabled) {
    return <section className="mx-auto max-w-xl rounded-card border border-border bg-card p-6 text-center">
      <WhatsappLogo className="mx-auto size-10 text-text-muted" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-bold text-text">O WhatsApp da oficina ainda não está ativo</h2>
      <p className="mt-2 text-sm text-text-muted">Ative a integração para conversar com os clientes sem sair do Ofix.</p>
      <Button asChild className="mt-4"><Link href="/configuracoes/whatsapp">Configurar WhatsApp</Link></Button>
    </section>;
  }

  return <section aria-label="Chat do WhatsApp" className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-text-muted">No primeiro acesso, entre com o login do WhatsApp da sua oficina.</p>
      <Button asChild variant="outline" size="sm">
        <a href={WA_AKG_CHAT_URL} target="_blank" rel="noopener noreferrer"><ArrowSquareOut className="size-4" aria-hidden="true" />Abrir em nova aba</a>
      </Button>
    </div>
    <iframe
      title="Conversas do WhatsApp"
      src={WA_AKG_CHAT_URL}
      allow="clipboard-read; clipboard-write; microphone"
      referrerPolicy="no-referrer"
      className="h-[calc(100dvh-14rem)] min-h-[480px] w-full rounded-card border border-border bg-card md:h-[calc(100dvh-11rem)]"
    />
  </section>;
}
