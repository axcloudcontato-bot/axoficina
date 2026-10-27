import type { Metadata } from 'next';
// Auto-hospedada (bundlada no build) em vez de next/font/google: esse loader
// busca o CSS da fonte no Google ao vivo durante `next build`, e esse fetch
// falhou de forma intermitente em CI (`next/font` loader.js: "Cannot read
// properties of null (reading '1')" quando a resposta vem vazia/bloqueada).
import '@fontsource-variable/montserrat';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/providers';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Ofix — Sistema para Oficina Mecânica', template: '%s | Ofix' },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: SITE_NAME,
    title: 'Ofix — Sistema para Oficina Mecânica',
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ofix — Sistema para Oficina Mecânica',
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
