// Iran time, Jalali calendar, Persian digits — same presentation as the web.
const dayFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'Asia/Tehran',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFmt = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatWhen(date: Date): string {
  return `${dayFmt.format(date)}، ساعت ${timeFmt.format(date)}`;
}

export function toLocalPhone(canonical: string | null): string {
  if (!canonical) return '';
  return canonical.startsWith('+98') ? `0${canonical.slice(3)}` : canonical;
}
