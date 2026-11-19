import { createZodDto } from 'nestjs-zod';
import { createBookingSchema } from '@vaqt/shared';

export class CreateBookingDto extends createZodDto(createBookingSchema) {}
