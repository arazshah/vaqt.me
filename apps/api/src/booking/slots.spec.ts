import { generateSlots, slotStepMinutes } from './slots';

// 2026-11-19 is a Thursday (weekday 4). 06:00 UTC = 09:30 Iran.
const NOW = new Date('2026-11-19T06:00:00Z');
const thursday9to12 = [{ weekday: 4, startMinute: 540, endMinute: 720 }];

function base(overrides = {}) {
  return {
    rules: thursday9to12,
    exceptions: new Set<string>(),
    durationMinutes: 60,
    minNoticeHours: 0,
    maxDaysAhead: 0,
    now: NOW,
    busy: [],
    ...overrides,
  };
}

const iranTimes = (slots: string[]) =>
  slots.map((s) => {
    const d = new Date(new Date(s).getTime() + 210 * 60_000);
    return d.toISOString().slice(11, 16);
  });

describe('slotStepMinutes', () => {
  it('uses 15 for quick intros and 30 otherwise', () => {
    expect(slotStepMinutes(15)).toBe(15);
    expect(slotStepMinutes(45)).toBe(30);
  });
});

describe('generateSlots', () => {
  it('generates slots inside the window and drops the ones already past', () => {
    // 09:00 has started already (it is 09:30), 09:30 is "now" and allowed.
    const [day] = generateSlots(base());
    expect(iranTimes(day.slots)).toEqual(['09:30', '10:00', '10:30', '11:00']);
  });

  it('never lets a slot run past the end of the window', () => {
    const [day] = generateSlots(base({ durationMinutes: 90 }));
    expect(iranTimes(day.slots)).toEqual(['09:30', '10:00', '10:30']);
  });

  it('honours the minimum notice', () => {
    const [day] = generateSlots(base({ minNoticeHours: 1 }));
    expect(iranTimes(day.slots)).toEqual(['10:30', '11:00']);
  });

  it('removes slots overlapping a busy interval but keeps adjacent ones', () => {
    const busy = [
      {
        startAt: new Date('2026-11-19T07:00:00Z'), // 10:30 Iran
        endAt: new Date('2026-11-19T08:00:00Z'), // 11:30 Iran
      },
    ];
    const [day] = generateSlots(base({ busy, durationMinutes: 30 }));
    expect(iranTimes(day.slots)).toEqual(['09:30', '10:00', '11:30']);
  });

  it('returns no slots on an exception day or a day without rules', () => {
    const off = generateSlots(
      base({ exceptions: new Set(['2026-11-19']), maxDaysAhead: 1 }),
    );
    expect(off.map((d) => d.slots.length)).toEqual([0, 0]); // Fri has no rule
  });

  it('supports several windows per day', () => {
    const rules = [
      { weekday: 4, startMinute: 600, endMinute: 660 },
      { weekday: 4, startMinute: 840, endMinute: 900 },
    ];
    const [day] = generateSlots(base({ rules }));
    expect(iranTimes(day.slots)).toEqual(['10:00', '14:00']);
  });

  it('spans maxDaysAhead + 1 calendar days starting today (Iran date)', () => {
    const days = generateSlots(base({ maxDaysAhead: 7 }));
    expect(days).toHaveLength(8);
    expect(days[0].date).toBe('2026-11-19');
    expect(days[7].date).toBe('2026-11-26');
    // the next Thursday has slots again (nothing is "past" there)
    expect(iranTimes(days[7].slots)).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
    ]);
  });
});
