'use client';

import { useEffect, useState } from 'react';
import type { PublicCustomerMessageResponse } from '@oficina/contracts';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/api/client';
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
    setLoading(true);
    setError('');
    customerMessagesApi.getPublic(token).then((result) => {
      if (!active) return;
      setMessage(result);
      const option = initialOption !== undefined && /^[0-2]$/.test(initialOption) ? Number(initialOption) : null;
      setSelected(option !== null && option < result.options.length ? option : null);
    }).catch((err: unknown) => { if (active) setError(extractErrorMessage(err, 'Não foi possível abrir a mensagem.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, initialOption, reload]);

  async function answer() {
    if (selected === null || sending) return;
    setSending(true);
    setError('');
    try { setMessage(await customerMessagesApi.answer(token, selected)); }
    catch (err) { setError(extractErrorMessage(err, 'Não foi possível registrar a resposta. Tente novamente.')); }
    finally { setSending(false); }
  }

  if (loading) return <p role="status">Carregando mensagem...</p>;
  if (!message) return <div><h1 className="text-xl font-bold">Mensagem indisponível</h1><p role="alert" className="mt-3 text-sm text-text-muted">{error}</p><Button className="mt-4" variant="outline" onClick={() => setReload((value) => value + 1)}>Tentar novamente</Button></div>;
  const expired = Date.parse(message.expiresAt) <= Date.now();
  return <>
    <p className="text-sm font-semibold text-primary">{message.companyName}</p>
    <h1 className="mt-2 text-2xl font-bold">Resposta à oficina</h1>
    <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{message.message}</p>
    <h2 className="mt-6 text-lg font-semibold">{message.question}</h2>
    {message.answeredAt && message.selectedOption !== undefined ? <div role="status" className="mt-4 rounded-button border border-primary/30 bg-primary-subtle p-4"><p className="font-bold">Resposta registrada: {message.options[message.selectedOption]}</p><p className="mt-2 text-sm">A oficina recebeu sua escolha. Obrigado!</p></div> : expired ? <p role="alert" className="mt-4">Este link expirou. Solicite uma nova mensagem à oficina.</p> : <>
      <div className="mt-4 flex flex-col gap-3" role="group" aria-label="Opções de resposta">{message.options.map((option, index) => <Button key={index} variant={selected === index ? 'default' : 'outline'} className="h-auto min-h-12 whitespace-normal py-3" aria-pressed={selected === index} disabled={sending} onClick={() => setSelected(index)}>{option}</Button>)}</div>
      {selected !== null && <p className="mt-4 text-sm">Sua escolha: <strong>{message.options[selected]}</strong></p>}
      <Button className="mt-4 w-full" disabled={selected === null || sending} onClick={answer}>{sending ? 'Registrando...' : 'Confirmar resposta'}</Button>
      <p className="mt-3 text-xs text-text-muted">Confirme apenas uma opção. Após o envio, entre em contato com a oficina se precisar alterar sua resposta.</p>
    </>}
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
  </>;
}
