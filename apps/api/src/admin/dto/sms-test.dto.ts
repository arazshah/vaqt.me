import { createZodDto } from 'nestjs-zod';
import { smsTestSchema } from '@vaqt/shared';

export class SmsTestDto extends createZodDto(smsTestSchema) {}
