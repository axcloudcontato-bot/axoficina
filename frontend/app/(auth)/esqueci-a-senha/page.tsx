import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/brand/auth-shell';
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

export const metadata: Metadata = { title: 'Esqueci minha senha', robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <AuthShell title="Esqueci minha senha" description="Informe o e-mail da sua conta para receber um link e criar uma nova senha." footer={<>Lembrou a senha? <Link href="/entrar" className="font-semibold text-primary hover:underline">Entrar</Link></>}>
    <ForgotPasswordForm />
  </AuthShell>;
}
