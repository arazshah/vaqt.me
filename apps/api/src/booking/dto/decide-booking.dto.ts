import { createZodDto } from 'nestjs-zod';
import { decideBookingSchema } from '@vaqt/shared';

export class DecideBookingDto extends createZodDto(decideBookingSchema) {}
