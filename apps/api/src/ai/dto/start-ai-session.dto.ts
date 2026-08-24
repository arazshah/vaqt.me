import { createZodDto } from 'nestjs-zod';
import { startAiSessionSchema } from '@vaqt/shared';

export class StartAiSessionDto extends createZodDto(startAiSessionSchema) {}
