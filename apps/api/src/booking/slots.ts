import {
  addDaysToKey,
  tehranDateKey,
  tehranToUtc,
  tehranWeekday,
  type AvailabilityDay,
  type AvailabilityRuleInput,
} from '@vaqt/shared';

export interface BusyInterval {
  startAt: Date;
  endAt: Date;
}

export interface SlotInput {
  rules: AvailabilityRuleInput[];
  /** Iran dates ('YYYY-MM-DD') the provider is off. */
  exceptions: ReadonlySet<string>;
  durationMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  now: Date;
  /** Pending + confirmed bookings of the provider. */
  busy: BusyInterval[];
}

/** 15-minute intro calls bookable every 15 min, everything else every 30. */
export function slotStepMinutes(durationMinutes: number): number {
  return durationMinutes <= 15 ? 15 : 30;
}

export function generateSlots(input: SlotInput): AvailabilityDay[] {
  const {
    rules,
    exceptions,
    durationMinutes,
    minNoticeHours,
    maxDaysAhead,
    now,
    busy,
  } = input;
  const earliest = now.getTime() + minNoticeHours * 3_600_000;
  const step = slotStepMinutes(durationMinutes);
  const todayKey = tehranDateKey(now);
  const days: AvailabilityDay[] = [];

  for (let i = 0; i <= maxDaysAhead; i++) {
    const date = addDaysToKey(todayKey, i);
    const slots: string[] = [];
    if (!exceptions.has(date)) {
      const weekday = tehranWeekday(date);
      const windows = rules
        .filter((r) => r.weekday === weekday)
        .sort((a, b) => a.startMinute - b.startMinute);
      for (const w of windows) {
        for (
          let m = w.startMinute;
          m + durationMinutes <= w.endMinute;
          m += step
        ) {
          const start = tehranToUtc(date, m);
          const end = new Date(start.getTime() + durationMinutes * 60_000);
          if (start.getTime() < earliest) continue;
          const clashes = busy.some((b) => start < b.endAt && end > b.startAt);
          if (!clashes) slots.push(start.toISOString());
        }
      }
    }
    days.push({ date, slots });
  }
  return days;
}
