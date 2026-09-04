import { type Page, expect } from '@playwright/test';

export class ConversationsPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/conversations');
  }

  async openOnlyConversation() {
    // Scoped to href="/conversations/{id}" specifically — getByRole('link')
    // with no scoping also matches AppShell's nav links (the "وقت‌می" logo
    // link to "/" comes first in DOM order), so .first() would click that
    // instead of a conversation card. The nav's own "گفتگوها" link points
    // at "/conversations" (no trailing segment), so the "/conversations/"
    // prefix excludes it too.
    //
    // The smoke test only ever has exactly one conversation in flight (one
    // seeker + one provider, one selected offer), so the first match here
    // is unambiguous.
    const link = this.page.locator('a[href^="/conversations/"]').first();
    await expect(link).toBeVisible();
    await link.click();
  }
}

export class ConversationDetailPage {
  constructor(private readonly page: Page) {}

  async sendMessage(text: string) {
    await this.page.getByPlaceholder('پیام خود را بنویسید…').fill(text);
    await this.page.getByRole('button', { name: 'ارسال' }).click();
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
