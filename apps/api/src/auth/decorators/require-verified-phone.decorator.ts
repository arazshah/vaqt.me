import { applyDecorators, UseGuards } from '@nestjs/common';
import { RequireVerifiedPhoneGuard } from '../guards/require-verified-phone.guard';

export function RequireVerifiedPhone(): MethodDecorator & ClassDecorator {
  return applyDecorators(UseGuards(RequireVerifiedPhoneGuard));
}
