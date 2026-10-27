import Link from 'next/link';
import { publicPageMetadata } from '@/lib/seo';
import { AuthShell } from '@/components/brand/auth-shell';
import { LoginForm } from '@/features/auth/components/LoginForm';

export const metadata = publicPageMetadata({
  title: 'Entrar',
  description: 'Acesse o Ofix com seu e-mail e senha para gerenciar ordens de serviço, clientes e financeiro da sua oficina.',
  path: '/entrar',
});

export default function LoginPage() {
  return (
    <AuthShell
      title="Acesse o sistema"
      description="Entre com suas credenciais para continuar."
      footer={<>Ainda não tem uma oficina cadastrada?{' '}<Link href="/cadastro" className="font-semibold text-primary hover:underline">Criar conta</Link></>}
    >
      <LoginForm />
    </AuthShell>
  );
}
