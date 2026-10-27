import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';

/** Metadata de página pública: título/descrição próprios, canonical e Open Graph/Twitter coerentes. */
export function publicPageMetadata({ title, description, path, absoluteTitle }: { title: string; description: string; path: string; absoluteTitle?: boolean }): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', locale: 'pt_BR', siteName: SITE_NAME, title: fullTitle, description, url: path },
    twitter: { card: 'summary_large_image', title: fullTitle, description },
  };
}
