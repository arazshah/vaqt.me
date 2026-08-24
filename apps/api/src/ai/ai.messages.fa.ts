// Not an HttpException message (see common/messages/fa.ts for those) —
// this is a 200-response payload field shown when AI extraction fails
// twice in a row and the wizard falls back to the manual form. Exact
// wording from PROJECT_SPEC.md's AI provider decision.
export const AI_FALLBACK_MESSAGE_FA =
  'فعلاً نتوانستم درخواست را تحلیل کنم، می‌توانید جزئیات را دستی وارد کنید.';

// Shown (and stored as the assistant's turn) once the draft has every
// required field and there is nothing left to ask.
export const AI_DRAFT_READY_MESSAGE_FA =
  'همه‌چیز آماده است — می‌توانید پیش‌نمایش را بررسی و منتشر کنید.';
