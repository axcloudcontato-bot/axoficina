import { validate } from 'class-validator';
import { UpdateCompanySettingsDto, UpdateEmailSettingsDto } from './settings.dto';

// Regressão: `@IsOptional()` só pula a validação quando o valor é
// null/undefined, nunca string vazia — os forms sempre mandam '' pra campo de
// e-mail opcional deixado em branco (ex: EmailSettingsForm's `replyTo: ''`),
// o que derrubava o salvamento inteiro com "Dados inválidos" mesmo sem o
// operador ter digitado nada de errado.
describe('UpdateEmailSettingsDto', () => {
  function build(overrides: Partial<UpdateEmailSettingsDto> = {}): UpdateEmailSettingsDto {
    const dto = new UpdateEmailSettingsDto();
    dto.port = 465;
    dto.secure = true;
    dto.enabled = true;
    dto.fromEmail = 'atendimento@oficina.com.br';
    dto.replyTo = '';
    Object.assign(dto, overrides);
    return dto;
  }

  it('accepts replyTo left blank', async () => {
    const errors = await validate(build());
    expect(errors).toHaveLength(0);
  });

  it('still rejects a malformed replyTo', async () => {
    const errors = await validate(build({ replyTo: 'not-an-email' }));
    expect(errors.some((error) => error.property === 'replyTo')).toBe(true);
  });

  it('still rejects a malformed fromEmail', async () => {
    const errors = await validate(build({ fromEmail: 'not-an-email' }));
    expect(errors.some((error) => error.property === 'fromEmail')).toBe(true);
  });
});

describe('UpdateCompanySettingsDto', () => {
  function build(overrides: Partial<UpdateCompanySettingsDto> = {}): UpdateCompanySettingsDto {
    const dto = new UpdateCompanySettingsDto();
    dto.name = 'Oficina Teste';
    dto.document = '12345678900';
    dto.email = '';
    Object.assign(dto, overrides);
    return dto;
  }

  it('accepts email left blank', async () => {
    const errors = await validate(build());
    expect(errors).toHaveLength(0);
  });

  it('still rejects a malformed email', async () => {
    const errors = await validate(build({ email: 'not-an-email' }));
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });
});
