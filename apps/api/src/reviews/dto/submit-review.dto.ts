import { createZodDto } from 'nestjs-zod';
import { submitReviewSchema } from '@vaqt/shared';

export class SubmitReviewDto extends createZodDto(submitReviewSchema) {}
