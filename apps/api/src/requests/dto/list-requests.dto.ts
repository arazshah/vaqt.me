import { createZodDto } from 'nestjs-zod';
import { listRequestsSchema } from '@vaqt/shared';

export class ListRequestsDto extends createZodDto(listRequestsSchema) {}
