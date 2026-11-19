// Single source of truth for every enum in the system.
// prisma/schema.prisma mirrors these value-for-value; packages/db has a unit
// test asserting the two never drift apart. This package must never depend
// on @prisma/client — enums flow shared -> prisma schema, not the other way.
import { z } from 'zod';

function createEnum<const T extends readonly [string, ...string[]]>(values: T) {
  const obj = Object.fromEntries(values.map((v) => [v, v])) as {
    [K in T[number]]: K;
  };
  const schema = z.enum(values);
  return [obj, schema] as const;
}

export const [UserStatus, UserStatusSchema] = createEnum([
  'ACTIVE',
  'SUSPENDED',
] as const);
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const [OtpPurpose, OtpPurposeSchema] = createEnum(['AUTH'] as const);
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

// System-level permission: the only source of authorization.
export const [SystemRole, SystemRoleSchema] = createEnum([
  'USER',
  'ADMIN',
] as const);
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];
