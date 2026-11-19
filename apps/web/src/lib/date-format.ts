import { tehranToUtc } from '@vaqt/shared';

// Everything is displayed in Iran time with the Persian (Jalali) calendar and
// Persian digits, matching how bookings are defined on the server.
const ZONE = 'Asia/Tehran';
const LOCALE = 'fa-IR-u-ca-persian';

const dayFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFmt = new Intl.DateTimeFormat('fa-IR', {
  timeZone: ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const weekdayShortFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONE,
  weekday: 'short',
});
const dayNumFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONE,
  day: 'numeric',
});
const monthShortFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONE,
  month: 'short',
});

export const formatDay = (iso: string | Date): string =>
  dayFmt.format(typeof iso === 'string' ? new Date(iso) : iso);

export const formatTime = (iso: string | Date): string =>
  timeFmt.format(typeof iso === 'string' ? new Date(iso) : iso);

export const formatDayTime = (iso: string): string =>
  `${formatDay(iso)}، ${formatTime(iso)}`;

/** Pieces for a calendar-strip button from an Iran 'YYYY-MM-DD' key. */
export function dayKeyLabel(key: string): {
  weekday: string;
  day: string;
  month: string;
} {
  const noon = tehranToUtc(key, 12 * 60);
  return {
    weekday: weekdayShortFmt.format(noon),
    day: dayNumFmt.format(noon),
    month: monthShortFmt.format(noon),
  };
}

export const formatDayKey = (key: string): string =>
  dayFmt.format(tehranToUtc(key, 12 * 60));

/** 540 -> '09:00' (for <input type="time">). */
export function minutesToTimeInput(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** '09:30' -> 570, or null when empty/invalid. */
export function timeInputToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const total = Number(match[1]) * 60 + Number(match[2]);
  return total <= 1440 ? total : null;
}
