import type { Metadata } from 'next';
// Auto-hospedada (bundlada no build) em vez de next/font/google: esse loader
// busca o CSS da fonte no Google ao vivo durante `next build`, e esse fetch
// falhou de forma intermitente em CI (`next/font` loader.js: "Cannot read
// properties of null (reading '1')" quando a resposta vem vazia/bloqueada).
import '@fontsource-variable/montserrat';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ofix — Sistema para Oficina Mecânica',
  description: 'Mais controle para sua oficina. Gestão de ordens de serviço, clientes, estoque e financeiro.',
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
