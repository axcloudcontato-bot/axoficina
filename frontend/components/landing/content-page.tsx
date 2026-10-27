import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { OfixLogo } from '@/components/brand/ofix-logo';
import { ContentJsonLd } from '@/components/seo/json-ld';
import { getContentPage } from './content-pages';
import { SiteFooter } from './site-footer';

export function ContentPageView({ slug }: { slug: string }) {
  const page = getContentPage(slug);
  if (!page) return null;
  const related = page.related.map(getContentPage).filter((p) => p !== undefined);

  return (
    <div className="bg-bg">
      <ContentJsonLd page={page} />
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <header className="dark border-b border-white/10 bg-[#0f171f] text-foreground">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Ofix, página inicial"><OfixLogo className="w-24 text-white" /></Link>
          <div className="flex items-center gap-2">
            <Link href="/entrar" className="rounded-button px-3 py-2 text-sm font-semibold text-white/80 hover:text-white">Entrar</Link>
            <Link href="/cadastro" className="inline-flex h-10 items-center rounded-button bg-[#ffbe00] px-4 text-sm font-bold text-[#0f171f] hover:bg-[#ffd033]">Cadastrar oficina</Link>
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-3xl px-5 py-14 text-text sm:px-8 sm:py-20">
        <nav aria-label="Você está em" className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:underline">Início</Link> <span aria-hidden>/</span> <span>{page.title}</span>
        </nav>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{page.h1}</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{page.definition}</p>

        <div className="mt-12 space-y-12">
          {page.sections.map((section) => (
            <section key={section.h2}>
              <h2 className="text-2xl font-bold tracking-tight">{section.h2}</h2>
              {section.paragraphs.map((text) => <p key={text} className="mt-4 leading-relaxed text-muted-foreground">{text}</p>)}
              {section.bullets && (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground marker:text-[#ffbe00]">
                  {section.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        <section className="mt-14" aria-labelledby="faq-pagina">
          <h2 id="faq-pagina" className="text-2xl font-bold tracking-tight">Perguntas frequentes</h2>
          <dl className="mt-6 divide-y divide-border rounded-card border border-border bg-card shadow-card">
            {page.faq.map(([q, a]) => (
              <div key={q} className="p-5 sm:px-7">
                <dt className="font-bold">{q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14 rounded-card bg-[#ffbe00] p-8 text-[#0f171f]">
          <h2 className="text-2xl font-extrabold">Pronto para organizar sua oficina?</h2>
          <p className="mt-2">Cadastre sua oficina e comece pelo primeiro cliente e pela primeira ordem de serviço.</p>
          <Link href="/cadastro" className="group mt-5 inline-flex h-12 items-center gap-2 rounded-button bg-[#0f171f] px-6 font-bold text-white hover:bg-[#27323d]">
            Cadastrar minha oficina <ArrowRight weight="bold" className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>

        {related.length > 0 && (
          <nav aria-label="Leia também" className="mt-14">
            <h2 className="text-lg font-bold">Leia também</h2>
            <ul className="mt-3 space-y-2">
              {related.map((p) => <li key={p.slug}><Link href={`/${p.slug}`} className="font-semibold text-primary underline">{p.title}</Link></li>)}
            </ul>
          </nav>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
