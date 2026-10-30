import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModulesGuard } from './modules.guard';
import { REQUIRES_MODULE_KEY } from '../decorators/requires-module.decorator';

function context(user: unknown): ExecutionContext {
  return { getHandler: () => 'handler', getClass: () => 'class', switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext;
}

function build(required: string | undefined, modules: string[]) {
  const reflector = { getAllAndOverride: jest.fn((key: string) => (key === REQUIRES_MODULE_KEY ? required : undefined)) } as unknown as Reflector;
  const entitlements = { forTenant: jest.fn().mockResolvedValue({ modules }) };
  return { guard: new ModulesGuard(reflector, entitlements as never), entitlements };
}

describe('ModulesGuard', () => {
  it('lets through routes that are not sold separately without touching the database', async () => {
    const { guard, entitlements } = build(undefined, []);
    await expect(guard.canActivate(context({ tenantId: 't1' }))).resolves.toBe(true);
    expect(entitlements.forTenant).not.toHaveBeenCalled();
  });

  it('lets a workshop use a module its plan includes', async () => {
    const { guard } = build('financeiro', ['financeiro']);
    await expect(guard.canActivate(context({ tenantId: 't1' }))).resolves.toBe(true);
  });

  it('refuses a module outside the plan and says which plan has it', async () => {
    const { guard } = build('whatsapp', ['financeiro']);
    await expect(guard.canActivate(context({ tenantId: 't1' }))).rejects.toThrow(new ForbiddenException('WhatsApp não faz parte do plano da sua oficina. Disponível a partir do plano Completo.'));
  });

  it('does not sell public routes', async () => {
    const { guard } = build('whatsapp', []);
    await expect(guard.canActivate(context(undefined))).resolves.toBe(true);
  });
});
