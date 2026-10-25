'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CUSTOMER_MESSAGE_PRESETS, type CustomerMessagePreset } from '../customer-message-presets';

export interface CustomerMessageDraft {
  enabled: boolean;
  preset: CustomerMessagePreset;
  question: string;
  options: string[];
  includeQuote: boolean;
}

export function CustomerMessageComposer({ value, onChange, disabled, whatsappIntegrated = false, allowQuotePreset = true, allowPickupPreset = true }: { value: CustomerMessageDraft; onChange: (value: CustomerMessageDraft) => void; disabled: boolean; whatsappIntegrated?: boolean; allowQuotePreset?: boolean; allowPickupPreset?: boolean }) {
  return <fieldset disabled={disabled} className="mt-4 space-y-4 rounded-button border border-border p-4">
    {allowQuotePreset && <label className="flex items-center gap-2 text-sm font-semibold text-text">
      <input type="checkbox" checked={value.enabled} onChange={(event) => onChange({ ...value, enabled: event.target.checked })} className="size-4 accent-primary" />
      Solicitar resposta por botões
    </label>}
    {value.enabled && <>
      <label className="block text-sm font-medium">Tipo de pergunta
        <select value={value.preset} onChange={(event) => {
          const preset = event.target.value as CustomerMessagePreset;
          const template = CUSTOMER_MESSAGE_PRESETS[preset];
          onChange({ ...value, preset, question: template.question, options: [...template.options], includeQuote: template.includeQuote });
        }} className="mt-1 w-full rounded-button border border-border bg-bg px-3 py-2 text-text">
          {Object.entries(CUSTOMER_MESSAGE_PRESETS).filter(([key]) => (allowQuotePreset || key !== 'QUOTE') && (allowPickupPreset || key !== 'PICKUP')).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Pergunta para o cliente
        <textarea value={value.question} onChange={(event) => onChange({ ...value, question: event.target.value })} maxLength={300} rows={2} className="mt-1 w-full rounded-button border border-border bg-bg px-3 py-2 text-text" placeholder="O que você deseja perguntar?" />
      </label>
      <div className="space-y-2">
        <p className="text-sm font-medium">Respostas disponíveis</p>
        {value.options.map((option, index) => <div key={index} className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-xs text-text-muted">Botão {index + 1}
            <Input className="mt-1" maxLength={60} value={option} onChange={(event) => onChange({ ...value, options: value.options.map((label, position) => position === index ? event.target.value : label) })} />
          </label>
          {value.options.length > 2 && <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, options: value.options.filter((_, position) => position !== index) })} aria-label={`Remover botão ${index + 1}`}>Remover</Button>}
        </div>)}
        {value.options.length < 3 && <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, options: [...value.options, ''] })}>Adicionar botão</Button>}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.includeQuote} onChange={(event) => onChange({ ...value, includeQuote: event.target.checked })} className="size-4 accent-primary" />Incluir itens e total do orçamento</label>
      <div className="rounded-button bg-muted/50 p-3">
        <p className="text-xs font-semibold text-text-muted">Prévia dos botões</p>
        <div className="mt-2 flex flex-wrap gap-2">{value.options.map((option, index) => <span key={index} className="rounded-button bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{option.trim() || `Botão ${index + 1}`}</span>)}</div>
      </div>
      <p className="text-xs text-text-muted">No e-mail, o cliente clica em um botão e confirma a escolha. {whatsappIntegrated ? 'No WhatsApp, o WA-AKG envia a mensagem e o cliente responde tocando em um botão na própria conversa.' : 'No WhatsApp, abre o link da mensagem e escolhe um botão.'} As opções valem por 7 dias e a resposta aparece nesta OS. Confirmações de agendamento e retirada são registradas para a equipe, que faz os ajustes necessários.</p>
    </>}
  </fieldset>;
}
