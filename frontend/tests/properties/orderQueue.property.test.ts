import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getElapsedSeconds } from '../../src/utils/orderUrgency'

/**
 * Feature: voka-seat-system, Property 6: Order Queue Sorting by Wait Time
 *
 * For any set of pending orders with distinct creation timestamps, the order
 * queue SHALL display them sorted by elapsed waiting time in descending order
 * (longest-waiting first).
 *
 * Validates: Requirements 7.1
 */
describe('Feature: voka-seat-system, Property 6: Order Queue Sorting by Wait Time', () => {
  /**
   * Generator for an array of orders with distinct creation timestamps.
   * Each order has a unique id and a distinct createdAt timestamp.
   *
   * Notes:
   *   - We generate epoch milliseconds (rather than `fc.date()`) because
   *     fast-check 4.x can emit `Invalid Date` sentinels which crash on
   *     `toISOString()`. Bounding to a known good range and converting
   *     in one place sidesteps that.
   *   - The bounds are 2024-01-01..2025-12-31 to mirror the original
   *     intent without straying outside the V8 safe range.
   */
  const MIN_EPOCH = new Date('2024-01-01T00:00:00Z').getTime();
  const MAX_EPOCH = new Date('2025-12-31T23:59:59Z').getTime();

  const ordersArbitrary = fc
    .uniqueArray(fc.integer({ min: MIN_EPOCH, max: MAX_EPOCH }), {
      minLength: 2,
      maxLength: 24,
    })
    .map((epochs) =>
      epochs.map((epoch, index) => ({
        id: index + 1,
        createdAt: new Date(epoch).toISOString(),
      }))
    )

  it('sorting by elapsed time descending produces a list where each elapsed time >= the next', () => {
    fc.assert(
      fc.property(ordersArbitrary, (orders) => {
        const now = new Date()

        // Sort orders by elapsed waiting time descending (longest-waiting first)
        const sorted = [...orders].sort((a, b) => {
          const elapsedA = getElapsedSeconds(a.createdAt, now)
          const elapsedB = getElapsedSeconds(b.createdAt, now)
          return elapsedB - elapsedA
        })

        // Verify: each order's elapsed time is >= the next order's elapsed time
        for (let i = 0; i < sorted.length - 1; i++) {
          const currentElapsed = getElapsedSeconds(sorted[i].createdAt, now)
          const nextElapsed = getElapsedSeconds(sorted[i + 1].createdAt, now)
          expect(currentElapsed).toBeGreaterThanOrEqual(nextElapsed)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('the sorted array has the same length as the input', () => {
    fc.assert(
      fc.property(ordersArbitrary, (orders) => {
        const now = new Date()

        const sorted = [...orders].sort((a, b) => {
          const elapsedA = getElapsedSeconds(a.createdAt, now)
          const elapsedB = getElapsedSeconds(b.createdAt, now)
          return elapsedB - elapsedA
        })

        expect(sorted.length).toBe(orders.length)
      }),
      { numRuns: 100 }
    )
  })

  it('the sorted array contains the same elements as the input', () => {
    fc.assert(
      fc.property(ordersArbitrary, (orders) => {
        const now = new Date()

        const sorted = [...orders].sort((a, b) => {
          const elapsedA = getElapsedSeconds(a.createdAt, now)
          const elapsedB = getElapsedSeconds(b.createdAt, now)
          return elapsedB - elapsedA
        })

        // Verify same elements by checking all IDs are present
        const inputIds = orders.map((o) => o.id).sort((a, b) => a - b)
        const sortedIds = sorted.map((o) => o.id).sort((a, b) => a - b)
        expect(sortedIds).toEqual(inputIds)

        // Verify same createdAt values are present
        const inputTimestamps = orders.map((o) => o.createdAt).sort()
        const sortedTimestamps = sorted.map((o) => o.createdAt).sort()
        expect(sortedTimestamps).toEqual(inputTimestamps)
      }),
      { numRuns: 100 }
    )
  })
})
