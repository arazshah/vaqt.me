import { createZodDto } from 'nestjs-zod';
import { getConversationSchema } from '@vaqt/shared';

export class GetConversationDto extends createZodDto(getConversationSchema) {}
