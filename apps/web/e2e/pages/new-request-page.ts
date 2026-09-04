import { type Page, expect } from '@playwright/test';

export interface NewRequestInput {
  title: string;
  description: string;
  durationMinutes: string;
  budgetMinToman: string;
  budgetMaxToman: string;
  deadlineAt: string; // yyyy-mm-dd, matches <input type="date">
}

export class NewRequestPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/requests/new');
  }

  async fillAndCreateDraft(input: NewRequestInput) {
    await this.page.getByLabel('عنوان').fill(input.title);
    await this.page.getByLabel('توضیحات').fill(input.description);

    // Radix Select — click the combobox trigger (labeled "دسته"), then pick
    // whichever category comes first. Not coupled to a specific seed
    // category name on purpose: this suite only cares that some category
    // was chosen, not which one.
    await this.page.getByLabel('دسته').click();
    await this.page.getByRole('option').first().click();

    await this.page.getByLabel('آنلاین').check();
    await this.page.getByLabel('مدت زمان (دقیقه)').fill(input.durationMinutes);
    await this.page
      .getByLabel('حداقل بودجه (تومان)')
      .fill(input.budgetMinToman);
    await this.page
      .getByLabel('حداکثر بودجه (تومان)')
      .fill(input.budgetMaxToman);
    await this.page.getByLabel('مهلت').fill(input.deadlineAt);

    await this.page.getByRole('button', { name: 'ثبت پیش‌نویس' }).click();
    // shadcn's CardTitle renders a <div>, not an <h*> — no accessible
    // heading role, so this can't use getByRole('heading').
    await expect(this.page.getByText('پیش‌نمایش پیش‌نویس')).toBeVisible();
  }

  async publish() {
    await this.page.getByRole('button', { name: 'انتشار' }).click();
    await expect(this.page).toHaveURL(/\/requests$/);
  }
}
