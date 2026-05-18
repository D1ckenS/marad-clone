// MLC 2006 Regulation VIII/1 rest-hour validation.
// Daily minimum: ≥10 hours rest in any 24-hour period.
// Weekly minimum: ≥77 hours rest in any 7-day period.
// REST = hours not worked; hoursWorked is an array of 24 booleans (true = worked).

export interface RestHourDay {
  date: string; // YYYY-MM-DD
  hoursWorked: boolean[]; // length 24; index 0 = 00:00–00:59
}

export interface MlcViolation {
  type: 'DAILY_REST' | 'WEEKLY_REST';
  date: string;
  restHours: number;
  minimumRequired: number;
}

export interface MlcCheckResult {
  valid: boolean;
  violations: MlcViolation[];
}

const DAILY_MIN_REST = 10;
const WEEKLY_MIN_REST = 77;

export function checkMlcRestHours(days: RestHourDay[]): MlcCheckResult {
  const violations: MlcViolation[] = [];
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  for (const day of sorted) {
    const restHours = day.hoursWorked.filter((w) => !w).length;
    if (restHours < DAILY_MIN_REST) {
      violations.push({
        type: 'DAILY_REST',
        date: day.date,
        restHours,
        minimumRequired: DAILY_MIN_REST,
      });
    }
  }

  for (let i = 0; i <= sorted.length - 7; i++) {
    const window = sorted.slice(i, i + 7);
    const totalRest = window.reduce((sum, d) => sum + d.hoursWorked.filter((w) => !w).length, 0);
    if (totalRest < WEEKLY_MIN_REST) {
      violations.push({
        type: 'WEEKLY_REST',
        date: window[6]!.date,
        restHours: totalRest,
        minimumRequired: WEEKLY_MIN_REST,
      });
    }
  }

  return { valid: violations.length === 0, violations };
}
