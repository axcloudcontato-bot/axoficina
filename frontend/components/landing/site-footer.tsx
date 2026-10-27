import Link from 'next/link';
import { OfixLogo } from '@/components/brand/ofix-logo';
import { COMPANY, PARENT_SITE, SAME_AS, SISTER_PRODUCTS } from '@/lib/site';
import { CONTENT_PAGES } from './content-pages';

export function SiteFooter() {
  return (
    <footer className="dark bg-[#0b1218] text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div>
          <OfixLogo tagline className="w-48 text-white" />
          <p className="mt-4 text-sm text-white/50">Um produto <a href={PARENT_SITE} className="underline hover:text-white">{COMPANY.name}</a>.</p>
          <p className="mt-1 text-sm text-white/50">CNPJ {COMPANY.document}</p>
          <p className="mt-1 text-sm text-white/50"><a href={`mailto:${COMPANY.email}`} className="hover:text-white">{COMPANY.email}</a></p>
          <p className="mt-3 text-sm text-white/50">
            Outros produtos: {SISTER_PRODUCTS.map((p, i) => <span key={p.url}>{i > 0 && ', '}<a href={p.url} className="underline hover:text-white">{p.name}</a></span>)}
          </p>
          <p className="mt-3 flex gap-4 text-sm text-white/70">
            {SAME_AS.map((url) => <a key={url} href={url} rel="me noopener" target="_blank" className="hover:text-white">{url.includes('instagram') ? 'Instagram' : url.includes('tiktok') ? 'TikTok' : new URL(url).hostname}</a>)}
          </p>
        </div>
        <nav aria-label="Guias" className="text-sm text-white/70">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/40">Guias</p>
          <ul className="space-y-2">
            {CONTENT_PAGES.map((page) => <li key={page.slug}><Link href={`/${page.slug}`} className="hover:text-white">{page.navLabel}</Link></li>)}
          </ul>
        </nav>
        <nav aria-label="Documentos legais" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-white/70">
          <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
          <Link href="/termos" className="hover:text-white">Termos de uso</Link>
          <Link href="/cookies" className="hover:text-white">Cookies</Link>
          <Link href="/reembolso" className="hover:text-white">Reembolso</Link>
          <Link href="/entrar" className="hover:text-white">Entrar</Link>
          <Link href="/cadastro" className="hover:text-white">Criar conta</Link>
        </nav>
      </div>
      <p className="border-t border-white/10 py-5 text-center text-xs text-white/40">© {new Date().getFullYear()} Ofix. Todos os direitos reservados.</p>
    </footer>
  );
}
