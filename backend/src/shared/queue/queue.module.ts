import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const AUDIT_LOG_QUEUE = 'audit-log';
export const FIPE_SYNC_QUEUE = 'fipe-sync';
export const MAINTENANCE_ALERTS_QUEUE = 'maintenance-alerts-scan';
export const SERVICE_ORDER_STATUS_QUEUE = 'service-order-status-notifications';
export const CUSTOMER_CARE_QUEUE = 'customer-care';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          prefix: config.get<string>('QUEUE_PREFIX', 'bull'),
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
          },
        };
      },
    }),
    BullModule.registerQueue({ name: AUDIT_LOG_QUEUE }),
    BullModule.registerQueue({ name: FIPE_SYNC_QUEUE }),
    BullModule.registerQueue({ name: MAINTENANCE_ALERTS_QUEUE }),
    BullModule.registerQueue({ name: SERVICE_ORDER_STATUS_QUEUE }),
    BullModule.registerQueue({ name: CUSTOMER_CARE_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
