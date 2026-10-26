import Link from 'next/link';
import { AuthShell } from '@/components/brand/auth-shell';
import { SignupForm } from '@/features/auth/components/SignupForm';

export default function SignupPage() {
  return (
    <AuthShell
      title="Cadastre sua oficina"
      description="Crie sua conta e comece a gerenciar clientes, veículos e ordens de serviço."
      footer={<>Já tem uma conta?{' '}<Link href="/entrar" className="font-semibold text-primary hover:underline">Entrar</Link></>}
    >
      <SignupForm />
    </AuthShell>
  );
}
