import * as Sentry from '@sentry/node';

// Error monitoring for production. Off unless SENTRY_DSN is set. It reports only unexpected server errors, with
// everything that could identify a person or a workshop removed before it leaves the server (LGPD).

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const DOCUMENT = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const TOKEN_SEGMENT = /\/[A-Za-z0-9_-]{20,}(?=\/|$)/g;
const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

export function scrubText(text: string): string {
  return text.replace(EMAIL, '[email]').replace(DOCUMENT, '[documento]');
}

// Keeps the route shape (which endpoint failed) but drops the query string and anything that looks like an id or token.
export function scrubUrl(url: string): string {
  const path = url.split(/[?#]/)[0];
  return path.replace(UUID_SEGMENT, '/:id').replace(TOKEN_SEGMENT, '/:token');
}

export function scrubEvent<T extends Sentry.ErrorEvent>(event: T): T {
  delete event.user;
  delete event.server_name;
  delete event.contexts?.device;
  if (event.request) {
    event.request = { method: event.request.method, url: event.request.url ? scrubUrl(event.request.url) : undefined };
  }
  if (event.message) event.message = scrubText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }
  event.breadcrumbs = [];
  event.extra = undefined;
  return event;
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || undefined,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
}

// Called for exceptions nobody handled (the 500s). Validation and permission errors are expected and never sent.
export function captureServerError(exception: unknown): void {
  if (process.env.SENTRY_DSN) Sentry.captureException(exception);
}
