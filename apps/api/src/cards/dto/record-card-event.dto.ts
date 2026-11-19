import { createZodDto } from 'nestjs-zod';
import { recordCardEventSchema } from '@vaqt/shared';

export class RecordCardEventDto extends createZodDto(recordCardEventSchema) {}
