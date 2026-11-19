import { createZodDto } from 'nestjs-zod';
import { walletTargetSchema } from '@vaqt/shared';

export class WalletTargetDto extends createZodDto(walletTargetSchema) {}
