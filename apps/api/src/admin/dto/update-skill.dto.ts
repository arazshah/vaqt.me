import { createZodDto } from 'nestjs-zod';
import { updateSkillSchema } from '@vaqt/shared';

export class UpdateSkillDto extends createZodDto(updateSkillSchema) {}
