interface RawUser {
  id: string;
  phone: string;
  phoneVerifiedAt: Date | null;
  systemRole: string;
}

declare function findUser(): RawUser;

export function getUser(): RawUser {
  return findUser();
}
