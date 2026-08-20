import { createZodDto } from 'nestjs-zod';
import { updateUserProfileSchema } from '@vaqt/shared';

export class UpdateUserProfileDto extends createZodDto(
  updateUserProfileSchema,
) {}
