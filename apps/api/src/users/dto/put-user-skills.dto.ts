import { createZodDto } from 'nestjs-zod';
import { putUserSkillsSchema } from '@vaqt/shared';

export class PutUserSkillsDto extends createZodDto(putUserSkillsSchema) {}
