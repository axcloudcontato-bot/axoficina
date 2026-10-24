import Link from 'next/link';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-text">Entrar</h1>
        <p className="mt-1 text-sm text-text-muted">Acesse sua conta para continuar.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-text-muted">
          Ainda não tem uma oficina cadastrada?{' '}
          <Link href="/signup" className="text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
