import { createZodDto } from 'nestjs-zod';
import { bookingIdSchema } from '@vaqt/shared';

export class BookingIdDto extends createZodDto(bookingIdSchema) {}
