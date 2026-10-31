'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { useNeedsOnboarding } from '@/features/onboarding/OnboardingGate';
import { OnboardingWizard } from '@/features/onboarding/OnboardingWizard';

function Wizard() {
  const router = useRouter();
  const { needed, known } = useNeedsOnboarding();
  // Already set up, or not someone who sets the workshop up: nothing to do here.
  useEffect(() => { if (known && !needed) router.replace('/painel'); }, [known, needed, router]);
  return needed ? <OnboardingWizard /> : <div className="flex justify-center py-20 text-sm text-text-muted">Carregando...</div>;
}

export default function FirstStepsPage() {
  return <AuthGuard><Wizard /></AuthGuard>;
}
