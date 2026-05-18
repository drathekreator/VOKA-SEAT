import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { paginateOrders, PaginatedOrder } from '../../src/services/orderService';

/**
 * Feature: voka-seat-system, Property 13: Order History Pagination and Sorting
 *
 * For any authenticated user's order history containing N orders, the system SHALL
 * return at most 20 orders per page, sorted by creation date descending (most recent
 * first). For page P, the returned orders SHALL be items [(P-1)*20 + 1] through
 * [min(P*20, N)] from the fully sorted list.
 *
 * **Validates: Requirements 13.5**
 */
describe('Property 13: Order History Pagination and Sorting', () => {
  // Generator for a list of orders with random createdAt dates
  const orderListArb = fc.array(
    fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(
      (d) => ({ createdAt: d } as PaginatedOrder)
    ),
    { minLength: 0, maxLength: 100 }
  );

  it('each page returns at most 20 items', () => {
    fc.assert(
      fc.property(
        orderListArb,
        fc.integer({ min: 1, max: 10 }),
        (orders, page) => {
          const result = paginateOrders(orders, page);
          expect(result.orders.length).toBeLessThanOrEqual(20);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('orders are always sorted by creation date descending (most recent first)', () => {
    fc.assert(
      fc.property(
        orderListArb.filter((arr) => arr.length > 1),
        fc.integer({ min: 1, max: 10 }),
        (orders, page) => {
          const result = paginateOrders(orders, page);
          for (let i = 1; i < result.orders.length; i++) {
            expect(result.orders[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
              result.orders[i].createdAt.getTime()
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for page P, returns items [(P-1)*20 + 1] through [min(P*20, N)] from the fully sorted list', () => {
    fc.assert(
      fc.property(
        orderListArb.filter((arr) => arr.length > 0),
        (orders) => {
          // Sort the full list descending by createdAt (reference)
          const sorted = [...orders].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
          );

          const totalPages = Math.ceil(orders.length / 20) || 1;

          // Verify each valid page returns the correct slice
          for (let page = 1; page <= totalPages; page++) {
            const result = paginateOrders(orders, page);
            const expectedStart = (page - 1) * 20;
            const expectedEnd = Math.min(page * 20, orders.length);
            const expectedSlice = sorted.slice(expectedStart, expectedEnd);

            expect(result.orders.length).toBe(expectedSlice.length);
            for (let i = 0; i < result.orders.length; i++) {
              expect(result.orders[i].createdAt.getTime()).toBe(
                expectedSlice[i].createdAt.getTime()
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('total pages = ceil(N / 20) or 1 if N = 0', () => {
    fc.assert(
      fc.property(
        orderListArb,
        (orders) => {
          const result = paginateOrders(orders, 1);
          const expected = orders.length === 0 ? 1 : Math.ceil(orders.length / 20);
          expect(result.totalPages).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
