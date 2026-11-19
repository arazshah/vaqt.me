import { USERNAME_REGEX, type PublicCard } from '@vaqt/shared';
import { BASE_URL } from '@/lib/api-client';

// GET /cards/:username is @Public() and read-only, so unlike the POST calls
// elsewhere on the server side it needs no Origin header (origin-check only
// guards mutating methods). Returns null for anything that is not a card —
// including usernames that can't exist, so random crawler paths such as
// /apple-touch-icon.png never reach the API.
export async function fetchPublicCard(
  username: string,
): Promise<PublicCard | null> {
  const name = username.toLowerCase();
  if (!USERNAME_REGEX.test(name)) return null;
  try {
    const res = await fetch(
      `${BASE_URL}/api/v1/cards/${encodeURIComponent(name)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as PublicCard;
  } catch {
    return null;
  }
}

export function vcardUrl(username: string): string {
  return `${BASE_URL}/api/v1/cards/${encodeURIComponent(username)}/vcard`;
}
