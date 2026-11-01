import * as Sentry from '@sentry/browser';

// Browser error monitoring. Off unless NEXT_PUBLIC_SENTRY_DSN was set at build time. Only uncaught errors are
// reported (no clicks, no requests, no session replay), and everything that could identify a person is removed.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const DOCUMENT = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const TOKEN_SEGMENT = /\/[A-Za-z0-9_-]{20,}(?=\/|$)/g;
const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

export function scrubText(text: string): string {
  return text.replace(EMAIL, '[email]').replace(DOCUMENT, '[documento]');
}

// Keeps the page (which screen failed) but drops the query string and anything that looks like an id or a token
// (invite and survey links carry one).
export function scrubUrl(url: string): string {
  const path = url.split(/[?#]/)[0];
  return path.replace(UUID_SEGMENT, '/:id').replace(TOKEN_SEGMENT, '/:token');
}

export function scrubEvent<T extends Sentry.ErrorEvent>(event: T): T {
  delete event.user;
  delete event.server_name;
  event.request = event.request?.url ? { url: scrubUrl(event.request.url) } : undefined;
  if (event.message) event.message = scrubText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }
  event.breadcrumbs = [];
  event.extra = undefined;
  return event;
}

let started = false;

export function initSentry(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || started) return;
  started = true;
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'production',
    // Nothing is collected by default: only the handler for uncaught errors and promise rejections is on.
    defaultIntegrations: false,
    integrations: [Sentry.globalHandlersIntegration(), Sentry.dedupeIntegration()],
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
}
