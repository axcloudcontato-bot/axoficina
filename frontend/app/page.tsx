import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = {
  title: 'Ofix — Sistema para oficina mecânica | Mais controle para sua oficina',
  description: 'Ordens de serviço, orçamento aprovado pelo WhatsApp, agenda, alertas de manutenção e financeiro em um só sistema para oficinas mecânicas.',
};

export default function Home() {
  return <LandingPage />;
}
