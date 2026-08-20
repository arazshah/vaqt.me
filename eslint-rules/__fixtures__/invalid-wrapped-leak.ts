interface RawUser {
  id: string;
  phone: string;
  phoneVerifiedAt: Date | null;
  systemRole: string;
}

declare function findUser(): RawUser;

export function getResult(): { user: RawUser; token: string } {
  return { user: findUser(), token: 'x' };
}
