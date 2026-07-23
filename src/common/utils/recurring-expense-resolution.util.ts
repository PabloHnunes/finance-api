import { Decimal } from '@prisma/client/runtime/library';

interface RecurringExpenseHistoryEntry {
  amount: Decimal;
  month: number;
  year: number;
}

/**
 * Resolves the amount that applies to a recurring expense in a given
 * month/year by forward-filling from the latest history entry <= that
 * period. Falls back to the oldest entry if the period predates all history.
 */
export function getAmountForPeriod(
  history: RecurringExpenseHistoryEntry[],
  month: number,
  year: number,
): Decimal {
  const entry = history.find(
    (h) => h.year < year || (h.year === year && h.month <= month),
  );
  return entry ? entry.amount : history[history.length - 1].amount;
}
