'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { UpdateWhatsAppSettingsRequest } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractErrorMessage } from '@/lib/api/client';
import { settingsApi } from '../api/settings-api';
import { BRANDING_KEY } from '../hooks/use-settings';
import { hasPermission } from '@/features/auth/permissions';
import { useAuthStore } from '@/stores/auth-store';

const SETTINGS_KEY = ['whatsapp-settings'];
const EMPTY: UpdateWhatsAppSettingsRequest = { baseUrl: 'https://chat.axcloud.com.br', sessionId: '', apiKey: '', webhookSecret: '', enabled: false };

export function WhatsAppSettingsForm() {
  const user = useAuthStore((state) => state.user);
  const canView = hasPermission(user, 'settings.view');
  const canManage = hasPermission(user, 'settings.manage');
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: settingsApi.whatsapp, enabled: canView });
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [webhookStatus, setWebhookStatus] = useState('');
  const update = useMutation({ mutationFn: settingsApi.updateWhatsApp });
  const testConnection = useMutation({ mutationFn: settingsApi.testWhatsApp });
  const testWebhook = useMutation({ mutationFn: settingsApi.testWhatsAppWebhook });

  useEffect(() => {
    if (!settings.data) return;
    setForm({ baseUrl: settings.data.baseUrl ?? EMPTY.baseUrl, sessionId: settings.data.sessionId ?? '', apiKey: '', webhookSecret: '', enabled: settings.data.enabled });
    setDirty(false);
  }, [settings.data]);

  function set<K extends keyof UpdateWhatsAppSettingsRequest>(key: K, value: UpdateWhatsAppSettingsRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setConnectionStatus('');
    setWebhookStatus('');
  }

  async function save() {
    try {
      const result = await update.mutateAsync(form);
      queryClient.setQueryData(SETTINGS_KEY, result);
      // Clear entered secrets even if the server response is structurally unchanged.
      setForm((current) => ({ ...current, apiKey: '', webhookSecret: '' }));
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: BRANDING_KEY });
      toast.success('Configuração do WhatsApp atualizada.');
    } catch (error) { toast.error(extractErrorMessage(error, 'Não foi possível salvar o WhatsApp.')); }
  }

  async function test() {
    if (dirty) return toast.warning('Salve a configuração antes de testar a conexão.');
    try {
      const result = await testConnection.mutateAsync();
      setConnectionStatus(result.connected ? 'Conexão validada. A sessão está conectada ao WhatsApp.' : `A API respondeu, mas a sessão está desconectada (${result.status}). Conecte o número no WA-AKG.`);
    } catch (error) { setConnectionStatus(extractErrorMessage(error, 'Não foi possível verificar a conexão com o WA-AKG.')); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); toast.success('Copiado.'); }
    catch { toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.'); }
  }

  async function checkWebhook() {
    if (dirty) return toast.warning('Salve a configuração antes de testar o recebimento.');
    try {
      await testWebhook.mutateAsync();
      setWebhookStatus('Recebimento validado: a URL pública alcançou o webhook desta oficina e confirmou a assinatura. Confira se essa mesma URL, segredo e evento message.received estão cadastrados no WA-AKG.');
    } catch (error) { setWebhookStatus(extractErrorMessage(error, 'Não foi possível validar o recebimento.')); }
  }

  if (!canView) return <p className="text-sm text-text-muted">Seu perfil não permite consultar esta configuração.</p>;
  if (settings.isPending) return <p role="status" className="text-sm text-text-muted">Carregando configuração do WhatsApp...</p>;
  if (settings.isError) return <div role="alert"><p>Não foi possível carregar a configuração.</p><Button variant="outline" className="mt-3" onClick={() => settings.refetch()}>Tentar novamente</Button></div>;
  const busy = update.isPending || testConnection.isPending || testWebhook.isPending;
  return <div className="space-y-6">
    <section className="rounded-card border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-bold">WhatsApp via WA-AKG</h2><p className="mt-1 text-sm text-text-muted">Envie as perguntas da OS com botões na conversa e receba as escolhas automaticamente.</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{settings.data.enabled ? 'Ativo' : 'Inativo'}</span></div>
      <fieldset disabled={!canManage || busy} className="mt-5 space-y-4">
        <label className="grid gap-1.5 text-sm font-semibold">Endereço do WA-AKG<Input type="url" value={form.baseUrl ?? ''} onChange={(event) => set('baseUrl', event.target.value)} placeholder="https://chat.axcloud.com.br" /></label>
        <label className="grid gap-1.5 text-sm font-semibold">ID da sessão<Input value={form.sessionId ?? ''} onChange={(event) => set('sessionId', event.target.value)} placeholder="Copie o sessionId exibido no WA-AKG" maxLength={160} /></label>
        <label className="grid gap-1.5 text-sm font-semibold">Chave de API<Input type="password" value={form.apiKey ?? ''} onChange={(event) => set('apiKey', event.target.value)} autoComplete="new-password" placeholder={settings.data.apiKeyConfigured ? 'Chave configurada · deixe vazio para manter' : 'Chave de API com acesso à sessão'} maxLength={1000} /></label>
        <label className="grid gap-1.5 text-sm font-semibold">Segredo do webhook<Input type="password" value={form.webhookSecret ?? ''} onChange={(event) => set('webhookSecret', event.target.value)} autoComplete="new-password" placeholder={settings.data.webhookSecretConfigured ? 'Segredo configurado · deixe vazio para manter' : 'Use o mesmo segredo no WA-AKG (mínimo 32 caracteres)'} maxLength={500} /></label>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => {
          const bytes = crypto.getRandomValues(new Uint8Array(32));
          set('webhookSecret', Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''));
        }}>Gerar segredo</Button><Button type="button" variant="outline" size="sm" disabled={!form.webhookSecret} onClick={() => copy(form.webhookSecret!)}>Copiar segredo antes de salvar</Button></div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.enabled} onChange={(event) => set('enabled', event.target.checked)} className="size-4 accent-primary" />Ativar envio de botões pelo WA-AKG</label>
        <div className="flex justify-end"><Button type="button" onClick={save}>{update.isPending ? 'Salvando...' : 'Salvar configuração'}</Button></div>
      </fieldset>
      <p className="mt-4 text-xs text-text-muted">A chave e o segredo são criptografados e não são exibidos novamente. O envio direto usa os botões quando “Solicitar resposta por botões” estiver ativado na OS. Mensagens de texto continuam com o compartilhamento manual.</p>
    </section>
    <section className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 className="font-bold">Receber respostas do cliente</h2>
      <p className="mt-2 text-sm text-text-muted">No WA-AKG, crie um webhook para esta sessão, selecione o evento <strong>message.received</strong> e informe o mesmo segredo cadastrado acima. Use esta URL pública HTTPS:</p>
      <label className="mt-4 grid gap-1.5 text-sm font-semibold">URL do webhook<Input readOnly value={settings.data.webhookUrl} onFocus={(event) => event.target.select()} /></label>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => copy(settings.data.webhookUrl)}>Copiar URL do webhook</Button>
      <Button type="button" variant="outline" size="sm" className="ml-2 mt-2" onClick={checkWebhook} disabled={!canManage || busy || dirty || !settings.data.enabled}>{testWebhook.isPending ? 'Validando...' : 'Testar recebimento'}</Button>
      {webhookStatus && <p role="status" className="mt-3 text-sm">{webhookStatus}</p>}
      <p className="mt-3 text-xs text-text-muted">Se aparecer localhost, configure o endereço público da API antes de cadastrar o webhook. O teste de recebimento exige a integração ativa e verifica a resposta JSON do Ofix; uma página HTML com status 200 não confirma o webhook. Use WA-AKG 1.7.0 ou superior com sessão conectada. Cada resposta fica vinculada à pergunta e à OS; mensagens digitadas livremente não são consideradas escolhas de botão.</p>
    </section>
    <section className="rounded-card border border-primary/20 bg-primary-subtle p-5">
      <h2 className="font-bold">Verificar conexão</h2><p className="mt-2 text-sm text-text-muted">Confere a chave e a sessão, sem enviar mensagens. A confirmação do webhook pode ser feita pelo teste do próprio WA-AKG.</p>
      <Button variant="outline" className="mt-4" onClick={test} disabled={!canManage || busy || dirty}>{testConnection.isPending ? 'Verificando...' : 'Testar conexão'}</Button>
      {connectionStatus && <p role="status" className="mt-3 text-sm">{connectionStatus}</p>}
    </section>
  </div>;
}
