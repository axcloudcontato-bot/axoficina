import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseController, renderApiDocs, type ControllerDoc } from './generate-api-docs';

const SOURCE_ROOT = join(__dirname, '..', '..');
const DOC_FILE = join(SOURCE_ROOT, '..', '..', 'docs', 'api', 'endpoints.md');

function controllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return controllerFiles(path);
    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

function currentDocs(): ControllerDoc[] {
  return controllerFiles(SOURCE_ROOT)
    .map((file) => ({ file: relative(SOURCE_ROOT, file).split(sep).join('/'), endpoints: parseController(readFileSync(file, 'utf8')) }))
    .filter((controller) => controller.endpoints.length > 0)
    .sort((a, b) => a.file.localeCompare(b.file));
}

describe('parseController', () => {
  it('reads the route, access and plan rules from a controller', () => {
    const source = [
      "const STAFF = ['ADMIN', 'MECHANIC'] as const;",
      "@Controller('api/v1/things')",
      'export class ThingsController {',
      "  @Roles('ADMIN', 'MANAGER')",
      "  @Permissions('things.manage')",
      "  @RequiresModule('financial')",
      "  @PlanLimit('write')",
      "  @Post('update')",
      '  async update() {}',
      '',
      '  @Public()',
      '  @Get()',
      '  list() {}',
      '',
      "  @Roles(...STAFF)",
      '  @Get(',
      "    ':id',",
      '  )',
      '  one() {}',
      '',
      '  @Get(',
      '    "weird"',
      '  )',
      '  other() {}',
      '}',
    ].join('\n');
    expect(parseController(source)).toEqual([
      { method: 'POST', path: '/api/v1/things/update', handler: 'update', access: 'ADMIN, MANAGER', permissions: 'things.manage', extras: 'módulo financial; limite write' },
      { method: 'GET', path: '/api/v1/things', handler: 'list', access: 'público', permissions: '', extras: '' },
      { method: 'GET', path: '/api/v1/things/:id', handler: 'one', access: 'ADMIN, MECHANIC', permissions: '', extras: '' },
      { method: 'GET', path: '/api/v1/things/weird', handler: 'other', access: 'qualquer usuário autenticado', permissions: '', extras: '' },
    ]);
  });
});

describe('docs/api/endpoints.md', () => {
  it('is in sync with the controllers (run with UPDATE_API_DOCS=1 to regenerate it)', () => {
    const expected = renderApiDocs(currentDocs());
    if (process.env.UPDATE_API_DOCS === '1') writeFileSync(DOC_FILE, expected);
    expect(existsSync(DOC_FILE)).toBe(true);
    // Compared without CR so a Windows checkout (CRLF) matches the file generated on Linux in CI.
    expect(readFileSync(DOC_FILE, 'utf8').replace(/\r\n/g, '\n').trimEnd()).toBe(expected.trimEnd());
  });

  it('covers every route of the backend', () => {
    const docs = currentDocs();
    expect(docs.length).toBeGreaterThanOrEqual(20);
    expect(docs.flatMap((controller) => controller.endpoints).length).toBeGreaterThanOrEqual(150);
  });
});
