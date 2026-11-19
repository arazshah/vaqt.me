import { describe, expect, it } from 'vitest';
import {
  createBookingSchema,
  decideBookingSchema,
  updateBookingSettingsSchema,
} from './booking';

describe('updateBookingSettingsSchema', () => {
  it('accepts a normal week with two windows on one day', () => {
    const r = updateBookingSettingsSchema.safeParse({
      rules: [
        { weekday: 6, startMinute: 540, endMinute: 720 },
        { weekday: 6, startMinute: 840, endMinute: 1020 },
      ],
    });
    expect(r.success).toBe(true);
  });
  it('rejects overlapping windows on the same day only', () => {
    const overlap = updateBookingSettingsSchema.safeParse({
      rules: [
        { weekday: 1, startMinute: 540, endMinute: 720 },
        { weekday: 1, startMinute: 700, endMinute: 800 },
      ],
    });
    expect(overlap.success).toBe(false);
    const otherDays = updateBookingSettingsSchema.safeParse({
      rules: [
        { weekday: 1, startMinute: 540, endMinute: 720 },
        { weekday: 2, startMinute: 540, endMinute: 720 },
      ],
    });
    expect(otherDays.success).toBe(true);
  });
  it('rejects reversed, off-grid and out-of-range windows', () => {
    for (const rule of [
      { weekday: 1, startMinute: 720, endMinute: 540 },
      { weekday: 1, startMinute: 541, endMinute: 600 },
      { weekday: 7, startMinute: 540, endMinute: 600 },
      { weekday: 1, startMinute: 0, endMinute: 1445 },
    ]) {
      expect(
        updateBookingSettingsSchema.safeParse({ rules: [rule] }).success,
      ).toBe(false);
    }
  });
  it('validates services and leave dates', () => {
    expect(
      updateBookingSettingsSchema.safeParse({
        services: [{ name: 'آشنایی', durationMinutes: 15, mode: 'online' }],
        exceptions: ['2026-11-20'],
      }).success,
    ).toBe(true);
    for (const bad of [
      { services: [{ name: 'x', durationMinutes: 15, mode: 'online' }] },
      { services: [{ name: 'آشنایی', durationMinutes: 17, mode: 'online' }] },
      { services: [{ name: 'آشنایی', durationMinutes: 15, mode: 'zoom' }] },
      { exceptions: ['2026-02-30'] },
      { maxDaysAhead: 0 },
    ]) {
      expect(updateBookingSettingsSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('createBookingSchema / decideBookingSchema', () => {
  it('lowercases the username and requires an ISO start', () => {
    const ok = createBookingSchema.parse({
      username: 'Ali_N',
      serviceId: 's1',
      startAt: '2026-11-20T06:30:00.000Z',
      name: 'سارا',
    });
    expect(ok.username).toBe('ali_n');
    expect(
      createBookingSchema.safeParse({
        username: 'ali',
        serviceId: 's1',
        startAt: 'tomorrow',
        name: 'سارا',
      }).success,
    ).toBe(false);
  });
  it('only knows confirm and reject', () => {
    expect(
      decideBookingSchema.safeParse({ id: 'b', action: 'confirm' }).success,
    ).toBe(true);
    expect(
      decideBookingSchema.safeParse({ id: 'b', action: 'delete' }).success,
    ).toBe(false);
  });
});
