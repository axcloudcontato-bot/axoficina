'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreatePrivacyRequest, PrivacyRequestResponse, PrivacyRequestStatus, PrivacyRequestType } from '@oficina/contracts';
import { PRIVACY_REQUEST_TYPES } from '@oficina/contracts';
import { apiClient, extractErrorMessage } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission } from '@/features/auth/permissions';
import { CustomerSearchCombobox } from '@/features/customers/components/CustomerSearchCombobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { legalIdentity } from '../legal-content';

const typeLabels: Record<PrivacyRequestType, string> = { ACCESS: 'Acesso e confirmação de dados', CORRECTION: 'Correção de dados', PORTABILITY: 'Portabilidade', RESTRICTION: 'Bloqueio, oposição ou revogação', DELETION: 'Exclusão de dados', REFUND: 'Reembolso', CANCELLATION: 'Cancelamento da contratação' };
const statusLabels: Record<PrivacyRequestStatus, string> = { OPEN: 'Recebida', IN_REVIEW: 'Em análise', COMPLETED: 'Concluída', RETAINED: 'Conservação justificada' };
const selectClass = 'h-10 w-full rounded-button border border-input bg-background px-3 text-sm text-text';
const cardClass = 'rounded-card border border-border bg-surface p-5 sm:p-6';

async function downloadData(url: string, filename: string, body?: object) {
  const response = body ? await apiClient.post(url, body) : await apiClient.get(url);
  const href = URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = href; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(href);
}

export function PrivacyCenter({ mode = 'self' }: { mode?: 'self' | 'admin' }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN' && hasPermission(user, 'settings.manage');
  const canManageCustomers = isAdmin && hasPermission(user, 'customers.manage');
  const manage = mode === 'admin';
  const [type, setType] = useState<PrivacyRequestType>('ACCESS');
  const subject = mode === 'admin' ? 'customer' : 'self';
  const [customerId, setCustomerId] = useState('');
  const [details, setDetails] = useState('');
  const [selected, setSelected] = useState<PrivacyRequestResponse | null>(null);
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<'IN_REVIEW' | 'COMPLETED' | 'RETAINED'>('IN_REVIEW');
  const [retentionUntil, setRetentionUntil] = useState('');
  const [erase, setErase] = useState<PrivacyRequestResponse | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: ['privacy-requests', user?.id, manage && isAdmin],
    queryFn: async () => (await apiClient.get<{ items: PrivacyRequestResponse[] }>(`/api/v1/privacy/requests${manage && isAdmin ? '/manage' : ''}`)).data,
    enabled: Boolean(user) && (mode === 'self' || isAdmin),
  });
  async function refresh() { await queryClient.invalidateQueries({ queryKey: ['privacy-requests'] }); }
  const create = useMutation({
    mutationFn: async (body: CreatePrivacyRequest) => (await apiClient.post<{ request: PrivacyRequestResponse }>('/api/v1/privacy/requests', body)).data,
    onSuccess: (data) => { toast.success(`Solicitação recebida. Protocolo: ${data.request.id}`); setDetails(''); void refresh(); },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const review = useMutation({
    mutationFn: async () => apiClient.post('/api/v1/privacy/requests/resolve', { id: selected!.id, status, response, retentionUntil: status === 'RETAINED' ? new Date(`${retentionUntil}T12:00:00`).toISOString() : undefined }),
    onSuccess: () => { toast.success('Resposta registrada.'); setSelected(null); void refresh(); },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const erasure = useMutation({
    mutationFn: async () => apiClient.post(erase!.customerId ? '/api/v1/privacy/customers/erase' : '/api/v1/privacy/account/erase', { requestId: erase!.id, password, confirmation }),
    onSuccess: () => {
      if (!erase?.customerId) {
        setPassword(''); setConfirmation(''); setErase(null);
        queryClient.clear(); useAuthStore.getState().logout();
        toast.success('Dados da conta apagados na base ativa e sessões encerradas.');
        return;
      }
      toast.success('Dados cadastrais apagados na base ativa. Confira as orientações no protocolo.'); setErase(null); setPassword(''); setConfirmation(''); void refresh(); void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => { setPassword(''); toast.error(extractErrorMessage(error)); },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (subject === 'customer' && !customerId) { toast.error('Selecione o cliente da solicitação.'); return; }
    create.mutate({ type, customerId: subject === 'customer' ? customerId : undefined, details: details.trim() || undefined });
  }
  async function exportRegistry(id?: string) {
    setExporting(true);
    try { await downloadData(id ? '/api/v1/privacy/customers/export' : '/api/v1/privacy/export', id ? 'cadastro-cliente.json' : 'meus-dados.json', id ? { id } : undefined); }
    catch (error) { toast.error(extractErrorMessage(error)); }
    finally { setExporting(false); }
  }
  if (mode === 'admin' && !isAdmin) return <div role="alert" className={cardClass}>Seu perfil não permite gerenciar solicitações da oficina.</div>;
  return <div className="space-y-6 text-text">
    <header><h2 className="text-2xl font-bold">{mode === 'admin' ? 'Solicitações da oficina' : 'Minha privacidade e solicitações'}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{mode === 'admin' ? 'Registre e acompanhe pedidos de clientes, com protocolo e resposta documentada.' : 'Consulte seus dados, exerça direitos da LGPD ou solicite cancelamento e reembolso. Cada pedido recebe um protocolo. Registrar uma solicitação não apaga dados nem executa estorno automaticamente.'}</p>{mode === 'self' && legalIdentity.email && <p className="mt-3 text-sm text-text-muted">Para assuntos do fornecedor, inclusive cancelamento e reembolso do software, encaminhe seu protocolo para <a className="text-primary underline" href={`mailto:${legalIdentity.email}`}>{legalIdentity.email}</a>. Esse envio não é automático.</p>}</header>
    {mode === 'self' && <section className={cardClass}><h3 className="font-bold">Seus dados, suas escolhas</h3><p className="mb-4 mt-2 text-sm leading-6 text-text-muted">Baixe os dados cadastrais da sua conta. Para acesso completo, correção, exclusão ou revisão de tratamento, registre um pedido abaixo. Não há cobrança para exercer seus direitos.</p><Button variant="outline" disabled={exporting} onClick={() => void exportRegistry()}>Baixar meus dados cadastrais</Button><p className="mt-4 text-xs leading-5 text-text-muted">O acesso simplificado deve ser imediato quando possível; a declaração completa de acesso observa até 15 dias, conforme a LGPD. Para outros pedidos, a data exibida é uma meta de acompanhamento, sujeita ao prazo legal aplicável. <Link className="text-primary underline" href="/privacidade">Ler a política de privacidade</Link>.</p></section>}
    {(mode === 'self' || canManageCustomers) && <section className={cardClass}><h3 className="font-bold">Nova solicitação</h3><form onSubmit={submit} className="mt-5 space-y-4">
      {subject === 'customer' && <div><label htmlFor="privacy-customer" className="mb-2 block text-sm font-semibold">Cliente</label><CustomerSearchCombobox id="privacy-customer" value={customerId} onChange={setCustomerId} /><p className="mt-2 text-xs text-text-muted">Verifique a identidade e a legitimidade do pedido sem exigir documento completo por padrão. Para cadastro arquivado, informe o identificador interno.</p><label className="mt-3 block text-xs" htmlFor="privacy-customer-id">Identificador interno do cliente (alternativa à busca)</label><Input id="privacy-customer-id" value={customerId} onChange={(event) => setCustomerId(event.target.value)} placeholder="UUID do cadastro" /></div>}
      <div><label htmlFor="privacy-type" className="mb-2 block text-sm font-semibold">Tipo de solicitação</label><select id="privacy-type" value={type} onChange={(event) => setType(event.target.value as PrivacyRequestType)} className={selectClass}>{PRIVACY_REQUEST_TYPES.filter((item) => subject !== 'customer' || !['REFUND', 'CANCELLATION'].includes(item)).map((item) => <option key={item} value={item}>{typeLabels[item]}</option>)}</select></div>
      <div><label htmlFor="privacy-details" className="mb-2 block text-sm font-semibold">Informações adicionais (opcional)</label><Textarea id="privacy-details" maxLength={2000} rows={3} value={details} onChange={(event) => setDetails(event.target.value)} aria-describedby="privacy-details-help" /><p id="privacy-details-help" className="mt-2 text-xs leading-5 text-text-muted">Descreva apenas o necessário. Não envie senhas, dados sensíveis, documentos completos nem dados de cartão. Motivo do arrependimento não é obrigatório. Solicitações são acompanhadas pelo administrador autorizado da oficina; pedidos sobre o fornecedor devem ser encaminhados ao canal indicado nas políticas.</p></div>
      <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Registrando...' : 'Registrar solicitação'}</Button>
    </form></section>}
    <section className={cardClass}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Protocolos e respostas</h3></div>
      {requests.isPending && <p className="mt-4 text-sm" role="status">Carregando solicitações...</p>}
      {requests.isError && <div role="alert" className="mt-4 text-sm text-danger"><p>{extractErrorMessage(requests.error, 'Não foi possível carregar as solicitações.')}</p><Button variant="outline" className="mt-3" onClick={() => void requests.refetch()}>Tentar novamente</Button></div>}
      {!requests.isPending && !requests.isError && !requests.data?.items.length && <p className="mt-4 text-sm text-text-muted">Nenhuma solicitação registrada.</p>}
      <ul className="mt-4 space-y-4">{requests.data?.items.map((item) => <li key={item.id} className="rounded-button border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">{typeLabels[item.type]}</h4><span className="text-xs font-semibold text-primary">{statusLabels[item.status]}</span></div><p className="mt-2 break-all text-xs text-text-muted">Protocolo: {item.id}</p><p className="mt-1 text-xs text-text-muted">Recebida: {new Date(item.createdAt).toLocaleDateString('pt-BR')} · Acompanhamento: {new Date(item.dueAt).toLocaleDateString('pt-BR')}</p>{item.customerId && <p className="mt-1 break-all text-xs text-text-muted">Cliente: {item.customerId}</p>}{item.details && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.details}</p>}{item.response && <p className="mt-3 whitespace-pre-wrap break-words rounded-button bg-muted p-3 text-sm">{item.response}</p>}{item.retentionUntil && <p className="mt-2 text-xs text-text-muted">Revisão da conservação: {new Date(item.retentionUntil).toLocaleDateString('pt-BR')}</p>}
        {manage && isAdmin && item.status !== 'COMPLETED' && <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { setSelected(item); setResponse(''); setStatus('IN_REVIEW'); setRetentionUntil(''); }}>Analisar e responder</Button>{canManageCustomers && item.customerId && <Button variant="outline" size="sm" disabled={exporting} onClick={() => void exportRegistry(item.customerId)}>Baixar cadastro do cliente</Button>}{canManageCustomers && item.customerId && item.type === 'DELETION' && <Button variant="destructive" size="sm" onClick={() => { setErase(item); setPassword(''); setConfirmation(''); }}>Apagar dados de cadastro isolado</Button>}</div>}
        {!manage && !item.customerId && item.type === 'DELETION' && ['OPEN', 'IN_REVIEW'].includes(item.status) && <Button variant="destructive" size="sm" className="mt-4" onClick={() => { setErase(item); setPassword(''); setConfirmation(''); }}>Apagar minha conta e encerrar sessões</Button>}
      </li>)}</ul><p className="mt-4 text-xs text-text-muted">Exibição dos 100 protocolos mais recentes. Exclusão de conta e de histórico vinculado requer análise do responsável, incluindo obrigações legais, cópias e backups.</p>
    </section>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent><DialogHeader><DialogTitle>Analisar solicitação</DialogTitle><DialogDescription>Informe a providência real, eventual base legal de conservação, quais dados permanecem e a data de revisão. O registro de resposta não executa estorno.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); review.mutate(); }}><label className="block text-sm font-semibold" htmlFor="review-status">Situação</label><select id="review-status" className={selectClass} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="IN_REVIEW">Em análise</option>{selected?.type !== 'DELETION' && <option value="COMPLETED">Concluída (providência já executada)</option>}<option value="RETAINED">Conservação justificada</option></select><label className="block text-sm font-semibold" htmlFor="review-response">Resposta e fundamentação</label><Textarea id="review-response" required minLength={10} maxLength={2000} value={response} onChange={(event) => setResponse(event.target.value)} />{status === 'RETAINED' && <div><label htmlFor="retention-until" className="mb-2 block text-sm">Data de revisão da conservação</label><Input id="retention-until" type="date" required value={retentionUntil} onChange={(event) => setRetentionUntil(event.target.value)} /></div>}<DialogFooter><Button type="submit" disabled={review.isPending}>Registrar resposta</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={Boolean(erase)} onOpenChange={(open) => { if (!open) { setErase(null); setPassword(''); setConfirmation(''); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{erase?.customerId ? 'Apagar dados pessoais do cadastro' : 'Apagar minha conta'}</DialogTitle>
          <DialogDescription>
            {erase?.customerId
              ? 'Operação irreversível na base ativa, permitida apenas para cliente sem veículos, serviços, agenda ou finanças vinculados, incluindo arquivados. Revise a necessidade de guarda antes de continuar.'
              : 'Sua identificação e credenciais serão apagadas na base ativa, suas sessões serão encerradas e você perderá acesso. Baixe seus dados antes de continuar. O último administrador deve transferir a administração primeiro. O acervo da oficina e os identificadores técnicos de rastreabilidade permanecem para análise separada.'}
            {' '}Cópias exportadas, integrações e backups exigem tratamento próprio pelo responsável.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); erasure.mutate(); }}>
          <label htmlFor="erase-password" className="block text-sm font-semibold">Sua senha atual</label>
          <Input id="erase-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          <label htmlFor="erase-confirmation" className="block text-sm font-semibold">Digite EXCLUIR para confirmar a revisão e o apagamento</label>
          <Input id="erase-confirmation" required pattern="EXCLUIR" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          <DialogFooter><Button type="submit" variant="destructive" disabled={erasure.isPending || confirmation !== 'EXCLUIR'}>{erasure.isPending ? 'Apagando...' : 'Apagar dados pessoais'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
