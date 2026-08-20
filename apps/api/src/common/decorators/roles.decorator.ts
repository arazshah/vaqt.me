import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import type { SystemRole } from '@vaqt/shared';
import { RolesGuard } from '../guards/roles.guard';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

export function Roles(
  ...roles: SystemRole[]
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(REQUIRED_ROLES_KEY, roles),
    UseGuards(RolesGuard),
  );
}
