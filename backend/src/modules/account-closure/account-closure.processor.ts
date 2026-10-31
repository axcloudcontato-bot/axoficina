import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ACCOUNT_CLOSURE_QUEUE } from '../../shared/queue/queue.module';
import { AccountClosureService } from './account-closure.service';

@Processor(ACCOUNT_CLOSURE_QUEUE)
export class AccountClosureProcessor extends WorkerHost {
  private readonly logger = new Logger(AccountClosureProcessor.name);

  constructor(private readonly closure: AccountClosureService) {
    super();
  }

  async process(): Promise<void> {
    const erased = await this.closure.purgeDue();
    if (erased) this.logger.log(`${erased} oficina(s) com o prazo vencido apagada(s).`);
  }
}
