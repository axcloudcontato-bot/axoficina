import { Injectable } from '@nestjs/common';
import type { FiscalDocument, FiscalSettings, Prisma } from '@oficina/database';
import type { CustomerAddress, PaymentMethod } from '@oficina/contracts';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { FiscalCustomer, FiscalOrder } from './fiscal-payload';

export type FiscalSettingsData = Omit<Prisma.FiscalSettingsUncheckedCreateInput, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;
export type FiscalDocumentData = Omit<Prisma.FiscalDocumentUncheckedCreateInput, 'tenantId' | 'createdAt' | 'updatedAt'>;

export interface FiscalOrderBundle {
  order: FiscalOrder;
  customer: FiscalCustomer;
  status: string;
}

// Every model read here is tenant-scoped by the Prisma middleware (FiscalSettings, FiscalDocument, ServiceOrder,
// Customer, Vehicle, CatalogItem); ServiceOrderItem has no tenant_id and is only reached through an order of this tenant.
@Injectable()
export class FiscalRepository {
  constructor(private readonly prisma: PrismaService) {}

  settings(tenantId: string): Promise<FiscalSettings | null> {
    return this.prisma.client.fiscalSettings.findUnique({ where: { tenantId } });
  }

  saveSettings(tenantId: string, data: Partial<FiscalSettingsData>): Promise<FiscalSettings> {
    return this.prisma.client.fiscalSettings.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  }

  async orderBundle(serviceOrderId: string): Promise<FiscalOrderBundle | null> {
    const order = await this.prisma.client.serviceOrder.findFirst({ where: { id: serviceOrderId, deletedAt: null } });
    if (!order) return null;
    const [items, customer, vehicle] = await Promise.all([
      this.prisma.client.serviceOrderItem.findMany({ where: { serviceOrderId, deletedAt: null }, orderBy: { createdAt: 'asc' } }),
      this.prisma.client.customer.findFirst({ where: { id: order.customerId } }),
      this.prisma.client.vehicle.findFirst({ where: { id: order.vehicleId } }),
    ]);
    const catalogIds = [...new Set(items.map((item) => item.catalogItemId).filter((id): id is string => Boolean(id)))];
    const catalog = catalogIds.length ? await this.prisma.client.catalogItem.findMany({ where: { id: { in: catalogIds } }, select: { id: true, ncm: true, unit: true, code: true } }) : [];
    const byId = new Map(catalog.map((item) => [item.id, item]));
    return {
      status: order.status,
      order: {
        orderNumber: order.orderNumber,
        vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model}`.trim() : 'Veículo',
        vehiclePlate: vehicle?.plate ?? '',
        discountCents: order.discountCents,
        paymentMethod: (order.paymentMethod ?? null) as PaymentMethod | null,
        items: items.map((item) => {
          const source = item.catalogItemId ? byId.get(item.catalogItemId) : undefined;
          return { id: item.id, type: item.type, description: item.description, quantity: Number(item.quantity), unitPriceCents: item.unitPriceCents, ncm: source?.ncm, unit: source?.unit, code: source?.code };
        }),
      },
      customer: customer
        ? { type: customer.type, document: customer.document, name: customer.name, email: customer.email, phone: customer.phone, stateRegistration: customer.stateRegistration, address: (customer.address ?? null) as CustomerAddress | null }
        : { type: 'PF', name: 'Consumidor' },
    };
  }

  documents(serviceOrderId: string): Promise<FiscalDocument[]> {
    return this.prisma.client.fiscalDocument.findMany({ where: { serviceOrderId }, orderBy: { createdAt: 'desc' } });
  }

  document(id: string): Promise<FiscalDocument | null> {
    return this.prisma.client.fiscalDocument.findFirst({ where: { id } });
  }

  // An issued (or still processing) document of this kind blocks issuing another one for the same order.
  activeDocument(serviceOrderId: string, kind: string): Promise<FiscalDocument | null> {
    return this.prisma.client.fiscalDocument.findFirst({ where: { serviceOrderId, kind, status: { in: ['PROCESSING', 'AUTHORIZED'] } } });
  }

  createDocument(tenantId: string, data: FiscalDocumentData): Promise<FiscalDocument> {
    return this.prisma.client.fiscalDocument.create({ data: { tenantId, ...data } });
  }

  updateDocument(id: string, data: Prisma.FiscalDocumentUncheckedUpdateInput): Promise<FiscalDocument> {
    return this.prisma.client.fiscalDocument.update({ where: { id }, data });
  }

  deleteDocument(id: string): Promise<FiscalDocument> {
    return this.prisma.client.fiscalDocument.delete({ where: { id } });
  }
}
