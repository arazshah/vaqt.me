import { createZodDto } from 'nestjs-zod';
import { setUsernameSchema } from '@vaqt/shared';

export class SetUsernameDto extends createZodDto(setUsernameSchema) {}
