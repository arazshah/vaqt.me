import { type Page, expect, test } from '@playwright/test';
import { setUpBookableCard } from './fixtures/api-helpers';
import {
  E2E_OTP_CODE,
  randomTestPhone,
  randomUsername,
} from './fixtures/test-data';

async function loginWithOtp(page: Page, phone: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('شماره موبایل').fill(phone);
  await page.getByRole('button', { name: 'دریافت کد' }).click();
  await page.getByLabel('کد تأیید').fill(E2E_OTP_CODE);
  await page.getByRole('button', { name: 'ورود' }).click();
}

// Golden path: a specialist publishes a bookable card, a visitor books a
// slot from the public page (SMS-code login, no separate account), the
// specialist confirms, and the visitor sees the confirmation.
test('card → booking → manual approval', async ({ browser }) => {
  const username = randomUsername();
  const serviceName = 'جلسه‌ی آزمایشی';

  // --- Specialist: sign in and set up the card (via API; UI-tested elsewhere)
  const specialistCtx = await browser.newContext();
  const specialist = await specialistCtx.newPage();
  await loginWithOtp(specialist, randomTestPhone());
  await expect(specialist).toHaveURL(/\/card\/edit$/);
  await setUpBookableCard(specialist, username, serviceName);

  // --- Visitor: the public card shows the booking button
  const visitorCtx = await browser.newContext();
  const visitor = await visitorCtx.newPage();
  await visitor.goto(`/${username}`);
  await visitor.getByRole('link', { name: 'رزرو وقت' }).first().click();
  await expect(visitor).toHaveURL(new RegExp(`/${username}/book$`));

  // day/slot → name → phone verification → submit
  // (a single service skips the service step and goes straight to the time)
  await expect(visitor.getByText(serviceName)).toBeVisible();
  // the first day with free slots is preselected; pick its first slot
  await visitor.locator('button[aria-pressed]').first().click();
  await visitor.getByRole('button', { name: 'ادامه' }).click();
  await visitor.getByLabel('نام شما').fill('بازدیدکننده‌ی آزمایشی');
  await visitor.getByRole('button', { name: 'ادامه' }).click();
  await visitor.getByLabel('شماره موبایل').fill(randomTestPhone());
  await visitor.getByRole('button', { name: 'دریافت کد' }).click();
  await visitor.getByLabel('کد تأیید').fill(E2E_OTP_CODE);
  await visitor.getByRole('button', { name: 'ورود' }).click();

  await expect(visitor.getByText('درخواست رزرو ثبت شد')).toBeVisible();
  await visitor.getByRole('link', { name: 'پیگیری یا لغو رزرو' }).click();
  await expect(
    visitor.getByText('در انتظار تأیید', { exact: true }),
  ).toBeVisible();

  // --- Specialist confirms from the bookings page
  await specialist.goto('/card/bookings');
  await specialist.getByRole('button', { name: 'تأیید', exact: true }).click();

  // --- Visitor sees the decision (no account needed — token page)
  await visitor.reload();
  await expect(visitor.getByText('تأیید شد', { exact: true })).toBeVisible();

  await specialistCtx.close();
  await visitorCtx.close();
});
