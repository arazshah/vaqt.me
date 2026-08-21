// Asserts packages/shared/src/constants/enums.ts (the source of truth) and
// prisma/schema.prisma (its mirror) never drift apart. If this test fails,
// either the shared enum or the Prisma enum was changed without updating
// the other.
import { describe, expect, it } from 'vitest';
import * as PrismaClient from '../../generated/prisma/index.js';
import * as Shared from '@vaqt/shared';

const ENUM_NAMES = [
  'RoleIntent',
  'UserStatus',
  'OtpPurpose',
  'RequestMode',
  'RequestStatus',
  'Currency',
  'OfferStatus',
  'ConversationStatus',
  'MessageType',
  'ProductCode',
  'OrderStatus',
  'PaymentProvider',
  'SubscriptionStatus',
  'NotificationChannel',
  'ReportStatus',
  'SystemRole',
] as const;

describe('enum parity between @vaqt/shared and Prisma schema', () => {
  it.each(ENUM_NAMES)('%s has identical values in both places', (name) => {
    const prismaEnum = (PrismaClient as unknown as Record<string, object>)[
      name
    ];
    const sharedEnum = (Shared as unknown as Record<string, object>)[name];

    expect(
      prismaEnum,
      `Prisma did not export an enum named ${name}`,
    ).toBeDefined();
    expect(
      sharedEnum,
      `@vaqt/shared did not export an enum named ${name}`,
    ).toBeDefined();

    const prismaValues = Object.values(prismaEnum).sort();
    const sharedValues = Object.values(sharedEnum).sort();

    expect(sharedValues).toEqual(prismaValues);
  });

  // Every one of these is a self-mapping object (key === value, just like a
  // schema-defined string enum) that Prisma's generator always emits at the
  // top level regardless of schema content — a *ScalarFieldEnum per model
  // (field names mapped to themselves), plus a small fixed set of
  // query-building enums. None of them are schema-defined domain enums, so
  // they must not trip the parity check below.
  const PRISMA_BUILTIN_NON_DOMAIN_ENUMS = new Set([
    'SortOrder',
    'QueryMode',
    'NullsOrder',
    'TransactionIsolationLevel',
    'ModelName',
  ]);

  it('does not cover an enum that exists in one place but not the other', () => {
    const prismaEnumNames = Object.keys(PrismaClient).filter((key) => {
      if (
        key.endsWith('ScalarFieldEnum') ||
        PRISMA_BUILTIN_NON_DOMAIN_ENUMS.has(key)
      ) {
        return false;
      }
      const value = (PrismaClient as unknown as Record<string, unknown>)[key];
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
      }
      const entries = Object.entries(value as Record<string, unknown>);
      // A Prisma/TS string enum maps each key to itself (SEEKER: "SEEKER").
      // This distinguishes real enums from other object exports that also
      // happen to hold only string values — e.g. `prismaVersion: { client:
      // "6.19.3", engine: "<hash>" }`, which the client always exports and
      // is not an enum.
      return (
        entries.length > 0 &&
        entries.every(([enumKey, enumValue]) => enumValue === enumKey)
      );
    });

    for (const name of prismaEnumNames) {
      expect(
        ENUM_NAMES as readonly string[],
        `Prisma enum "${name}" is not covered by the parity test — add it to ENUM_NAMES`,
      ).toContain(name);
    }
  });
});
