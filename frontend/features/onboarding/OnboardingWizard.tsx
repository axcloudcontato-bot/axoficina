'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChangeEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Buildings, CheckCircle, Image as ImageIcon, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { DEFAULT_AGENDA_HOURS, isValidDocument, type CompanySettingsResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCNPJ, formatCPF, formatPhone } from '@/lib/format-br-document';
import { cn } from '@/lib/utils';
import { useBranding, useCompleteOnboarding, useSettings, useUpdateAgendaHours, useUpdateCompanySettings, useUpdateOrderDefaults } from '@/features/settings/hooks/use-settings';

const STEPS = ['Sua oficina', 'Contato', 'Endereço', 'Funcionamento', 'Documentos', 'Pronto'] as const;
const DAYS = [{ value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }, { value: 0, label: 'Dom' }];
const selectClass = 'h-10 w-full rounded-button border border-input bg-background px-3 text-sm';
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const digits = (value = '') => value.replace(/\D/g, '');
const maskDocument = (value: string) => { const d = digits(value); return d.length === 11 ? formatCPF(d) : d.length === 14 ? formatCNPJ(d) : value; };
const maskPhone = (value: string) => { const d = digits(value); return [10, 11].includes(d.length) ? formatPhone(d) : value; };
const maskPostalCode = (value: string) => { const d = digits(value); return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : value; };
const validPhone = (value?: string) => /^\d{10,13}$/.test(digits(value));

// First access: the company is set up one short screen at a time. Each "Avançar" saves what the screen asked,
// so leaving halfway keeps the answers and the guide resumes where the data stops.
export function OnboardingWizard() {
  const router = useRouter();
  const settings = useSettings();
  const branding = useBranding();
  const updateCompany = useUpdateCompanySettings();
  const updateAgenda = useUpdateAgendaHours();
  const updateDefaults = useUpdateOrderDefaults();
  const complete = useCompleteOnboarding();

  const [step, setStep] = useState(0);
  const [company, setCompany] = useState<CompanySettingsResponse | null>(null);
  const [hours, setHours] = useState({ openHour: DEFAULT_AGENDA_HOURS.openHour, closeHour: DEFAULT_AGENDA_HOURS.closeHour, workDays: DEFAULT_AGENDA_HOURS.workDays, bays: '' });
  const [warranty, setWarranty] = useState('90');
  const [validity, setValidity] = useState('7');
  const [terms, setTerms] = useState('');
  const [findingCep, setFindingCep] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data || !branding.data || company) return;
    setCompany({ ...settings.data.company, document: maskDocument(settings.data.company.document) });
    const agenda = branding.data.agendaHours;
    if (agenda) setHours({ openHour: agenda.openHour, closeHour: agenda.closeHour, workDays: agenda.workDays, bays: agenda.bays ? String(agenda.bays) : '' });
    const defaults = branding.data.orderDefaults;
    if (defaults) { if (defaults.defaultWarrantyDays != null) setWarranty(String(defaults.defaultWarrantyDays)); if (defaults.quoteValidityDays != null) setValidity(String(defaults.quoteValidityDays)); setTerms(defaults.documentTerms ?? ''); }
  }, [settings.data, branding.data, company]);

  const saving = updateCompany.isPending || updateAgenda.isPending || updateDefaults.isPending || complete.isPending;
  const set = (key: keyof CompanySettingsResponse, value: string | undefined) => setCompany((current) => current && { ...current, [key]: value });

  if (settings.isError || branding.isError) return <div role="alert" className="rounded-card border border-danger/30 bg-card p-6 text-sm"><p>Não foi possível carregar os dados da oficina.</p><Button variant="outline" className="mt-3" onClick={() => { void settings.refetch(); void branding.refetch(); }}>Tentar novamente</Button></div>;
  if (!company) return <div className="h-96 animate-pulse rounded-card bg-muted" />;

  async function lookupPostalCode(value: string) {
    if (digits(value).length !== 8) return;
    setFindingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits(value)}/json/`);
      const address = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (address.erro) return void setError('CEP não encontrado. Confira os números ou preencha o endereço abaixo.');
      setCompany((current) => current && { ...current, addressStreet: current.addressStreet || address.logradouro || undefined, addressDistrict: current.addressDistrict || address.bairro || undefined, addressCity: current.addressCity || address.localidade || undefined, addressState: current.addressState || address.uf || undefined });
    } catch { /* the address is typed by hand when the lookup is out */ }
    finally { setFindingCep(false); }
  }

  function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return void setError('Use uma imagem PNG, JPEG ou WebP.');
    if (file.size > 500 * 1024) return void setError('A logo deve ter no máximo 500 KiB.');
    setError(null);
    const reader = new FileReader();
    reader.onload = () => set('logoDataUrl', String(reader.result));
    reader.readAsDataURL(file);
  }

  // The first message that applies to what is on screen, or null when the step can be saved.
  function problem(): string | null {
    const current = company!;
    if (step === 0) {
      if (!current.name.trim()) return 'Informe o nome da oficina.';
      if (!isValidDocument(current.document)) return 'Este CPF/CNPJ não é válido. Confira os números: ele sai impresso em todo orçamento e OS.';
    }
    if (step === 1) {
      if (!validPhone(current.phone) && !validPhone(current.whatsapp)) return 'Informe um telefone ou WhatsApp com DDD, para os clientes falarem com a oficina.';
      if (current.phone && !validPhone(current.phone)) return 'O telefone precisa ter DDD e número.';
      if (current.whatsapp && !validPhone(current.whatsapp)) return 'O WhatsApp precisa ter DDD e número.';
      if (current.email && !/^\S+@\S+\.\S+$/.test(current.email.trim())) return 'Informe um e-mail válido.';
      if (current.website && !/^https?:\/\//i.test(current.website.trim())) return 'Informe o site com http:// ou https://.';
    }
    if (step === 2) {
      if (current.addressPostalCode && !/^\d{5}-?\d{3}$/.test(current.addressPostalCode.trim())) return 'Informe um CEP válido.';
      if (!current.addressStreet?.trim() || !current.addressCity?.trim() || !/^[A-Za-z]{2}$/.test(current.addressState?.trim() ?? '')) return 'Informe rua, cidade e UF da oficina.';
    }
    if (step === 3) {
      if (hours.openHour >= hours.closeHour) return 'O horário de fechamento deve ser depois da abertura.';
      if (hours.workDays.length === 0) return 'Escolha ao menos um dia de funcionamento.';
      if (hours.bays && !(Number(hours.bays) >= 1 && Number(hours.bays) <= 100)) return 'Informe de 1 a 100 vagas, ou deixe em branco.';
    }
    if (step === 4) {
      if (warranty && !(Number.isInteger(Number(warranty)) && Number(warranty) >= 0 && Number(warranty) <= 3650)) return 'Informe a garantia em dias, de 0 a 3650.';
      if (validity && !(Number.isInteger(Number(validity)) && Number(validity) >= 1 && Number(validity) <= 365)) return 'Informe a validade do orçamento em dias, de 1 a 365.';
    }
    return null;
  }

  async function advance() {
    const message = problem();
    if (message) return void setError(message);
    setError(null);
    try {
      if (step <= 2 || step === 4) {
        const payload = step === 4 ? { ...company!, documentFooter: company!.documentFooter?.trim() || undefined } : company!;
        await updateCompany.mutateAsync(payload);
      }
      if (step === 3) await updateAgenda.mutateAsync({ ...(branding.data?.agendaHours ?? DEFAULT_AGENDA_HOURS), openHour: hours.openHour, closeHour: hours.closeHour, workDays: hours.workDays, bays: hours.bays ? Number(hours.bays) : null });
      if (step === 4) await updateDefaults.mutateAsync({ defaultWarrantyDays: warranty ? Number(warranty) : null, quoteValidityDays: validity ? Number(validity) : null, documentTerms: terms.trim() || null, acceptedPaymentMethods: branding.data?.orderDefaults?.acceptedPaymentMethods ?? [] });
      setStep((value) => value + 1);
    } catch (failure) {
      setError(extractErrorMessage(failure, 'Não foi possível salvar agora. Tente de novo.'));
    }
  }

  async function finish() {
    try {
      await complete.mutateAsync();
      toast.success('Oficina configurada. Bom trabalho!');
      router.replace('/painel');
    } catch (failure) {
      setError(extractErrorMessage(failure, 'Não foi possível concluir agora. Tente de novo.'));
    }
  }

  const last = step === STEPS.length - 1;
  const toggleDay = (day: number) => setHours((current) => ({ ...current, workDays: current.workDays.includes(day) ? current.workDays.filter((value) => value !== day) : [...current.workDays, day] }));
  const address = [company.addressStreet, company.addressNumber, company.addressDistrict, company.addressCity && `${company.addressCity}${company.addressState ? `/${company.addressState.toUpperCase()}` : ''}`].filter(Boolean).join(', ');

  return <div className="mx-auto w-full max-w-2xl">
    <header className="mb-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Configuração inicial</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-text">Vamos preparar a sua oficina</h1>
      <p className="mt-1 text-sm text-text-muted">Preencha cada tela e clique em Avançar. Leva poucos minutos e tudo pode ser mudado depois em Configurações.</p>
    </header>

    <nav aria-label="Etapas da configuração" className="mb-6">
      <p className="mb-2 flex items-baseline justify-between text-sm"><span className="font-bold">{`Passo ${step + 1} de ${STEPS.length}`}: {STEPS[step]}</span></p>
      <ol className="grid grid-cols-6 gap-1.5" role="list">{STEPS.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className="min-w-0"><div className={cn('h-1.5 rounded-full', index <= step ? 'bg-primary' : 'bg-border')} /><span className={cn('mt-1 hidden truncate text-[11px] sm:block', index === step ? 'font-bold text-text' : 'text-text-muted')}>{label}</span></li>)}</ol>
    </nav>

    <section className="rounded-card border border-border bg-card p-5 shadow-sm sm:p-6">
      <fieldset disabled={saving} className="space-y-5">
        {step === 0 && <>
          <StepTitle title="Como se chama a sua oficina?" help="Estes dados aparecem no sistema e em todos os orçamentos e ordens de serviço impressos." />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-card border border-slate-700 bg-slate-900">
              {company.logoDataUrl ? <Image src={company.logoDataUrl} alt="Prévia da logo" width={96} height={96} unoptimized className="size-full object-contain p-2" /> : <Buildings className="size-9 text-text-muted" aria-hidden="true" />}
            </div>
            <div className="space-y-2"><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><label className="cursor-pointer"><ImageIcon className="size-4" aria-hidden="true" />Enviar logo (opcional)<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectLogo} /></label></Button>{company.logoDataUrl && <Button variant="ghost" className="text-danger" onClick={() => set('logoDataUrl', undefined)}><Trash className="size-4" aria-hidden="true" />Remover</Button>}</div><p className="text-xs text-text-muted">PNG, JPEG ou WebP, até 500 KiB.</p></div>
          </div>
          <Field label="Nome da oficina" required><Input autoFocus value={company.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CPF/CNPJ" required><Input inputMode="numeric" value={company.document} onChange={(e) => set('document', e.target.value)} onBlur={(e) => set('document', maskDocument(e.target.value))} /></Field>
            <Field label="Razão social"><Input value={company.legalName ?? ''} onChange={(e) => set('legalName', e.target.value)} /></Field>
          </div>
        </>}

        {step === 1 && <>
          <StepTitle title="Como os clientes falam com você?" help="Informe ao menos um telefone ou WhatsApp. Os dados saem nos documentos e nas mensagens aos clientes." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefone"><Input autoFocus inputMode="tel" placeholder="(11) 3333-4444" value={company.phone ?? ''} onChange={(e) => set('phone', e.target.value)} onBlur={(e) => set('phone', maskPhone(e.target.value))} /></Field>
            <Field label="WhatsApp"><Input inputMode="tel" placeholder="(11) 99999-8888" value={company.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} onBlur={(e) => set('whatsapp', maskPhone(e.target.value))} /></Field>
            <Field label="E-mail da oficina"><Input type="email" value={company.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Site"><Input placeholder="https://" value={company.website ?? ''} onChange={(e) => set('website', e.target.value)} /></Field>
          </div>
        </>}

        {step === 2 && <>
          <StepTitle title="Onde fica a oficina?" help="Digite o CEP e o endereço é preenchido sozinho." />
          <div className="grid gap-4 sm:grid-cols-6">
            <div className="sm:col-span-2"><Field label="CEP"><Input autoFocus inputMode="numeric" placeholder="00000-000" value={company.addressPostalCode ?? ''} onChange={(e) => set('addressPostalCode', e.target.value)} onBlur={(e) => { set('addressPostalCode', maskPostalCode(e.target.value)); void lookupPostalCode(e.target.value); }} /></Field>{findingCep && <p role="status" className="mt-1 text-xs text-text-muted">Buscando endereço...</p>}</div>
            <div className="sm:col-span-4"><Field label="Rua" required><Input value={company.addressStreet ?? ''} onChange={(e) => set('addressStreet', e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><Field label="Número"><Input value={company.addressNumber ?? ''} onChange={(e) => set('addressNumber', e.target.value)} /></Field></div>
            <div className="sm:col-span-4"><Field label="Bairro"><Input value={company.addressDistrict ?? ''} onChange={(e) => set('addressDistrict', e.target.value)} /></Field></div>
            <div className="sm:col-span-4"><Field label="Cidade" required><Input value={company.addressCity ?? ''} onChange={(e) => set('addressCity', e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><Field label="UF" required><Input maxLength={2} value={company.addressState ?? ''} onChange={(e) => set('addressState', e.target.value.toUpperCase())} /></Field></div>
          </div>
        </>}

        {step === 3 && <>
          <StepTitle title="Quando a oficina funciona?" help="A agenda usa estes horários. Horários especiais e feriados ficam em Configurações, Operação." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Abre às"><select className={selectClass} value={hours.openHour} onChange={(e) => setHours((current) => ({ ...current, openHour: Number(e.target.value) }))}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></Field>
            <Field label="Fecha às"><select className={selectClass} value={hours.closeHour} onChange={(e) => setHours((current) => ({ ...current, closeHour: Number(e.target.value) }))}>{Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></Field>
          </div>
          <div><p className="text-sm font-semibold">Dias de funcionamento</p><div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Dias de funcionamento">{DAYS.map((day) => <button key={day.value} type="button" aria-pressed={hours.workDays.includes(day.value)} onClick={() => toggleDay(day.value)} className={cn('h-10 min-w-14 rounded-button border px-3 text-sm font-semibold transition-colors', hours.workDays.includes(day.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-text-muted hover:bg-muted')}>{day.label}</button>)}</div></div>
          <Field label="Quantos carros atende ao mesmo tempo? (opcional)"><Input inputMode="numeric" className="sm:w-40" placeholder="Ex.: 4" value={hours.bays} onChange={(e) => setHours((current) => ({ ...current, bays: e.target.value.replace(/\D/g, '') }))} /></Field>
        </>}

        {step === 4 && <>
          <StepTitle title="O que sai nos seus documentos?" help="Valores sugeridos para novos orçamentos e ordens de serviço. Cada documento pode mudar depois." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Garantia dos serviços (dias)"><Input autoFocus inputMode="numeric" value={warranty} onChange={(e) => setWarranty(e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Validade do orçamento (dias)"><Input inputMode="numeric" value={validity} onChange={(e) => setValidity(e.target.value.replace(/\D/g, ''))} /></Field>
          </div>
          <Field label="Termos e condições (opcional)"><Textarea maxLength={2000} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Ex.: Peças trocadas ficam à disposição do cliente por 7 dias." /></Field>
          <Field label="Frase no rodapé dos documentos (opcional)"><Textarea maxLength={500} value={company.documentFooter ?? ''} onChange={(e) => set('documentFooter', e.target.value)} placeholder="Ex.: Obrigado pela preferência." /></Field>
        </>}

        {last && <>
          <div className="flex items-start gap-3"><CheckCircle className="size-8 shrink-0 text-success" weight="fill" aria-hidden="true" /><StepTitle title="Tudo pronto!" help="Estes são os dados da sua oficina. Confira e entre no sistema." /></div>
          <dl className="divide-y divide-border rounded-button border border-border text-sm">
            <Summary term="Oficina" value={`${company.name} · ${company.document}`} />
            <Summary term="Contato" value={[company.phone, company.whatsapp, company.email].filter(Boolean).join(' · ')} />
            <Summary term="Endereço" value={address} />
            <Summary term="Funcionamento" value={`${DAYS.filter((day) => hours.workDays.includes(day.value)).map((day) => day.label).join(', ')}, das ${hourLabel(hours.openHour)} às ${hourLabel(hours.closeHour)}`} />
            <Summary term="Documentos" value={`Garantia de ${warranty || '0'} dias · orçamento válido por ${validity || '-'} dias`} />
          </dl>
          <p className="text-sm text-text-muted">Quando quiser, conecte o e-mail e o WhatsApp e convide a equipe em Configurações.</p>
        </>}

        {error && <p role="alert" className="rounded-button border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-3 pt-1">
          {step > 0 ? <Button type="button" variant="ghost" onClick={() => { setError(null); setStep((value) => value - 1); }}><ArrowLeft className="size-4" aria-hidden="true" />Voltar</Button> : <span />}
          {last
            ? <Button type="button" onClick={finish} disabled={saving}>{complete.isPending ? 'Concluindo...' : 'Entrar no sistema'}<ArrowRight className="size-4" aria-hidden="true" /></Button>
            : <Button type="button" onClick={advance} disabled={saving}>{saving ? 'Salvando...' : 'Avançar'}<ArrowRight className="size-4" aria-hidden="true" /></Button>}
        </div>
      </fieldset>
    </section>
  </div>;
}

function StepTitle({ title, help }: { title: string; help: string }) { return <div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-text-muted">{help}</p></div>; }
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-semibold">{label}{required && <span className="sr-only"> obrigatório</span>}{children}</label>; }
function Summary({ term, value }: { term: string; value: string }) { return <div className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr]"><dt className="text-text-muted">{term}</dt><dd className="font-semibold">{value || 'Não informado'}</dd></div>; }
