import { type Page, expect } from '@playwright/test';

export class RequestDetailPage {
  constructor(private readonly page: Page) {}

  async submitOffer(input: {
    proposedStartAt: string; // yyyy-mm-ddThh:mm, matches datetime-local
    proposedDurationMinutes: string;
    amountToman: string;
  }) {
    await this.page
      .getByLabel('زمان پیشنهادی شروع')
      .fill(input.proposedStartAt);
    await this.page
      .getByLabel('مدت زمان پیشنهادی (دقیقه)')
      .fill(input.proposedDurationMinutes);
    await this.page.getByLabel('مبلغ پیشنهادی (تومان)').fill(input.amountToman);
    await this.page.getByRole('button', { name: 'ارسال پیشنهاد' }).click();
    await expect(
      this.page.getByRole('button', { name: 'پس‌گرفتن پیشنهاد' }),
    ).toBeVisible();
  }

  async selectOnlyOffer() {
    await this.page.getByRole('button', { name: 'انتخاب این پیشنهاد' }).click();
    await expect(this.page.getByText('انتخاب‌شده').first()).toBeVisible();
  }
}
