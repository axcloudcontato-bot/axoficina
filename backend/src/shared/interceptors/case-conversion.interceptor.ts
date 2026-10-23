import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { keysToSnake } from '@oficina/contracts';
import { map, Observable } from 'rxjs';

// Converte o corpo de toda resposta de sucesso de camelCase (código TS) para
// snake_case (JSON na rede) — o espelho, do lado do backend, do interceptor
// axios que o frontend usa. Respostas de erro passam pelo HttpExceptionFilter,
// não por aqui (filters rodam fora da cadeia de interceptors).
//
// Conteúdo binário (StreamableFile, ex.: foto da OS) nunca passa por isso:
// `typeof` também acusa "object" pra ele, e keysToSnake percorrendo suas
// propriedades internas (stream, buffer...) destrói o StreamableFile — o
// Nest deixa de reconhecer o retorno como arquivo e serializa o objeto
// quebrado como JSON no corpo da resposta, em vez de transmitir os bytes.
@Injectable()
export class CaseConversionInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => (data && typeof data === 'object' && !(data instanceof StreamableFile) ? keysToSnake(data) : data)),
    );
  }
}
