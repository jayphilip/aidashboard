// web/src/utils/formatting.ts

/**
 * Format a date for display
 */
export function formatDate(date: Date | string | null): string {
  const d = parseItemDate(date);
  if (!d) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get a text excerpt from content
 */
export function excerpt(text: string | null | undefined, length: number = 150): string {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
}

/**
 * Ensure value is a Date object
 */
export function ensureDate(value: any): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

/**
 * Parse a value into a Date, returning null instead of an Invalid Date.
 *
 * iOS Safari's Date parser is much stricter than Chrome's. In particular it
 * rejects Postgres-style timestamps like "2026-06-06 12:00:00+00" (space
 * separator, short "+00" offset), returning an Invalid Date whose .getTime()
 * is NaN. Calling .toISOString() on such a value throws a RangeError, which on
 * iOS would crash the render (white page) while working fine on desktop.
 *
 * This normalizes the common Postgres format to ISO 8601 before parsing and
 * always returns either a valid Date or null.
 */
export function parseItemDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  // Try the raw string first (handles already-ISO values).
  let d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;

  // Normalize Postgres "YYYY-MM-DD HH:MM:SS[.fff][+HH[:MM]]" to ISO 8601:
  // replace the space separator with "T" and expand a bare "+HH" offset to
  // "+HH:00" so Safari accepts it.
  const normalized = value
    .replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00');
  d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}
