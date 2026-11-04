import { OfixLogo } from '@/components/brand/ofix-logo';

const BARS = [
  [10, 12], [18, 11], [24, 20], [28, 17], [34, 26], [40, 33],
];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
const NAV = ['Início', 'Ordens de Serviço', 'Clientes', 'Veículos', 'Estoque', 'Financeiro', 'Relatórios'];
const KPIS = [
  ['Ordens de serviço', '24', '+12%'],
  ['Clientes', '88', '+8%'],
  ['Veículos', '16', '+7%'],
  ['Faturamento', 'R$ 12.560', '+16%'],
];

/** Réplica ilustrativa do painel (HTML/CSS, não imagem). Valores de exemplo. */
export function DashboardMock({ className = '' }: { className?: string }) {
  return (
    <figure className={className} aria-label="Ilustração do painel do Ofix com dados de exemplo">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f171f] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" />
        </div>
        <div className="grid grid-cols-[9.5rem_1fr] text-[11px]">
          <aside className="hidden border-r border-white/10 p-3 sm:block" aria-hidden>
            <OfixLogo className="mb-4 w-16 text-white" />
            {NAV.map((item, i) => (
              <div key={item} className={`mb-1 rounded-md px-2.5 py-1.5 font-semibold ${i === 0 ? 'bg-[#ffbe00] text-[#0f171f]' : 'text-white/60'}`}>{item}</div>
            ))}
          </aside>
          <div className="col-span-2 bg-[#f4f6f8] p-4 text-[#0f171f] sm:col-span-1">
            <p className="text-sm font-bold">Visão geral</p>
            <p className="mb-3 text-[10px] text-[#526070]">Acompanhe o desempenho da sua oficina em tempo real.</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {KPIS.map(([label, value, delta]) => (
                <div key={label} className="rounded-lg bg-white p-2.5 shadow-sm">
                  <p className="truncate text-[9px] text-[#526070]">{label}</p>
                  <p className="mt-1 text-base font-extrabold leading-none">{value}</p>
                  <p className="mt-1 text-[9px] font-semibold text-[#16a34a]">↑ {delta}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold">Serviços por mês</p>
                <p className="flex items-center gap-2 text-[9px] text-[#526070]"><i className="size-1.5 rounded-full bg-[#ffbe00]" />Concluídos<i className="size-1.5 rounded-full bg-[#0f171f]" />Em andamento</p>
              </div>
              <div className="flex h-24 items-end gap-3 border-b border-[#dde3e9] px-1" aria-hidden>
                {BARS.map(([a, b], i) => (
                  <div key={MONTHS[i]} className="flex flex-1 items-end justify-center gap-1">
                    <span className="w-2.5 rounded-t-sm bg-[#ffbe00]" style={{ height: `${a * 2.2}px` }} />
                    <span className="w-2.5 rounded-t-sm bg-[#0f171f]" style={{ height: `${b * 2.2}px` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-around text-[9px] text-[#526070]">{MONTHS.map((m) => <span key={m}>{m}</span>)}</div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-white/50">Ilustração com dados de exemplo.</figcaption>
    </figure>
  );
}

/** Conversa de aprovação de orçamento (recurso real: botões de resposta no WhatsApp). */
export function QuoteChatMock() {
  return (
    <div className="mx-auto w-full max-w-xs rounded-2xl bg-[#0b1218] p-3 shadow-xl ring-1 ring-white/10" aria-label="Ilustração de orçamento enviado pelo WhatsApp">
      <div className="rounded-xl rounded-tl-sm bg-[#1c2a35] p-3 text-[13px] leading-relaxed text-white">
        <p className="font-bold">Ofix</p>
        <p className="mt-1 text-white/80">Olá, João! O orçamento do seu <b className="text-white">Honda HR-V</b> está pronto.</p>
        <p className="mt-2 text-white/80">Você aprova este orçamento para realizarmos o serviço?</p>
      </div>
      <div className="mt-2 grid gap-1.5">
        <span className="rounded-lg bg-[#ffbe00] py-2 text-center text-[13px] font-bold text-[#0f171f]">Aprovar orçamento</span>
        <span className="rounded-lg bg-white/10 py-2 text-center text-[13px] font-semibold text-white">Falar com a oficina</span>
      </div>
    </div>
  );
}

const FLOW = ['Aberta', 'Aguardando aprovação', 'Em andamento', 'Aguardando peças', 'Concluída', 'Entregue'];

const ITEMS = [
  ['Troca de óleo e filtro', 'Serviço', 'R$ 180,00'],
  ['Pastilha de freio dianteira', 'Peça', 'R$ 240,00'],
  ['Alinhamento e balanceamento', 'Serviço', 'R$ 160,00'],
];

/** Fluxo de status (rótulos reais do sistema) e itens de uma OS de exemplo. */
export function StatusFlowMock() {
  return (
    <div className="mt-6">
      <ol className="flex flex-wrap gap-2" aria-label="Etapas de uma ordem de serviço">
        {FLOW.map((label, i) => (
          <li key={label} className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold ${i === 2 ? 'border-[#ffbe00] bg-[#ffbe00] text-[#0f171f]' : 'border-border bg-muted text-muted-foreground'}`}>
            <span className="opacity-60">{i + 1}</span>{label}
          </li>
        ))}
      </ol>
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface" aria-label="Ilustração de itens de uma ordem de serviço, com dados de exemplo">
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2.5 text-xs font-bold">
          <span>OS #1042 · Honda HR-V</span><span className="text-muted-foreground">3 fotos anexadas</span>
        </div>
        {ITEMS.map(([name, kind, price]) => (
          <div key={name} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-4 py-3 text-sm last:border-0">
            <span className="font-semibold">{name}</span>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{kind}</span>
            <span className="w-24 text-right font-bold tabular-nums">{price}</span>
          </div>
        ))}
        <div className="flex items-center justify-between bg-[#0f171f] px-4 py-3 text-sm font-bold text-white"><span>Total</span><span className="text-[#ffbe00] tabular-nums">R$ 580,00</span></div>
      </div>
    </div>
  );
}
