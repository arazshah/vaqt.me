import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  private readonly prefix: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.prefix = config.get<string>('REDIS_PREFIX') ?? '';
    this.client = new Redis(url);
  }

  key(...parts: string[]): string {
    return `${this.prefix}${parts.join(':')}`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
