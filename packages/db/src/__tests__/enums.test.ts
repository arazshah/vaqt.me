// Asserts packages/shared/src/constants/enums.ts (the source of truth) and
// prisma/schema.prisma (its mirror) never drift apart. If this test fails,
// either the shared enum or the Prisma enum was changed without updating
// the other.
import { describe, expect, it } from 'vitest';
import * as PrismaClient from '@prisma/client';
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

  it('does not cover an enum that exists in one place but not the other', () => {
    const prismaEnumNames = Object.keys(PrismaClient).filter((key) => {
      const value = (PrismaClient as unknown as Record<string, unknown>)[key];
      return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every((v) => typeof v === 'string')
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
