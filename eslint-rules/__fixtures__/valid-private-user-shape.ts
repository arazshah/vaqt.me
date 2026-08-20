// Mirrors the real PrivateUser shape (apps/api/src/auth/user-view.ts): has
// systemRole but neither raw phone nor phoneVerifiedAt, so only 1 of the 3
// RAW_USER_MARKERS is present — must NOT be flagged.
interface PrivateUser {
  id: string;
  systemRole: string;
  maskedPhone: string;
}

declare function toPrivateUser(): PrivateUser;

export function getMe(): PrivateUser {
  return toPrivateUser();
}
