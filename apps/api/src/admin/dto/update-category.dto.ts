import { createZodDto } from 'nestjs-zod';
import { updateCategorySchema } from '@vaqt/shared';

export class UpdateCategoryDto extends createZodDto(updateCategorySchema) {}
