'use client';

import { FISCAL_DEFAULTS, FISCAL_DOCUMENT_KIND_DESCRIPTIONS, FISCAL_DOCUMENT_KIND_LABELS, FISCAL_TAX_REGIME_LABELS, FISCAL_TAX_REGIMES, type FiscalDocumentKind, type FiscalSettingsResponse, type UpdateFiscalSettingsRequest } from '@oficina/contracts';
import { CheckCircle, Certificate, FloppyDisk, Info, UploadSimple, WarningCircle } from '@phosphor-icons/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hasPermission } from '@/features/auth/permissions';
import { useUnsavedSettings } from '@/features/settings/hooks/use-unsaved-settings';
import { extractErrorMessage } from '@/lib/api/client';
import { readFileAsBase64 } from '@/lib/read-file-base64';
import { useAuthStore } from '@/stores/auth-store';
import { useFiscalSettings, useUpdateFiscalSettings, useUploadFiscalCertificate } from '../hooks/use-fiscal';

type Form = Omit<UpdateFiscalSettingsRequest, 'issRatePercent'> & { issRatePercent: string };
const KINDS: FiscalDocumentKind[] = ['NFSE', 'NFE', 'NFCE'];
const ENABLED_KEY: Record<FiscalDocumentKind, 'nfseEnabled' | 'nfeEnabled' | 'nfceEnabled'> = { NFSE: 'nfseEnabled', NFE: 'nfeEnabled', NFCE: 'nfceEnabled' };

function toForm(data: FiscalSettingsResponse): Form {
  return {
    environment: data.environment, taxRegime: data.taxRegime, municipalRegistration: data.municipalRegistration ?? '', cityIbgeCode: data.cityIbgeCode ?? '', cnae: data.cnae ?? '',
    nfseEnabled: data.nfseEnabled, nfeEnabled: data.nfeEnabled, nfceEnabled: data.nfceEnabled, serviceListItem: data.serviceListItem, municipalTaxCode: data.municipalTaxCode ?? '',
    issRatePercent: data.issRatePercent === undefined ? '' : String(data.issRatePercent).replace('.', ','), issWithheld: data.issWithheld,
    defaultNcm: data.defaultNcm, defaultCfop: data.defaultCfop, csosn: data.csosn, pisCofinsCst: data.pisCofinsCst, nfceCscId: data.nfceCscId ?? '', nfceCsc: '',
  };
}

export function FiscalSettingsForm() {
  const settings = useFiscalSettings();
  const update = useUpdateFiscalSettings();
  const upload = useUploadFiscalCertificate();
  const user = useAuthStore((state) => state.user);
  const canManage = hasPermission(user, 'settings.manage');
  const canUploadCertificate = canManage && user?.role === 'ADMIN';
  const [form, setForm] = useState<Form | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { if (settings.data && !form) setForm(toForm(settings.data)); }, [settings.data, form]);
  const saved = settings.data ? toForm(settings.data) : null;
  const dirty = Boolean(form && saved && JSON.stringify(form) !== JSON.stringify(saved));
  useUnsavedSettings(dirty && !update.isPending);

  if (settings.isLoading || (settings.data && !form)) return <div className="h-96 animate-pulse rounded-card bg-muted" />;
  if (settings.isError || !settings.data || !form) return <div role="alert" className="rounded-card border border-danger/30 p-6"><p>Não foi possível carregar a configuração fiscal.</p><Button variant="outline" className="mt-3" onClick={() => settings.refetch()}>Tentar novamente</Button></div>;
  const data = settings.data;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => (current ? { ...current, [key]: value } : current));

  function save() {
    if (!form) return;
    const rate = form.issRatePercent.trim() ? Number(form.issRatePercent.replace(',', '.')) : null;
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 10)) return toast.error('A alíquota do ISS deve ficar entre 0 e 10%.');
    if (form.environment === 'PRODUCAO' && data.environment !== 'PRODUCAO' && !window.confirm('Em produção as notas têm valor fiscal e são enviadas à prefeitura e à SEFAZ. Já testou a emissão em homologação?')) return;
    update.mutate({ ...form, issRatePercent: rate, nfceCsc: form.nfceCsc?.trim() || undefined }, {
      onSuccess: (response) => { setForm(toForm(response)); response.lastSyncError ? toast.warning(`Configuração salva, mas o emissor recusou o cadastro: ${response.lastSyncError}`) : toast.success('Configuração fiscal salva.'); },
      onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível salvar a configuração fiscal.')),
    });
  }

  async function sendCertificate() {
    if (!certificateFile) return toast.error('Escolha o arquivo do certificado (.pfx ou .p12).');
    if (!certificatePassword) return toast.error('Informe a senha do certificado.');
    if (dirty) return toast.warning('Salve as configurações antes de enviar o certificado.');
    const dataBase64 = await readFileAsBase64(certificateFile);
    upload.mutate({ fileName: certificateFile.name, dataBase64, password: certificatePassword }, {
      onSuccess: (response) => { setForm(toForm(response)); setCertificateFile(null); setCertificatePassword(''); if (fileInput.current) fileInput.current.value = ''; toast.success('Certificado enviado ao emissor.'); },
      onError: (error) => toast.error(extractErrorMessage(error, 'O emissor não aceitou o certificado.')),
    });
  }

  const validUntil = data.certificate.validUntil ? new Date(data.certificate.validUntil) : null;
  const expiresSoon = validUntil && validUntil.getTime() - Date.now() < 30 * 86_400_000;

  return <div className="space-y-6">
    {!canManage && <p className="text-sm text-text-muted">Seu perfil permite consultar esta configuração, mas não alterá-la.</p>}

    <section className="rounded-card border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-base font-bold">Situação da emissão</h2><p className="mt-1 text-sm text-text-muted">A nota é opcional em cada OS: só sai quando alguém clicar em Emitir nota. Notas emitidas fora do Ofix podem ser registradas na própria OS.</p></div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${data.environment === 'PRODUCAO' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-strong dark:text-warning'}`}>{data.environment === 'PRODUCAO' ? 'Produção' : 'Homologação (teste)'}</span>
      </div>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {KINDS.map((kind) => {
          const pending = data.readiness[kind];
          return <li key={kind} className="rounded-button border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-bold">{pending.length ? <WarningCircle className="size-4 text-warning" aria-hidden="true" /> : <CheckCircle className="size-4 text-success" aria-hidden="true" />}{FISCAL_DOCUMENT_KIND_LABELS[kind]} {pending.length ? '· pendente' : '· pronta'}</p>
            <p className="mt-1 text-xs text-text-muted">{FISCAL_DOCUMENT_KIND_DESCRIPTIONS[kind]}</p>
            {pending.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-text">{pending.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>}
          </li>;
        })}
      </ul>
      {!data.providerAvailable && <p className="mt-4 flex gap-2 rounded-button bg-muted/60 p-3 text-xs text-text-muted"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />A emissão automática depende da ativação no servidor do Ofix. Enquanto isso, as configurações podem ser preenchidas e as notas emitidas no portal da prefeitura ou da SEFAZ podem ser registradas em cada OS.</p>}
      {data.lastSyncError && <p role="alert" className="mt-4 rounded-button border border-danger/30 bg-danger-subtle p-3 text-xs text-danger-strong dark:text-danger">O emissor recusou o último envio do cadastro: {data.lastSyncError}</p>}
    </section>

    <fieldset disabled={!canManage || update.isPending} className="space-y-6">
      <section className="rounded-card border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-bold">Dados fiscais da oficina</h2>
        <p className="mt-1 text-sm text-text-muted">CNPJ, razão social, endereço e inscrição estadual vêm de <Link href="/configuracoes/empresa" className="font-semibold text-primary-ink underline dark:text-primary">Empresa e marca</Link>. Confirme os demais com o seu contador.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="CNPJ"><Input value={data.document} readOnly disabled /></Field>
          <Field label="Inscrição estadual"><Input value={data.stateRegistration ?? 'Não informada'} readOnly disabled /></Field>
          <Field label="Regime tributário"><select className="h-10 w-full rounded-button border border-input bg-card px-3 text-sm" value={form.taxRegime} onChange={(event) => set('taxRegime', event.target.value as Form['taxRegime'])}>{FISCAL_TAX_REGIMES.map((regime) => <option key={regime} value={regime}>{FISCAL_TAX_REGIME_LABELS[regime]}</option>)}</select></Field>
          <Field label="Inscrição municipal" hint="Obrigatória para a NFS-e."><Input value={form.municipalRegistration ?? ''} maxLength={30} onChange={(event) => set('municipalRegistration', event.target.value)} /></Field>
          <Field label="Código IBGE do município" hint="Preenchido pelo endereço da oficina. 7 dígitos."><Input value={form.cityIbgeCode ?? ''} inputMode="numeric" maxLength={7} onChange={(event) => set('cityIbgeCode', event.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="CNAE principal" hint="Ex.: 4520-0/01 (manutenção de veículos)."><Input value={form.cnae ?? ''} maxLength={10} placeholder="4520-0/01" onChange={(event) => set('cnae', event.target.value)} /></Field>
        </div>
      </section>

      <section className="rounded-card border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-bold">Notas que a oficina emite</h2>
        <p className="mt-1 text-sm text-text-muted">Ligue só o que a oficina usa. A maioria das oficinas do Simples emite só a NFS-e de serviços.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">{KINDS.map((kind) => <label key={kind} className="flex cursor-pointer items-start gap-3 rounded-button border border-border p-3">
          <input type="checkbox" className="mt-1 size-4 accent-primary" checked={form[ENABLED_KEY[kind]]} onChange={(event) => set(ENABLED_KEY[kind], event.target.checked)} />
          <span><span className="block text-sm font-bold">{FISCAL_DOCUMENT_KIND_LABELS[kind]}</span><span className="mt-0.5 block text-xs text-text-muted">{FISCAL_DOCUMENT_KIND_DESCRIPTIONS[kind]}</span></span>
        </label>)}</div>
      </section>

      {form.nfseEnabled && <section className="rounded-card border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-bold">NFS-e (serviços)</h2>
        <p className="mt-1 text-sm text-text-muted">Entram na nota os itens de mão de obra da OS, com a parte proporcional do desconto.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Item da lista de serviços" hint={`Padrão ${FISCAL_DEFAULTS.serviceListItem}: conserto e manutenção de veículos.`}><Input value={form.serviceListItem} maxLength={10} onChange={(event) => set('serviceListItem', event.target.value)} /></Field>
          <Field label="Código de tributação municipal" hint="Só se a prefeitura exigir."><Input value={form.municipalTaxCode ?? ''} maxLength={30} onChange={(event) => set('municipalTaxCode', event.target.value)} /></Field>
          <Field label="Alíquota do ISS (%)" hint="No Simples, a da sua faixa. Ex.: 2,01."><Input value={form.issRatePercent} inputMode="decimal" maxLength={5} placeholder="Ex.: 2,00" onChange={(event) => set('issRatePercent', event.target.value)} /></Field>
          <label className="flex cursor-pointer items-start gap-3 self-end rounded-button border border-border p-3"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={form.issWithheld} onChange={(event) => set('issWithheld', event.target.checked)} /><span className="text-sm"><span className="block font-bold">ISS retido pelo cliente</span><span className="text-xs text-text-muted">Raro em oficinas; marque só se o contador orientar.</span></span></label>
        </div>
      </section>}

      {(form.nfeEnabled || form.nfceEnabled) && <section className="rounded-card border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-bold">NF-e e NFC-e (peças)</h2>
        <p className="mt-1 text-sm text-text-muted">Entram as peças e os produtos da OS. O NCM de cada peça vem do catálogo; sem ele, vale o padrão abaixo.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="NCM padrão" hint={`${FISCAL_DEFAULTS.defaultNcm}: outras partes e acessórios de veículos.`}><Input value={form.defaultNcm} inputMode="numeric" maxLength={8} onChange={(event) => set('defaultNcm', event.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="CFOP padrão" hint="5102: venda de mercadoria de terceiros. Para outro estado o Ofix troca por 6102."><Input value={form.defaultCfop} inputMode="numeric" maxLength={4} onChange={(event) => set('defaultCfop', event.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="CSOSN (ICMS no Simples)" hint="102: sem permissão de crédito. 500: ICMS já recolhido por substituição."><Input value={form.csosn} inputMode="numeric" maxLength={3} onChange={(event) => set('csosn', event.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="CST do PIS e da COFINS" hint="49 é o mais comum no Simples."><Input value={form.pisCofinsCst} inputMode="numeric" maxLength={2} onChange={(event) => set('pisCofinsCst', event.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        {form.nfceEnabled && <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <Field label="ID do CSC (NFC-e)" hint="Gerado no portal da SEFAZ do seu estado."><Input value={form.nfceCscId ?? ''} maxLength={10} onChange={(event) => set('nfceCscId', event.target.value)} /></Field>
          <Field label="Código CSC (NFC-e)" hint={data.hasNfceCsc ? 'Já configurado. Preencha só para trocar.' : 'Fica guardado com criptografia.'}><Input type="password" autoComplete="off" value={form.nfceCsc ?? ''} maxLength={60} onChange={(event) => set('nfceCsc', event.target.value)} placeholder={data.hasNfceCsc ? '••••••••' : ''} /></Field>
        </div>}
      </section>}

      <section className="rounded-card border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-bold">Ambiente de emissão</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{(['HOMOLOGACAO', 'PRODUCAO'] as const).map((environment) => <label key={environment} className={`flex cursor-pointer items-start gap-3 rounded-button border p-3 ${form.environment === environment ? 'border-primary bg-selection/20' : 'border-border'}`}>
          <input type="radio" name="environment" className="mt-1 size-4 accent-primary" checked={form.environment === environment} onChange={() => set('environment', environment)} />
          <span><span className="block text-sm font-bold">{environment === 'PRODUCAO' ? 'Produção' : 'Homologação (teste)'}</span><span className="mt-0.5 block text-xs text-text-muted">{environment === 'PRODUCAO' ? 'Notas com valor fiscal, enviadas à prefeitura e à SEFAZ.' : 'Para testar a configuração. As notas não têm valor fiscal.'}</span></span>
        </label>)}</div>
      </section>

      {canManage && <div className="flex justify-end"><Button onClick={save} disabled={!dirty || update.isPending}><FloppyDisk className="size-4" />{update.isPending ? 'Salvando...' : 'Salvar configuração fiscal'}</Button></div>}
    </fieldset>

    <section className="rounded-card border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-base font-bold"><Certificate className="size-5" aria-hidden="true" />Certificado digital A1</h2><p className="mt-1 text-sm text-text-muted">O arquivo e a senha vão direto ao emissor da nota e não ficam guardados no Ofix.</p></div>
        {data.certificate.uploaded && validUntil && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${expiresSoon ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'}`}>Válido até {validUntil.toLocaleDateString('pt-BR')}</span>}
      </div>
      {canUploadCertificate ? <fieldset disabled={upload.isPending || !data.providerAvailable} className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field label="Arquivo do certificado (.pfx ou .p12)"><Input ref={fileInput} type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={(event) => setCertificateFile(event.target.files?.[0] ?? null)} /></Field>
        <Field label="Senha do certificado"><Input type="password" autoComplete="off" value={certificatePassword} onChange={(event) => setCertificatePassword(event.target.value)} /></Field>
        <Button variant="outline" onClick={() => void sendCertificate()}><UploadSimple className="size-4" />{upload.isPending ? 'Enviando...' : data.certificate.uploaded ? 'Trocar certificado' : 'Enviar certificado'}</Button>
      </fieldset> : <p className="mt-4 text-sm text-text-muted">Só o administrador da oficina envia o certificado.</p>}
      {!data.providerAvailable && canUploadCertificate && <p className="mt-2 text-xs text-text-muted">Disponível quando a emissão automática estiver ativa no servidor.</p>}
    </section>
  </div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium">{label}{children}{hint && <span className="block text-xs font-normal text-text-muted">{hint}</span>}</label>;
}
