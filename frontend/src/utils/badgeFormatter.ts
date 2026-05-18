/**
 * Formats a cart item count into a badge display string.
 *
 * - count = 0 → null (badge hidden)
 * - count 1–99 → exact count as string
 * - count > 99 → "99+"
 */
export function formatBadge(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  if (count > 99) {
    return '99+';
  }
  return String(count);
}
