import { IsIn } from 'class-validator';
import { RoleIntent, type RoleIntent as RoleIntentType } from '@vaqt/shared';

export class UpdateRoleDto {
  @IsIn(Object.values(RoleIntent))
  roleIntent!: RoleIntentType;
}
