import Link from 'next/link';
import { SignupForm } from '@/features/auth/components/SignupForm';

export default function SignupPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-text">Cadastre sua oficina</h1>
        <p className="mt-1 text-sm text-text-muted">
          Crie sua conta e comece a gerenciar clientes, veículos e ordens de serviço.
        </p>
        <div className="mt-6">
          <SignupForm />
        </div>
        <p className="mt-6 text-center text-sm text-text-muted">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
