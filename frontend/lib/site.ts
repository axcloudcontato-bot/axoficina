export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ofix.axcloud.com.br').replace(/\/+$/, '');
export const SITE_NAME = 'Ofix';
export const SITE_TAGLINE = 'Mais controle para sua oficina';
export const SITE_DESCRIPTION =
  'Ordens de serviço, orçamento aprovado pelo WhatsApp, agenda, estoque, financeiro e produtividade da equipe em um só sistema para oficinas mecânicas.';

/** Identidade da empresa responsável. As variáveis NEXT_PUBLIC_LEGAL_* / NEXT_PUBLIC_PRIVACY_EMAIL sobrescrevem. */
const DEFAULT_ADDRESS = {
  street: 'Av. Cassiano Ricardo, 601',
  neighborhood: 'Jardim Aquarius',
  city: 'São José dos Campos',
  region: 'SP',
  postalCode: '12246-870',
};
const ENV_ADDRESS = process.env.NEXT_PUBLIC_LEGAL_COMPANY_ADDRESS?.trim();

/** Endereço estruturado (para o schema); só existe quando vale o endereço padrão, não o texto livre da variável. */
export const COMPANY_POSTAL_ADDRESS = ENV_ADDRESS ? null : DEFAULT_ADDRESS;

export const COMPANY = {
  name: process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME?.trim() || 'Ax Cloud',
  document: process.env.NEXT_PUBLIC_LEGAL_COMPANY_DOCUMENT?.trim() || '66.475.844/0001-05',
  address: ENV_ADDRESS || `${DEFAULT_ADDRESS.street} - ${DEFAULT_ADDRESS.neighborhood}, ${DEFAULT_ADDRESS.city} - ${DEFAULT_ADDRESS.region}, ${DEFAULT_ADDRESS.postalCode}`,
  email: process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || 'contato@axcloud.com.br',
};

/** Site da empresa e outros produtos, usados em links de rodapé e no schema (parentOrganization). */
export const PARENT_SITE = 'https://axcloud.com.br';
export const SISTER_PRODUCTS: Array<{ name: string; url: string }> = [
  { name: 'Openfix (gestão financeira)', url: 'https://openfix.axcloud.com.br' },
];

// Perfis oficiais (LinkedIn, Instagram, etc.) usados em `sameAs` do Organization.
// Preencha quando existirem; enquanto vazio, o campo é omitido do JSON-LD.
export const SAME_AS: string[] = [
  'https://www.instagram.com/ofixgestaomecanica',
  'https://www.tiktok.com/@ofixgestao',
];

/** Páginas públicas indexáveis, com a prioridade usada no sitemap. */
export const PUBLIC_PAGES: Array<{ path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/cadastro', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/entrar', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/software-para-oficina-mecanica', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/ordem-de-servico-para-oficina', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/controle-financeiro-para-oficina', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/privacidade', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/termos', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/cookies', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/reembolso', priority: 0.3, changeFrequency: 'yearly' },
];

export const PRIVATE_PATHS = [
  '/painel', '/ordens-de-servico', '/agenda', '/clientes', '/veiculos', '/alertas-de-manutencao',
  '/financeiro', '/produtividade', '/relacionamento', '/usuarios', '/configuracoes', '/admin',
  '/convite/', '/redefinir-senha/', '/esqueci-a-senha', '/responder/', '/preferencias-de-contato/', '/api/',
];
