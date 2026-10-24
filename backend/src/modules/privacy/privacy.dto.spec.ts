import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResolvePrivacyRequestDto } from './privacy.dto';

describe('privacy request justification', () => {
  it('rejects whitespace as a retention justification', async () => {
    const input = plainToInstance(ResolvePrivacyRequestDto, { id: '12345678-1234-4123-8123-123456789012', status: 'RETAINED', response: '                       ', retentionUntil: '2027-01-01T00:00:00Z' });
    const errors = await validate(input);
    expect(errors.some((error) => error.property === 'response')).toBe(true);
  });
});
