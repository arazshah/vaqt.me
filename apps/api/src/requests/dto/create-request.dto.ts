import { createZodDto } from 'nestjs-zod';
import { createRequestSchema } from '@vaqt/shared';

export class CreateRequestDto extends createZodDto(createRequestSchema) {}
