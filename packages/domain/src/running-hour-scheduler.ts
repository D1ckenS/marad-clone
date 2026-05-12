/**
 * Pure running-hour interval scheduler.
 *
 * Given a job's interval (in hours), the previous component running-hours
 * value, and the new value after a reading update, returns every threshold
 * that was crossed. Each threshold is an exact multiple of `intervalHours`
 * and represents a point at which a new `JobInstance` should be opened.
 *
 * Invariants upheld by this function:
 *  - Returns [] when intervalHours ≤ 0 (guard against bad DB data).
 *  - Returns [] when newHours ≤ prevHours (monotonicity enforced by the service
 *    layer, but this function is safe to call regardless).
 *  - One entry per interval boundary crossed — a jump of 3× the interval
 *    yields 3 entries.
 *  - All entries are > prevHours and ≤ newHours.
 *  - Entries are sorted ascending.
 */

export interface RunHourCheckInput {
  readonly intervalHours: number;
  readonly prevHours: number;
  readonly newHours: number;
}

export function checkRunningHourThresholds(input: RunHourCheckInput): readonly number[] {
  const { intervalHours, prevHours, newHours } = input;

  if (intervalHours <= 0 || newHours <= prevHours) return [];

  const prevFloor = Math.floor(prevHours / intervalHours);
  const newFloor = Math.floor(newHours / intervalHours);

  if (newFloor <= prevFloor) return [];

  const thresholds: number[] = [];
  for (let k = prevFloor + 1; k <= newFloor; k++) {
    thresholds.push(k * intervalHours);
  }
  return thresholds;
}
