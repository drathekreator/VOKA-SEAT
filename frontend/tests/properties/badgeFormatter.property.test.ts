import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { formatBadge } from '../../src/utils/badgeFormatter'

/**
 * Feature: voka-seat-system, Property 15: Cart Badge Display Formatting
 *
 * For any cart item count C: if C = 0, the badge SHALL be hidden; if 1 ≤ C ≤ 99,
 * the badge SHALL display the exact numeric value of C; if C > 99, the badge SHALL
 * display "99+".
 *
 * Validates: Requirements 17.6
 */
describe('Feature: voka-seat-system, Property 15: Cart Badge Display Formatting', () => {
  it('count = 0 always returns null (badge hidden)', () => {
    const result = formatBadge(0)
    expect(result).toBeNull()
  })

  it('count 1-99 always returns the exact count as a string', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        (count) => {
          const result = formatBadge(count)
          expect(result).toBe(String(count))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('count > 99 always returns "99+"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 10000 }),
        (count) => {
          const result = formatBadge(count)
          expect(result).toBe('99+')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('negative counts always return null (badge hidden)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: -1 }),
        (count) => {
          const result = formatBadge(count)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })
})
