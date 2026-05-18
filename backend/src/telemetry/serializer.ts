/**
 * Telemetry Payload Serializer
 *
 * Provides serialize/deserialize functions for TelemetryPayload objects.
 * Ensures round-trip consistency and payload size ≤ 128 bytes.
 */

const MAX_PAYLOAD_SIZE = 128;

export interface TelemetryPayload {
  id_kursi: number; // Integer 1-24
  status: number;   // 0 (available) or 1 (occupied)
}

/**
 * Serializes a TelemetryPayload to a JSON string.
 * Throws if the serialized output exceeds 128 bytes.
 */
export function serialize(payload: TelemetryPayload): string {
  const json = JSON.stringify({ id_kursi: payload.id_kursi, status: payload.status });
  const byteLength = Buffer.byteLength(json, 'utf-8');

  if (byteLength > MAX_PAYLOAD_SIZE) {
    throw new Error(
      `Serialized payload exceeds ${MAX_PAYLOAD_SIZE} bytes (got ${byteLength} bytes)`
    );
  }

  return json;
}

/**
 * Deserializes a JSON string or Buffer back to a TelemetryPayload.
 * Throws if the data cannot be parsed or produces invalid fields.
 */
export function deserialize(data: string | Buffer): TelemetryPayload {
  const raw = typeof data === 'string' ? data : data.toString('utf-8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Failed to parse telemetry payload: invalid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Failed to parse telemetry payload: expected a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj['id_kursi'] !== 'number' || !Number.isInteger(obj['id_kursi'])) {
    throw new Error('Invalid telemetry payload: id_kursi must be an integer');
  }

  if (typeof obj['status'] !== 'number' || !Number.isInteger(obj['status'])) {
    throw new Error('Invalid telemetry payload: status must be an integer');
  }

  return {
    id_kursi: obj['id_kursi'] as number,
    status: obj['status'] as number,
  };
}
