import { HealthStatus } from '@/features/health/HealthStatus';

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[420px] rounded-card border border-border bg-surface p-6 shadow-md">
        <h2 className="text-xl font-semibold text-text">Oficina SaaS</h2>
        <p className="mb-4 text-sm text-text-muted">Ambiente de desenvolvimento</p>
        <HealthStatus />
      </div>
    </main>
  );
}
