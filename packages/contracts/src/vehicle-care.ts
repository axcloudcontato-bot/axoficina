import type { FipeCategory } from './response/fipe.response';
import type { CareServiceKey } from './customer-care';

const APPLICABLE: Record<FipeCategory, readonly CareServiceKey[]> = {
  CAR: ['PERIODIC_REVIEW', 'OIL_CHANGE', 'BRAKES', 'BRAKE_FLUID', 'TIRES', 'AIR_FILTER', 'CABIN_FILTER', 'COOLING', 'BATTERY', 'WIPERS', 'BELTS', 'SPARK_PLUGS'],
  MOTORCYCLE: ['PERIODIC_REVIEW', 'OIL_CHANGE', 'BRAKES', 'BRAKE_FLUID', 'TIRES', 'AIR_FILTER', 'COOLING', 'BATTERY', 'SPARK_PLUGS'],
  TRUCK: ['PERIODIC_REVIEW', 'OIL_CHANGE', 'BRAKES', 'BRAKE_FLUID', 'TIRES', 'AIR_FILTER', 'CABIN_FILTER', 'COOLING', 'BATTERY', 'WIPERS', 'BELTS'],
};

export function careAppliesToVehicle(category: FipeCategory | null, key: CareServiceKey): boolean {
  return category !== null && APPLICABLE[category].includes(key);
}
