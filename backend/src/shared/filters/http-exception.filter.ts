import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppException } from '../errors/app-exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppException) {
      response.status(exception.getStatus()).json({
        error: {
          code: exception.code,
          message: exception.message,
          status: exception.getStatus(),
          details: exception.details,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const rawMessage = typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);

      response.status(status).json({
        error: {
          code: this.codeForStatus(status),
          message: Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage,
          status,
        },
      });
      return;
    }

    // Body parser errors are not HttpExceptions: a file too big must say so, not 'internal error'.
    const parserError = exception as { type?: string; status?: number } | null;
    if (parserError?.type === 'entity.too.large') {
      response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'O arquivo é grande demais. Envie um arquivo menor.', status: HttpStatus.PAYLOAD_TOO_LARGE } });
      return;
    }
    if (parserError?.type === 'entity.parse.failed') {
      response.status(HttpStatus.BAD_REQUEST).json({ error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', status: HttpStatus.BAD_REQUEST } });
      return;
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor.',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      },
    });
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'ERROR';
    }
  }
}
