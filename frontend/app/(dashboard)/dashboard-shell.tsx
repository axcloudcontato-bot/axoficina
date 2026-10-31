'use client';

import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { usePathname } from 'next/navigation';
import { PlanNotice } from '@/features/plan/PlanNotice';
import { ModuleLocked } from '@/features/plan/ModuleLocked';
import { moduleForPath, useEntitlements } from '@/features/plan/use-entitlements';
import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';

// A page of a module the plan does not include shows the offer instead of failing with a refused request.
function ModuleGate({ children }: { children: React.ReactNode }) {
  const moduleKey = moduleForPath(usePathname());
  const { hasModule } = useEntitlements();
  return moduleKey && !hasModule(moduleKey) ? <ModuleLocked module={moduleKey} /> : <>{children}</>;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OnboardingGate>
      <div className="min-h-screen bg-bg">
        <Sidebar />
        <div className="min-h-screen min-w-0 transition-[padding] duration-normal md:pl-[var(--sidebar-width)]">
          <Topbar />
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-6 sm:py-6 md:pb-6">
            <div className="w-full min-w-0"><PlanNotice /><ModuleGate>{children}</ModuleGate></div>
          </main>
        </div>
      </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
