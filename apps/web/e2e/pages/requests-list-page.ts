import { type Page, expect } from '@playwright/test';

export class RequestsListPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/requests');
  }

  async openRequestByTitle(title: string) {
    // Always (re)navigate first — the list has no polling/revalidation, so
    // a page already sitting on /requests (e.g. right after login, before
    // the request being searched for was published) would otherwise show
    // whatever it fetched on its *original* mount and never find a request
    // published afterward. This bit the golden-path test for real: the
    // provider's page landed on /requests via the post-login redirect
    // before the seeker had published anything, and reusing that stale
    // page state made the newly published request invisible.
    await this.goto();

    // .filter({hasText}) instead of getByRole(..., {name}) — the card's
    // accessible name is its full text content (title + category + mode +
    // owner + budget badge), and title can contain regex-special
    // characters (the random suffix uses "-"), so an exact/regex name
    // match is the wrong tool here.
    const link = this.page.getByRole('link').filter({ hasText: title });
    await expect(link).toBeVisible();
    await link.click();
  }
}
