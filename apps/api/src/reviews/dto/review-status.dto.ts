import { createZodDto } from 'nestjs-zod';
import { reviewStatusSchema } from '@vaqt/shared';

export class ReviewStatusDto extends createZodDto(reviewStatusSchema) {}
