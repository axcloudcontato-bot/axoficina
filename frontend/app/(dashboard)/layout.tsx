import type { Metadata } from 'next';
import { DashboardShell } from './dashboard-shell';

// Depende de estado client-only (zustand persist lendo localStorage via
// AuthGuard) — nunca deve ser pré-renderizado estaticamente no build.
export const dynamic = 'force-dynamic';

// Área logada: nunca deve aparecer em buscadores.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
