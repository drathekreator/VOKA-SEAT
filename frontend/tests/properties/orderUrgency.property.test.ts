import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { classifyUrgency } from '../../src/utils/orderUrgency'

/**
 * Feature: voka-seat-system, Property 7: Order Urgency Classification
 *
 * For any pending order with elapsed waiting time T:
 * - if T > 7 minutes, the order SHALL be classified as "URGENT"
 * - if 3 ≤ T ≤ 7 minutes, it SHALL be classified as "WAITING"
 * - if T < 3 minutes, it SHALL be classified as "NEW"
 * These categories are mutually exclusive and exhaustive for all positive T values.
 *
 * Validates: Requirements 7.2
 */
describe('Feature: voka-seat-system, Property 7: Order Urgency Classification', () => {
  it('any elapsed time > 7 minutes always returns URGENT', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 7.000001, max: 30, noNaN: true, noDefaultInfinity: true }),
        (elapsedMinutes) => {
          const result = classifyUrgency(elapsedMinutes)
          expect(result).toBe('URGENT')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('any elapsed time >= 3 and <= 7 minutes always returns WAITING', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 3, max: 7, noNaN: true, noDefaultInfinity: true }),
        (elapsedMinutes) => {
          const result = classifyUrgency(elapsedMinutes)
          expect(result).toBe('WAITING')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('any elapsed time < 3 minutes always returns NEW', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2.999999, noNaN: true, noDefaultInfinity: true }),
        (elapsedMinutes) => {
          const result = classifyUrgency(elapsedMinutes)
          expect(result).toBe('NEW')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result is always one of URGENT, WAITING, or NEW (exhaustive and mutually exclusive)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 30, noNaN: true, noDefaultInfinity: true }),
        (elapsedMinutes) => {
          const result = classifyUrgency(elapsedMinutes)

          // Exhaustive: result must be one of the three categories
          expect(['URGENT', 'WAITING', 'NEW']).toContain(result)

          // Mutually exclusive: exactly one classification applies
          const isUrgent = result === 'URGENT'
          const isWaiting = result === 'WAITING'
          const isNew = result === 'NEW'
          const count = [isUrgent, isWaiting, isNew].filter(Boolean).length
          expect(count).toBe(1)
        }
      ),
      { numRuns: 100 }
    )
  })
})
