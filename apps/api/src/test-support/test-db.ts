import { randomInt, randomUUID } from 'node:crypto';
import { prisma } from '@vaqt/db';

// Test users always live in the +9899xxxxxxxx sub-range so they're easy to
// tell apart from seed data (+98912xxxxxxx..+98912xxxxxxx8) and to sweep up
// in bulk without touching real rows.
export function randomTestPhone(): string {
  const suffix = String(randomInt(0, 1e8)).padStart(8, '0');
  return `+9899${suffix}`;
}

export function randomTestRedisPrefix(): string {
  return `vaqt:test:${randomUUID()}:`;
}

export async function createTestUser(overrides: {
  phone?: string;
  phoneVerifiedAt?: Date | null;
}): Promise<{ id: string; phone: string }> {
  const phone = overrides.phone ?? randomTestPhone();
  const user = await prisma.user.create({
    data: {
      phone,
      displayName: 'کاربر تست',
      phoneVerifiedAt:
        overrides.phoneVerifiedAt === undefined
          ? new Date()
          : overrides.phoneVerifiedAt,
    },
  });
  return { id: user.id, phone: user.phone };
}

export async function cleanupTestUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  await prisma.auditLog.deleteMany({ where: { actorId: userId } });
  await prisma.session.deleteMany({ where: { userId } });
  if (user) {
    await prisma.verificationCode.deleteMany({ where: { phone: user.phone } });
  }
  await prisma.user.deleteMany({ where: { id: userId } });
}

// Replaces `value!` in tests: fails loudly with context instead of silently
// asserting away a null/undefined that would otherwise just surface as a
// confusing downstream type error or runtime crash.
export function requireNonNull<T>(
  value: T | null | undefined,
  message: string,
): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

export async function cleanupTestPhone(phone: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (user) {
    await cleanupTestUser(user.id);
  } else {
    await prisma.verificationCode.deleteMany({ where: { phone } });
  }
}
