import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { Vehicle } from '@oficina/database';
import { MAINTENANCE_ALERTS_QUEUE } from '../../../shared/queue/queue.module';
import { TenantRepository } from '../../iam/repositories/tenant.repository';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { ServiceOrderRepository } from '../../service-orders/repositories/service-order.repository';
import { CustomerRepository } from '../../customers/repositories/customer.repository';
import { MaintenanceAlertRepository } from '../repositories/maintenance-alert.repository';
import { monthsSince } from '../utils/months-since';

// Default for a workshop that never changed it (settings: months without a delivered order).
const DEFAULT_DUE_THRESHOLD_MONTHS = 6;

// Paginação em chunks (BATCH_PROCESSING.md): nunca carrega todos os tenants
// nem todos os veículos de um tenant de uma vez em memória. MAX_CHUNKS é um
// guard contra loop infinito, não um limite esperado na prática.
const TENANT_CHUNK_SIZE = 50;
const TENANT_MAX_CHUNKS = 200;
const VEHICLE_CHUNK_SIZE = 500;
const VEHICLE_MAX_CHUNKS = 200;

interface MaintenanceAlertScanJobData {
  // Injetado só em teste, pra tornar o "agora" determinístico — em produção
  // a fila é enfileirada com `{}` e o processor usa `new Date()`.
  now?: string;
}

@Processor(MAINTENANCE_ALERTS_QUEUE)
export class MaintenanceAlertScanProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceAlertScanProcessor.name);

  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly vehicleRepository: VehicleRepository,
    private readonly serviceOrderRepository: ServiceOrderRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly maintenanceAlertRepository: MaintenanceAlertRepository,
  ) {
    super();
  }

  async process(job: Job<MaintenanceAlertScanJobData>): Promise<void> {
    const now = job.data?.now ? new Date(job.data.now) : new Date();

    let offset = 0;
    for (let chunk = 0; chunk < TENANT_MAX_CHUNKS; chunk++) {
      const tenants = await this.tenantRepository.listAllUnscoped(offset, TENANT_CHUNK_SIZE);
      if (tenants.length === 0) {
        break;
      }

      for (const tenant of tenants) {
        await this.scanTenant(tenant.id, now, tenant.maintenanceAlertMonths ?? DEFAULT_DUE_THRESHOLD_MONTHS);
      }

      if (tenants.length < TENANT_CHUNK_SIZE) {
        break;
      }
      offset += TENANT_CHUNK_SIZE;
    }
  }

  private async scanTenant(tenantId: string, now: Date, thresholdMonths: number): Promise<void> {
    let offset = 0;
    for (let chunk = 0; chunk < VEHICLE_MAX_CHUNKS; chunk++) {
      const vehicles = await this.vehicleRepository.listActiveForTenantUnscoped(tenantId, offset, VEHICLE_CHUNK_SIZE);
      if (vehicles.length === 0) {
        break;
      }

      // Edge Case 5 da spec: veículo de cliente soft-deletado nunca gera nem
      // mantém alerta. Sem relação FK entre Vehicle e Customer (SCHEMA.md),
      // o filtro é feito em lote aqui (mesmo padrão N+1-safe já usado em
      // CustomerRepository.byIds/VehicleRepository.byIds).
      const activeCustomerIds = new Set(
        await this.customerRepository.activeIdsAmongUnscoped(vehicles.map((vehicle) => vehicle.customerId)),
      );
      const vehiclesWithActiveCustomer = vehicles.filter((vehicle) => activeCustomerIds.has(vehicle.customerId));

      for (const vehicle of vehiclesWithActiveCustomer) {
        try {
          await this.scanVehicle(vehicle, now, thresholdMonths);
        } catch (error) {
          this.logger.warn(`Falha ao avaliar alerta de manutenção do veículo ${vehicle.id}`, error as Error);
        }
      }

      if (vehicles.length < VEHICLE_CHUNK_SIZE) {
        break;
      }
      offset += VEHICLE_CHUNK_SIZE;
    }
  }

  private async scanVehicle(vehicle: Vehicle, now: Date, thresholdMonths: number): Promise<void> {
    const lastDeliveredAt = await this.serviceOrderRepository.lastDeliveredClosedAtUnscoped(vehicle.id);
    const referenceDate = lastDeliveredAt ?? vehicle.createdAt;

    if (monthsSince(referenceDate, now) < thresholdMonths) {
      return;
    }

    await this.maintenanceAlertRepository.upsertOpenAlert({
      tenantId: vehicle.tenantId,
      vehicleId: vehicle.id,
      customerId: vehicle.customerId,
      referenceDate,
    });
  }
}
