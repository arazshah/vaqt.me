import { createZodDto } from 'nestjs-zod';
import { continueAiSessionSchema } from '@vaqt/shared';

export class ContinueAiSessionDto extends createZodDto(
  continueAiSessionSchema,
) {}
