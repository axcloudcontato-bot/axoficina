import type { Metadata } from 'next';
// Auto-hospedada (bundlada no build) em vez de next/font/google: esse loader
// busca o CSS da fonte no Google ao vivo durante `next build`, e esse fetch
// falhou de forma intermitente em CI (`next/font` loader.js: "Cannot read
// properties of null (reading '1')" quando a resposta vem vazia/bloqueada).
import '@fontsource-variable/plus-jakarta-sans';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Oficina',
  description: 'ERP SaaS multi-tenant para oficinas mecânicas',
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
