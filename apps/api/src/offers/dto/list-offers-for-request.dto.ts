import { createZodDto } from 'nestjs-zod';
import { listOffersForRequestSchema } from '@vaqt/shared';

export class ListOffersForRequestDto extends createZodDto(
  listOffersForRequestSchema,
) {}
