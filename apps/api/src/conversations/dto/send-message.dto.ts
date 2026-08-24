import { createZodDto } from 'nestjs-zod';
import { sendMessageSchema } from '@vaqt/shared';

export class SendMessageDto extends createZodDto(sendMessageSchema) {}
