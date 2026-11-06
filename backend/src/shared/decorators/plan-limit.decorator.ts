import { SetMetadata } from '@nestjs/common';
import type { LimitKind } from '@oficina/contracts';

export const PLAN_LIMIT_KEY = 'plan-limit';
// Marks a route that changes data: refused when the account is view-only. 'write' checks only that; the other kinds also
// check the plan's limit for what is being added. read-only-routes.spec.ts fails when a new write route does not say which.
export const PlanLimit = (kind: LimitKind | 'write') => SetMetadata(PLAN_LIMIT_KEY, kind);
