import { describe, expect, it } from 'vitest';
import { checkMlcRestHours } from './mlc-rest-hours.js';
import type { RestHourDay } from './mlc-rest-hours.js';

function makeDay(date: string, workedHours: number): RestHourDay {
  const hoursWorked = Array.from({ length: 24 }, (_, i) => i < workedHours);
  return { date, hoursWorked };
}

function makeDays(startDate: string, count: number, workedPerDay: number): RestHourDay[] {
  const days: RestHourDay[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(makeDay(d.toISOString().slice(0, 10), workedPerDay));
  }
  return days;
}

describe('checkMlcRestHours', () => {
  it('passes when all days have ≥10h rest and ≥77h rest in the week', () => {
    const days = makeDays('2026-01-01', 7, 13); // 13 worked = 11 rest/day → 77h weekly
    const result = checkMlcRestHours(days);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('flags DAILY_REST violation when rest < 10h in a day', () => {
    const days = [makeDay('2026-01-01', 15)]; // 15 worked = 9 rest
    const result = checkMlcRestHours(days);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.type === 'DAILY_REST')).toBe(true);
    expect(result.violations[0]?.restHours).toBe(9);
  });

  it('passes daily check at exactly 10h rest', () => {
    const days = [makeDay('2026-01-01', 14)]; // 14 worked = 10 rest
    const result = checkMlcRestHours(days);
    expect(result.valid).toBe(true);
  });

  it('flags WEEKLY_REST violation when 7-day rest < 77h', () => {
    // 12 worked per day = 12 rest per day → 84h/week → valid
    // 15 worked per day = 9 rest per day → 63h/week → DAILY + WEEKLY
    const days = makeDays('2026-01-01', 7, 15);
    const result = checkMlcRestHours(days);
    const weekly = result.violations.filter((v) => v.type === 'WEEKLY_REST');
    expect(weekly.length).toBeGreaterThan(0);
    expect(weekly[0]?.restHours).toBe(63);
    expect(weekly[0]?.minimumRequired).toBe(77);
  });

  it('passes weekly at exactly 77h rest (11h rest each day)', () => {
    const days = makeDays('2026-01-01', 7, 13); // 13 worked = 11 rest → 77h/week
    const result = checkMlcRestHours(days);
    const weekly = result.violations.filter((v) => v.type === 'WEEKLY_REST');
    expect(weekly).toHaveLength(0);
  });

  it('no weekly check when fewer than 7 days', () => {
    const days = makeDays('2026-01-01', 6, 16); // 6 days, severe overwork
    const result = checkMlcRestHours(days);
    expect(result.violations.every((v) => v.type === 'DAILY_REST')).toBe(true);
  });

  it('result is immutable — does not mutate input', () => {
    const days = [makeDay('2026-01-01', 14)];
    const before = JSON.stringify(days);
    checkMlcRestHours(days);
    expect(JSON.stringify(days)).toBe(before);
  });
});
