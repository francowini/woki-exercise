import { describe, it, expect } from 'vitest';
import { toMinutes, toMinutesFromISO, toISO, SLOT_GRID_MINUTES } from './time';

describe('toMinutes', () => {
  it('converts HH:MM to minutes', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('12:00')).toBe(720);
    expect(toMinutes('15:30')).toBe(930);
    expect(toMinutes('23:45')).toBe(1425);
  });
});

describe('toMinutesFromISO', () => {
  it('extracts time portion as minutes', () => {
    expect(toMinutesFromISO('2025-12-01T00:00:00Z')).toBe(0);
    expect(toMinutesFromISO('2025-12-01T12:30:00Z')).toBe(750);
    expect(toMinutesFromISO('2025-12-01T19:30:00Z')).toBe(1170);
  });
});

describe('toISO', () => {
  it('builds ISO string from date and minutes', () => {
    expect(toISO('2025-12-01', 0)).toBe('2025-12-01T00:00:00Z');
    expect(toISO('2025-12-01', 720)).toBe('2025-12-01T12:00:00Z');
    expect(toISO('2025-12-01', 930)).toBe('2025-12-01T15:30:00Z');
  });

  it('pads single digits', () => {
    expect(toISO('2025-12-01', 65)).toBe('2025-12-01T01:05:00Z');
  });
});

describe('roundtrip', () => {
  it('toMinutes -> toISO -> toMinutesFromISO', () => {
    const mins = toMinutes('19:30');
    const iso = toISO('2025-12-01', mins);
    expect(toMinutesFromISO(iso)).toBe(mins);
  });
});

describe('constants', () => {
  it('slot grid is 15 minutes', () => {
    expect(SLOT_GRID_MINUTES).toBe(15);
  });
});
