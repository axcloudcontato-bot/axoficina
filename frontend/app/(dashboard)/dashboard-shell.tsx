'use client';

import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { AuthGuard } from '@/features/auth/components/AuthGuard';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg">
        <Sidebar />
        <div className="min-h-screen min-w-0 transition-[padding] duration-normal md:pl-[var(--sidebar-width)]">
          <Topbar />
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-6 sm:py-6 md:pb-6">
            <div className="w-full min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
