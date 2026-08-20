import type { User } from '@vaqt/db';
import type { ProfileCompleteness } from '@vaqt/shared';
import { maskPhone } from '../common/utils/mask-phone';

export interface PublicUserSkill {
  id: string;
  slug: string;
  name: string;
}

// The shape a User is allowed to exit the API in when viewed by anyone
// OTHER than the account owner (GET /users/:id). Phone number, raw
// phoneVerifiedAt, block status, systemRole, and internal storage keys
// never appear here.
export interface PublicUser {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarThumbnailUrl: string | null;
  city: string | null;
  modePreference: User['modePreference'];
  linkedinUrl: string | null;
  timezone: string;
  roleIntent: User['roleIntent'];
  phoneVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  skills: PublicUserSkill[];
}

// The shape returned ONLY for the account owner's own self-view (GET
// /users/me, GET /auth/me) — never for viewing another user. Adds masked
// (never raw) phone, block status, and the caller's own permission level
// and profile-completeness. The raw phone string still never appears here
// — `maskedPhone` goes through the same maskPhone() used in logs/audit.
export interface PrivateUser extends PublicUser {
  maskedPhone: string;
  status: User['status'];
  systemRole: User['systemRole'];
  completeness: ProfileCompleteness;
}

type UserWithOptionalSkills = User & {
  skills?: { skill: PublicUserSkill }[];
};

export function toPublicUser(user: UserWithOptionalSkills): PublicUser {
  return {
    id: user.id,
    displayName: user.displayName,
    headline: user.headline,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    avatarThumbnailUrl: user.avatarThumbnailUrl,
    city: user.city,
    modePreference: user.modePreference,
    linkedinUrl: user.linkedinUrl,
    timezone: user.timezone,
    roleIntent: user.roleIntent,
    phoneVerified: user.phoneVerifiedAt !== null,
    ratingAvg: user.ratingAvg,
    ratingCount: user.ratingCount,
    createdAt: user.createdAt,
    skills: (user.skills ?? []).map((s) => s.skill),
  };
}

export function toPrivateUser(
  user: UserWithOptionalSkills,
  completeness: ProfileCompleteness,
): PrivateUser {
  return {
    ...toPublicUser(user),
    maskedPhone: maskPhone(user.phone),
    status: user.status,
    systemRole: user.systemRole,
    completeness,
  };
}
