import type { ReactNode } from 'react';
import { OfixLogo } from './ofix-logo';

/** Casca das telas públicas (login/cadastro): painel de marca grafite + cartão do formulário. */
export function AuthShell({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="grid min-h-screen bg-bg lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="dark relative hidden overflow-hidden bg-background text-foreground lg:flex lg:flex-col lg:justify-center lg:px-16 lg:[clip-path:polygon(0_0,calc(100%-120px)_0,100%_50%,calc(100%-120px)_100%,0_100%)] xl:px-24">
        <svg aria-hidden viewBox="0 0 160 800" preserveAspectRatio="none" className="pointer-events-none absolute inset-y-0 right-0 h-full w-40 [mask-image:linear-gradient(to_right,transparent,black_45%)]">
          <path d="M-70 0H-10L110 400-10 800H-70L50 400Z" transform="translate(50 0)" fill="#27323d" />
          <path d="M22 0L142 400 22 800" fill="none" stroke="#ffbe00" strokeWidth="4" vectorEffect="non-scaling-stroke" />
          <path d="M-8 0L112 400-8 800" fill="none" stroke="#ffbe00" strokeWidth="1.5" opacity="0.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative max-w-sm">
          <OfixLogo tagline className="w-full max-w-sm text-white" />
          <span className="mt-12 block h-1 w-12 rounded-full bg-primary" aria-hidden />
          <h2 className="mt-6 text-4xl font-bold leading-tight tracking-tight">
            Mais controle<br />para <span className="text-[#ffbe00]">sua oficina.</span>
          </h2>
          <p className="mt-4 max-w-sm text-base text-muted-foreground">Gerencie serviços, clientes, estoque e muito mais em um só lugar.</p>
        </div>
      </section>
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <OfixLogo variant="full" className="mx-auto mb-8 w-44 text-foreground lg:hidden" />
          <div className="rounded-card border border-border bg-surface p-8 shadow-card">
            <h1 className="text-2xl font-bold text-text">{title}</h1>
            <p className="mt-1 text-sm text-text-muted">{description}</p>
            <div className="mt-6">{children}</div>
            <p className="mt-6 text-center text-sm text-text-muted">{footer}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
