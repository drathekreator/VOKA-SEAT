import { describe, it, expect, vi } from 'vitest';
import { sanitize, sanitizerMiddleware } from '../../src/middleware/sanitizer';
import type { Request, Response, NextFunction } from 'express';

describe('sanitize', () => {
  describe('removes XSS-related characters and sequences', () => {
    it('removes <script> tags', () => {
      expect(sanitize('<script>alert("xss")</script>')).toBe('alert(xss)');
    });

    it('removes <script> tags case-insensitively', () => {
      expect(sanitize('<SCRIPT>alert("xss")</SCRIPT>')).toBe('alert(xss)');
    });

    it('removes < and > characters', () => {
      expect(sanitize('hello <b>world</b>')).toBe('hello bworld/b');
    });

    it('removes angle brackets from HTML-like input', () => {
      expect(sanitize('<img src=x onerror=alert(1)>')).toBe('img src=x onerror=alert(1)');
    });
  });

  describe('removes SQL injection characters', () => {
    it('removes single quotes', () => {
      expect(sanitize("SELECT * FROM users WHERE name = 'admin'")).toBe('SELECT * FROM users WHERE name = admin');
    });

    it('removes double quotes', () => {
      expect(sanitize('DROP TABLE "users"')).toBe('DROP TABLE users');
    });

    it('removes semicolons', () => {
      expect(sanitize('SELECT 1; DROP TABLE users;')).toBe('SELECT 1 DROP TABLE users');
    });

    it('removes SQL comment sequences (--)', () => {
      expect(sanitize('admin-- comment')).toBe('admin comment');
    });
  });

  describe('preserves safe content', () => {
    it('returns empty string for empty input', () => {
      expect(sanitize('')).toBe('');
    });

    it('preserves plain text without dangerous characters', () => {
      expect(sanitize('Hello World 123')).toBe('Hello World 123');
    });

    it('preserves numbers', () => {
      expect(sanitize('12345')).toBe('12345');
    });

    it('preserves spaces and newlines', () => {
      expect(sanitize('line1\nline2\ttab')).toBe('line1\nline2\ttab');
    });

    it('preserves safe special characters', () => {
      expect(sanitize('hello@world.com (test) [array] {object}')).toBe('hello@world.com (test) [array] {object}');
    });
  });

  describe('handles combined dangerous patterns', () => {
    it('removes multiple dangerous sequences in one string', () => {
      const input = "<script>alert('xss')</script>; DROP TABLE users--";
      const result = sanitize(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain("'");
      expect(result).not.toContain(';');
      expect(result).not.toContain('--');
    });
  });
});

describe('sanitizerMiddleware', () => {
  function createMockReq(overrides: Partial<Request> = {}): Request {
    return {
      body: {},
      query: {},
      params: {},
      ...overrides,
    } as unknown as Request;
  }

  const mockRes = {} as Response;
  const mockNext: NextFunction = vi.fn();

  it('calls next() after sanitization', () => {
    const next = vi.fn();
    const req = createMockReq();
    sanitizerMiddleware(req, mockRes, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('sanitizes string values in req.body', () => {
    const req = createMockReq({
      body: { name: '<script>alert("xss")</script>', age: 25 },
    });
    sanitizerMiddleware(req, mockRes, vi.fn());
    expect(req.body.name).toBe('alert(xss)');
    expect(req.body.age).toBe(25);
  });

  it('sanitizes string values in req.query', () => {
    const req = createMockReq({
      query: { search: "admin'; DROP TABLE--" } as any,
    });
    sanitizerMiddleware(req, mockRes, vi.fn());
    expect((req as any).query.search).toBe('admin DROP TABLE');
  });

  it('sanitizes string values in req.params', () => {
    const req = createMockReq({
      params: { id: '1; DROP TABLE' } as any,
    });
    sanitizerMiddleware(req, mockRes, vi.fn());
    expect((req as any).params.id).toBe('1 DROP TABLE');
  });

  it('recursively sanitizes nested objects in req.body', () => {
    const req = createMockReq({
      body: {
        user: {
          name: '<b>Admin</b>',
          bio: "It's a test",
        },
      },
    });
    sanitizerMiddleware(req, mockRes, vi.fn());
    expect(req.body.user.name).toBe('bAdmin/b');
    expect(req.body.user.bio).toBe('Its a test');
  });

  it('recursively sanitizes arrays in req.body', () => {
    const req = createMockReq({
      body: {
        items: ['<script>bad</script>', 'safe text', "it's dangerous;"],
      },
    });
    sanitizerMiddleware(req, mockRes, vi.fn());
    expect(req.body.items[0]).toBe('bad');
    expect(req.body.items[1]).toBe('safe text');
    expect(req.body.items[2]).toBe('its dangerous');
  });

  it('preserves non-string values (numbers, booleans, null)', () => {
    const req = createMockReq({
      body: { count: 42, active: true, data: null },
    });
    sanitizerMiddleware(req, mockRes, vi.fn());
    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
    expect(req.body.data).toBe(null);
  });
});
