import { DEFAULT_CARE_CAMPAIGNS } from '@oficina/contracts';
import { addMonthsClamped } from '../../customer-care/care-policy';

export interface CarePlanLike {
  serviceKey: string;
  completedAt: Date;
  mileage: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
}

// The cares of a car that are already due: past the time since they were last done, or past the mileage they
// were due at (when the car's current odometer is known). Time comes first, since a care overdue in both is just overdue.
export function overdueCare(plans: CarePlanLike[], vehicleMileage: number | null, now: Date): Array<{ serviceName: string; reason: 'TIME' | 'KM' }> {
  const result: Array<{ serviceName: string; reason: 'TIME' | 'KM'; dueAt: number }> = [];
  for (const plan of plans) {
    const campaign = DEFAULT_CARE_CAMPAIGNS.find((item) => item.key === plan.serviceKey);
    if (!campaign) continue;
    const dueAt = addMonthsClamped(plan.completedAt, plan.intervalMonths ?? campaign.intervalMonths);
    const intervalKm = plan.intervalKm ?? campaign.intervalKm;
    if (dueAt.getTime() < now.getTime()) result.push({ serviceName: campaign.name, reason: 'TIME', dueAt: dueAt.getTime() });
    else if (plan.mileage !== null && intervalKm !== null && vehicleMileage !== null && vehicleMileage >= plan.mileage + intervalKm) result.push({ serviceName: campaign.name, reason: 'KM', dueAt: dueAt.getTime() });
  }
  // The one that has been waiting the longest first.
  return result.sort((a, b) => a.dueAt - b.dueAt).map(({ serviceName, reason }) => ({ serviceName, reason }));
}
