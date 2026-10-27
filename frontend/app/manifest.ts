import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ofix — Sistema para Oficina Mecânica',
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: 'pt-BR',
    start_url: '/painel',
    scope: '/',
    display: 'standalone',
    background_color: '#0F171F',
    theme_color: '#0F171F',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
