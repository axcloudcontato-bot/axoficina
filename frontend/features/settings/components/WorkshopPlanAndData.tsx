'use client';

import { useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { DATA_EXPORT_DATASETS, type DataExportDataset, type WorkshopSubscriptionResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { settingsApi } from '../api/settings-api';
import { useWorkshopSubscription } from '../hooks/use-settings';

const STATUS: Record<WorkshopSubscriptionResponse['status'], { label: string; tone: string }> = {
  unconfigured: { label: 'Plano em configuração', tone: 'bg-muted text-text-muted' },
  trial: { label: 'Período de teste', tone: 'bg-selection text-primary' },
  active: { label: 'Em dia', tone: 'bg-success-subtle text-success' },
  past_due: { label: 'Pagamento em atraso', tone: 'bg-danger-subtle text-danger' },
  canceled: { label: 'Cancelada', tone: 'bg-muted text-text-muted' },
};
const DATASETS: Record<DataExportDataset, { title: string; detail: string }> = {
  customers: { title: 'Clientes', detail: 'Nome, documento, contato, endereço e consentimento.' },
  vehicles: { title: 'Veículos', detail: 'Placa, modelo, ano, quilometragem e dono.' },
  'service-orders': { title: 'Ordens de serviço', detail: 'Cliente, veículo, situação, datas, garantia e total.' },
  financial: { title: 'Financeiro', detail: 'Receitas e despesas com categoria, valores e vencimento.' },
};

// The workshop's plan and a way to take its own records away: no one is locked in.
export function WorkshopPlanAndData() {
  const query = useWorkshopSubscription();
  const [busy, setBusy] = useState<DataExportDataset | null>(null);

  async function download(dataset: DataExportDataset) {
    setBusy(dataset);
    try {
      const { blob, filename } = await settingsApi.exportData(dataset);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
      toast.success(`${DATASETS[dataset].title} exportados.`);
    } catch (error) { toast.error(extractErrorMessage(error, 'Não foi possível exportar agora.')); }
    finally { setBusy(null); }
  }

  const plan = query.data;
  return <div className="space-y-6">
    <section aria-label="Minha assinatura" className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-bold">Minha assinatura</h2>
      {query.isLoading && <div role="status" className="mt-4 h-20 animate-pulse rounded-card bg-muted" />}
      {query.isError && <p role="alert" className="mt-3 text-sm text-danger">Não foi possível carregar a assinatura. <button className="underline" onClick={() => query.refetch()}>Tentar novamente</button></p>}
      {plan && <>
        <div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-xl font-bold capitalize">{plan.plan === 'free' ? 'Plano inicial' : plan.plan}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[plan.status].tone}`}>{STATUS[plan.status].label}</span></div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-xs font-semibold text-text-muted">Valor</dt><dd className="mt-1 font-semibold">{plan.amountCents > 0 ? `${formatCurrencyBRL(plan.amountCents)} por ${plan.cycle === 'yearly' ? 'ano' : 'mês'}` : 'A definir'}</dd></div>
          <div><dt className="text-xs font-semibold text-text-muted">{plan.status === 'trial' ? 'O teste termina em' : 'Próximo vencimento'}</dt><dd className="mt-1 font-semibold">{plan.dueAt ? new Date(plan.dueAt).toLocaleDateString('pt-BR') : '—'}</dd></div>
          <div><dt className="text-xs font-semibold text-text-muted">Cliente desde</dt><dd className="mt-1 font-semibold">{new Date(plan.customerSince).toLocaleDateString('pt-BR')}</dd></div>
        </dl>
        {plan.status === 'past_due' && <p role="alert" className="mt-4 rounded-button bg-danger-subtle p-3 text-sm text-danger">O pagamento está em atraso. Fale com o suporte do Ofix para regularizar e evitar a suspensão do acesso.</p>}
        <p className="mt-4 text-xs text-text-muted">Para mudar de plano, ver faturas ou cancelar, fale com o suporte do Ofix.</p>
      </>}
    </section>

    <section aria-label="Exportar dados" className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-bold">Exportar os dados da oficina</h2>
      <p className="mt-1 text-sm text-text-muted">Baixe os seus registros em planilha (CSV, abre no Excel e no Google Planilhas). Os dados são seus: faça uma cópia quando quiser.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">{DATA_EXPORT_DATASETS.map((dataset) => <li key={dataset} className="flex items-start justify-between gap-3 rounded-button border border-border p-3">
        <div><p className="text-sm font-semibold">{DATASETS[dataset].title}</p><p className="mt-0.5 text-xs text-text-muted">{DATASETS[dataset].detail}</p></div>
        <Button variant="outline" size="sm" aria-label={`Baixar ${DATASETS[dataset].title}`} disabled={busy !== null} onClick={() => download(dataset)}><DownloadSimple className="size-4" />{busy === dataset ? 'Gerando...' : 'Baixar'}</Button>
      </li>)}</ul>
      <p className="mt-3 text-xs text-text-muted">Cada download fica registrado no histórico de alterações. As planilhas incluem os registros arquivados ou excluídos, com a data.</p>
    </section>
  </div>;
}
