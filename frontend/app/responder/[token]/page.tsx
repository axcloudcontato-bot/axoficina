import type { Metadata } from 'next';
import { PublicCustomerMessage } from '@/features/service-orders/components/PublicCustomerMessage';

export const metadata: Metadata = {
  title: 'Responder à oficina',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function CustomerResponsePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ option?: string | string[] }> }) {
  const { token } = await params;
  const { option } = await searchParams;
  return <main id="main-content" tabIndex={-1} className="min-h-screen bg-bg px-4 py-8 sm:py-12"><div className="mx-auto w-full max-w-xl rounded-card border border-border bg-card p-5 shadow-sm sm:p-8"><PublicCustomerMessage token={token} initialOption={typeof option === 'string' ? option : undefined} /></div></main>;
}
