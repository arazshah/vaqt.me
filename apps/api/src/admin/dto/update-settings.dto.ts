import { createZodDto } from 'nestjs-zod';
import { updateSettingsSchema } from '@vaqt/shared';

export class UpdateSettingsDto extends createZodDto(updateSettingsSchema) {}
