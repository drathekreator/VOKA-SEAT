import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { filterAvailableSeats, SeatEntry } from '../../src/utils/seatFilter'

/**
 * Feature: voka-seat-system, Property 8: Available Seat Filtering for Assignment
 *
 * For any set of 24 seat statuses, when the "Assign Table" dialog is opened,
 * it SHALL display exactly those seats with status = 0 (available) and SHALL
 * exclude all seats with status = 1 (occupied).
 *
 * Validates: Requirements 7.7
 */
describe('Feature: voka-seat-system, Property 8: Available Seat Filtering for Assignment', () => {
  // Generator: array of exactly 24 seats with random statuses (0 or 1)
  const seatsArbitrary = fc.array(
    fc.constantFrom(0 as const, 1 as const),
    { minLength: 24, maxLength: 24 }
  ).map((statuses) =>
    statuses.map((status, index): SeatEntry => ({
      id: index + 1,
      status,
    }))
  )

  it('all returned seats have status=0', () => {
    fc.assert(
      fc.property(seatsArbitrary, (seats) => {
        const result = filterAvailableSeats(seats)
        for (const seat of result) {
          expect(seat.status).toBe(0)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('no returned seat has status=1', () => {
    fc.assert(
      fc.property(seatsArbitrary, (seats) => {
        const result = filterAvailableSeats(seats)
        const hasOccupied = result.some((seat) => seat.status === 1)
        expect(hasOccupied).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('every seat with status=0 in the input appears in the output', () => {
    fc.assert(
      fc.property(seatsArbitrary, (seats) => {
        const result = filterAvailableSeats(seats)
        const availableInInput = seats.filter((s) => s.status === 0)
        for (const seat of availableInInput) {
          expect(result).toContainEqual(seat)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('output length equals the count of status=0 seats in the input', () => {
    fc.assert(
      fc.property(seatsArbitrary, (seats) => {
        const result = filterAvailableSeats(seats)
        const expectedCount = seats.filter((s) => s.status === 0).length
        expect(result.length).toBe(expectedCount)
      }),
      { numRuns: 100 }
    )
  })
})
