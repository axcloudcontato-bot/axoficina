import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import {
  ArrowRight, BellRinging, Buildings, CalendarCheck, Camera, Car, ChartLineUp, Check, ClipboardText,
  CurrencyCircleDollar, Gauge, Lock, Printer, ShieldCheck, Star, UsersThree, WhatsappLogo, X,
} from '@phosphor-icons/react/dist/ssr';
import { OfixLogo } from '@/components/brand/ofix-logo';
import { DashboardMock, QuoteChatMock, StatusFlowMock } from './product-mock';

type IconType = ComponentType<{ weight?: 'duotone' | 'bold'; className?: string }>;

const SIGNUP = '/cadastro';
const Y = 'text-[#ffbe00]';

function Section({ id, dark = false, className = '', children }: { id?: string; dark?: boolean; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={`${dark ? 'dark bg-background text-foreground' : 'bg-bg text-text'} scroll-mt-16 ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-primary"><span className="h-0.5 w-8 bg-[#ffbe00]" aria-hidden />{children}</p>;
}

function Heading({ children, sub, center = false }: { children: ReactNode; sub?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <h2 className="text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">{children}</h2>
      {sub && <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">{sub}</p>}
    </div>
  );
}

function CtaButton({ children = 'Cadastrar minha oficina', variant = 'solid' }: { children?: ReactNode; variant?: 'solid' | 'dark' }) {
  const base = 'group inline-flex h-12 items-center justify-center gap-2 rounded-button px-6 text-base font-bold transition-[background-color,transform] duration-fast focus-visible:outline-2 focus-visible:outline-offset-4 active:translate-y-px';
  const tone = variant === 'solid' ? 'bg-[#ffbe00] text-[#0f171f] hover:bg-[#ffd033] focus-visible:outline-[#ffbe00]' : 'bg-[#0f171f] text-white hover:bg-[#27323d] focus-visible:outline-[#0f171f]';
  return <Link href={SIGNUP} className={`${base} ${tone}`}>{children}<ArrowRight weight="bold" className="size-4 transition-transform group-hover:translate-x-0.5" /></Link>;
}

const PAINS = [
  ['Ordem de serviço no caderno, orçamento no WhatsApp', 'O histórico do veículo se perde, o cliente pergunta o status e ninguém acha a informação certa na hora.'],
  ['Financeiro numa planilha que só o dono entende', 'Contas a pagar, a receber e parcelas de OS em arquivos separados escondem para onde o dinheiro está indo.'],
  ['Cliente que some depois do serviço', 'Sem lembrete de revisão, a próxima troca de óleo e as manutenções preventivas vão para o concorrente.'],
] as const;

const FEATURES: Array<{ icon: IconType; title: string; text: string; span?: string; chat?: boolean; flow?: boolean }> = [
  { icon: ClipboardText, title: 'Ordens de serviço completas', text: 'Itens, peças, serviços, fotos e histórico de status em um só lugar, do check-in à entrega, com impressão em A4.', span: 'lg:col-span-2', flow: true },
  { icon: WhatsappLogo, title: 'Orçamento aprovado pelo WhatsApp', text: 'O cliente recebe o orçamento e responde com um toque. Você acompanha a resposta direto na ordem de serviço.', chat: true },
  { icon: CalendarCheck, title: 'Agenda da oficina', text: 'Horários organizados para recepção e equipe, sem conflito e sem papel.' },
  { icon: Car, title: 'Veículo com dados da FIPE', text: 'Marca, modelo e valor puxados da tabela FIPE. Cadastro rápido, histórico completo por veículo.' },
  { icon: BellRinging, title: 'Alertas de manutenção', text: 'O sistema avisa quando o veículo de um cliente está perto da próxima revisão. Retorno sem depender de memória.' },
  { icon: CurrencyCircleDollar, title: 'Financeiro sem planilha', text: 'Contas a pagar e a receber, parcelas das OS, fornecedores, fluxo de caixa e relatórios analíticos.' },
  { icon: Gauge, title: 'Produtividade da equipe', text: 'Veja o que cada ordem rende e onde o trabalho está parado para decidir com dados.' },
  { icon: Star, title: 'Avaliação depois da entrega', text: 'Peça a nota de cinco estrelas ao cliente quando o carro sai e construa reputação com fatos.' },
];

const STEPS = [
  ['01', 'Cliente chega', 'Cadastre cliente e veículo em segundos, com dados da FIPE.'],
  ['02', 'Abre a OS', 'Registre o problema, adicione itens e fotos, e envie o orçamento.'],
  ['03', 'Cliente aprova', 'A aprovação chega pelo WhatsApp e fica registrada na ordem.'],
  ['04', 'Entrega e cobra', 'Finalize, gere parcelas e recibo, e peça a avaliação.'],
] as const;

const ROLES: Array<[IconType, string, string]> = [
  [ClipboardText, 'Recepção', 'Abre ordens, agenda horários e responde ao cliente com o status em mãos.'],
  [Camera, 'Mecânico', 'Trabalha pela ordem de serviço: itens, status e fotos, inclusive no tablet.'],
  [CurrencyCircleDollar, 'Financeiro', 'Fecha contas, lança categorias e fornecedores e concilia as parcelas.'],
  [ChartLineUp, 'Dono e gestor', 'Enxerga a oficina inteira, configura equipe e acessos e decide com números.'],
];

const TRUST: Array<[IconType, string]> = [
  [Buildings, 'Dados isolados por oficina'],
  [UsersThree, 'Permissões por função'],
  [Printer, 'Impressão em A4 pronta'],
  [WhatsappLogo, 'Integração com WhatsApp'],
];

const SAFETY: Array<[IconType, string, string]> = [
  [Buildings, 'Ambiente isolado por oficina', 'Cada oficina tem seus usuários, clientes e registros separados dos demais.'],
  [Lock, 'Acesso por permissão', 'Perfis personalizados definem quem vê preços, financeiro e configurações.'],
  [ShieldCheck, 'Documentos publicados', 'Política de privacidade, termos de uso, cookies e reembolso acessíveis no rodapé.'],
];

const COMPARE: Array<[string, string]> = [
  ['Orçamento e aprovação perdidos em conversas', 'Aprovação por botão no WhatsApp, registrada na OS'],
  ['Histórico do carro na memória de quem atendeu', 'Histórico por veículo, com fotos e status'],
  ['Financeiro em planilhas soltas', 'Pagar, receber, parcelas e relatórios no mesmo sistema'],
  ['Cliente só volta se lembrar', 'Alertas de manutenção para chamar na hora certa'],
  ['Todo mundo vê tudo, ou ninguém vê nada', 'Perfis de acesso por função e por permissão'],
];

const FAQ: Array<[string, string]> = [
  ['O Ofix serve para a minha oficina?', 'Ele foi feito para oficinas mecânicas: da recepção ao financeiro, passando por ordens de serviço, agenda, clientes e veículos.'],
  ['Preciso instalar alguma coisa?', 'Não. O Ofix funciona no navegador, no computador do balcão e no tablet do pátio. Basta cadastrar sua oficina e começar.'],
  ['Meus dados ficam separados dos de outras oficinas?', 'Sim. Cada oficina é um ambiente isolado, com seus próprios usuários, clientes e registros.'],
  ['Posso controlar o que cada pessoa da equipe vê?', 'Sim. Há papéis prontos (administrador, gestor, mecânico, recepção) e perfis de acesso personalizados com permissões detalhadas.'],
  ['Como funciona a aprovação pelo WhatsApp?', 'Você conecta o WhatsApp da oficina nas configurações. O cliente recebe o orçamento e responde com um botão, e a resposta aparece na ordem de serviço.'],
  ['Como tratam a privacidade dos dados?', 'Política de privacidade, termos de uso, cookies e política de reembolso estão publicados e acessíveis no rodapé deste site.'],
];

export function LandingPage() {
  return (
    <div className="bg-bg">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <header className="dark sticky top-0 z-50 border-b border-white/10 bg-[#0f171f]/90 text-foreground backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Ofix, página inicial"><OfixLogo className="w-24 text-white" /></Link>
          <nav aria-label="Seções" className="hidden items-center gap-8 text-sm font-semibold text-white/70 md:flex">
            <a href="#funcionalidades" className="hover:text-white">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-white">Como funciona</a>
            <a href="#equipe" className="hover:text-white">Para sua equipe</a>
            <a href="#duvidas" className="hover:text-white">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/entrar" className="rounded-button px-3 py-2 text-sm font-semibold text-white/80 hover:text-white">Entrar</Link>
            <Link href={SIGNUP} className="hidden h-10 items-center rounded-button bg-[#ffbe00] px-4 text-sm font-bold text-[#0f171f] hover:bg-[#ffd033] sm:inline-flex">Cadastrar oficina</Link>
          </div>
        </div>
      </header>

      <main id="conteudo">
        <section className="dark relative overflow-hidden bg-[#0f171f] text-foreground">
          <svg aria-hidden viewBox="0 0 600 700" className="pointer-events-none absolute -right-32 top-0 h-full w-[46rem] opacity-60" preserveAspectRatio="xMaxYMid slice">
            <path d="M300 0H420L600 350 420 700H300L480 350Z" fill="#27323d" opacity="0.6" />
            <path d="M470 0H520L700 350 520 700H470L650 350Z" fill="#ffbe00" opacity="0.9" />
          </svg>
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:grid-cols-[1.02fr_1fr]">
            <div data-reveal>
              <Eyebrow>Sistema para oficina mecânica</Eyebrow>
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
                Mais controle<br />para <span className={Y}>sua oficina.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
                Ordens de serviço, orçamento pelo WhatsApp, agenda e financeiro em um sistema simples e rápido, feito para quem vive o dia a dia do pátio. Mais tempo para o que importa: consertar carros e fazer a oficina crescer.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <CtaButton />
                <a href="#funcionalidades" className="inline-flex h-12 items-center justify-center rounded-button border border-white/20 px-6 text-base font-semibold text-white hover:bg-white/5">Ver o que o Ofix faz</a>
              </div>
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
                {['Funciona no navegador', 'Sem instalar nada', 'Do orçamento ao financeiro'].map((t) => <li key={t} className="flex items-center gap-2"><Check weight="bold" className={`size-4 ${Y}`} />{t}</li>)}
              </ul>
            </div>
            <DashboardMock className="relative" />
          </div>
        </section>

        <section className="dark border-y border-white/10 bg-[#0b1218] text-foreground" aria-label="Fundamentos do sistema">
          <ul className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-5 py-8 sm:px-8 lg:grid-cols-4">
            {TRUST.map(([Icon, label]) => (
              <li key={label} className="flex items-center gap-3 text-sm font-semibold text-white/80"><Icon weight="duotone" className={`size-6 shrink-0 ${Y}`} />{label}</li>
            ))}
          </ul>
        </section>

        <Section>
          <Eyebrow>O problema</Eyebrow>
          <Heading sub="Quando a informação está espalhada, a oficina perde tempo, dinheiro e cliente. O Ofix reúne tudo em um fluxo só.">
            Oficina que cresce não pode rodar em caderno, planilha e conversa solta.
          </Heading>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {PAINS.map(([title, text], i) => (
              <article key={title} className="rounded-card border border-border bg-card p-7 shadow-card">
                <span className="text-sm font-extrabold text-primary">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-bold leading-snug">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section id="funcionalidades" className="border-t border-border">
          <Eyebrow>Funcionalidades</Eyebrow>
          <Heading sub="Cada recurso nasceu do fluxo real de uma oficina, do balcão ao pátio. Nada de módulo que ninguém usa.">
            Tudo o que sua oficina precisa, <span className="rounded-md bg-[#ffbe00] px-2 text-[#0f171f] [box-decoration-break:clone]">em um só lugar.</span>
          </Heading>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text, span = '', chat, flow }) => (
              <article key={title} className={`rounded-card border border-border bg-card p-7 shadow-card transition-[box-shadow,transform] duration-normal hover:-translate-y-0.5 hover:shadow-card-hover ${span}`}>
                <span className="flex size-11 items-center justify-center rounded-button bg-[#0f171f] text-[#ffbe00]"><Icon weight="duotone" className="size-6" /></span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                {flow && <StatusFlowMock />}
                {chat && <div className="mt-6"><QuoteChatMock /></div>}
              </article>
            ))}
          </div>
        </Section>

        <Section id="como-funciona" dark>
          <Eyebrow>Como funciona</Eyebrow>
          <Heading sub="Um caminho único e sem retrabalho: o que você registra no balcão já chega pronto para o mecânico e para o financeiro.">
            Do cliente na porta ao <span className={Y}>carro entregue.</span>
          </Heading>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-card border border-white/10 bg-white/10 md:grid-cols-4">
            {STEPS.map(([n, title, text]) => (
              <li key={n} className="bg-[#0f171f] p-7">
                <span className={`text-4xl font-extrabold ${Y}`}>{n}</span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="equipe">
          <Eyebrow>Para toda a equipe</Eyebrow>
          <Heading sub="Cada pessoa vê o que precisa para trabalhar, sem treinamento longo e sem expor o que não é da sua função.">
            Uma só ferramenta, <span className="rounded-md bg-[#ffbe00] px-2 text-[#0f171f] [box-decoration-break:clone]">cada um no seu papel.</span>
          </Heading>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map(([Icon, title, text]) => (
              <article key={title} className="rounded-card border border-border bg-card p-6 shadow-card">
                <Icon weight="duotone" className="size-8 text-primary" />
                <h3 className="mt-4 text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section className="border-t border-border">
          <Heading center sub="A diferença aparece no primeiro dia de uso.">
            Antes do Ofix e <span className="rounded-md bg-[#ffbe00] px-2 text-[#0f171f] [box-decoration-break:clone]">depois.</span>
          </Heading>
          <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-card border border-border bg-card shadow-card">
            <div className="grid grid-cols-2 border-b border-border bg-muted text-xs font-bold uppercase tracking-wider">
              <p className="p-4 text-muted-foreground sm:px-6">Sem sistema</p>
              <p className="flex items-center gap-2 bg-[#ffbe00] p-4 text-[#0f171f] sm:px-6"><Check weight="bold" className="size-4" />Com Ofix</p>
            </div>
            {COMPARE.map(([before, after]) => (
              <div key={before} className="grid grid-cols-2 border-b border-border last:border-0">
                <p className="flex gap-3 p-4 text-sm text-muted-foreground sm:px-6"><X weight="bold" className="mt-0.5 size-4 shrink-0 text-danger" />{before}</p>
                <p className="flex gap-3 p-4 text-sm font-semibold sm:px-6"><Check weight="bold" className="mt-0.5 size-4 shrink-0 text-success" />{after}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section dark>
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <Eyebrow>Confiança</Eyebrow>
              <Heading sub="Os dados da sua oficina e dos seus clientes merecem cuidado. O Ofix foi construído com isolamento e controle de acesso desde a base.">
                Seus dados, <span className={Y}>só seus.</span>
              </Heading>
            </div>
            <ul className="grid gap-4">
              {SAFETY.map(([Icon, title, text]) => (
                <li key={title} className="flex gap-4 rounded-card border border-white/10 bg-white/[0.03] p-5">
                  <Icon weight="duotone" className={`size-7 shrink-0 ${Y}`} />
                  <div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-white/60">{text}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="duvidas">
          <Heading center>Perguntas <span className="rounded-md bg-[#ffbe00] px-2 text-[#0f171f] [box-decoration-break:clone]">frequentes</span></Heading>
          <div className="mx-auto mt-12 max-w-3xl divide-y divide-border rounded-card border border-border bg-card shadow-card">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group p-5 sm:px-7 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-bold">
                  {q}
                  <span aria-hidden className="text-2xl font-light leading-none text-primary transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </Section>

        <section className="relative overflow-hidden bg-[#ffbe00] text-[#0f171f]">
          <svg aria-hidden viewBox="0 0 400 300" className="pointer-events-none absolute -right-10 inset-y-0 h-full opacity-15" preserveAspectRatio="xMaxYMid slice"><path d="M120 0H220L400 150 220 300H120L300 150Z" fill="#0f171f" /></svg>
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Pronto para ter mais controle sobre a sua oficina?</h2>
              <p className="mt-4 text-lg font-medium text-[#0f171f]/75">Cadastre sua oficina e comece a organizar clientes, veículos e ordens de serviço hoje mesmo.</p>
            </div>
            <CtaButton variant="dark" />
          </div>
        </section>
      </main>

      <footer className="dark bg-[#0b1218] text-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
          <div>
            <OfixLogo tagline className="w-48 text-white" />
            <p className="mt-4 text-sm text-white/50">Um produto Ax Cloud.</p>
          </div>
          <nav aria-label="Documentos legais" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-white/70">
            <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
            <Link href="/termos" className="hover:text-white">Termos de uso</Link>
            <Link href="/cookies" className="hover:text-white">Cookies</Link>
            <Link href="/reembolso" className="hover:text-white">Reembolso</Link>
            <Link href="/entrar" className="hover:text-white">Entrar</Link>
            <Link href={SIGNUP} className="hover:text-white">Criar conta</Link>
          </nav>
        </div>
        <p className="border-t border-white/10 py-5 text-center text-xs text-white/40">© {new Date().getFullYear()} Ofix. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
