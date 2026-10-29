import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { CustomersController } from './controllers/customers.controller';
import { CustomerManager } from './managers/customer.manager';
import { CustomerRepository } from './repositories/customer.repository';

// DocumentValidatorService e AuditLogService vêm de módulos @Global()
// (DocumentsModule, AuditLogModule) — não precisam estar nos providers aqui.
@Module({
  imports: [IamModule],
  controllers: [CustomersController],
  providers: [CustomerManager, CustomerRepository],
  // VehicleManager (Feature 4) precisa validar que um customerId existe e
  // pertence ao tenant antes de criar/atualizar um veículo.
  exports: [CustomerRepository],
})
export class CustomersModule {}
