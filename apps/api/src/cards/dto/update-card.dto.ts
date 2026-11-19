import { createZodDto } from 'nestjs-zod';
import { updateCardSchema } from '@vaqt/shared';

export class UpdateCardDto extends createZodDto(updateCardSchema) {}
