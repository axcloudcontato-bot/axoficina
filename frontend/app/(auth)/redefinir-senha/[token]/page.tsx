import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/brand/auth-shell';
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm';

export const metadata: Metadata = { title: 'Criar nova senha', robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AuthShell title="Criar nova senha" description="Escolha a nova senha da sua conta." footer={<Link href="/entrar" className="font-semibold text-primary hover:underline">Voltar para o login</Link>}>
    <ResetPasswordForm token={token} />
  </AuthShell>;
}
