/**
 * Parses a date string ensuring UTC midnight, avoiding timezone shift issues.
 * e.g. '2026-05-01' or '2026-05-01T00:00:00' → 2026-05-01T00:00:00.000Z
 */
export function parseAsUTCDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/**
 * Creates a Date at UTC midnight from year/month/day components.
 * Replaces `new Date(year, month, day)` which uses local timezone.
 */
export function createUTCDate(year: number, month: number, day = 1): Date {
  return new Date(Date.UTC(year, month, day));
}

/**
 * Last day (28-31) of a month. `month` is 1-based (1 = January).
 */
export function getLastDayOfMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Like createUTCDate, but clamps the day to the target month's last day
 * instead of overflowing into the next month (Jan 31 + 1 month → Feb 28/29).
 * `month` is 0-based and may exceed 11; the year rolls over accordingly.
 */
export function createUTCDateClamped(
  year: number,
  month: number,
  day: number,
): Date {
  const firstOfMonth = createUTCDate(year, month);
  const targetYear = firstOfMonth.getUTCFullYear();
  const targetMonth = firstOfMonth.getUTCMonth();
  const lastDay = getLastDayOfMonth(targetMonth + 1, targetYear);
  return createUTCDate(targetYear, targetMonth, Math.min(day, lastDay));
}
