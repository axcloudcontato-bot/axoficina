import { PLANS, keysToSnake, type PlanStatusResponse } from '@oficina/contracts';
import type { Route } from '@playwright/test';

// What GET /plan answers for an active workshop on the top plan, so a screen under test is never locked by its plan.
const ACTIVE_PLAN: PlanStatusResponse = {
  plan: 'completo',
  planName: PLANS.completo.name,
  modules: [...PLANS.completo.modules],
  limits: PLANS.completo.limits,
  access: { state: 'active', daysLeft: null, reason: null },
  usage: { users: 1, ordersThisMonth: 0, photoStorageMb: 0 },
};

const CORS_HEADERS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' };

// Answers shared by many screens: the plan read by the app shell and the warranty panel of a service order.
// Call this first in a catch-all API mock; it returns false for anything the spec should answer itself.
export async function fulfillAppDefaults(route: Route): Promise<boolean> {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const body = path.endsWith('/api/v1/plan') ? keysToSnake(ACTIVE_PLAN)
    : path.endsWith('/service-orders/warranty-return') && request.method() === 'GET' ? { current: null, candidates: [] }
    : undefined;
  if (!body) return false;
  await route.fulfill({ status: 200, contentType: 'application/json', headers: CORS_HEADERS, body: JSON.stringify(body) });
  return true;
}
