import { createZodDto } from 'nestjs-zod';
import { submitOfferSchema } from '@vaqt/shared';

export class SubmitOfferDto extends createZodDto(submitOfferSchema) {}
