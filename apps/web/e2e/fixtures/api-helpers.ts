import type { Page } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
const WEB_ORIGIN = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:3000';

// `page.request` shares the browser context's cookie jar, so this rides on
// the httpOnly session the UI login just established. `Origin` is set by
// hand: origin-check.middleware.ts rejects mutating requests without it, and
// page.request (a Node-side client) doesn't add one the way fetch() does.
async function post(page: Page, path: string, data: unknown): Promise<void> {
  const res = await page.request.post(`${API_URL}/api/v1${path}`, {
    headers: { Origin: WEB_ORIGIN },
    data,
  });
  if (!res.ok()) {
    throw new Error(`POST ${path} failed: ${String(res.status())}`);
  }
}

// Gives the logged-in specialist a card at vaqt.me/<username>, one service
// and every weekday open 09:00–17:00, so any day has bookable slots.
export async function setUpBookableCard(
  page: Page,
  username: string,
  serviceName: string,
): Promise<void> {
  await post(page, '/cards/me', {});
  await post(page, '/cards/me/username', { username });
  await post(page, '/booking/me/settings/update', {
    enabled: true,
    minNoticeHours: 0,
    maxDaysAhead: 14,
    services: [
      { name: serviceName, durationMinutes: 30, mode: 'online', note: null },
    ],
    rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
    })),
    exceptions: [],
  });
}
