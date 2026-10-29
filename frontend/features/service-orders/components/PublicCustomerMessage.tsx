'use client';

import { useEffect, useState } from 'react';
import { SERVICE_ORDER_ITEM_TYPE_LABELS, type PublicCustomerMessageResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrencyBRL } from '@/lib/format-currency';
import { customerMessagesApi } from '../api/customer-messages-api';

export function PublicCustomerMessage({ token, initialOption }: { token: string; initialOption?: string }) {
  const [message, setMessage] = useState<PublicCustomerMessageResponse | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    customerMessagesApi.getPublic(token).then(result => {
      if (!active) return;
      setMessage(result);
      const option = initialOption !== undefined && /^[0-2]$/.test(initialOption) ? Number(initialOption) : null;
      setSelected(option !== null && option < result.options.length ? option : null);
    }).catch((err: unknown) => { if (active) setError(extractErrorMessage(err, 'Não foi possível abrir a mensagem.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, initialOption, reload]);

  async function answer() {
    if (selected === null || sending) return;
    setSending(true); setError('');
    try { setMessage(await customerMessagesApi.answer(token, selected)); }
    catch (err) { setError(extractErrorMessage(err, 'Não foi possível registrar a resposta. Tente novamente.')); }
    finally { setSending(false); }
  }

  if (loading) return <p role="status" className="py-8 text-center text-sm text-text-muted">Carregando mensagem...</p>;
  if (!message) return <div><h1 className="text-xl font-bold">Mensagem indisponível</h1><p role="alert" className="mt-3 text-sm text-text-muted">{error}</p><p className="mt-3 text-sm text-text-muted">Se o link expirou, peça à oficina uma nova solicitação.</p><Button className="mt-4" variant="outline" onClick={() => setReload(value => value + 1)}>Tentar novamente</Button></div>;
  const expired = Date.parse(message.expiresAt) <= Date.now();
  const isQuote = message.purpose === 'QUOTE';
  const answered = Boolean(message.answeredAt && message.selectedOption !== undefined);
  const unavailable = expired || message.canAnswer === false;
  const confirmLabel = isQuote && selected === 0 ? 'Confirmar aprovação' : isQuote && selected === 1 ? 'Confirmar que não aprovo' : 'Confirmar resposta';
  return <>
    <header className="border-b border-border pb-5"><p className="text-sm font-semibold text-primary">{message.companyName}</p><h1 className="mt-2 text-2xl font-bold text-text">{isQuote ? 'Aprovação do orçamento' : 'Resposta à oficina'}</h1><p className="mt-2 text-sm text-text-muted">{answered ? 'Sua resposta já foi registrada. Confira abaixo.' : isQuote ? 'Confira os serviços e o valor antes de responder.' : 'Escolha uma opção e confirme sua resposta.'}</p></header>
    {message.quote ? <section aria-label="Orçamento enviado" className="mt-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold text-text-muted">OS #{String(message.quote.orderNumber).padStart(5, '0')}</p><h2 className="mt-1 font-semibold text-text">{message.quote.vehicle}</h2><p className="mt-1 font-mono text-xs text-text-muted">{message.quote.plate}</p></div></div><ul className="mt-4 divide-y divide-border">{message.quote.items.map((item, index) => <li key={index} className="flex items-start justify-between gap-4 py-3 text-sm"><div className="min-w-0"><p className="break-words font-medium text-text">{item.description}</p><p className="mt-1 text-xs text-text-muted">{SERVICE_ORDER_ITEM_TYPE_LABELS[item.type]} · {item.quantity} × {formatCurrencyBRL(item.unitPriceCents)}</p></div><span className="shrink-0 font-semibold tabular-nums text-text">{formatCurrencyBRL(item.lineTotalCents)}</span></li>)}</ul>{(message.quote.discountCents ?? 0) > 0 && <div className="mt-2 flex items-center justify-between gap-2 px-4 text-sm text-success"><span>Desconto</span><span className="tabular-nums">-{formatCurrencyBRL(message.quote.discountCents ?? 0)}</span></div>}<div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-button bg-surface p-4"><span className="text-sm font-semibold">Total do orçamento</span><strong className="text-xl tabular-nums text-text">{formatCurrencyBRL(message.quote.totalAmountCents)}</strong></div>{message.quoteIsCurrent === false && <p className="mt-3 rounded-button border border-warning/30 p-3 text-sm text-warning">Estes são os valores da mensagem original. A oficina alterou o orçamento; solicite a versão atualizada.</p>}</section> : <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{message.message}</p>}
    {answered ? <div role="status" className="mt-5 rounded-button border border-success/30 bg-success-subtle p-4"><p className="font-bold text-text">Resposta registrada: {message.options[message.selectedOption!]}</p><p className="mt-2 text-sm text-text">A oficina recebeu sua escolha. {isQuote && message.selectedOption === 0 ? 'A equipe foi avisada da aprovação.' : 'Obrigado!'}</p>{message.answeredAt && <p className="mt-2 text-xs text-text-muted">{new Date(message.answeredAt).toLocaleString('pt-BR')}</p>}</div> : unavailable ? <p role="alert" className="mt-5 rounded-button border border-warning/30 p-4 text-sm text-text">{expired ? 'Este link expirou. Solicite uma nova mensagem à oficina.' : message.unavailableReason || 'Esta solicitação não está mais disponível. Entre em contato com a oficina.'}</p> : <section aria-labelledby="response-question" className="mt-6"><h2 id="response-question" className="text-base font-semibold text-text">{message.question}</h2><div className="mt-4 flex flex-col gap-2" role="group" aria-label="Opções de resposta">{message.options.map((option, index) => <Button key={index} variant={selected === index ? 'default' : 'outline'} className="h-auto min-h-12 justify-start whitespace-normal px-4 py-3 text-left" aria-pressed={selected === index} disabled={sending} onClick={() => setSelected(index)}><span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${selected === index ? 'border-current' : 'border-border'}`}>{selected === index && <span className="size-2 rounded-full bg-current" />}</span>{option}</Button>)}</div>{selected !== null && <p className="mt-4 text-sm text-text-muted">Sua escolha: <strong className="text-text">{message.options[selected]}</strong></p>}<Button className="mt-4 min-h-12 w-full whitespace-normal" disabled={selected === null || sending} onClick={answer}>{sending ? 'Registrando...' : confirmLabel}</Button><p className="mt-3 text-xs leading-5 text-text-muted">A resposta só será enviada após a confirmação. Para alterá-la depois, fale com a oficina.</p><p className="mt-1 text-xs text-text-muted">Você pode responder até {new Date(message.expiresAt).toLocaleString('pt-BR')}.</p></section>}
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
  </>;
}