interface SalaryHistoryEntry {
  year: number;
  month: number;
  amount: unknown;
}

interface SalaryLike {
  isMain: boolean;
  mainUntilMonth?: number | null;
  mainUntilYear?: number | null;
  history: SalaryHistoryEntry[];
}

/**
 * Resolves which history entry (if any) applies to a given month/year.
 * A main salary forward-fills from its latest entry <= the queried month,
 * bounded by mainUntilMonth/Year if it was later superseded by a new main
 * salary. A non-main salary only counts for the exact month it was recorded.
 */
export function resolveSalaryHistoryEntry<T extends SalaryLike>(
  salary: T,
  month: number,
  year: number,
): SalaryHistoryEntry | null {
  const hasMainWindow =
    salary.isMain ||
    (salary.mainUntilMonth != null && salary.mainUntilYear != null);

  if (!hasMainWindow) {
    return (
      salary.history.find((h) => h.year === year && h.month === month) ??
      null
    );
  }

  if (!salary.isMain) {
    const isAfterWindow =
      year > (salary.mainUntilYear as number) ||
      (year === salary.mainUntilYear &&
        month >= (salary.mainUntilMonth as number));
    if (isAfterWindow) return null;
  }

  return (
    salary.history.find(
      (h) => h.year < year || (h.year === year && h.month <= month),
    ) ?? null
  );
}
