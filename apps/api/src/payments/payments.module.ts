import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { AuthModule } from '../auth/auth.module';
import { MockPaymentAdapter } from './mock-payment.adapter';
import { PAYMENT_PORT, type PaymentPort } from './payment.port';
import { PaymentsConfigService } from './payments.config';
import { PaymentsController } from './payments.controller';
import { PaymentsReconciliationProcessor } from './payments-reconciliation.processor';
import { PaymentsService } from './payments.service';
import { ZarinpalAdapter } from './zarinpal.adapter';

const EVERY_15_MINUTES_CRON = '*/15 * * * *';
const REPEATABLE_JOB_ID = 'payment-reconciliation';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    BullModule.registerQueue({
      name: 'payments',
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsConfigService,
    PaymentsReconciliationProcessor,
    {
      provide: PAYMENT_PORT,
      useFactory: (config: ConfigService): PaymentPort => {
        const provider = config.get<string>('PAYMENT_PROVIDER') ?? 'mock';

        if (provider === 'mock') {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'PAYMENT_PROVIDER=mock is not allowed when NODE_ENV=production',
            );
          }
          return new MockPaymentAdapter();
        }

        if (provider === 'zarinpal') {
          const merchantId = config.get<string>('ZARINPAL_MERCHANT_ID');
          if (!merchantId) {
            throw new Error(
              'ZARINPAL_MERCHANT_ID must be set when PAYMENT_PROVIDER=zarinpal',
            );
          }
          const sandbox = config.get<string>('ZARINPAL_SANDBOX') !== 'false';
          return new ZarinpalAdapter(merchantId, sandbox);
        }

        throw new Error(`Unknown PAYMENT_PROVIDER: ${provider}`);
      },
      inject: [ConfigService],
    },
  ],
})
export class PaymentsModule implements OnModuleInit {
  constructor(@InjectQueue('payments') private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // upsertJobScheduler is idempotent by schedulerId — safe on every boot.
    await this.queue.upsertJobScheduler(
      REPEATABLE_JOB_ID,
      { pattern: EVERY_15_MINUTES_CRON },
      { name: 'reconcile' },
    );
  }
}
