import type { CatalogItemType } from '@oficina/contracts';

type DefaultItem = { type: CatalogItemType; name: string; category: string };
const build = (type: CatalogItemType, category: string, names: string[]): DefaultItem[] => names.map((name) => ({ type, name, category }));

// Itens comuns de oficina mecânica. Entram com preço zero: cada oficina define o seu.
export const DEFAULT_CATALOG: DefaultItem[] = [
  ...build('LABOR', 'Manutenção preventiva', ['Revisão preventiva', 'Troca de óleo e filtro', 'Troca de filtro de ar', 'Troca de filtro de combustível', 'Troca de filtro de cabine (ar-condicionado)', 'Troca de velas de ignição', 'Troca de correia dentada', 'Troca de correia do alternador']),
  ...build('LABOR', 'Freios', ['Troca de pastilhas de freio', 'Troca de discos de freio', 'Troca de lonas e sapatas', 'Sangria do sistema de freio', 'Revisão do sistema de freios']),
  ...build('LABOR', 'Suspensão e direção', ['Alinhamento de direção', 'Balanceamento de rodas', 'Troca de amortecedores', 'Troca de pivô e terminal', 'Troca de bieleta e bucha da barra estabilizadora', 'Troca de coxim do motor']),
  ...build('LABOR', 'Motor e transmissão', ['Diagnóstico com scanner', 'Troca de junta do cabeçote', 'Retífica de motor', 'Troca de kit de embreagem', 'Troca de óleo do câmbio', 'Troca de homocinética']),
  ...build('LABOR', 'Elétrica e ar-condicionado', ['Diagnóstico elétrico', 'Troca de bateria', 'Troca de alternador', 'Troca de motor de arranque', 'Higienização do ar-condicionado', 'Recarga de gás do ar-condicionado']),
  ...build('LABOR', 'Pneus e rodas', ['Troca de pneus', 'Rodízio de pneus', 'Reparo de pneu (remendo)']),
  ...build('LABOR', 'Outros serviços', ['Mão de obra (hora técnica)', 'Escapamento: reparo ou troca', 'Lavagem de motor', 'Inspeção veicular (pré-vistoria)']),
  ...build('PART', 'Freios', ['Pastilha de freio dianteira', 'Pastilha de freio traseira', 'Disco de freio', 'Lona de freio', 'Cilindro de roda']),
  ...build('PART', 'Suspensão e direção', ['Amortecedor dianteiro', 'Amortecedor traseiro', 'Pivô de suspensão', 'Terminal de direção', 'Bieleta', 'Coxim do motor', 'Rolamento de roda']),
  ...build('PART', 'Motor e transmissão', ['Filtro de óleo', 'Filtro de ar do motor', 'Filtro de combustível', 'Filtro de cabine (ar-condicionado)', 'Vela de ignição', 'Correia dentada (kit)', 'Correia do alternador', 'Bomba d’água', 'Válvula termostática', 'Kit de embreagem', 'Homocinética']),
  ...build('PART', 'Elétrica', ['Bateria', 'Alternador', 'Motor de arranque', 'Lâmpada de farol', 'Palheta de limpador de para-brisa']),
  ...build('PART', 'Pneus e rodas', ['Pneu', 'Válvula de pneu']),
  ...build('PRODUCT', 'Óleos e lubrificantes', ['Óleo de motor 5W30', 'Óleo de motor 5W40', 'Óleo de motor 10W40', 'Óleo de câmbio manual', 'Óleo de câmbio automático (ATF)', 'Graxa']),
  ...build('PRODUCT', 'Fluidos', ['Fluido de freio DOT 4', 'Aditivo de radiador', 'Água desmineralizada', 'Fluido de direção hidráulica', 'Água do limpador de para-brisa']),
  ...build('PRODUCT', 'Químicos e consumíveis', ['Limpa bicos (aditivo de combustível)', 'Limpa contatos', 'Desengripante', 'Silicone', 'Gás refrigerante R134a', 'Fita isolante']),
];
