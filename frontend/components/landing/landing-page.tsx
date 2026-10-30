import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import {
  ArrowRight, Buildings, CalendarCheck, Camera, Car, ChartLineUp, Check, ClipboardText, ClockCounterClockwise,
  CurrencyCircleDollar, FileText, Gauge, Heart, Lock, Package, Printer, ShieldCheck, Star, UsersThree, WhatsappLogo, X,
} from '@phosphor-icons/react/dist/ssr';
import { MODULE_KEYS, MODULES, PLANS, PLAN_CODES, YEARLY_MONTHS_CHARGED, planPriceCents, type ModuleKey } from '@oficina/contracts';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { OfixLogo } from '@/components/brand/ofix-logo';
import { DashboardMock, QuoteChatMock, StatusFlowMock } from './product-mock';
import { FAQ } from './faq';
import { STEPS } from './steps';
import { SPEC, STATS } from './facts';
import { SiteFooter } from './site-footer';
import { COMPANY, PARENT_SITE } from '@/lib/site';

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

function CtaButton({ children = 'Cadastrar minha oficina', variant = 'solid' }: { children?: ReactNode; variant?: 'solid' | 'dark' | 'outline' }) {
  const base = 'group inline-flex h-12 items-center justify-center gap-2 rounded-button px-6 text-base font-bold transition-[background-color,transform] duration-fast focus-visible:outline-2 focus-visible:outline-offset-4 active:translate-y-px';
  const tone = variant === 'solid' ? 'bg-[#ffbe00] text-[#0f171f] hover:bg-[#ffd033] focus-visible:outline-[#ffbe00]' : variant === 'outline' ? 'border-2 border-[#ffbe00] text-foreground hover:bg-[#ffbe00]/10 focus-visible:outline-[#ffbe00]' : 'bg-[#0f171f] text-white hover:bg-[#27323d] focus-visible:outline-[#0f171f]';
  return <Link href={SIGNUP} className={`${base} ${tone}`}>{children}<ArrowRight weight="bold" className="size-4 transition-transform group-hover:translate-x-0.5" /></Link>;
}

const PAINS = [
  ['Ordem de serviço no caderno, orçamento no WhatsApp', 'O histórico do veículo se perde, o cliente pergunta o status e ninguém acha a informação certa na hora.'],
  ['Financeiro numa planilha que só o dono entende', 'Contas a pagar, a receber e parcelas de OS em arquivos separados escondem para onde o dinheiro está indo.'],
  ['Cliente que some depois do serviço', 'Sem lembrete de revisão, a próxima troca de óleo e as manutenções preventivas vão para o concorrente.'],
] as const;

// `module` marks what is sold from a given plan on; the badge reads the catalog, so it never drifts from the prices.
// The plan shown as the suggested one, and the words on its badge. "Recomendado" is our opinion; switch it to "Mais escolhido" only once the numbers say so.
const HIGHLIGHTED_PLAN = 'profissional';
const HIGHLIGHT_LABEL = 'Recomendado';

const FEATURES: Array<{ icon: IconType; title: string; text: string; span?: string; chat?: boolean; flow?: boolean; module?: ModuleKey }> = [
  { icon: ClipboardText, title: 'Ordens de serviço completas', text: 'Itens, peças, serviços, fotos e histórico de status em um só lugar, do check-in à entrega, com desconto, garantia e impressão em A4.', span: 'lg:col-span-2', flow: true },
  { icon: WhatsappLogo, title: 'Orçamento aprovado pelo WhatsApp', text: 'O cliente recebe o orçamento e responde com um toque. Você acompanha a resposta direto na ordem de serviço.', chat: true, module: 'whatsapp' },
  { icon: CalendarCheck, title: 'Agenda com capacidade', text: 'Grade por horário, arraste para remarcar, capacidade de atendimentos ao mesmo tempo e horário por dia da semana, com feriados e férias.' },
  { icon: Car, title: 'Clientes e veículos com ficha', text: 'Histórico, total gasto e próximos cuidados de cada um. Veículo com dados da FIPE, importação por planilha e junção de cadastros duplicados.' },
  { icon: Heart, title: 'Cuidado com o cliente', text: 'Alertas de manutenção, lembretes automáticos de revisão e aniversário, e uma lista para a equipe ligar para quem não autorizou mensagens.', module: 'cuidado' },
  { icon: Package, title: 'Catálogo e estoque', text: 'Peças e serviços com custo, margem e estoque mínimo, baixa automática na entrega, pacotes de serviço e relatório dos mais vendidos.' },
  { icon: CurrencyCircleDollar, title: 'Financeiro sem planilha', text: 'Contas a pagar e a receber, parcelas das OS, fornecedores, fluxo de caixa e relatórios analíticos.', module: 'financeiro' },
  { icon: Gauge, title: 'Produtividade e comissões', text: 'Tempo por técnico, eficiência, valor por hora, ocupação, metas, comissão e retornos em garantia, para decidir com dados.', module: 'produtividade' },
  { icon: FileText, title: 'Documentos com a sua marca', text: 'Orçamento em PDF e OS impressa com logo, CPF/CNPJ, validade, garantia e os termos da sua oficina.' },
  { icon: Star, title: 'Avaliação depois da entrega', text: 'Peça a nota de cinco estrelas ao cliente quando o carro sai e construa reputação com fatos.' },
  { icon: ClockCounterClockwise, title: 'Histórico e seus dados', text: 'Veja quem alterou o quê e quando, e exporte clientes, veículos, ordens de serviço e financeiro em planilha.', module: 'governanca' },
];

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
  ['Cliente só volta se lembrar', 'Lembretes de revisão e alertas de manutenção na hora certa'],
  ['Ninguém sabe quanto cada mecânico rende', 'Tempo, eficiência, valor por hora e comissão por técnico'],
  ['Estoque conferido só no olho', 'Estoque com baixa automática e aviso de estoque baixo'],
  ['Todo mundo vê tudo, ou ninguém vê nada', 'Perfis de acesso por função e por permissão'],
];

export function LandingPage() {
  return (
    <div className="bg-bg">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <header className="dark sticky top-0 z-50 border-b border-white/10 bg-[#0f171f]/90 text-foreground backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Ofix, página inicial"><OfixLogo className="w-24 text-white" /></Link>
          <nav aria-label="Seções" className="hidden items-center gap-5 whitespace-nowrap text-sm font-semibold text-white/70 md:flex lg:gap-8">
            <a href="#funcionalidades" className="hover:text-white">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-white">Como funciona</a>
            <a href="#equipe" className="hidden hover:text-white lg:inline">Para sua equipe</a>
            <a href="#planos" className="hover:text-white">Planos</a>
            <a href="#duvidas" className="hover:text-white">Dúvidas</a>
            <a href="#sobre" className="hidden hover:text-white lg:inline">Sobre</a>
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
                <strong className="font-semibold text-white">O Ofix é um sistema de gestão para oficinas mecânicas que reúne</strong> ordens de serviço, orçamento aprovado pelo WhatsApp, agenda, clientes, veículos, estoque, financeiro e produtividade da equipe em um só lugar, simples e rápido, feito para quem vive o dia a dia do pátio.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <CtaButton />
                <a href="#funcionalidades" className="inline-flex h-12 items-center justify-center rounded-button border border-white/20 px-6 text-base font-semibold text-white hover:bg-white/5">Ver o que o Ofix faz</a>
              </div>
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
                {['Funciona no navegador', 'Sem instalar nada', `A partir de ${formatCurrencyBRL(PLANS.essencial.monthlyPriceCents)} por mês`].map((t) => <li key={t} className="flex items-center gap-2"><Check weight="bold" className={`size-4 ${Y}`} />{t}</li>)}
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
            {FEATURES.map(({ icon: Icon, title, text, span = '', chat, flow, module }) => (
              <article key={title} className={`rounded-card border border-border bg-card p-7 shadow-card transition-[box-shadow,transform] duration-normal hover:-translate-y-0.5 hover:shadow-card-hover ${span}`}>
                <span className="flex size-11 items-center justify-center rounded-button bg-[#0f171f] text-[#ffbe00]"><Icon weight="duotone" className="size-6" /></span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                {module && <p className="mt-2 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">A partir do plano {PLANS[MODULES[module].minPlan].name}</p>}
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

        <Section id="numeros" dark>
          <Eyebrow>O Ofix em números</Eyebrow>
          <Heading sub="Os limites e as opções do sistema, sem arredondar: o que está no produto hoje.">
            Fatos sobre o que o sistema <span className={Y}>faz.</span>
          </Heading>
          <ul className="mt-14 grid gap-px overflow-hidden rounded-card border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {STATS.map(([value, label, detail]) => (
              <li key={label} className="bg-[#0f171f] p-7">
                <p className={`text-5xl font-extrabold ${Y}`}>{value}</p>
                <h3 className="mt-3 text-lg font-bold">{label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{detail}</p>
              </li>
            ))}
          </ul>
          <div className="mt-14 overflow-hidden rounded-card border border-white/10">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="bg-white/5 p-4 text-left text-xs font-bold uppercase tracking-widest text-white/60">Ficha técnica do Ofix</caption>
              <tbody>
                {SPEC.map(([name, value]) => (
                  <tr key={name} className="border-t border-white/10 align-top">
                    <th scope="row" className="w-2/5 bg-white/[0.03] p-4 font-semibold sm:w-1/3 sm:px-6">{name}</th>
                    <td className="p-4 text-white/70 sm:px-6">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section className="border-t border-border">
          <Heading center sub="A diferença aparece no primeiro dia de uso.">
            Antes do Ofix e <span className="rounded-md bg-[#ffbe00] px-2 text-[#0f171f] [box-decoration-break:clone]">depois.</span>
          </Heading>
          <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-card border border-border bg-card shadow-card">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">Comparação entre a rotina da oficina sem sistema e com o Ofix</caption>
              <thead>
                <tr className="border-b border-border bg-muted text-xs font-bold uppercase tracking-wider">
                  <th scope="col" className="p-4 text-muted-foreground sm:px-6">Sem sistema</th>
                  <th scope="col" className="bg-[#ffbe00] p-4 text-[#0f171f] sm:px-6"><span className="flex items-center gap-2"><Check weight="bold" className="size-4" />Com Ofix</span></th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([before, after]) => (
                  <tr key={before} className="border-b border-border align-top last:border-0">
                    <td className="p-4 text-sm text-muted-foreground sm:px-6"><span className="flex gap-3"><X weight="bold" aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />{before}</span></td>
                    <td className="p-4 text-sm font-semibold sm:px-6"><span className="flex gap-3"><Check weight="bold" aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{after}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
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

        <Section id="planos" className="border-t border-border">
          <Eyebrow>Planos</Eyebrow>
          <Heading sub="Três planos, o mesmo sistema. Você começa pelo que precisa e sobe quando a oficina crescer, sem trocar de ferramenta e sem perder nada.">
            Escolha o plano da <span className="rounded-md bg-[#ffbe00] px-2 text-[#0f171f] [box-decoration-break:clone]">sua oficina.</span>
          </Heading>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {PLAN_CODES.map((code) => {
              const plan = PLANS[code];
              const highlighted = code === HIGHLIGHTED_PLAN;
              return (
                <article key={code} className={`relative flex flex-col rounded-card border bg-card p-7 shadow-card ${highlighted ? 'border-2 border-[#ffbe00] lg:-my-3 lg:py-10' : 'border-border'}`}>
                  {highlighted && <p className="absolute -top-3.5 left-7 rounded-full bg-[#ffbe00] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#0f171f]">{HIGHLIGHT_LABEL}</p>}
                  <h3 className="text-xl font-extrabold">{plan.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.tagline}</p>
                  <p className="mt-6 text-4xl font-extrabold">{formatCurrencyBRL(plan.monthlyPriceCents)}<span className="text-base font-semibold text-muted-foreground"> por mês</span></p>
                  <p className="mt-1 text-sm text-muted-foreground">ou {formatCurrencyBRL(planPriceCents(code, 'yearly'))} por ano, com {12 - YEARLY_MONTHS_CHARGED} meses grátis</p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                    <li className="flex gap-3"><Check weight="bold" aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /><span><strong>Ordens de serviço, clientes, veículos, agenda e catálogo</strong></span></li>
                    <li className="flex gap-3"><Check weight="bold" aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{plan.limits.users === null ? 'Usuários sem limite' : `Até ${plan.limits.users} usuários`}</li>
                    <li className="flex gap-3"><Check weight="bold" aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{plan.limits.ordersPerMonth === null ? 'Ordens de serviço sem limite' : `Até ${plan.limits.ordersPerMonth} ordens de serviço por mês`}</li>
                    <li className="flex gap-3"><Check weight="bold" aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{(plan.limits.photoStorageMb ?? 0) / 1024} GB de fotos</li>
                    {MODULE_KEYS.map((key) => {
                      const included = plan.modules.includes(key);
                      return (
                        <li key={key} className={`flex gap-3 ${included ? '' : 'text-muted-foreground'}`}>
                          {included ? <Check weight="bold" aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /> : <X weight="bold" aria-hidden className="mt-0.5 size-4 shrink-0" />}
                          <span>{MODULES[key].label}<span className="sr-only">{included ? ' (incluído)' : ' (não incluído)'}</span></span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-8"><CtaButton variant={highlighted ? 'solid' : 'outline'}>Contratar<span className="sr-only"> o plano {plan.name}</span></CtaButton></div>
                </article>
              );
            })}
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">Valores por oficina. O cadastro não gera cobrança: você escolhe o plano dentro do sistema e paga com cartão, na página segura do Stripe. Cancele quando quiser: o sistema segue até o fim do período pago e seus dados continuam guardados.</p>
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

        <Section id="sobre">
          <Heading sub="Quem está por trás do sistema e como falar com a gente.">Sobre o Ofix</Heading>
          <div className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>O Ofix é um sistema de gestão para oficinas mecânicas, desenvolvido e mantido pela <a href={PARENT_SITE} className="font-semibold text-primary underline">{COMPANY.name}</a>. Ele organiza o atendimento da recepção ao financeiro: ordens de serviço, orçamentos aprovados pelo WhatsApp, agenda, histórico de cada veículo e alertas de manutenção.</p>
              <p>Cada oficina tem um ambiente isolado, com usuários e permissões próprios, e os documentos de privacidade, termos de uso, cookies e reembolso são públicos e estão no rodapé.</p>
            </div>
            <dl className="divide-y divide-border rounded-card border border-border bg-card p-6 text-sm shadow-card">
              <div className="pb-3"><dt className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Razão social</dt><dd className="mt-1 font-semibold">{COMPANY.name}</dd></div>
              <div className="py-3"><dt className="text-xs font-bold uppercase tracking-widest text-muted-foreground">CNPJ</dt><dd className="mt-1 font-semibold">{COMPANY.document}</dd></div>
              {COMPANY.address && <div className="py-3"><dt className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Endereço</dt><dd className="mt-1 font-semibold">{COMPANY.address}</dd></div>}
              <div className="pt-3"><dt className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contato</dt><dd className="mt-1 font-semibold"><a className="text-primary underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></dd></div>
            </dl>
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

      <SiteFooter />
    </div>
  );
}
