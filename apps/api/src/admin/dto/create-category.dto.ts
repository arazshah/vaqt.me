import { createZodDto } from 'nestjs-zod';
import { createCategorySchema } from '@vaqt/shared';

export class CreateCategoryDto extends createZodDto(createCategorySchema) {}
