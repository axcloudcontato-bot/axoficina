import { Injectable } from '@nestjs/common';
import type { CareForecastCustomer, CareForecastDay, CareForecastResponse, CareServiceKey } from '@oficina/contracts';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CustomerCareService } from './customer-care.service';
import { addDays, birthdayDates, maintenanceContact } from './care-forecast';
import { DAY_MS, localClock } from './care-policy';

const BATCH = 500;

@Injectable()
export class CustomerCareForecastService {
  constructor(private readonly prisma: PrismaService, private readonly care: CustomerCareService) {}

  async forecast(tenantId: string, horizonDays = 90): Promise<CareForecastResponse> {
    const settings = await this.care.settings(tenantId);
    const today = localClock(new Date(), settings.timeZone).date; const end = addDays(today, horizonDays - 1);
    const buckets = new Map<string, Map<string, CareForecastCustomer>>();
    const add = (date: string, customerId: string, customerName: string, kind: CareForecastCustomer['kind'], item?: CareForecastCustomer['items'][number]) => {
      const day = buckets.get(date) ?? new Map<string, CareForecastCustomer>(); buckets.set(date, day);
      const entry = day.get(`${customerId}:${kind}`) ?? { customerId, customerName, kind, items: [] }; day.set(`${customerId}:${kind}`, entry);
      if (item) entry.items.push(item);
    };

    // Deliveries already made: a plan with any delivery for the same service
    // date has had its first contact; a birthday key is unique per year.
    const sinceCreated = new Date(Date.now() - 400 * DAY_MS);
    const deliveries = await this.prisma.unscoped.customerCareDelivery.findMany({ where: { tenantId, status: { in: ['PENDING', 'SENDING', 'SENT', 'UNKNOWN'] }, createdAt: { gte: sinceCreated } }, select: { eventKeys: true } });
    const eventKeys = new Set(deliveries.flatMap(item => item.eventKeys));
    const contacted = new Set([...eventKeys].map(key => key.slice(0, key.lastIndexOf(':'))));

    const birthdayCampaign = settings.campaigns.find(item => item.key === 'BIRTHDAY');
    if (birthdayCampaign?.enabled) {
      let cursor: string | undefined;
      for (;;) {
        const customers = await this.prisma.unscoped.customer.findMany({ where: { tenantId, deletedAt: null, careMessagesEnabled: true, type: 'PF', birthDate: { not: null }, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: BATCH });
        for (const customer of customers) for (const date of birthdayDates(customer.birthDate!, today, end)) {
          if (!eventKeys.has(`birthday:${customer.id}:${date.slice(0, 4)}`)) add(date, customer.id, customer.name, 'BIRTHDAY');
        }
        if (customers.length < BATCH) break;
        cursor = customers.at(-1)!.id;
      }
    }

    const withoutConsent = new Set<string>(); let cursor: string | undefined;
    for (;;) {
      const plans = await this.prisma.unscoped.customerCarePlan.findMany({ where: { tenantId, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: BATCH });
      if (!plans.length) break;
      const [customers, vehicles] = await Promise.all([
        this.prisma.unscoped.customer.findMany({ where: { tenantId, deletedAt: null, id: { in: [...new Set(plans.map(plan => plan.customerId))] } } }),
        this.prisma.unscoped.vehicle.findMany({ where: { tenantId, deletedAt: null, id: { in: [...new Set(plans.map(plan => plan.vehicleId))] } } }),
      ]);
      for (const plan of plans) {
        const campaign = settings.campaigns.find(item => item.key === plan.serviceKey);
        const customer = customers.find(item => item.id === plan.customerId); const vehicle = vehicles.find(item => item.id === plan.vehicleId && item.customerId === plan.customerId);
        if (!campaign?.enabled || !customer || !vehicle || contacted.has(`${plan.id}:${plan.completedAt.toISOString()}`)) continue;
        const contact = maintenanceContact(plan, campaign, settings, today);
        if (contact.date > end) continue;
        if (!customer.careMessagesEnabled) { withoutConsent.add(customer.id); continue; }
        add(contact.date, customer.id, customer.name, 'MAINTENANCE', { vehicleId: vehicle.id, vehicleName: `${vehicle.brand} ${vehicle.model}`, plate: vehicle.plate, serviceKey: plan.serviceKey as CareServiceKey, serviceName: campaign.name, dueAt: contact.dueDate, late: contact.late });
      }
      if (plans.length < BATCH) break;
      cursor = plans.at(-1)!.id;
    }

    const days: CareForecastDay[] = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, day]) => ({ date, customers: [...day.values()].sort((a, b) => a.customerName.localeCompare(b.customerName, 'pt-BR')) }));
    return { enabled: settings.enabled, today, horizonDays, dailyLimit: settings.dailyLimit, withoutConsent: withoutConsent.size, days };
  }
}
