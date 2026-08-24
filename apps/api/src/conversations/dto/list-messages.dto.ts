import { createZodDto } from 'nestjs-zod';
import { listMessagesSchema } from '@vaqt/shared';

export class ListMessagesDto extends createZodDto(listMessagesSchema) {}
