import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  isValidDateKey,
  tehranDateKey,
  tehranToUtc,
  tehranWeekday,
} from './tehran-time';

describe('tehran time helpers', () => {
  it('maps an instant to the Iran calendar date across midnight', () => {
    // 20:30 UTC on the 18th is 00:00 Iran time on the 19th.
    expect(tehranDateKey(new Date('2026-11-18T20:30:00Z'))).toBe('2026-11-19');
    expect(tehranDateKey(new Date('2026-11-18T20:29:59Z'))).toBe('2026-11-18');
  });
  it('converts Iran local minutes to UTC', () => {
    expect(tehranToUtc('2026-11-19', 9 * 60).toISOString()).toBe(
      '2026-11-19T05:30:00.000Z',
    );
    // before 03:30 local, the UTC instant lands on the previous day
    expect(tehranToUtc('2026-11-19', 60).toISOString()).toBe(
      '2026-11-18T21:30:00.000Z',
    );
  });
  it('round-trips with tehranDateKey', () => {
    const d = tehranToUtc('2027-03-21', 23 * 60 + 45);
    expect(tehranDateKey(d)).toBe('2027-03-21');
  });
  it('knows weekdays (2026-11-19 is a Thursday, Friday is 5)', () => {
    expect(tehranWeekday('2026-11-19')).toBe(4);
    expect(tehranWeekday('2026-11-20')).toBe(5);
  });
  it('adds days across month ends', () => {
    expect(addDaysToKey('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('rejects impossible dates', () => {
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('26-1-1')).toBe(false);
    expect(isValidDateKey('2026-11-19')).toBe(true);
  });
});
