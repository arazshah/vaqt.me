import { createZodDto } from 'nestjs-zod';
import { bookingTokenSchema } from '@vaqt/shared';

export class BookingTokenDto extends createZodDto(bookingTokenSchema) {}
