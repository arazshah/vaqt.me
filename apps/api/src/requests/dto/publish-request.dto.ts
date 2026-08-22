import { createZodDto } from 'nestjs-zod';
import { publishRequestSchema } from '@vaqt/shared';

export class PublishRequestDto extends createZodDto(publishRequestSchema) {}
