import { ServiceOrderStatusNotificationsController } from './controllers/service-order-status-notifications.controller';
import { ServiceOrderStatusNotificationRepository } from './repositories/service-order-status-notification.repository';
import { ServiceOrderStatusNotificationService } from './services/service-order-status-notification.service';
import { ServiceOrderStatusNotificationProcessor } from './processors/service-order-status-notification.processor';
import { forwardRef, Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { CustomersModule } from '../customers/customers.module';
import { IamModule } from '../iam/iam.module';
import { MaintenanceAlertsModule } from '../maintenance-alerts/maintenance-alerts.module';
import { ServiceOrdersController } from './controllers/service-orders.controller';
import { ServiceOrderManager } from './managers/service-order.manager';
import { ServiceOrderRepository } from './repositories/service-order.repository';
import { ServiceOrderStatusHistoryRepository } from './repositories/service-order-status-history.repository';
import { ServiceOrderItemRepository } from './repositories/service-order-item.repository';
import { ServiceOrderReceiptRepository } from './repositories/service-order-receipt.repository';
import { ServiceOrderPhotoRepository } from './repositories/service-order-photo.repository';
import { ServiceOrderPhotoManager } from './managers/service-order-photo.manager';
import { ServiceOrderPhotoStorageService } from './services/service-order-photo-storage.service';
import { SettingsModule } from '../settings/settings.module';
import { CustomerCareModule } from '../customer-care/customer-care.module';
import { CustomerMessagesController } from './controllers/customer-messages.controller';
import { CustomerMessageManager } from './managers/customer-message.manager';
import { CustomerMessageRepository } from './repositories/customer-message.repository';
import { WaAkgWebhookController } from './controllers/wa-akg-webhook.controller';
import { CustomerReplyNotificationsController } from './controllers/customer-reply-notifications.controller';
import { CustomerReplyNotificationRepository } from './repositories/customer-reply-notification.repository';

// Importa VehiclesModule/CustomersModule/IamModule pra ter acesso aos
// repositórios que exportam — ServiceOrderManager valida vehicleId (e lê
// customerId a partir dele) e technicianId. AuditLogService vem do
// AuditLogModule @Global(), não precisa estar aqui.
// MaintenanceAlertsModule: ServiceOrderManager injeta MaintenanceAlertRepository
// pra resolver automaticamente um alerta obsoleto na transição pra DELIVERED.
// `forwardRef()` porque MaintenanceAlertsModule importa este módulo de volta
// (pra usar ServiceOrderRepository.lastDeliveredClosedAtUnscoped no job) —
// ver comentário em maintenance-alerts.module.ts.
@Module({
  imports: [VehiclesModule, CustomersModule, IamModule, SettingsModule, CustomerCareModule, forwardRef(() => MaintenanceAlertsModule)],
  controllers: [ServiceOrderStatusNotificationsController, ServiceOrdersController, CustomerMessagesController, WaAkgWebhookController, CustomerReplyNotificationsController],
  providers: [ServiceOrderStatusNotificationRepository, ServiceOrderStatusNotificationService, ServiceOrderStatusNotificationProcessor, CustomerReplyNotificationRepository, CustomerMessageManager, CustomerMessageRepository, ServiceOrderManager, ServiceOrderPhotoManager, ServiceOrderPhotoStorageService, ServiceOrderRepository, ServiceOrderStatusHistoryRepository, ServiceOrderItemRepository, ServiceOrderReceiptRepository, ServiceOrderPhotoRepository],
  // MaintenanceAlertsModule (Feature Motor de Manutenção Preventiva) importa
  // este módulo pra usar ServiceOrderRepository.lastDeliveredClosedAtUnscoped
  // no job diário de scan.
  exports: [ServiceOrderRepository, ServiceOrderManager],
})
export class ServiceOrdersModule {}
