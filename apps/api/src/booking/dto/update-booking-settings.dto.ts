import { createZodDto } from 'nestjs-zod';
import { updateBookingSettingsSchema } from '@vaqt/shared';

export class UpdateBookingSettingsDto extends createZodDto(
  updateBookingSettingsSchema,
) {}
