interface PublicUser {
  id: string;
  displayName: string;
}

declare function toPublicUser(raw: unknown): PublicUser;

export function getUser(): PublicUser {
  return toPublicUser({});
}
