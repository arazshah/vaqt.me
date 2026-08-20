import type { User } from '@vaqt/db';

export interface PublicUser {
  id: string;
  phone: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  roleIntent: User['roleIntent'];
  status: User['status'];
  phoneVerifiedAt: Date | null;
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    roleIntent: user.roleIntent,
    status: user.status,
    phoneVerifiedAt: user.phoneVerifiedAt,
    createdAt: user.createdAt,
  };
}
