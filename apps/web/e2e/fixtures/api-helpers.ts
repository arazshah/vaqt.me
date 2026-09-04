import type { Page } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
const WEB_ORIGIN = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:3000';

// There is no in-browser profile-editing UI yet for bio/skills (see
// CLAUDE.md's Phase 6/8 QA notes — every prior manual verification of the
// offer flow completed the provider's profile via direct API calls too,
// never through a page). `page.request` shares the browser context's
// cookie jar, so this rides on the same httpOnly session the UI login just
// established — no separate auth needed here.
//
// `Origin` is required by hand: `origin-check.middleware.ts` treats every
// PATCH/PUT/POST as mutating and rejects it without a matching Origin
// header, and `page.request` (a Node-side HTTP client, not the browser's
// own fetch) never sets one automatically the way `fetch()` from page JS
// does.
export async function completeProviderProfile(page: Page): Promise<void> {
  await page.request.patch(`${API_URL}/api/v1/users/me`, {
    headers: { Origin: WEB_ORIGIN },
    data: { bio: 'ارائه‌دهنده‌ی تستی برای مسیر E2E — بدون داده‌ی واقعی.' },
  });

  const skillsRes = await page.request.get(`${API_URL}/api/v1/skills`);
  const skills = (await skillsRes.json()) as { items: { id: string }[] };
  const skillId = skills.items[0]?.id;
  if (!skillId) {
    throw new Error(
      'No skills available from the API to complete the profile with.',
    );
  }

  await page.request.put(`${API_URL}/api/v1/users/me/skills`, {
    headers: { Origin: WEB_ORIGIN },
    data: { skillIds: [skillId] },
  });
}
