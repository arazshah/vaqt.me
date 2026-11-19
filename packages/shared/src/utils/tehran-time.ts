// Booking times are stored as UTC instants but *defined* in Iran local time
// (weekly hours, leave days, "9 to 5"). Iran abolished daylight saving in
// 2022, so Asia/Tehran is a fixed UTC+03:30 offset; keeping it a constant
// avoids Intl lookups in the slot generator's hot loop. If the DST ban is
// ever lifted this single constant (and these helpers) is the only place to
// change.
export const TEHRAN_OFFSET_MINUTES = 210;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** 'YYYY-MM-DD' calendar date in Iran for an instant. */
export function tehranDateKey(date: Date): string {
  const shifted = new Date(
    date.getTime() + TEHRAN_OFFSET_MINUTES * MS_PER_MINUTE,
  );
  return shifted.toISOString().slice(0, 10);
}

/** Parses 'YYYY-MM-DD'; returns null if it is not a real calendar date. */
function parseKey(key: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

export function isValidDateKey(key: string): boolean {
  return parseKey(key) !== null;
}

/** 0 = Sunday … 6 = Saturday (same as Date#getDay) for an Iran date. */
export function tehranWeekday(key: string): number {
  const p = parseKey(key);
  if (!p) throw new Error(`invalid date key: ${key}`);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/** The UTC instant of `minuteOfDay` (0..1439) on an Iran calendar date. */
export function tehranToUtc(key: string, minuteOfDay: number): Date {
  const p = parseKey(key);
  if (!p) throw new Error(`invalid date key: ${key}`);
  return new Date(
    Date.UTC(p.y, p.m - 1, p.d) +
      (minuteOfDay - TEHRAN_OFFSET_MINUTES) * MS_PER_MINUTE,
  );
}

export function addDaysToKey(key: string, days: number): string {
  const p = parseKey(key);
  if (!p) throw new Error(`invalid date key: ${key}`);
  return new Date(Date.UTC(p.y, p.m - 1, p.d) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}
