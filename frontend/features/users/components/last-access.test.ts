import { describe, expect, it } from 'vitest';
import { lastAccess } from './UsersTable';

describe('lastAccess', () => {
  const now = new Date('2026-10-30T12:00:00Z');
  it('tells who never used the access and who left long ago', () => {
    expect(lastAccess(null, 'invited', now)).toBe('convite pendente');
    expect(lastAccess(null, 'active', now)).toBe('nunca entrou');
    expect(lastAccess('2026-10-30T08:00:00Z', 'active', now)).toBe('hoje');
    expect(lastAccess('2026-10-29T08:00:00Z', 'active', now)).toBe('ontem');
    expect(lastAccess('2026-10-20T12:00:00Z', 'active', now)).toBe('há 10 dias');
    expect(lastAccess('2026-07-30T12:00:00Z', 'active', now)).toBe('há 3 meses');
    expect(lastAccess('2025-01-01T12:00:00Z', 'disabled', now)).toBe('há mais de um ano');
  });
});
