// web/src/lib/utils.ts

/**
 * Format a date for display
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
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
