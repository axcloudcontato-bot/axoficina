import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../shared/decorators/public.decorator';
import { scrubUrl } from '../shared/observability/sentry';

const MAX_LENGTH = 160;

// Keys arrive as "violated-directive" (report-uri) or camelCase after the body is converted: compare without the dashes.
function pick(report: Record<string, unknown>, name: string): string {
  const wanted = name.replace(/-/g, '').toLowerCase();
  const key = Object.keys(report).find((candidate) => candidate.replace(/[-_]/g, '').toLowerCase() === wanted);
  const value = key ? report[key] : undefined;
  // Only printable ASCII goes to the log, so a report cannot forge log lines; URLs lose query strings and tokens.
  return typeof value === 'string' ? scrubUrl(value).replace(/[^\x20-\x7E]/g, '').slice(0, MAX_LENGTH) : '';
}

export function summarizeCspReport(body: unknown): string | null {
  const wrapper = body as Record<string, unknown> | null;
  const report = wrapper && typeof wrapper === 'object' ? (wrapper['csp-report'] ?? wrapper['cspReport']) : undefined;
  if (!report || typeof report !== 'object') return null;
  const fields = report as Record<string, unknown>;
  const directive = pick(fields, 'effective-directive') || pick(fields, 'violated-directive');
  if (!directive) return null;
  return `${directive} bloqueado: ${pick(fields, 'blocked-uri') || '(sem origem)'} em ${pick(fields, 'document-uri') || '(sem página)'}`;
}

// Receives the browser's CSP violation reports while the policy runs in report-only mode (deploy/debian/Caddyfile).
// It only writes one scrubbed line to the log: no database, no data kept.
@Controller('api/v1/csp-report')
export class CspReportController {
  private readonly logger = new Logger('CSP');

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post()
  report(@Body() body: unknown): void {
    const line = summarizeCspReport(body);
    if (line) this.logger.warn(line);
  }
}
