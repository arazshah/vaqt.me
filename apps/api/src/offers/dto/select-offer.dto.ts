import { createZodDto } from 'nestjs-zod';
import { selectOfferSchema } from '@vaqt/shared';

export class SelectOfferDto extends createZodDto(selectOfferSchema) {}
