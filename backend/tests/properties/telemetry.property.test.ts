/**
 * Property 3: Telemetry Payload Validation Completeness
 *
 * For any incoming message on the MQTT telemetry topic, the validator SHALL accept
 * the message if and only if: (a) the message is ≤ 256 bytes, (b) it is well-formed JSON,
 * (c) it contains exactly the fields `id_kursi` (integer in [1,24]) and `status` (integer in {0,1}).
 * All other messages SHALL be rejected without persisting.
 *
 * Tag: Feature: voka-seat-system, Property 3: Telemetry Payload Validation Completeness
 * Validates: Requirements 4.1, 4.4, 4.5, 4.6, 16.1, 16.2, 16.3, 16.4, 16.5, 16.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateTelemetryPayload } from '../../src/telemetry/validator';

describe('Feature: voka-seat-system, Property 3: Telemetry Payload Validation Completeness', () => {
  /**
   * Sub-property 1: Any valid payload (id_kursi 1-24, status 0|1, no extra fields) is always accepted
   * Validates: Requirements 4.1, 16.5
   */
  it('should accept any valid payload with id_kursi in [1,24] and status in {0,1}', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 24 }),
        fc.constantFrom(0, 1),
        (idKursi, status) => {
          const message = JSON.stringify({ id_kursi: idKursi, status });
          const result = validateTelemetryPayload(message);
          expect(result.valid).toBe(true);
          if (result.valid) {
            expect(result.payload.id_kursi).toBe(idKursi);
            expect(result.payload.status).toBe(status);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 2: Any message > 256 bytes is always rejected
   * Validates: Requirements 16.7
   */
  it('should reject any message exceeding 256 bytes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 257, max: 1024 }),
        (byteLength) => {
          // Generate a string that exceeds 256 bytes
          const padding = 'x'.repeat(byteLength);
          const message = padding;
          expect(Buffer.byteLength(message, 'utf-8')).toBeGreaterThan(256);
          const result = validateTelemetryPayload(message);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 3: Any non-JSON string is always rejected
   * Validates: Requirements 16.2
   */
  it('should reject any non-JSON string', () => {
    // Generate strings that are not valid JSON
    const nonJsonArb = fc.oneof(
      // Random strings that aren't valid JSON
      fc.string().filter((s) => {
        try {
          JSON.parse(s);
          return false;
        } catch {
          return true;
        }
      }),
      // Strings that look like partial JSON
      fc.constantFrom(
        '{invalid',
        '{"id_kursi": 1, "status":}',
        'not json at all',
        '{id_kursi: 1}',
        "{'id_kursi': 1}",
        '',
        'undefined',
        'NaN'
      )
    );

    fc.assert(
      fc.property(nonJsonArb, (message) => {
        // Ensure message is within 256 bytes so we test JSON parsing, not size
        if (Buffer.byteLength(message, 'utf-8') > 256) return;
        const result = validateTelemetryPayload(message);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 4: Any JSON with id_kursi outside [1,24] is always rejected
   * Validates: Requirements 4.4, 16.4
   */
  it('should reject any payload with id_kursi outside [1,24]', () => {
    const invalidIdArb = fc.oneof(
      fc.integer({ min: -1000, max: 0 }),
      fc.integer({ min: 25, max: 1000 })
    );

    fc.assert(
      fc.property(
        invalidIdArb,
        fc.constantFrom(0, 1),
        (idKursi, status) => {
          const message = JSON.stringify({ id_kursi: idKursi, status });
          const result = validateTelemetryPayload(message);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 5: Any JSON with status not in {0,1} is always rejected
   * Validates: Requirements 4.5, 16.4
   */
  it('should reject any payload with status not in {0,1}', () => {
    const invalidStatusArb = fc.oneof(
      fc.integer({ min: -1000, max: -1 }),
      fc.integer({ min: 2, max: 1000 })
    );

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 24 }),
        invalidStatusArb,
        (idKursi, status) => {
          const message = JSON.stringify({ id_kursi: idKursi, status });
          const result = validateTelemetryPayload(message);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sub-property 6: Any JSON with extra fields is always rejected
   * Validates: Requirements 16.3
   */
  it('should reject any payload with extra fields beyond id_kursi and status', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 24 }),
        fc.constantFrom(0, 1),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s !== 'id_kursi' && s !== 'status'),
        fc.jsonValue(),
        (idKursi, status, extraKey, extraValue) => {
          const payload: Record<string, unknown> = {
            id_kursi: idKursi,
            status,
            [extraKey]: extraValue,
          };
          const message = JSON.stringify(payload);
          // Only test if within 256 bytes
          if (Buffer.byteLength(message, 'utf-8') > 256) return;
          const result = validateTelemetryPayload(message);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
