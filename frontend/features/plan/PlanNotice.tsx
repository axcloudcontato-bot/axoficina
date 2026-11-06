'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { useEntitlements } from './use-entitlements';
import { usageRows, usageText } from './usage';

// What the whole team should know before something is refused: a late subscription and a plan that is filling up.
export function PlanNotice({ placement = 'main' }: { placement?: 'main' | 'footer' }) {
  const user = useAuthStore((state) => state.user);
  const { data } = useEntitlements();
  if (!data) return null;
  const admin = user?.role === 'ADMIN';
  const { access } = data;
  const full = admin ? usageRows(data).filter((row) => row.status !== 'ok') : [];
  const reason = access.reason === 'trial_ended' ? 'O período de teste terminou' : access.reason === 'canceled' ? 'A assinatura foi cancelada' : 'O pagamento da assinatura está em atraso';
  if (placement === 'footer') return access.state === 'active' && access.reason === 'trial' && admin && access.daysLeft !== null
    ? <footer className="px-4 pb-24 pt-4 sm:px-6 md:pb-6"><p role="status" className="rounded-button border border-primary/20 bg-selection p-3 text-sm">Teste grátis: {access.daysLeft === 1 ? 'falta 1 dia' : `faltam ${access.daysLeft} dias`}, com todos os recursos do plano Completo. Para continuar depois, <Link href="/configuracoes/assinatura" className="font-semibold underline">escolha um plano</Link>.</p></footer>
    : null;
  return <div className="mb-4 space-y-2">
    {access.state === 'suspended' && <p role="alert" className="rounded-button border border-danger/30 bg-danger-subtle p-3 text-sm text-danger">{reason} e o sistema está só para consulta: não é possível cadastrar nem alterar clientes, veículos, agendamentos, ordens de serviço, financeiro ou configurações, e nenhuma mensagem automática é enviada. Seus dados continuam guardados. {admin ? <>Para voltar a usar, <Link href="/configuracoes/assinatura" className="font-semibold underline">escolha um plano em Assinatura</Link>.</> : 'Peça a um administrador para regularizar a assinatura.'}</p>}
    {access.state === 'grace' && admin && <p role="status" className="rounded-button border border-warning/30 bg-warning-subtle p-3 text-sm text-warning-strong">{reason}. {access.daysLeft !== null ? `Em ${access.daysLeft} ${access.daysLeft === 1 ? 'dia' : 'dias'} o sistema passa a ficar só para consulta.` : 'Regularize para evitar que o sistema fique só para consulta.'} Fale com o suporte do Ofix.</p>}
    {full.map((row) => <p key={row.kind} role="status" className="rounded-button border border-warning/30 bg-warning-subtle p-3 text-sm text-warning-strong">
      {row.status === 'over' ? `${row.label}: o limite do plano foi atingido (${usageText(row)}).` : `${row.label}: você já usou ${usageText(row)} do plano.`} <Link href="/configuracoes/assinatura" className="font-semibold underline">Ver minha assinatura</Link>
    </p>)}
  </div>;
}
