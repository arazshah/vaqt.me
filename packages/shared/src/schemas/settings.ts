import { z } from 'zod';

// Everything an admin can change at runtime. Labels and help texts are in
// apps/web/messages/fa.ts (keyed by `key`); this file only holds structure so
// the API can validate and the web can render the right control.

export type SettingKind = 'text' | 'secret' | 'select';
export type SettingGroup = 'sms' | 'sms_templates' | 'bale';

export interface SettingDefinition {
  key: string;
  group: SettingGroup;
  kind: SettingKind;
  options?: readonly string[];
  /** Env var this setting falls back to (kept so existing deployments work). */
  env?: string;
  /** Used when neither the panel nor the env has a value. */
  defaultValue?: string;
  /** Production default when it differs (e.g. providers start "disabled"). */
  productionDefault?: string;
  pattern?: RegExp;
  maxLength: number;
}

const providerSelect = (env: string): Partial<SettingDefinition> => ({
  kind: 'select',
  env,
  defaultValue: 'mock',
  productionDefault: 'disabled',
});

const templateId = (key: string, env: string): SettingDefinition => ({
  key,
  group: 'sms_templates',
  kind: 'text',
  env,
  pattern: /^\d{1,12}$/,
  maxLength: 12,
});

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: 'sms.provider',
    group: 'sms',
    options: ['mock', 'smsir', 'disabled'],
    maxLength: 10,
    ...providerSelect('SMS_PROVIDER'),
  } as SettingDefinition,
  {
    key: 'sms.smsir.apiKey',
    group: 'sms',
    kind: 'secret',
    env: 'SMSIR_API_KEY',
    maxLength: 200,
    pattern: /^\S+$/,
  },
  {
    key: 'sms.smsir.otpTemplateId',
    group: 'sms',
    kind: 'text',
    env: 'SMSIR_VERIFY_TEMPLATE_ID',
    pattern: /^\d{1,12}$/,
    maxLength: 12,
  },
  templateId(
    'sms.template.bookingNewForProvider',
    'SMS_TEMPLATE_BOOKING_NEW_FOR_PROVIDER',
  ),
  templateId('sms.template.bookingConfirmed', 'SMS_TEMPLATE_BOOKING_CONFIRMED'),
  templateId('sms.template.bookingRejected', 'SMS_TEMPLATE_BOOKING_REJECTED'),
  templateId(
    'sms.template.bookingCanceledByProvider',
    'SMS_TEMPLATE_BOOKING_CANCELED_BY_PROVIDER',
  ),
  templateId('sms.template.bookingReminder', 'SMS_TEMPLATE_BOOKING_REMINDER'),
  {
    key: 'bale.provider',
    group: 'bale',
    options: ['mock', 'bale', 'disabled'],
    maxLength: 10,
    ...providerSelect('BALE_PROVIDER'),
  } as SettingDefinition,
  {
    key: 'bale.botToken',
    group: 'bale',
    kind: 'secret',
    env: 'BALE_BOT_TOKEN',
    maxLength: 200,
    pattern: /^\S+$/,
  },
  {
    key: 'bale.botUsername',
    group: 'bale',
    kind: 'text',
    env: 'BALE_BOT_USERNAME',
    pattern: /^@?[A-Za-z0-9_]{3,64}$/,
    maxLength: 65,
  },
  {
    key: 'bale.webhookSecret',
    group: 'bale',
    kind: 'secret',
    env: 'BALE_WEBHOOK_SECRET',
    pattern: /^[A-Za-z0-9_-]{16,128}$/,
    maxLength: 128,
  },
];

export const SETTING_KEYS = SETTING_DEFINITIONS.map((d) => d.key);

export function findSettingDefinition(
  key: string,
): SettingDefinition | undefined {
  return SETTING_DEFINITIONS.find((d) => d.key === key);
}

/** null when valid, otherwise a short reason code the UI can translate. */
export function validateSettingValue(
  def: SettingDefinition,
  value: string,
): 'too_long' | 'invalid' | 'not_an_option' | null {
  if (def.options && !def.options.includes(value)) return 'not_an_option';
  if (value.length > def.maxLength) return 'too_long';
  if (def.pattern && !def.pattern.test(value)) return 'invalid';
  return null;
}

export const updateSettingsSchema = z.object({
  // key -> new value. An empty string for a secret is ignored (keeps the
  // stored value); use `clear` to remove a value.
  set: z.record(z.string(), z.string().max(300)).default({}),
  clear: z.array(z.string()).default([]),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export interface SettingView {
  key: string;
  group: SettingGroup;
  kind: SettingKind;
  options?: readonly string[];
  /** Current value for non-secret settings; always null for secrets. */
  value: string | null;
  /** True if any value (panel, env or default) is in effect. */
  isSet: boolean;
  source: 'panel' | 'env' | 'default' | 'none';
}

export const setupClaimSchema = z.object({
  token: z.string().trim().min(16).max(200),
  phone: z.string().trim().min(10).max(20),
  displayName: z.string().trim().min(2).max(50).optional(),
});
export type SetupClaimInput = z.infer<typeof setupClaimSchema>;

export const smsTestSchema = z.object({
  phone: z.string().trim().min(10).max(20),
});
export type SmsTestInput = z.infer<typeof smsTestSchema>;
