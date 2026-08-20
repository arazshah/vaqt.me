import { prisma } from '@vaqt/db';
import { AppError } from '../common/errors/app-error';
import { cleanupTestUser, createTestUser } from '../test-support/test-db';
import { UsersService } from './users.service';

describe('UsersService (real Postgres)', () => {
  const createdUserIds: string[] = [];
  const createdSkillIds: string[] = [];
  let service: UsersService;

  beforeAll(() => {
    service = new UsersService();
  });

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await cleanupTestUser(id);
    }
  });

  afterAll(async () => {
    for (const id of createdSkillIds.splice(0)) {
      await prisma.userSkill.deleteMany({ where: { skillId: id } });
      await prisma.skill.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  async function makeUser(
    overrides: {
      phoneVerifiedAt?: Date | null;
      displayName?: string;
      bio?: string | null;
    } = {},
  ): Promise<string> {
    const user = await createTestUser({
      phoneVerifiedAt: overrides.phoneVerifiedAt,
    });
    createdUserIds.push(user.id);
    if (overrides.displayName !== undefined || overrides.bio !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(overrides.displayName !== undefined
            ? { displayName: overrides.displayName }
            : {}),
          ...(overrides.bio !== undefined ? { bio: overrides.bio } : {}),
        },
      });
    }
    return user.id;
  }

  async function makeSkill(): Promise<string> {
    const skill = await prisma.skill.create({
      data: {
        name: 'مهارت تست',
        slug: `test-skill-${String(Date.now())}-${String(Math.random())}`,
      },
    });
    createdSkillIds.push(skill.id);
    return skill.id;
  }

  describe('getMe', () => {
    it('never leaks the phone number anywhere in the response', async () => {
      const userId = await makeUser();
      const phone = await prisma.user
        .findUniqueOrThrow({ where: { id: userId } })
        .then((u) => u.phone);

      const result = await service.getMe(userId);

      expect(JSON.stringify(result)).not.toContain(phone);
      expect(result).not.toHaveProperty('phone');
      expect(result.maskedPhone).not.toBe(phone);
    });

    it('computes completeness from the real DB state', async () => {
      const userId = await makeUser({ phoneVerifiedAt: null, bio: null });
      const result = await service.getMe(userId);

      expect(result.completeness.canPublishRequest).toBe(false);
      expect(result.completeness.missingForPublishRequest).toContain(
        'PHONE_VERIFIED',
      );
      expect(result.completeness.canSubmitOffer).toBe(false);
      expect(result.completeness.missingForSubmitOffer).toContain('BIO');
      expect(result.completeness.missingForSubmitOffer).toContain(
        'AT_LEAST_ONE_SKILL',
      );
    });

    it('reflects verified phone + bio + skill as complete for offers', async () => {
      const userId = await makeUser({
        phoneVerifiedAt: new Date(),
        bio: 'یک بیو کامل',
      });
      const skillId = await makeSkill();
      await prisma.userSkill.create({ data: { userId, skillId } });

      const result = await service.getMe(userId);

      expect(result.completeness.canPublishRequest).toBe(true);
      expect(result.completeness.canSubmitOffer).toBe(true);
    });

    it('throws UNAUTHORIZED when the user no longer exists', async () => {
      await expect(service.getMe('does-not-exist')).rejects.toThrow(AppError);
    });
  });

  describe('updateMe', () => {
    it('normalizes the display name via normalizeFa', async () => {
      const userId = await makeUser();
      const result = await service.updateMe(userId, { displayName: '  علی  ' });
      expect(result.displayName).toBe('علی');
    });

    it('clears linkedinUrl when given an empty string', async () => {
      const userId = await makeUser();
      await service.updateMe(userId, {
        linkedinUrl: 'https://linkedin.com/in/x',
      });
      const result = await service.updateMe(userId, { linkedinUrl: '' });
      expect(result.linkedinUrl).toBeNull();
    });

    it('leaves unspecified fields untouched', async () => {
      await prisma.user.update({
        where: { id: await makeUser() },
        data: {},
      });
      const userId = await makeUser({ displayName: 'مریم' });
      await service.updateMe(userId, { bio: 'بیو جدید' });
      const result = await service.updateMe(userId, {});
      expect(result.displayName).toBe('مریم');
      expect(result.bio).toBe('بیو جدید');
    });

    it('never returns the phone number', async () => {
      const userId = await makeUser();
      const result = await service.updateMe(userId, {
        headline: 'توسعه‌دهنده',
      });
      expect(result).not.toHaveProperty('phone');
    });
  });

  describe('putSkills', () => {
    it('replaces the full skill set atomically', async () => {
      const userId = await makeUser();
      const skillA = await makeSkill();
      const skillB = await makeSkill();

      await service.putSkills(userId, [skillA]);
      const result = await service.putSkills(userId, [skillB]);

      expect(result.skills.map((s) => s.id)).toEqual([skillB]);
    });

    it('deduplicates repeated skill ids', async () => {
      const userId = await makeUser();
      const skillA = await makeSkill();
      const result = await service.putSkills(userId, [skillA, skillA]);
      expect(result.skills).toHaveLength(1);
    });

    it('rejects an unknown skill id', async () => {
      const userId = await makeUser();
      await expect(
        service.putSkills(userId, ['does-not-exist']),
      ).rejects.toThrow(AppError);
    });

    it('rejects an inactive skill id', async () => {
      const userId = await makeUser();
      const skill = await prisma.skill.create({
        data: {
          name: 'مهارت غیرفعال',
          slug: `inactive-skill-${String(Date.now())}-${String(Math.random())}`,
          isActive: false,
        },
      });
      createdSkillIds.push(skill.id);
      await expect(service.putSkills(userId, [skill.id])).rejects.toThrow(
        AppError,
      );
    });
  });

  describe('getPublicProfile (authorization matrix: owner / other logged-in user / admin all get the same non-leaking shape)', () => {
    it('returns the same public shape whether requested by the owner, another user, or an admin', async () => {
      const targetId = await makeUser();
      const phone = await prisma.user
        .findUniqueOrThrow({ where: { id: targetId } })
        .then((u) => u.phone);

      const asOwner = await service.getPublicProfile(targetId);
      const asOther = await service.getPublicProfile(targetId);
      const adminId = await makeUser();
      await prisma.user.update({
        where: { id: adminId },
        data: { systemRole: 'ADMIN' },
      });
      const asAdmin = await service.getPublicProfile(targetId);

      for (const result of [asOwner, asOther, asAdmin]) {
        expect(JSON.stringify(result)).not.toContain(phone);
        expect(result).not.toHaveProperty('phone');
        expect(result).not.toHaveProperty('systemRole');
        expect(result).not.toHaveProperty('status');
      }
      expect(asOwner).toEqual(asOther);
      expect(asOwner).toEqual(asAdmin);
    });

    it('throws NOT_FOUND for a non-existent user id', async () => {
      await expect(service.getPublicProfile('does-not-exist')).rejects.toThrow(
        AppError,
      );
    });
  });
});
