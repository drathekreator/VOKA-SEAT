/**
 * Seat filtering utility for the Assign Table dialog.
 * Filters seats to show only those that are available (status=0).
 */

export interface SeatEntry {
  id: number;
  status: 0 | 1;
}

/**
 * Filter an array of seats to return only those with status=0 (available).
 * This is a pure function used by the AssignTableDialog to determine
 * which seats can be assigned to an order.
 *
 * @param seats - Array of seat objects with id and status fields
 * @returns Array containing only seats where status === 0
 */
export function filterAvailableSeats<T extends SeatEntry>(seats: T[]): T[] {
  return seats.filter((seat) => seat.status === 0);
}
