'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { PrivacyControls } from '@/features/privacy/components/PrivacyControls';
import { KeyboardNavigation } from '@/components/keyboard-navigation';
import { initSentry } from '@/lib/sentry';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  useEffect(initSentry, []);

  return (
    <QueryClientProvider client={queryClient}>
      <KeyboardNavigation />
      {children}
      <PrivacyControls />
      <Toaster />
    </QueryClientProvider>
  );
}
