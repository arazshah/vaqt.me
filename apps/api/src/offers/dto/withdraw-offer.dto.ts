import { createZodDto } from 'nestjs-zod';
import { withdrawOfferSchema } from '@vaqt/shared';

export class WithdrawOfferDto extends createZodDto(withdrawOfferSchema) {}
