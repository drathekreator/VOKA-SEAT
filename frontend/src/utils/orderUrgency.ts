/**
 * Order urgency classification utility.
 * Classifies pending orders based on elapsed waiting time.
 */

export type UrgencyLevel = 'URGENT' | 'WAITING' | 'NEW';

/**
 * Classify an order's urgency based on elapsed minutes since creation.
 * - URGENT: waiting longer than 7 minutes
 * - WAITING: waiting between 3 and 7 minutes (inclusive)
 * - NEW: waiting less than 3 minutes
 */
export function classifyUrgency(elapsedMinutes: number): UrgencyLevel {
  if (elapsedMinutes > 7) return 'URGENT';
  if (elapsedMinutes >= 3) return 'WAITING';
  return 'NEW';
}

/**
 * Get Tailwind CSS classes for the accent bar based on urgency level.
 */
export function getUrgencyAccentClasses(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'URGENT':
      return 'border-l-4 border-red-500';
    case 'WAITING':
      return 'border-l-4 border-amber-500';
    case 'NEW':
      return 'border-l-4 border-[#D81B60]';
  }
}

/**
 * Get Tailwind CSS classes for the top accent bar color.
 */
export function getUrgencyTopBarColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'URGENT':
      return 'bg-status-out-of-stock';
    case 'WAITING':
      return 'bg-status-low-stock';
    case 'NEW':
      return 'bg-primary';
  }
}

/**
 * Get Tailwind CSS classes for the urgency badge text and background.
 */
export function getUrgencyBadgeClasses(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'URGENT':
      return 'text-status-out-of-stock bg-status-out-of-stock/10';
    case 'WAITING':
      return 'text-status-low-stock bg-status-low-stock/10';
    case 'NEW':
      return 'text-primary bg-primary/10';
  }
}

/**
 * Get Tailwind CSS classes for the timer text color.
 */
export function getUrgencyTimerColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'URGENT':
      return 'text-status-out-of-stock';
    case 'WAITING':
      return 'text-status-low-stock';
    case 'NEW':
      return 'text-primary';
  }
}

/**
 * Format elapsed seconds into MM:SS string.
 */
export function formatElapsedTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate elapsed seconds from a creation timestamp to now.
 */
export function getElapsedSeconds(createdAt: string | Date, now?: Date): number {
  const created = new Date(createdAt);
  const current = now || new Date();
  return Math.max(0, Math.floor((current.getTime() - created.getTime()) / 1000));
}
