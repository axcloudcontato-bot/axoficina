// Builds docs/api/endpoints.md from the controllers' own decorators, so the index cannot drift from the code
// (api-docs.spec.ts fails when the file is out of date). It reads source text; it does not boot the app.

export interface Endpoint {
  method: string;
  path: string;
  handler: string;
  access: string;
  permissions: string;
  extras: string;
}

export interface ControllerDoc {
  file: string;
  endpoints: Endpoint[];
}

const HTTP_DECORATORS = ['Get', 'Post', 'Put', 'Patch', 'Delete'];

// `const ROLES = ['ADMIN', 'MANAGER'] as const;` declared in the same file, for decorators written as `@Roles(...ROLES)`.
function constantLists(source: string): Map<string, string[]> {
  const lists = new Map<string, string[]>();
  for (const match of source.matchAll(/const\s+(\w+)\s*=\s*\[([^\]]*)\]/g)) {
    lists.set(match[1], [...match[2].matchAll(/'([^']*)'/g)].map((item) => item[1]));
  }
  return lists;
}

function args(decorator: string, lists: Map<string, string[]> = new Map()): string[] {
  const inner = decorator.slice(decorator.indexOf('(') + 1, decorator.lastIndexOf(')'));
  const spread = [...inner.matchAll(/\.\.\.(\w+)/g)].flatMap((match) => lists.get(match[1]) ?? []);
  return [...[...inner.matchAll(/['"]([^'"]*)['"]/g)].map((match) => match[1]), ...spread];
}

function name(decorator: string): string {
  return decorator.slice(1, decorator.indexOf('(') === -1 ? undefined : decorator.indexOf('('));
}

// Joins decorators that span several lines by counting parentheses.
function decoratorGroups(source: string): { decorators: string[]; signature: string }[] {
  const groups: { decorators: string[]; signature: string }[] = [];
  let pending: string[] = [];
  let open: string | null = null;
  for (const line of source.split('\n')) {
    const text = line.trim();
    if (open !== null) {
      open += ` ${text}`;
      if (balanced(open)) { pending.push(open); open = null; }
      continue;
    }
    if (text.startsWith('@')) {
      if (balanced(text)) pending.push(text); else open = text;
      continue;
    }
    if (pending.length && /^(async\s+)?[A-Za-z_]\w*\(|^(export\s+)?(default\s+)?class\s/.test(text)) groups.push({ decorators: pending, signature: text });
    if (text !== '' && !text.startsWith('//') && !text.startsWith('*')) pending = [];
  }
  return groups;
}

function balanced(text: string): boolean {
  let depth = 0;
  for (const char of text) { if (char === '(') depth++; else if (char === ')') depth--; }
  return depth === 0;
}

export function parseController(source: string): Endpoint[] {
  const endpoints: Endpoint[] = [];
  let prefix = '';
  let controllerSaasAdmin = false;
  const normalized = source.replace(/\r\n/g, '\n');
  const lists = constantLists(normalized);
  for (const group of decoratorGroups(normalized)) {
    const controller = group.decorators.find((decorator) => name(decorator) === 'Controller');
    if (controller) {
      prefix = args(controller)[0] ?? '';
      controllerSaasAdmin = group.decorators.some((decorator) => decorator.includes('@UseGuards(SaasAdminGuard)'));
      continue;
    }
    const http = group.decorators.find((decorator) => HTTP_DECORATORS.includes(name(decorator)));
    if (!http) continue;
    const roles = group.decorators.find((decorator) => name(decorator) === 'Roles');
    const permissions = group.decorators.find((decorator) => name(decorator) === 'Permissions');
    const module = group.decorators.find((decorator) => name(decorator) === 'RequiresModule');
    const limit = group.decorators.find((decorator) => name(decorator) === 'PlanLimit');
    const isPublic = group.decorators.some((decorator) => name(decorator) === 'Public');
    const isSaasAdmin = controllerSaasAdmin || group.decorators.some((decorator) => decorator.includes('@UseGuards(SaasAdminGuard)'));
    const path = ['/' + prefix.replace(/^\/+|\/+$/g, ''), args(http)[0]?.replace(/^\/+|\/+$/g, '')].filter(Boolean).join('/').replace(/\/{2,}/g, '/');
    endpoints.push({
      method: name(http).toUpperCase(),
      path,
      handler: group.signature.replace(/^async\s+/, '').split('(')[0],
      access: isPublic ? 'público' : isSaasAdmin ? 'administrador do SaaS' : roles ? args(roles, lists).join(', ') : 'qualquer usuário autenticado',
      permissions: permissions ? args(permissions).join(', ') : '',
      extras: [module ? `módulo ${args(module).join(', ')}` : '', limit ? `limite ${args(limit).join(', ')}` : ''].filter(Boolean).join('; '),
    });
  }
  return endpoints;
}

function cell(value: string): string {
  return value ? value.replace(/\|/g, '\\|') : '';
}

export function renderApiDocs(controllers: ControllerDoc[]): string {
  const total = controllers.reduce((sum, controller) => sum + controller.endpoints.length, 0);
  const lines = [
    '# Endpoints da API',
    '',
    '> Gerado a partir dos controllers do backend. Não edite à mão: rode `UPDATE_API_DOCS=1 pnpm --filter @oficina/backend exec jest src/shared/api-docs`',
    '> depois de mudar uma rota ou seus decorators. O teste `api-docs.spec.ts` falha se este arquivo ficar desatualizado.',
    '',
    `São ${total} endpoints em ${controllers.length} controllers.`,
    '',
    '## Convenções',
    '',
    '- Todas as rotas ficam sob `/api/v1`, exceto `GET /health`. O estilo é RPC: a maioria das ações, inclusive as de leitura com filtros, é `POST`.',
    '- O corpo e as respostas trafegam em `snake_case`; o backend converte de e para `camelCase` internamente.',
    '- Autenticação: cabeçalho `Authorization: Bearer <token de acesso>`, obtido em `POST /api/v1/auth/login`. Rotas "público" não exigem token.',
    '- **Quem acessa** lista os papéis aceitos (`@Roles`). **Permissão** é a permissão exigida (`@Permissions`), além do papel. **Módulo/limite** indica o módulo do plano e o limite do plano aplicados.',
    '- Erros voltam como `{ "error": { "code", "message", "status", "details?" } }`.',
    '- Os formatos de entrada e saída estão nos DTOs de `backend/src/modules/*/dto` e nos tipos de `packages/contracts`.',
    '',
  ];
  for (const controller of controllers) {
    lines.push(`## ${controller.file}`, '', '| Método | Rota | Ação | Quem acessa | Permissão | Módulo/limite |', '| --- | --- | --- | --- | --- | --- |');
    for (const endpoint of controller.endpoints) {
      lines.push(`| ${endpoint.method} | \`${endpoint.path}\` | \`${endpoint.handler}\` | ${cell(endpoint.access)} | ${cell(endpoint.permissions)} | ${cell(endpoint.extras)} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
