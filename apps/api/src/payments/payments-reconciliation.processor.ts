import { Processor, WorkerHost } from '@nestjs/bullmq';
import { PaymentsService } from './payments.service';

@Processor('payments')
export class PaymentsReconciliationProcessor extends WorkerHost {
  constructor(private readonly payments: PaymentsService) {
    super();
  }

  async process(): Promise<void> {
    await this.payments.reconcileStaleOrders();
  }
}
