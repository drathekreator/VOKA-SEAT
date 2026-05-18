/**
 * Telemetry Payload Validator
 *
 * Validates incoming MQTT telemetry messages from ESP32 sensor nodes.
 * Ensures payloads conform to the expected format before persistence.
 */

export interface TelemetryPayload {
  id_kursi: number;
  status: number;
}

export type ValidationResult =
  | { valid: true; payload: TelemetryPayload }
  | { valid: false; error: string };

const MAX_MESSAGE_BYTES = 256;
const MIN_SEAT_ID = 1;
const MAX_SEAT_ID = 24;
const VALID_STATUSES = [0, 1] as const;
const REQUIRED_FIELDS = ['id_kursi', 'status'] as const;

/**
 * Validates a raw MQTT telemetry message.
 *
 * Validation rules:
 * 1. Message body must not exceed 256 bytes
 * 2. Message body must be valid JSON
 * 3. Must contain exactly `id_kursi` and `status` fields (no extra fields)
 * 4. `id_kursi` must be an integer in range [1, 24]
 * 5. `status` must be exactly 0 or 1 (integer)
 */
export function validateTelemetryPayload(message: Buffer | string): ValidationResult {
  const raw = typeof message === 'string' ? message : message.toString('utf-8');

  // Rule 1: Check message size (byte length, not character length)
  const byteLength = Buffer.byteLength(raw, 'utf-8');
  if (byteLength > MAX_MESSAGE_BYTES) {
    return { valid: false, error: `Message exceeds maximum size of ${MAX_MESSAGE_BYTES} bytes (got ${byteLength} bytes)` };
  }

  // Rule 2: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, error: 'Message is not valid JSON' };
  }

  // Must be a plain object (not null, not array, not primitive)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'Payload must be a JSON object' };
  }

  const obj = parsed as Record<string, unknown>;

  // Rule 3: Check for exactly the required fields (no extra, no missing)
  const keys = Object.keys(obj);
  if (keys.length !== REQUIRED_FIELDS.length) {
    return { valid: false, error: `Payload must contain exactly fields [${REQUIRED_FIELDS.join(', ')}], got [${keys.join(', ')}]` };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  // Rule 4: Validate id_kursi is an integer in [1, 24]
  const idKursi = obj['id_kursi'];
  if (typeof idKursi !== 'number' || !Number.isInteger(idKursi)) {
    return { valid: false, error: `Field "id_kursi" must be an integer, got ${typeof idKursi === 'number' ? idKursi : typeof idKursi}` };
  }
  if (idKursi < MIN_SEAT_ID || idKursi > MAX_SEAT_ID) {
    return { valid: false, error: `Field "id_kursi" must be in range [${MIN_SEAT_ID}, ${MAX_SEAT_ID}], got ${idKursi}` };
  }

  // Rule 5: Validate status is exactly 0 or 1 (integer)
  const status = obj['status'];
  if (typeof status !== 'number' || !Number.isInteger(status)) {
    return { valid: false, error: `Field "status" must be an integer, got ${typeof status === 'number' ? status : typeof status}` };
  }
  if (!VALID_STATUSES.includes(status as 0 | 1)) {
    return { valid: false, error: `Field "status" must be 0 or 1, got ${status}` };
  }

  return {
    valid: true,
    payload: { id_kursi: idKursi, status: status as 0 | 1 },
  };
}
