import { SetMetadata } from '@nestjs/common';
import type { LimitKind } from '@oficina/contracts';

export const PLAN_LIMIT_KEY = 'plan-limit';
// Marks a route that adds something new: refused when the account is view-only or the plan's limit is used up.
export const PlanLimit = (kind: LimitKind | 'write') => SetMetadata(PLAN_LIMIT_KEY, kind);
