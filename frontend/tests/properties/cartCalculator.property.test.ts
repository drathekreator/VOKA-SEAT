import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { adjustQuantity, calculateTotal, CartItem } from '../../src/utils/cartCalculator'

/**
 * Feature: voka-seat-system, Property 11: Cart Quantity Adjustment Invariant
 *
 * For any cart item with current quantity Q: increasing quantity SHALL set it to
 * Q+1 (capped at 99); decreasing quantity when Q > 1 SHALL set it to Q-1;
 * decreasing quantity when Q = 1 SHALL remove the item from the cart entirely.
 * After any adjustment, the cart total SHALL be recalculated per Property 10.
 *
 * Validates: Requirements 12.2
 */

/** Generator for a valid CartItem */
const cartItemArb = (id: number): fc.Arbitrary<CartItem> =>
  fc.record({
    id: fc.constant(id),
    menuItemId: fc.integer({ min: 1, max: 100 }),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    quantity: fc.integer({ min: 1, max: 99 }),
    priceAtOrder: fc.integer({ min: 100, max: 100000 }),
  })

/** Generator for a cart with 1-10 items, each with a unique id */
const cartArb: fc.Arbitrary<CartItem[]> = fc
  .integer({ min: 1, max: 10 })
  .chain((size) =>
    fc.tuple(...Array.from({ length: size }, (_, i) => cartItemArb(i + 1)))
  )
  .map((items) => items as unknown as CartItem[])

describe('Feature: voka-seat-system, Property 11: Cart Quantity Adjustment Invariant', () => {
  it('increase always sets quantity to Q+1 (capped at 99)', () => {
    fc.assert(
      fc.property(
        cartArb,
        (cart) => {
          // Pick a random item from the cart to adjust
          const targetItem = cart[0]
          const result = adjustQuantity(cart, targetItem.id, 'increase')
          const updatedItem = result.find((item) => item.id === targetItem.id)

          expect(updatedItem).toBeDefined()
          const expectedQuantity = Math.min(targetItem.quantity + 1, 99)
          expect(updatedItem!.quantity).toBe(expectedQuantity)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('decrease when Q > 1 always sets quantity to Q-1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.integer({ min: 2, max: 99 }),
        fc.integer({ min: 100, max: 100000 }),
        (menuItemId, name, quantity, priceAtOrder) => {
          const cart: CartItem[] = [
            { id: 1, menuItemId, name, quantity, priceAtOrder },
          ]
          const result = adjustQuantity(cart, 1, 'decrease')
          const updatedItem = result.find((item) => item.id === 1)

          expect(updatedItem).toBeDefined()
          expect(updatedItem!.quantity).toBe(quantity - 1)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('decrease when Q = 1 always removes the item from the cart', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.integer({ min: 100, max: 100000 }),
        (menuItemId, name, priceAtOrder) => {
          const cart: CartItem[] = [
            { id: 1, menuItemId, name, quantity: 1, priceAtOrder },
          ]
          const result = adjustQuantity(cart, 1, 'decrease')

          // Item should be removed entirely
          const removedItem = result.find((item) => item.id === 1)
          expect(removedItem).toBeUndefined()
          expect(result.length).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('after any adjustment, calculateTotal returns the correct sum', () => {
    fc.assert(
      fc.property(
        cartArb,
        fc.constantFrom('increase' as const, 'decrease' as const),
        (cart, action) => {
          const targetItem = cart[0]
          const result = adjustQuantity(cart, targetItem.id, action)
          const total = calculateTotal(result)

          // Manually compute expected total
          const expectedTotal = result.reduce(
            (sum, item) => sum + item.quantity * item.priceAtOrder,
            0
          )
          expect(total).toBe(expectedTotal)
        }
      ),
      { numRuns: 100 }
    )
  })
})
