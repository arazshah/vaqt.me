// Pure profile-completeness rules — no I/O, so both the API and the web
// frontend can import this directly and agree on exactly what's missing.
export interface ProfileCompletenessInput {
  phoneVerified: boolean;
  displayName: string | null;
  bio: string | null;
  skillCount: number;
}

export type MissingField =
  'PHONE_VERIFIED' | 'DISPLAY_NAME' | 'BIO' | 'AT_LEAST_ONE_SKILL';

export interface ProfileCompleteness {
  canPublishRequest: boolean;
  canSubmitOffer: boolean;
  missingForPublishRequest: MissingField[];
  missingForSubmitOffer: MissingField[];
}

function hasText(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

export function computeProfileCompleteness(
  input: ProfileCompletenessInput,
): ProfileCompleteness {
  const missingForPublishRequest: MissingField[] = [];
  if (!input.phoneVerified) missingForPublishRequest.push('PHONE_VERIFIED');
  if (!hasText(input.displayName))
    missingForPublishRequest.push('DISPLAY_NAME');

  const missingForSubmitOffer: MissingField[] = [];
  if (!hasText(input.displayName)) missingForSubmitOffer.push('DISPLAY_NAME');
  if (!hasText(input.bio)) missingForSubmitOffer.push('BIO');
  if (input.skillCount < 1) missingForSubmitOffer.push('AT_LEAST_ONE_SKILL');

  return {
    canPublishRequest: missingForPublishRequest.length === 0,
    canSubmitOffer: missingForSubmitOffer.length === 0,
    missingForPublishRequest,
    missingForSubmitOffer,
  };
}
