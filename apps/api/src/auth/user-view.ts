import type { User } from '@vaqt/db';
import { maskPhone } from '../common/utils/mask-phone';

// The shape a User is allowed to exit the API in when viewed by anyone
// OTHER than the account owner. Phone number, raw phoneVerifiedAt, block
// status, systemRole, and internal storage keys never appear here.
export interface PublicUser {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarThumbnailUrl: string | null;
  city: string | null;
  username: string | null;
  phoneVerified: boolean;
  createdAt: Date;
}

// The shape returned ONLY for the account owner's own self-view (GET
// /users/me, GET /auth/me). Adds masked (never raw) phone, block status and
// the caller's own permission level.
export interface PrivateUser extends PublicUser {
  maskedPhone: string;
  email: string | null;
  status: User['status'];
  systemRole: User['systemRole'];
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    displayName: user.displayName,
    headline: user.headline,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    avatarThumbnailUrl: user.avatarThumbnailUrl,
    city: user.city,
    username: user.username,
    phoneVerified: user.phoneVerifiedAt !== null,
    createdAt: user.createdAt,
  };
}

export function toPrivateUser(user: User): PrivateUser {
  return {
    ...toPublicUser(user),
    maskedPhone: user.phone ? maskPhone(user.phone) : '',
    email: user.email,
    status: user.status,
    systemRole: user.systemRole,
  };
}
