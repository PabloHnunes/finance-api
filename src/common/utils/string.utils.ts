/**
 * Trims a string and turns an empty result into null, so optional text
 * fields never persist "". Non-string values pass through for validation.
 */
export function trimToNull(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
