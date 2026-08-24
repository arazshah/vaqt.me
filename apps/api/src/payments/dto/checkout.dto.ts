import { createZodDto } from 'nestjs-zod';
import { checkoutSchema } from '@vaqt/shared';

export class CheckoutDto extends createZodDto(checkoutSchema) {}
