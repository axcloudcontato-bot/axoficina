
// Endereços antigos (em inglês) continuam funcionando e levam ao novo (pt-BR):
// links salvos, e-mails de convite e favoritos não quebram.
const LEGACY_ROUTES = [
  ['/service-orders/new', '/ordens-de-servico/nova'],
  ['/service-orders/:id/print', '/ordens-de-servico/:id/imprimir'],
  ['/service-orders/:path*', '/ordens-de-servico/:path*'],
  ['/service-orders', '/ordens-de-servico'],
  ['/financial/cash-flow', '/financeiro/fluxo-de-caixa'],
  ['/financial/categories', '/financeiro/categorias'],
  ['/financial/entries', '/financeiro/lancamentos'],
  ['/financial/payables', '/financeiro/contas-a-pagar'],
  ['/financial/receivables', '/financeiro/contas-a-receber'],
  ['/financial/reports', '/financeiro/relatorios'],
  ['/financial/suppliers', '/financeiro/fornecedores'],
  ['/financial/transactions', '/financeiro/movimentacoes'],
  ['/financial/print', '/financeiro/imprimir'],
  ['/financial', '/financeiro'],
  ['/settings/company', '/configuracoes/empresa'],
  ['/settings/team', '/configuracoes/equipe'],
  ['/settings/privacy', '/configuracoes/privacidade'],
  ['/settings/:path*', '/configuracoes/:path*'],
  ['/settings', '/configuracoes'],
  ['/admin/subscriptions', '/admin/assinaturas'],
  ['/dashboard', '/painel'],
  ['/appointments', '/agenda'],
  ['/customers', '/clientes'],
  ['/vehicles', '/veiculos'],
  ['/maintenance-alerts', '/alertas-de-manutencao'],
  ['/productivity', '/produtividade'],
  ['/users', '/usuarios'],
  ['/login', '/entrar'],
  ['/signup', '/cadastro'],
  ['/invite/:token', '/convite/:token'],
];

// Áreas que nunca devem ser indexadas (espelha PRIVATE_PATHS em lib/site.ts);
// o X-Robots-Tag cobre também as páginas com token e as de impressão.
const NOINDEX_PREFIXES = [
  'painel', 'ordens-de-servico', 'agenda', 'clientes', 'veiculos', 'alertas-de-manutencao', 'financeiro',
  'produtividade', 'relacionamento', 'usuarios', 'configuracoes', 'admin', 'convite', 'responder',
  'preferencias-de-contato',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // www → domínio principal (canônico). Só age se o host www chegar até o Next.
    const host = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://ofix.axcloud.com.br').host;
    const www = {
      source: '/:path*',
      has: [{ type: 'host', value: `www.${host}` }],
      destination: `https://${host}/:path*`,
      permanent: true,
    };
    return [www, ...LEGACY_ROUTES.map(([source, destination]) => ({ source, destination, permanent: true }))];
  },
  async headers() {
    return NOINDEX_PREFIXES.map((prefix) => ({
      source: `/${prefix}/:path*`,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    }));
  },
  // NOT using output: 'standalone' here — its file tracer creates real
  // symlinks (fs.symlink), which requires SeCreateSymbolicLinkPrivilege on
  // Windows (admin or Developer Mode). Without it, `next build` fails with
  // EPERM for every developer on a normal, non-elevated Windows setup. The
  // Docker image instead copies the full relative pnpm workspace structure
  // (see frontend/Dockerfile) — no tracing/symlinking needed.
};

export default nextConfig;
