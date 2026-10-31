'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { hasPermission } from '@/features/auth/permissions';
import { useBranding } from '@/features/settings/hooks/use-settings';
import { useAuthStore } from '@/stores/auth-store';

export const ONBOARDING_PATH = '/primeiros-passos';

// Who runs the first-access setup: the people who can change the company data. Everyone else just works.
export function useNeedsOnboarding() {
  const user = useAuthStore((state) => state.user);
  const branding = useBranding();
  const manages = Boolean(user && hasPermission(user, 'settings.manage'));
  return { manages, needed: manages && branding.data?.onboardingCompleted === false, known: !manages || branding.data !== undefined };
}

// A workshop that has not been through the guided setup cannot reach any other screen.
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { needed } = useNeedsOnboarding();
  useEffect(() => { if (needed && pathname !== ONBOARDING_PATH) router.replace(ONBOARDING_PATH); }, [needed, pathname, router]);
  return needed ? null : <>{children}</>;
}
