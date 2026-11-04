import type { Metadata } from 'next';
import { HomeJsonLd } from '@/components/seo/json-ld';
import { publicPageMetadata } from '@/lib/seo';
import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = publicPageMetadata({
  title: 'Ofix: sistema para oficina mecânica',
  description: 'Acompanhe sua oficina da entrada do carro à cobrança. Ordens de serviço, equipe, clientes e financeiro no mesmo fluxo. Teste o Ofix por 14 dias, sem cartão.',
  path: '/',
  absoluteTitle: true,
});

export default function Home() {
  return (
    <>
      <HomeJsonLd />
      <LandingPage />
    </>
  );
}
