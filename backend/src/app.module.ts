import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClientIpThrottlerGuard } from './shared/guards/client-ip-throttler.guard';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { TenantContextModule } from './shared/tenant-context/tenant-context.module';
import { JwtConfigModule } from './shared/jwt/jwt-config.module';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';
import { PermissionsGuard } from './shared/guards/permissions.guard';
import { ModulesGuard } from './shared/guards/modules.guard';
import { PlanLimitGuard } from './shared/guards/plan-limit.guard';
import { PlanModule } from './shared/plan/plan.module';
import { TenantContextInterceptor } from './shared/interceptors/tenant-context.interceptor';
import { CaseConversionInterceptor } from './shared/interceptors/case-conversion.interceptor';
import { QueueModule } from './shared/queue/queue.module';
import { AuditLogModule } from './shared/audit-log/audit-log.module';
import { DocumentsModule } from './shared/documents/documents.module';
import { IamModule } from './modules/iam/iam.module';
import { CustomersModule } from './modules/customers/customers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { ServiceOrdersModule } from './modules/service-orders/service-orders.module';
import { FipeModule } from './modules/fipe/fipe.module';
import { MaintenanceAlertsModule } from './modules/maintenance-alerts/maintenance-alerts.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FinancialModule } from './modules/financial/financial.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { CustomerCareModule } from './modules/customer-care/customer-care.module';
import { BillingModule } from './modules/billing/billing.module';
import { AccountClosureModule } from './modules/account-closure/account-closure.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            // ConfigService.get<number>() não converte em runtime — .env
            // sempre entrega string. Sem o Number() aqui, `ttl` como string
            // quebra a aritmética interna do ThrottlerStorageService
            // (Date.now() + "60000" vira concatenação, não soma).
            ttl: Number(config.get<string>('THROTTLE_TTL', '60000')),
            limit: Number(config.get<string>('THROTTLE_LIMIT', '100')),
          },
        ],
      }),
    }),
    PrismaModule,
    PlanModule,
    TenantContextModule,
    JwtConfigModule,
    QueueModule,
    AuditLogModule,
    DocumentsModule,
    HealthModule,
    IamModule,
    CustomersModule,
    VehiclesModule,
    ServiceOrdersModule,
    FipeModule,
    MaintenanceAlertsModule,
    AppointmentsModule,
    FinancialModule,
    CatalogModule,
    SettingsModule,
    PrivacyModule,
    SubscriptionsModule,
    CustomerCareModule,
    BillingModule,
    AccountClosureModule,
  ],
  providers: [
    // Ordem importa: ThrottlerGuard e JwtAuthGuard rodam antes do RolesGuard
    // (que depende de request.user já populado pelo JwtAuthGuard).
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ModulesGuard },
    { provide: APP_GUARD, useClass: PlanLimitGuard },
    // Interceptors rodam depois dos guards no pipeline do Nest — por isso o
    // TenantContextInterceptor (que lê request.user) é seguro aqui.
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    // Converte toda resposta de sucesso para snake_case (NAMING_CONVENTIONS.md).
    { provide: APP_INTERCEPTOR, useClass: CaseConversionInterceptor },
  ],
})
export class AppModule {}
