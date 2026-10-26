import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LEGAL_VERSION } from '@oficina/contracts';
import { legalDocuments, legalIdentity } from '@/features/privacy/legal-content';

type DocumentKey = keyof typeof legalDocuments;
function getDocument(key: string) { return Object.hasOwn(legalDocuments, key) ? legalDocuments[key as DocumentKey] : undefined; }
export function generateStaticParams() { return Object.keys(legalDocuments).map((document) => ({ document })); }
export async function generateMetadata({ params }: { params: Promise<{ document: string }> }): Promise<Metadata> {
  return { title: `${getDocument((await params).document)?.title ?? 'Documento'} | Ofix` };
}
export default async function LegalPage({ params }: { params: Promise<{ document: string }> }) {
  const document = getDocument((await params).document);
  if (!document) notFound();
  return <main id="main-content" tabIndex={-1} className="mx-auto min-h-screen max-w-4xl px-5 py-12 text-text sm:px-8">
    <Link href="/entrar" className="text-sm font-semibold text-primary hover:underline">Ofix · Acessar sistema</Link>
    <header className="mb-8 mt-8 border-b border-border pb-6">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Transparência e privacidade</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{document.title}</h1>
      <p className="mt-4 text-text-muted">{document.intro}</p>
      <p className="mt-3 text-sm text-text-muted">Versão {LEGAL_VERSION} · Atualizado em 24 de outubro de 2026</p>
    </header>
    <aside className="mb-8 rounded-card border border-border bg-surface p-5 text-sm">
      <h2 className="font-bold">Responsável pelo Ofix e contato</h2>
      {legalIdentity.name && <p className="mt-2">{legalIdentity.name}</p>}
      {legalIdentity.document && <p>CPF/CNPJ: {legalIdentity.document}</p>}
      {legalIdentity.address && <p>{legalIdentity.address}</p>}
      {legalIdentity.email && <p className="mt-2">Privacidade, suporte e cancelamento: <a className="text-primary underline" href={`mailto:${legalIdentity.email}`}>{legalIdentity.email}</a></p>}
      {(!legalIdentity.name || !legalIdentity.document || !legalIdentity.address || !legalIdentity.email) && <p className="mt-2 text-warning-strong" role="note">A identificação e o contato do fornecedor ainda precisam ser completados para publicação. Este documento é uma minuta de implantação enquanto esses dados estiverem pendentes.</p>}
      <Link className="mt-3 inline-block text-primary underline" href="/configuracoes/privacidade">Abrir Central de privacidade e solicitações</Link>
      <p className="mt-2 text-text-muted">Clientes da oficina sem conta no sistema podem exercer seus direitos diretamente com a oficina responsável pelo atendimento.</p>
    </aside>
    <nav aria-label="Conteúdo do documento" className="mb-10 rounded-card bg-muted p-5">
      <ol className="space-y-2 text-sm">{document.sections.map(([title], i) => <li key={title}><a href={`#secao-${i + 1}`} className="text-primary hover:underline">{i + 1}. {title}</a></li>)}</ol>
    </nav>
    <article className="space-y-8">{document.sections.map(([title, content], i) => <section key={title} id={`secao-${i + 1}`} className="scroll-mt-8"><h2 className="text-xl font-bold">{i + 1}. {title}</h2><p className="mt-3 whitespace-pre-line text-base leading-7 text-text-muted">{content}</p></section>)}</article>
    <section className="mt-12 border-t border-border pt-6 text-sm text-text-muted"><h2 className="font-semibold text-text">Referências legais</h2><p className="mt-2"><a className="text-primary underline" href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm">LGPD</a> · <a className="text-primary underline" href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm">Código de Defesa do Consumidor</a> · <a className="text-primary underline" href="https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais">Guia de cookies da ANPD</a></p></section>
  </main>;
}
