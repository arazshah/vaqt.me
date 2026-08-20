import { createZodDto } from 'nestjs-zod';
import { createSkillSchema } from '@vaqt/shared';

export class CreateSkillDto extends createZodDto(createSkillSchema) {}
