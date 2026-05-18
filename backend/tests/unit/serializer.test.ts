import { describe, it, expect } from 'vitest';
import { serialize, deserialize, TelemetryPayload } from '../../src/telemetry/serializer';

describe('Telemetry Serializer', () => {
  describe('serialize', () => {
    it('serializes a valid payload to JSON string', () => {
      const payload: TelemetryPayload = { id_kursi: 1, status: 1 };
      const result = serialize(payload);
      expect(result).toBe('{"id_kursi":1,"status":1}');
    });

    it('serialized output does not exceed 128 bytes for valid payloads', () => {
      const payload: TelemetryPayload = { id_kursi: 24, status: 0 };
      const result = serialize(payload);
      expect(Buffer.byteLength(result, 'utf-8')).toBeLessThanOrEqual(128);
    });

    it('only includes id_kursi and status fields', () => {
      const payload: TelemetryPayload = { id_kursi: 5, status: 0 };
      const result = serialize(payload);
      const parsed = JSON.parse(result);
      expect(Object.keys(parsed)).toEqual(['id_kursi', 'status']);
    });
  });

  describe('deserialize', () => {
    it('deserializes a valid JSON string', () => {
      const data = '{"id_kursi":12,"status":1}';
      const result = deserialize(data);
      expect(result).toEqual({ id_kursi: 12, status: 1 });
    });

    it('deserializes a Buffer', () => {
      const data = Buffer.from('{"id_kursi":3,"status":0}', 'utf-8');
      const result = deserialize(data);
      expect(result).toEqual({ id_kursi: 3, status: 0 });
    });

    it('throws on invalid JSON', () => {
      expect(() => deserialize('not json')).toThrow('invalid JSON');
    });

    it('throws on non-object JSON (array)', () => {
      expect(() => deserialize('[1,2]')).toThrow('expected a JSON object');
    });

    it('throws on null JSON', () => {
      expect(() => deserialize('null')).toThrow('expected a JSON object');
    });

    it('throws when id_kursi is not an integer', () => {
      expect(() => deserialize('{"id_kursi":1.5,"status":0}')).toThrow('id_kursi must be an integer');
    });

    it('throws when id_kursi is missing', () => {
      expect(() => deserialize('{"status":0}')).toThrow('id_kursi must be an integer');
    });

    it('throws when status is not an integer', () => {
      expect(() => deserialize('{"id_kursi":1,"status":"on"}')).toThrow('status must be an integer');
    });

    it('throws when status is missing', () => {
      expect(() => deserialize('{"id_kursi":1}')).toThrow('status must be an integer');
    });
  });

  describe('round-trip', () => {
    it('serialize then deserialize produces identical payload', () => {
      const payload: TelemetryPayload = { id_kursi: 15, status: 1 };
      const serialized = serialize(payload);
      const deserialized = deserialize(serialized);
      expect(deserialized).toEqual(payload);
    });

    it('round-trip works for all boundary seat IDs', () => {
      for (const id of [1, 24]) {
        for (const status of [0, 1]) {
          const payload: TelemetryPayload = { id_kursi: id, status };
          const result = deserialize(serialize(payload));
          expect(result).toEqual(payload);
        }
      }
    });
  });
});
