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
  await expect(specialist).toHaveURL(/\/card$/);
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

// First run: a brand-new user is guided step by step (address → about →
// photo/category → links → look) and ends with a shareable public card whose
// link uses the fixed linkedin.com/in/ prefix.
test('new user: guided card setup → public card', async ({ browser }) => {
  const username = randomUsername();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginWithOtp(page, randomTestPhone());
  await expect(page).toHaveURL(/\/card$/);

  await page.getByRole('link', { name: 'شروع ساخت کارت' }).click();
  await page.getByPlaceholder('your-name').fill(username);
  await page.getByRole('button', { name: 'ادامه' }).click();

  await page.getByLabel('نام و نام خانوادگی').fill('دکتر آزمایشی');
  await page.getByLabel('عنوان شغلی').fill('متخصص پوست');
  await page.getByRole('button', { name: 'ادامه' }).click();

  await page.getByRole('radio', { name: 'سلامت و پزشکی' }).click();
  await page.getByRole('button', { name: 'ادامه' }).click();

  await page.getByRole('button', { name: 'افزودن راه ارتباطی' }).click();
  await page.getByRole('button', { name: 'لینکدین' }).click();
  await page.getByRole('textbox', { name: 'لینکدین' }).fill('e2e-user');
  await page.getByRole('button', { name: 'ادامه' }).click();

  await page.getByRole('button', { name: 'ساخت کارت' }).click();
  await expect(page.getByText('کارتتان آماده است')).toBeVisible();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/${username}`);
  await expect(
    visitor.getByRole('heading', { name: 'دکتر آزمایشی' }),
  ).toBeVisible();
  await expect(visitor.getByRole('link', { name: /لینکدین/ })).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/e2e-user',
  );
  // QR/URL on the page must be the real origin, never a localhost default
  // baked in for the browser bundle.
  await expect(visitor.getByText(`/${username}`).first()).toBeVisible();
});
