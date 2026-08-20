import { z } from 'zod';

// Every stored money field is Rial (see CLAUDE.md "مبالغ"). Toman is the
// smallest unit anyone actually types or displays, and 1 Toman = 10 Rial,
// so a value that isn't a multiple of 10 can only be a unit-conversion bug
// (e.g. a Toman literal that was never multiplied by 10). Bounds are a
// sanity net, not a real business limit: 1,000 Rial (100 Toman) floor
// rejects accidental zero/near-zero garbage, and 10,000,000,000 Rial (1
// billion Toman) ceiling is far above any realistic marketplace price but
// still catches overflow-style bugs (e.g. an accidental extra x1000).
const MIN_RIAL = 1_000;
const MAX_RIAL = 10_000_000_000;

export const moneyRialSchema = z
  .number()
  .int('باید یک عدد صحیح باشد')
  .multipleOf(10, 'باید مضربی از ۱۰ ریال باشد (واحد ذخیره‌سازی ریال است)')
  .min(MIN_RIAL, `حداقل ${String(MIN_RIAL)} ریال`)
  .max(MAX_RIAL, `حداکثر ${String(MAX_RIAL)} ریال`);
export type MoneyRial = z.infer<typeof moneyRialSchema>;
