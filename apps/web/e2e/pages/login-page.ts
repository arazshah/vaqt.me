import { type Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async requestCode(phone: string) {
    await this.page.getByLabel('شماره موبایل').fill(phone);
    await this.page.getByRole('button', { name: 'دریافت کد' }).click();
    await expect(this.page.getByLabel('کد تأیید')).toBeVisible();
  }

  async enterCode(code: string) {
    await this.page.getByLabel('کد تأیید').fill(code);
    await this.page.getByRole('button', { name: 'ورود' }).click();
  }

  async loginWithOtp(phone: string, code: string) {
    await this.goto();
    await this.requestCode(phone);
    await this.enterCode(code);
    await expect(this.page).toHaveURL(/\/requests$/);
  }
}
