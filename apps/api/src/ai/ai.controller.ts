import { Body, Controller, Post } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import type { ContinueAiSessionInput, StartAiSessionInput } from '@vaqt/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { AiService } from './ai.service';
import { ContinueAiSessionDto } from './dto/continue-ai-session.dto';
import { StartAiSessionDto } from './dto/start-ai-session.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('sessions')
  start(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(StartAiSessionDto)) body: StartAiSessionInput,
  ) {
    return this.ai.start(user.sub, body.message);
  }

  @Post('sessions/message')
  continueSession(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(ContinueAiSessionDto))
    body: ContinueAiSessionInput,
  ) {
    return this.ai.continueSession(user.sub, body.sessionId, body.message);
  }
}
