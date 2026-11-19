import { expect, test } from '@playwright/test';

// The built-in "admin" account: playwright.config.ts boots the API with
// ADMIN_INITIAL_PASSWORD, so the temporary password is known here. The
// account is single and global, so the test skips (rather than fails) on a
// re-run against a DB where the password was already changed.
const TEMP = 'E2eTemp12345';

test('admin signs in with the temporary password and must replace it', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('ایمیل').fill('admin');
  await page.getByLabel('رمز عبور', { exact: true }).fill(TEMP);
  await page.getByRole('button', { name: 'ورود', exact: true }).click();

  const landed = await Promise.race([
    page.waitForURL(/\/admin\/password$/).then(() => 'change'),
    // Scoped to the form: Next's route announcer is also role="alert".
    page
      .locator('form [role="alert"]')
      .waitFor()
      .then(() => 'refused'),
  ]);
  test.skip(landed === 'refused', 'admin password already changed in this DB');

  // Nothing else opens until the password is replaced.
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/admin\/password$/);

  await page.getByLabel('رمز فعلی (یا رمز موقت)').fill(TEMP);
  await page.getByLabel('رمز تازه', { exact: true }).fill('E2eChosen9876');
  await page.getByLabel('تکرار رمز تازه').fill('E2eChosen9876');
  await page.getByRole('button', { name: 'ذخیره‌ی رمز تازه' }).click();

  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(
    page.getByRole('heading', { name: 'تنظیمات سامانه' }),
  ).toBeVisible();
});
