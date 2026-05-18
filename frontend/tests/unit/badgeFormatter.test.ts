import { describe, it, expect } from 'vitest';
import { formatBadge } from '../../src/utils/badgeFormatter';

describe('formatBadge', () => {
  it('returns null for count 0 (badge hidden)', () => {
    expect(formatBadge(0)).toBeNull();
  });

  it('returns null for negative counts', () => {
    expect(formatBadge(-1)).toBeNull();
    expect(formatBadge(-100)).toBeNull();
  });

  it('returns exact count as string for values 1-99', () => {
    expect(formatBadge(1)).toBe('1');
    expect(formatBadge(50)).toBe('50');
    expect(formatBadge(99)).toBe('99');
  });

  it('returns "99+" for counts exceeding 99', () => {
    expect(formatBadge(100)).toBe('99+');
    expect(formatBadge(150)).toBe('99+');
    expect(formatBadge(999)).toBe('99+');
  });
});
