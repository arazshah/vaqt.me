import { createZodDto } from 'nestjs-zod';
import { listReviewsForUserSchema } from '@vaqt/shared';

export class ListReviewsForUserDto extends createZodDto(
  listReviewsForUserSchema,
) {}
