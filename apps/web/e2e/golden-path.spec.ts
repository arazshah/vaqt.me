import { test, expect } from '@playwright/test';
import { completeProviderProfile } from './fixtures/api-helpers';
import {
  E2E_OTP_CODE,
  randomTestPhone,
  randomTitle,
} from './fixtures/test-data';
import { LoginPage } from './pages/login-page';
import { NewRequestPage } from './pages/new-request-page';
import { RequestsListPage } from './pages/requests-list-page';
import { RequestDetailPage } from './pages/request-detail-page';
import {
  ConversationsPage,
  ConversationDetailPage,
} from './pages/conversations-page';

// The one golden path CLAUDE.md's testing strategy names explicitly:
// login → create request → view in list → submit offer → select →
// chat. Two real browser contexts (seeker, provider) against the real
// API + Postgres + Redis — no mocking, matching this project's whole
// testing culture. Written as one continuous journey (not one assertion
// per test) because that's what the golden path actually is: a single
// user story spanning two accounts, not independent behaviors.
test('seeker publishes a request, provider offers, seeker selects, both chat', async ({
  browser,
}) => {
  const seekerContext = await browser.newContext();
  const providerContext = await browser.newContext();
  const seekerPage = await seekerContext.newPage();
  const providerPage = await providerContext.newPage();

  const seekerPhone = randomTestPhone();
  const providerPhone = randomTestPhone();
  const requestTitle = randomTitle('کمک برای رفع باگ فرانت‌اند');

  await test.step('seeker logs in', async () => {
    await new LoginPage(seekerPage).loginWithOtp(seekerPhone, E2E_OTP_CODE);
  });

  await test.step('provider logs in and completes their profile', async () => {
    await new LoginPage(providerPage).loginWithOtp(providerPhone, E2E_OTP_CODE);
    await completeProviderProfile(providerPage);
  });

  await test.step('seeker creates and publishes a request', async () => {
    const newRequestPage = new NewRequestPage(seekerPage);
    await newRequestPage.goto();
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    await newRequestPage.fillAndCreateDraft({
      title: requestTitle,
      description: 'یک صفحه‌ی React دارم که در موبایل درست نمایش داده نمی‌شود.',
      durationMinutes: '60',
      budgetMinToman: '500000',
      budgetMaxToman: '1000000',
      deadlineAt: deadline.toISOString().slice(0, 10),
    });
    await newRequestPage.publish();
  });

  await test.step('provider finds the request in the public list and submits an offer', async () => {
    await new RequestsListPage(providerPage).openRequestByTitle(requestTitle);
    await expect(providerPage.getByText(requestTitle)).toBeVisible();

    const proposedStartAt = new Date();
    proposedStartAt.setDate(proposedStartAt.getDate() + 1);
    await new RequestDetailPage(providerPage).submitOffer({
      proposedStartAt: proposedStartAt.toISOString().slice(0, 16),
      proposedDurationMinutes: '45',
      amountToman: '700000',
    });
  });

  await test.step('seeker sees the offer and selects it', async () => {
    await new RequestsListPage(seekerPage).openRequestByTitle(requestTitle);
    await new RequestDetailPage(seekerPage).selectOnlyOffer();
  });

  await test.step('seeker opens the conversation and sends a message', async () => {
    await new ConversationsPage(seekerPage).goto();
    await new ConversationsPage(seekerPage).openOnlyConversation();
    await new ConversationDetailPage(seekerPage).sendMessage(
      'سلام، وقتتون آزاده که شروع کنیم؟',
    );
  });

  await test.step('provider sees the message and replies', async () => {
    await new ConversationsPage(providerPage).goto();
    await new ConversationsPage(providerPage).openOnlyConversation();
    await expect(
      providerPage.getByText('سلام، وقتتون آزاده که شروع کنیم؟'),
    ).toBeVisible();
    await new ConversationDetailPage(providerPage).sendMessage(
      'سلام، بله می‌توانیم امروز شروع کنیم.',
    );
  });

  await seekerContext.close();
  await providerContext.close();
});
