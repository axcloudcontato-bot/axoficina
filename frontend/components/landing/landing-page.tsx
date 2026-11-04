import Link from 'next/link';
import { ArrowRight, Check, Crown, ShieldCheck } from '@phosphor-icons/react/dist/ssr';
import { MODULE_KEYS, MODULES, PLAN_CODES, PLANS, TRIAL_DAYS } from '@oficina/contracts';
import { OfixLogo } from '@/components/brand/ofix-logo';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { SiteFooter } from './site-footer';
import { FAQ } from './faq';

const signup = '/cadastro';

function TrialLink({ dark = false, children = `Testar ${TRIAL_DAYS} dias grátis` }: { dark?: boolean; children?: string }) {
  return <Link href={signup} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-button px-5 text-sm font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${dark ? 'bg-[#0f171f] text-white hover:bg-[#27323d] focus-visible:outline-[#0f171f]' : 'bg-[#ffbe00] text-[#0f171f] hover:bg-[#ffd033] focus-visible:outline-[#ffbe00]'}`}>{children}<ArrowRight weight="bold" className="size-4" /></Link>;
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="max-w-3xl"><p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-[#7a5800]">{eyebrow}</p><h2 className="text-3xl font-extrabold leading-tight tracking-tight text-[#0f171f] sm:text-5xl">{title}</h2>{description && <p className="mt-5 text-base leading-relaxed text-[#526070] sm:text-lg">{description}</p>}</div>;
}

const flow = [
  ['01', 'Cliente chega', 'Encontre ou cadastre cliente e veículo, com o histórico à mão.'],
  ['02', 'Abra a OS', 'Registre o problema, adicione itens e fotos e acompanhe o responsável.'],
  ['03', 'Peça aprovação', 'Envie o orçamento e registre a resposta na ordem de serviço.'],
  ['04', 'Entregue e cobre', 'Finalize o serviço e acompanhe parcelas e recebimentos.'],
] as const;

const benefits = [
  { label: 'Histórico', title: 'Cada carro com histórico', text: 'Serviços, fotos e andamento reunidos por veículo. A equipe encontra a informação sem depender da memória de quem atendeu.' },
  { label: 'Comunicação', title: 'Cliente informado', text: 'No plano Completo, envie o orçamento pelo WhatsApp e acompanhe a resposta direto na OS.' },
  { label: 'Financeiro', title: 'Caixa à vista', text: 'A partir do Profissional, organize contas, parcelas de OS e relatórios no mesmo sistema.' },
] as const;

function ServiceOrderPreview() {
  return (
    <figure className="overflow-hidden rounded-xl border border-white/10 bg-[#f4f6f8] text-[#0f171f] shadow-[0_30px_70px_-25px_rgba(0,0,0,0.65)]" aria-label="Exemplo ilustrativo de ordem de serviço no Ofix">
      <div className="flex items-center justify-between border-b border-[#dde3e9] bg-white px-4 py-3 text-[11px] font-extrabold sm:px-6"><span>OFIX / ORDEM DE SERVIÇO</span><span>OS #1042</span></div>
      <div className="p-5 sm:p-7">
        <p className="text-xs text-[#526070]">Honda HR-V · João Martins</p>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h3 className="text-xl font-extrabold sm:text-2xl">Revisão e freios</h3><span className="rounded-full bg-[#fff4c8] px-3 py-1 text-xs font-bold text-[#765600]">Aguardando aprovação</span></div>
        <div className="mt-6 space-y-2 text-xs sm:text-sm">
          {([['Troca de óleo e filtro', 'R$ 180,00'], ['Pastilhas dianteiras', 'R$ 240,00'], ['Alinhamento', 'R$ 160,00']] as const).map(([name, price]) => <div key={name} className="flex justify-between gap-3 rounded-lg border border-[#dde3e9] bg-white px-4 py-3"><span className="font-semibold">{name}</span><span className="shrink-0 tabular-nums">{price}</span></div>)}
          <div className="flex justify-between gap-3 rounded-lg border border-[#dde3e9] bg-white px-4 py-3"><span className="font-semibold">Orçamento enviado ao cliente</span><span className="shrink-0 font-bold text-[#166534]">WhatsApp*</span></div>
        </div>
      </div>
      <div className="flex justify-between bg-[#27323d] px-5 py-4 text-xs font-bold text-white sm:px-7 sm:text-sm"><span>Total do orçamento</span><span className="tabular-nums text-[#ffbe00]">R$ 580,00</span></div>
      <figcaption className="bg-[#0f171f] px-5 py-2 text-right text-[11px] text-white/60 sm:px-7">Ilustração com dados de exemplo. *WhatsApp no plano Completo.</figcaption>
    </figure>
  );
}

export function LandingPage() {
  return (
    <div className="bg-[#f4f6f8] text-[#0f171f]">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <header className="dark sticky top-0 z-50 border-b border-white/10 bg-[#0f171f]/95 text-white backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label="Ofix, página inicial"><OfixLogo className="w-24 text-white" /></Link>
          <nav aria-label="Seções" className="hidden items-center gap-6 text-sm font-semibold text-white/70 md:flex">
            <a href="#como-funciona" className="hover:text-white">Como funciona</a><a href="#beneficios" className="hover:text-white">Benefícios</a><a href="#planos" className="hover:text-white">Planos</a>
          </nav>
          <div className="flex items-center gap-2"><Link href="/entrar" className="hidden px-3 py-2 text-sm font-semibold text-white/70 hover:text-white sm:inline">Entrar</Link><Link href={signup} className="rounded-button bg-[#ffbe00] px-3 py-2.5 text-xs font-extrabold text-[#0f171f] hover:bg-[#ffd033] sm:px-4 sm:text-sm">Testar grátis</Link></div>
        </div>
      </header>

      <main id="conteudo">
        <section className="dark bg-[#0f171f] text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-2 lg:py-28">
            <div>
              <p className="mb-5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#ffbe00]">Sistema para oficina mecânica</p>
              <h1 className="text-4xl font-extrabold leading-[1.07] tracking-tight sm:text-6xl">Da entrada do carro à cobrança, <span className="text-[#ffbe00]">tudo sob controle.</span></h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">Ordens de serviço, equipe, clientes e financeiro no mesmo fluxo. Saiba o que está acontecendo em cada veículo e dê respostas rápidas, sem procurar em cadernos ou conversas.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><TrialLink /><a href="#como-funciona" className="inline-flex min-h-12 items-center justify-center rounded-button border border-white/30 px-5 text-sm font-bold text-white hover:bg-white/10">Ver como funciona</a></div>
              <p className="mt-5 text-sm text-white/60">Sem cartão · Acesso pelo navegador · Planos a partir de {formatCurrencyBRL(PLANS.essencial.monthlyPriceCents)}/mês</p>
            </div>
            <ServiceOrderPreview />
          </div>
        </section>
        <div className="border-b border-[#dde3e9] bg-white text-[#0f171f]"><ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-10 gap-y-3 px-5 py-7 text-sm font-semibold text-[#0f171f] sm:px-8">{[`${TRIAL_DAYS} dias grátis`, 'Sem cartão', 'Dados separados por oficina', 'WhatsApp no plano Completo'].map((item) => <li key={item} className="flex items-center gap-2"><Check weight="bold" className="size-4 text-[#7a5800]" />{item}</li>)}</ul></div>

        <section id="como-funciona" className="scroll-mt-16 bg-[#f4f6f8] text-[#0f171f]"><div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28"><SectionTitle eyebrow="Uma rotina, um fluxo" title="O atendimento avança. A informação acompanha." description="Veja o caminho de uma ordem de serviço, do balcão até o pagamento." /><ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{flow.map(([number, title, text]) => <li key={number} className="border-t-4 border-[#ffbe00] pt-5"><span className="text-sm font-extrabold text-[#7a5800]">{number}</span><h3 className="mt-3 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[#526070]">{text}</p></li>)}</ol></div></section>

        <section id="beneficios" className="scroll-mt-16 bg-white text-[#0f171f]"><div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28"><SectionTitle eyebrow="O que muda na prática" title="Menos procura. Mais decisão." /><div className="mt-12 grid gap-8 md:grid-cols-3">{benefits.map(({ label, title, text }) => <article key={title} className="border-t border-[#dde3e9] pt-6"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7a5800]">{label}</p><h3 className="mt-4 text-xl font-bold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-[#526070]">{text}</p></article>)}</div></div></section>

        <section className="dark bg-[#0f171f] text-white"><div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:items-center"><div><p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-[#ffbe00]">Feito para a equipe</p><h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">Todos sabem qual é o próximo passo.</h2><p className="mt-5 leading-relaxed text-white/70">A recepção abre o atendimento, o mecânico atualiza a execução e o gestor acompanha o que precisa de atenção. Perfis e permissões organizam o acesso de cada pessoa.</p></div><ul className="grid gap-4 sm:grid-cols-2">{[['Recepção', 'Cliente, veículo, agenda e OS no mesmo lugar.'], ['Mecânico', 'Itens, fotos e andamento à mão no pátio.'], ['Financeiro', 'Parcelas, contas e recebimentos conectados.'], ['Gestor', 'Visão da operação e produtividade da equipe.']].map(([title, text]) => <li key={title} className="border-l-2 border-[#ffbe00] pl-4"><strong>{title}</strong><p className="mt-1 text-sm text-white/60">{text}</p></li>)}</ul></div></section>

        <section id="planos" className="scroll-mt-16 bg-[#f4f6f8] text-[#0f171f]"><div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28"><SectionTitle eyebrow="Planos" title="Comece pelo que sua oficina precisa." description={`Teste todos os recursos do Completo por ${TRIAL_DAYS} dias. Depois escolha um plano, sem perder os dados que cadastrou.`} /><div className="mt-14 grid gap-8 lg:grid-cols-3 lg:gap-5">{PLAN_CODES.map((code) => { const plan = PLANS[code]; const featured = code === 'profissional'; return <article key={code} className={`relative flex flex-col rounded-card border bg-white p-7 shadow-card ${featured ? 'border-2 border-[#ffbe00] shadow-[0_18px_45px_-18px_rgba(15,23,31,0.28)] lg:z-10 lg:-my-4 lg:px-8 lg:py-10' : 'border-[#dde3e9]'}`}>{featured && <p className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#ffbe00] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[#0f171f] shadow-sm"><Crown weight="fill" aria-hidden className="size-4" />Recomendado</p>}<h3 className="text-xl font-extrabold">{plan.name}</h3><p className="mt-2 min-h-12 text-sm text-[#526070]">{plan.tagline}</p><p className="mt-5 text-3xl font-extrabold tabular-nums">{formatCurrencyBRL(plan.monthlyPriceCents)}<span className="text-sm font-medium text-[#526070]">/mês</span></p><ul className="mt-6 flex-1 space-y-3 text-sm"><li>OS, clientes, veículos, agenda e catálogo</li><li>{plan.limits.users === null ? 'Usuários sem limite' : `Até ${plan.limits.users} usuários`}</li><li>{plan.limits.ordersPerMonth === null ? 'OS sem limite' : `Até ${plan.limits.ordersPerMonth} OS/mês`}</li>{MODULE_KEYS.map((key) => <li key={key} className={plan.modules.includes(key) ? 'font-semibold' : 'text-[#526070]'}><span aria-hidden>{plan.modules.includes(key) ? '✓ ' : '— '}</span>{MODULES[key].label}</li>)}</ul><div className="mt-8"><TrialLink>{`Testar grátis`}</TrialLink></div></article>; })}</div><p className="mt-12 text-center text-sm leading-relaxed text-[#526070]">Valores por oficina. Sem cartão durante o teste. Após os {TRIAL_DAYS} dias, escolha e pague um plano para continuar usando. Cancele quando quiser.</p></div></section>

        <section className="bg-white text-[#0f171f]"><div className="mx-auto grid max-w-6xl gap-9 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-start"><div><SectionTitle eyebrow="Confiança" title="Sua oficina, seus dados." description="Cada oficina tem seu próprio ambiente. Defina o acesso da equipe por função e consulte as condições de uso e privacidade antes de começar." /><div className="mt-8 flex items-center gap-3 text-sm font-semibold"><ShieldCheck weight="duotone" className="size-7 text-[#7a5800]" /> Ambiente separado por oficina</div></div><div className="divide-y divide-[#dde3e9] border-y border-[#dde3e9]">{FAQ.filter(([question]) => ['Posso migrar os dados da minha planilha?', 'Como funciona o suporte?', 'Posso cancelar quando quiser?', 'Posso levar meus dados embora?', 'Como funciona a aprovação pelo WhatsApp?'].includes(question)).map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none justify-between gap-4 font-bold">{question}<span aria-hidden className="text-xl text-[#7a5800] group-open:rotate-45">+</span></summary><p className="mt-3 text-sm leading-relaxed text-[#526070]">{answer}</p></details>)}</div></div></section>

        <section className="bg-[#ffbe00] text-[#0f171f]"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center"><div><h2 className="max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">Comece pela sua próxima ordem de serviço.</h2><p className="mt-3 max-w-xl text-sm font-medium">Teste todos os recursos por {TRIAL_DAYS} dias. Escolha o plano depois, sem cartão no cadastro.</p></div><TrialLink dark /></div></section>
      </main>
      <SiteFooter />
    </div>
  );
}
