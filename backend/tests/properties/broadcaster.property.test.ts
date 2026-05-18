import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { broadcastSeatUpdate } from '../../src/websocket/broadcaster';

/**
 * Feature: voka-seat-system, Property 4: WebSocket Broadcast Payload Invariant
 *
 * For any seat_update event emitted by the WebSocket broadcaster,
 * the event payload SHALL contain a seat identifier (integer in range 1–24)
 * and a status value (exactly 0 or 1).
 *
 * **Validates: Requirements 5.2**
 */
describe('Feature: voka-seat-system, Property 4: WebSocket Broadcast Payload Invariant', () => {
  const seatIdArb = fc.integer({ min: 1, max: 24 });
  const statusArb = fc.constantFrom(0, 1);

  it('emitted payload always contains id in [1,24] and status in {0,1}', () => {
    fc.assert(
      fc.property(seatIdArb, statusArb, (id, status) => {
        const mockIo = { emit: vi.fn() } as any;

        broadcastSeatUpdate(mockIo, {
          id,
          status,
          updatedAt: new Date(),
        });

        expect(mockIo.emit).toHaveBeenCalledTimes(1);
        const [event, payload] = mockIo.emit.mock.calls[0];

        expect(event).toBe('seat_update');
        expect(payload.id).toBeGreaterThanOrEqual(1);
        expect(payload.id).toBeLessThanOrEqual(24);
        expect([0, 1]).toContain(payload.status);
      }),
      { numRuns: 100 }
    );
  });

  it('emitted payload always contains an updatedAt string field', () => {
    fc.assert(
      fc.property(seatIdArb, statusArb, (id, status) => {
        const mockIo = { emit: vi.fn() } as any;

        broadcastSeatUpdate(mockIo, {
          id,
          status,
          updatedAt: new Date(),
        });

        const [, payload] = mockIo.emit.mock.calls[0];

        expect(typeof payload.updatedAt).toBe('string');
        expect(payload.updatedAt.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('emitted payload shape is always { id: number, status: number, updatedAt: string }', () => {
    fc.assert(
      fc.property(seatIdArb, statusArb, (id, status) => {
        const mockIo = { emit: vi.fn() } as any;

        broadcastSeatUpdate(mockIo, {
          id,
          status,
          updatedAt: new Date(),
        });

        const [, payload] = mockIo.emit.mock.calls[0];

        // Verify exact shape: only id, status, updatedAt keys
        const keys = Object.keys(payload).sort();
        expect(keys).toEqual(['id', 'status', 'updatedAt']);

        // Verify types
        expect(typeof payload.id).toBe('number');
        expect(typeof payload.status).toBe('number');
        expect(typeof payload.updatedAt).toBe('string');
      }),
      { numRuns: 100 }
    );
  });
});
