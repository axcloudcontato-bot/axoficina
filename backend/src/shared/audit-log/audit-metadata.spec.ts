import { minimizeAuditMetadata } from './audit-metadata';

describe('audit data minimization', () => {
  it('keeps operational identifiers while removing duplicated PII and arbitrary objects', () => {
    expect(minimizeAuditMetadata({ document: '12345678900', email: 'person@example.invalid', recipient: 'person@example.invalid', subject: 'PII in free text', plate: 'ABC1D23', vehicleId: 'id', enabled: true, installments: 2, legalVersion: 'v1', category: { unexpected: 'PII' } })).toEqual({ vehicleId: 'id', enabled: true, installments: 2, legalVersion: 'v1' });
  });
});
