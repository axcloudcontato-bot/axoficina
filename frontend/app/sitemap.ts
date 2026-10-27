import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES, SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PAGES.map(({ path, priority, changeFrequency }) => ({
    url: path === '/' ? SITE_URL : `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
