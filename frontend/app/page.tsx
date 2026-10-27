import type { Metadata } from 'next';
import { HomeJsonLd } from '@/components/seo/json-ld';
import { publicPageMetadata } from '@/lib/seo';
import { SITE_DESCRIPTION } from '@/lib/site';
import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = publicPageMetadata({
  title: 'Ofix: sistema para oficina mecânica',
  description: SITE_DESCRIPTION,
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
