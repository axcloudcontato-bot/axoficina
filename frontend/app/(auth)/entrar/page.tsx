import Link from 'next/link';
import { AuthShell } from '@/components/brand/auth-shell';
import { LoginForm } from '@/features/auth/components/LoginForm';

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
