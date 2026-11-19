import { createZodDto } from 'nestjs-zod';
import { setupClaimSchema } from '@vaqt/shared';

export class SetupClaimDto extends createZodDto(setupClaimSchema) {}
