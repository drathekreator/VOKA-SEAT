import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { serialize, deserialize } from '../../src/telemetry/serializer';

/**
 * Feature: voka-seat-system, Property 2: Telemetry Payload Serialization Round-Trip
 *
 * For any valid seat identifier (integer 1–24) and status value (0 or 1),
 * serializing a TelemetryPayload to JSON and then parsing that JSON back
 * SHALL produce an object with identical id_kursi and status values.
 * The serialized payload SHALL not exceed 128 bytes.
 *
 * **Validates: Requirements 2.3, 16.6**
 */
describe('Feature: voka-seat-system, Property 2: Telemetry Payload Serialization Round-Trip', () => {
  const seatIdArb = fc.integer({ min: 1, max: 24 });
  const statusArb = fc.constantFrom(0, 1);

  it('serialize→deserialize produces identical id_kursi and status values', () => {
    fc.assert(
      fc.property(seatIdArb, statusArb, (id_kursi, status) => {
        const payload = { id_kursi, status };
        const serialized = serialize(payload);
        const deserialized = deserialize(serialized);

        expect(deserialized.id_kursi).toBe(id_kursi);
        expect(deserialized.status).toBe(status);
      }),
      { numRuns: 100 }
    );
  });

  it('serialized output is ≤ 128 bytes for any valid payload', () => {
    fc.assert(
      fc.property(seatIdArb, statusArb, (id_kursi, status) => {
        const payload = { id_kursi, status };
        const serialized = serialize(payload);
        const byteLength = Buffer.byteLength(serialized, 'utf-8');

        expect(byteLength).toBeLessThanOrEqual(128);
      }),
      { numRuns: 100 }
    );
  });

  it('serialized output is always valid JSON', () => {
    fc.assert(
      fc.property(seatIdArb, statusArb, (id_kursi, status) => {
        const payload = { id_kursi, status };
        const serialized = serialize(payload);

        expect(() => JSON.parse(serialized)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });
});
