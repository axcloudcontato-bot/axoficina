import Link from 'next/link';
import { publicPageMetadata } from '@/lib/seo';
import { AuthShell } from '@/components/brand/auth-shell';
import { SignupForm } from '@/features/auth/components/SignupForm';

export const metadata = publicPageMetadata({
  title: 'Cadastrar oficina',
  description: 'Crie a conta da sua oficina no Ofix e comece a organizar clientes, veículos, ordens de serviço e financeiro.',
  path: '/cadastro',
});

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
