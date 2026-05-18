import { describe, it, expect } from 'vitest';
import { filterAvailableSeats } from '../../src/utils/seatFilter';

describe('filterAvailableSeats', () => {
  it('returns only seats with status=0', () => {
    const seats = [
      { id: 1, status: 0 as const },
      { id: 2, status: 1 as const },
      { id: 3, status: 0 as const },
      { id: 4, status: 1 as const },
    ];
    const result = filterAvailableSeats(seats);
    expect(result).toEqual([
      { id: 1, status: 0 },
      { id: 3, status: 0 },
    ]);
  });

  it('returns empty array when all seats are occupied', () => {
    const seats = [
      { id: 1, status: 1 as const },
      { id: 2, status: 1 as const },
    ];
    const result = filterAvailableSeats(seats);
    expect(result).toEqual([]);
  });

  it('returns all seats when all are available', () => {
    const seats = [
      { id: 1, status: 0 as const },
      { id: 2, status: 0 as const },
      { id: 3, status: 0 as const },
    ];
    const result = filterAvailableSeats(seats);
    expect(result).toHaveLength(3);
  });

  it('returns empty array for empty input', () => {
    const result = filterAvailableSeats([]);
    expect(result).toEqual([]);
  });

  it('preserves additional properties on seat objects', () => {
    const seats = [
      { id: 5, status: 0 as const, zone: 'center' },
      { id: 11, status: 1 as const, zone: 'upper' },
    ];
    const result = filterAvailableSeats(seats);
    expect(result).toEqual([{ id: 5, status: 0, zone: 'center' }]);
  });
});
