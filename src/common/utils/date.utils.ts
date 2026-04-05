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
