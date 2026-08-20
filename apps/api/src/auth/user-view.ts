import type { User } from '@vaqt/db';

export interface PublicUserSkill {
  id: string;
  slug: string;
  name: string;
}

// The only shape a User is ever allowed to exit the API in. Phone number,
// raw phoneVerifiedAt, block status, systemRole, and internal storage keys
// never appear here — not even for the user's own profile, since there's
// no UX need to echo back a phone number the user already knows.
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
