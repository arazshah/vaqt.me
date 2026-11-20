import { createZodDto } from 'nestjs-zod';
import { createBookingDraftSchema } from '@vaqt/shared';

export class CreateBookingDraftDto extends createZodDto(
  createBookingDraftSchema,
) {}
