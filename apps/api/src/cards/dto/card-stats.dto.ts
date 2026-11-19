import { createZodDto } from 'nestjs-zod';
import { cardStatsQuerySchema } from '@vaqt/shared';

export class CardStatsDto extends createZodDto(cardStatsQuerySchema) {}
