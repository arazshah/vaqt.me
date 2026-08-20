import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// One shared Redis connection for every BullMQ queue in the app (sms now,
// notifications/requests/payments/ai in later phases) — matches the
// Phase 0 decision in CLAUDE.md ("صف‌های جدا با worker جدا، یک اتصال Redis
// مشترک"). BullMQ requires maxRetriesPerRequest: null on its connection or
// its blocking commands (used internally by workers) fail outright.
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: new Redis(
          config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
          { maxRetriesPerRequest: null },
        ),
        prefix: `${config.get<string>('REDIS_PREFIX') ?? ''}bull`,
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [BullModule],
})
export class BullRedisModule {}
