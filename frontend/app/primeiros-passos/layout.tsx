import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

// Área logada: nunca deve aparecer em buscadores.
export const metadata: Metadata = { title: 'Configuração inicial', robots: { index: false, follow: false } };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-bg px-4 py-8 sm:py-12">{children}</div>;
}
