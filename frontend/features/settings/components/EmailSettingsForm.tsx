'use client';

import type { UpdateEmailSettingsRequest } from '@oficina/contracts';
import { EnvelopeOpen, FloppyDisk, PaperPlaneTilt, ShieldCheck } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { extractErrorMessage } from '@/lib/api/client';
import { useSettings, useTestEmailSettings, useUpdateEmailSettings } from '../hooks/use-settings';

const EMPTY: UpdateEmailSettingsRequest = { host: '', port: 587, secure: false, username: '', password: '', fromName: '', fromEmail: '', replyTo: '', enabled: false };

export function EmailSettingsForm() {
  const settings = useSettings();
  const update = useUpdateEmailSettings();
  const test = useTestEmailSettings();
  const [form, setForm] = useState(EMPTY);
  const [recipient, setRecipient] = useState('');
  useEffect(() => {
    if (!settings.data) return;
    const email = settings.data.email;
    setForm({ host: email.host ?? '', port: email.port, secure: email.secure, username: email.username ?? '', password: '', fromName: email.fromName ?? '', fromEmail: email.fromEmail ?? '', replyTo: email.replyTo ?? '', enabled: email.enabled });
    setRecipient(settings.data.company.email ?? email.fromEmail ?? '');
  }, [settings.data]);
  const set = <K extends keyof UpdateEmailSettingsRequest>(key: K, value: UpdateEmailSettingsRequest[K]) => setForm((current) => ({ ...current, [key]: value }));

  function save() {
    update.mutate(form, {
      onSuccess: () => toast.success('Configuração de e-mail atualizada.'),
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível salvar a configuração.')),
    });
  }
  function sendTest() {
    if (!recipient.trim()) return toast.error('Informe o destinatário do teste.');
    test.mutate({ recipient }, {
      onSuccess: () => toast.success(`E-mail de teste enviado para ${recipient}.`),
      onError: (error) => toast.error(extractErrorMessage(error, 'Falha ao enviar o e-mail de teste.')),
    });
  }

  if (settings.isLoading) return <div className="h-96 animate-pulse rounded-card bg-muted" />;
  const configured = settings.data?.email.passwordConfigured;
  return <div className="space-y-6">
    <section className="rounded-card border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-bold">Servidor de saída (SMTP)</h2><p className="mt-1 text-sm text-text-muted">Use os dados fornecidos pelo serviço de e-mail da sua empresa.</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${form.enabled ? 'bg-success-subtle text-success' : 'bg-muted text-text-muted'}`}>{form.enabled ? 'Ativo' : 'Inativo'}</span></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-6">
        <div className="sm:col-span-4"><Field label="Servidor SMTP"><Input value={form.host ?? ''} onChange={(e) => set('host', e.target.value)} placeholder="smtp.seudominio.com.br" /></Field></div>
        <div className="sm:col-span-2"><Field label="Porta"><Input type="number" min={1} max={65535} value={form.port} onChange={(e) => set('port', Number(e.target.value))} /></Field></div>
        <div className="sm:col-span-3"><Field label="Usuário"><Input value={form.username ?? ''} onChange={(e) => set('username', e.target.value)} autoComplete="off" /></Field></div>
        <div className="sm:col-span-3"><Field label="Senha"><Input type="password" value={form.password ?? ''} onChange={(e) => set('password', e.target.value)} placeholder={configured ? 'Senha já configurada · deixe vazio para manter' : 'Senha SMTP'} autoComplete="new-password" /></Field></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-5"><Check checked={form.secure} onChange={(value) => set('secure', value)} label="Conexão SSL/TLS direta" /><Check checked={form.enabled} onChange={(value) => set('enabled', value)} label="Ativar envio pelo sistema" /></div>
    </section>
    <section className="rounded-card border border-border bg-card p-5 shadow-sm"><h2 className="text-base font-bold">Identidade do remetente</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Nome do remetente"><Input value={form.fromName ?? ''} onChange={(e) => set('fromName', e.target.value)} placeholder="Minha Oficina" /></Field><Field label="E-mail remetente"><Input type="email" value={form.fromEmail ?? ''} onChange={(e) => set('fromEmail', e.target.value)} placeholder="atendimento@oficina.com.br" /></Field><Field label="Responder para"><Input type="email" value={form.replyTo ?? ''} onChange={(e) => set('replyTo', e.target.value)} placeholder="Opcional" /></Field></div><div className="mt-5 flex justify-end"><Button onClick={save} disabled={update.isPending}><FloppyDisk className="size-4" />{update.isPending ? 'Salvando...' : 'Salvar configuração'}</Button></div></section>
    <section className="rounded-card border border-primary/20 bg-primary-subtle p-5"><div className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-button bg-card text-primary"><EnvelopeOpen className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="font-bold">Teste de entrega</h2><p className="mt-1 text-sm text-text-muted">Salve a configuração e envie uma mensagem para confirmar autenticação e entrega.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="destinatario@email.com" /><Button variant="outline" onClick={sendTest} disabled={test.isPending}><PaperPlaneTilt className="size-4" />{test.isPending ? 'Enviando...' : 'Enviar teste'}</Button></div></div></div></section>
    <p className="flex items-center gap-2 text-xs text-text-muted"><ShieldCheck className="size-4" />A senha é criptografada antes de ser armazenada e nunca é exibida novamente.</p>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-semibold">{label}{children}</label>; }
function Check({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) { return <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-primary" />{label}</label>; }
