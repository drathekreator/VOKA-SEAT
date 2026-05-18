import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { classifyInventoryAlert } from '../../src/utils/inventoryAlert'

/**
 * Feature: voka-seat-system, Property 9: Inventory Alert Classification
 *
 * For any inventory item: if quantity = 0, the item SHALL display a red alert
 * indicator; if 0 < quantity ≤ minimumThreshold, the item SHALL display an amber
 * warning indicator; if quantity > minimumThreshold, the item SHALL display no
 * alert indicator. These classifications are mutually exclusive and exhaustive.
 *
 * Validates: Requirements 8.2, 8.3, 8.4
 */
describe('Feature: voka-seat-system, Property 9: Inventory Alert Classification', () => {
  it('quantity = 0 always returns "red" regardless of threshold', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1000 }),
        (threshold) => {
          const result = classifyInventoryAlert(0, threshold)
          expect(result).toBe('red')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('0 < quantity <= threshold always returns "amber"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (threshold) => {
          // Generate a quantity in range (0, threshold]
          const quantity = fc.sample(fc.integer({ min: 1, max: threshold }), 1)[0]
          const result = classifyInventoryAlert(quantity, threshold)
          expect(result).toBe('amber')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('quantity > threshold always returns "none"', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 999 }),
        fc.integer({ min: 1, max: 1000 }),
        (threshold, offset) => {
          const quantity = threshold + offset
          const result = classifyInventoryAlert(quantity, threshold)
          expect(result).toBe('none')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result is always one of "red", "amber", or "none" (mutually exclusive and exhaustive)', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        (quantity, threshold) => {
          const result = classifyInventoryAlert(quantity, threshold)

          // Exhaustive: result must be one of the three valid values
          expect(['red', 'amber', 'none']).toContain(result)

          // Mutually exclusive: verify classification matches exactly one condition
          if (quantity === 0) {
            expect(result).toBe('red')
          } else if (quantity <= threshold) {
            expect(result).toBe('amber')
          } else {
            expect(result).toBe('none')
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
