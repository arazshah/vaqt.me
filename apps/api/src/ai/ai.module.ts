import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { AiConfigService } from './ai.config';
import { AiService } from './ai.service';
import { AI_PORT, type AiPort } from './ai.port';
import { AnthropicAiAdapter } from './anthropic-ai.adapter';
import { MockAiAdapter } from './mock-ai.adapter';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiConfigService,
    {
      provide: AI_PORT,
      useFactory: (config: ConfigService): AiPort => {
        const provider = config.get<string>('AI_PROVIDER') ?? 'mock';

        if (provider === 'mock') {
          return new MockAiAdapter();
        }

        if (provider === 'anthropic') {
          const apiKey = config.get<string>('ANTHROPIC_API_KEY');
          if (!apiKey) {
            throw new Error(
              'ANTHROPIC_API_KEY must be set when AI_PROVIDER=anthropic',
            );
          }
          const model =
            config.get<string>('AI_MODEL') ?? 'claude-sonnet-4-5-20250929';
          return new AnthropicAiAdapter(apiKey, model);
        }

        throw new Error(`Unknown AI_PROVIDER: ${provider}`);
      },
      inject: [ConfigService],
    },
  ],
})
export class AiModule {}
