import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sanitize } from '../../src/middleware/sanitizer';

/**
 * Feature: voka-seat-system, Property 14: Input Sanitization
 *
 * For any incoming string input to the backend API, the sanitization function
 * SHALL remove or escape characters that could enable SQL injection or XSS attacks
 * (including but not limited to: `<`, `>`, `'`, `"`, `;`, `--`, `<script>`)
 * before the data reaches the database layer or is broadcast to clients.
 *
 * **Validates: Requirements 15.6**
 */
describe('Property 14: Input Sanitization', () => {
  it('sanitized output never contains < or >', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (input) => {
          const result = sanitize(input);
          expect(result).not.toContain('<');
          expect(result).not.toContain('>');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sanitized output never contains single or double quotes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (input) => {
          const result = sanitize(input);
          expect(result).not.toContain("'");
          expect(result).not.toContain('"');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sanitized output never contains semicolons', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (input) => {
          const result = sanitize(input);
          expect(result).not.toContain(';');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sanitized output never contains SQL comment sequence (--)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (input) => {
          const result = sanitize(input);
          expect(result).not.toContain('--');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sanitized output never contains <script> or </script> tags (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (input) => {
          const result = sanitize(input);
          expect(result.toLowerCase()).not.toContain('<script>');
          expect(result.toLowerCase()).not.toContain('</script>');
        }
      ),
      { numRuns: 100 }
    );
  });
});
