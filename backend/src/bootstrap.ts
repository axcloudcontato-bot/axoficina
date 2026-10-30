import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { INestApplication, ValidationError } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { stringToSnakeCase } from '@oficina/contracts';
import { AppErrorCode } from './shared/errors/app-error-code';
import { AppException, type AppExceptionDetail } from './shared/errors/app-exception';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { snakeToCamelMiddleware } from './shared/middleware/snake-to-camel.middleware';

// class-validator aninha erros de objetos nested (ex: UserListDto.filters)
// em `error.children`, não em `error.constraints` do erro pai — sem
// recursão, um filtro inválido em `filters.status` produzia
// `details: []` e o usuário só via "Dados inválidos." genérico.
function flattenValidationErrors(errors: ValidationError[], parentPath = ''): AppExceptionDetail[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownDetails = Object.values(error.constraints ?? {}).map((message) => ({
      field: stringToSnakeCase(path),
      message,
    }));
    const childDetails = error.children?.length ? flattenValidationErrors(error.children, path) : [];
    return [...ownDetails, ...childDetails];
  });
}

// Compartilhado entre main.ts e os testes e2e (test/*.e2e-spec.ts) — os
// testes montam o Nest app manualmente via TestingModule e precisam do
// MESMO pipeline (body parser, conversão snake_case->camelCase, filtros e
// ValidationPipe) que a aplicação real usa. Duplicar essa configuração nos
// specs já causou divergência silenciosa: os testes passavam payloads
// snake_case sem o snakeToCamelMiddleware, testando um caminho que a
// aplicação real nunca exercita.
export function configureApp(app: INestApplication): void {
  // The logo (up to 500 KiB) and payment receipts (up to 2 MB) travel as base64 inside JSON, a third bigger than
  // the file. The 100 KB default refused anything past ~70 KB; each endpoint still checks its own file size.
  app.use(json({ limit: '4mb', verify: (req, _res, buffer) => {
    // HMAC must use the exact bytes signed by WA-AKG, before key conversion.
    if (req.url?.startsWith('/api/v1/webhooks/wa-akg/')) (req as { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  } }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // snake_case (rede) -> camelCase (DTOs) ANTES do ValidationPipe;
  // camelCase -> snake_case na volta é o CaseConversionInterceptor global
  // (ver app.module.ts).
  app.use(snakeToCamelMiddleware);

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Converte os erros do class-validator para o formato
      // `{ error: { details: [{ field, message }] } }` que o frontend espera
      // (regra API_ERROR_MESSAGES). `field` volta em snake_case, como o
      // corpo da requisição que o frontend enviou.
      exceptionFactory: (errors) => {
        const details = flattenValidationErrors(errors);
        return new AppException(AppErrorCode.VALIDATION_ERROR, 'Dados inválidos.', HttpStatus.BAD_REQUEST, details);
      },
    }),
  );
}
