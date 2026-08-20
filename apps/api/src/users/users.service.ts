import { HttpStatus, Injectable } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import {
  computeProfileCompleteness,
  normalizeFa,
  type UpdateUserProfileInput,
} from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import {
  toPrivateUser,
  toPublicUser,
  type PrivateUser,
  type PublicUser,
} from '../auth/user-view';

const userWithSkills = {
  include: { skills: { include: { skill: true } } },
} as const;

@Injectable()
export class UsersService {
  async getMe(userId: string): Promise<PrivateUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      ...userWithSkills,
    });
    if (!user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    }

    const completeness = computeProfileCompleteness({
      phoneVerified: user.phoneVerifiedAt !== null,
      displayName: user.displayName,
      bio: user.bio,
      skillCount: user.skills.length,
    });

    return toPrivateUser(user, completeness);
  }

  async updateMe(
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<PublicUser> {
    const data: Record<string, unknown> = {};
    if (input.displayName !== undefined) {
      data.displayName = normalizeFa(input.displayName);
    }
    if (input.headline !== undefined) data.headline = input.headline;
    if (input.bio !== undefined) data.bio = input.bio;
    if (input.city !== undefined) data.city = input.city;
    if (input.modePreference !== undefined)
      data.modePreference = input.modePreference;
    if (input.linkedinUrl !== undefined) {
      data.linkedinUrl = input.linkedinUrl === '' ? null : input.linkedinUrl;
    }
    if (input.timezone !== undefined) data.timezone = input.timezone;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      ...userWithSkills,
    });

    return toPublicUser(user);
  }

  async putSkills(userId: string, skillIds: string[]): Promise<PublicUser> {
    const uniqueIds = Array.from(new Set(skillIds));
    const validSkills = await prisma.skill.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true },
    });
    if (validSkills.length !== uniqueIds.length) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, {
        details: { reason: 'UNKNOWN_OR_INACTIVE_SKILL' },
      });
    }

    await prisma.$transaction([
      prisma.userSkill.deleteMany({ where: { userId } }),
      prisma.userSkill.createMany({
        data: uniqueIds.map((skillId) => ({ userId, skillId })),
      }),
    ]);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      ...userWithSkills,
    });
    return toPublicUser(user);
  }

  async getPublicProfile(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      ...userWithSkills,
    });
    if (!user) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return toPublicUser(user);
  }
}
