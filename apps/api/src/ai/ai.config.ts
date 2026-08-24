import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AI provider settings, read once from env with a documented default —
 * never hardcoded at the call site (same pattern as AuthConfigService).
 */
@Injectable()
export class AiConfigService {
  readonly provider: string;
  readonly model: string;
  readonly maxRetries: number;

  constructor(config: ConfigService) {
    this.provider = config.get<string>('AI_PROVIDER') ?? 'mock';
    this.model = config.get<string>('AI_MODEL') ?? 'claude-sonnet-4-5-20250929';
    this.maxRetries = 1;
  }
}
