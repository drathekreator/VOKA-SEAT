import { describe, it, expect } from 'vitest';
import {
  classifyUrgency,
  getUrgencyTopBarColor,
  getUrgencyBadgeClasses,
  getUrgencyTimerColor,
  formatElapsedTime,
  getElapsedSeconds,
} from '../../src/utils/orderUrgency';

describe('classifyUrgency', () => {
  it('returns URGENT for elapsed time > 7 minutes', () => {
    expect(classifyUrgency(7.01)).toBe('URGENT');
    expect(classifyUrgency(8)).toBe('URGENT');
    expect(classifyUrgency(15)).toBe('URGENT');
  });

  it('returns WAITING for elapsed time between 3 and 7 minutes (inclusive)', () => {
    expect(classifyUrgency(3)).toBe('WAITING');
    expect(classifyUrgency(5)).toBe('WAITING');
    expect(classifyUrgency(7)).toBe('WAITING');
  });

  it('returns NEW for elapsed time < 3 minutes', () => {
    expect(classifyUrgency(0)).toBe('NEW');
    expect(classifyUrgency(1.5)).toBe('NEW');
    expect(classifyUrgency(2.99)).toBe('NEW');
  });
});

describe('getUrgencyTopBarColor', () => {
  it('returns red color class for URGENT', () => {
    expect(getUrgencyTopBarColor('URGENT')).toBe('bg-status-out-of-stock');
  });

  it('returns amber color class for WAITING', () => {
    expect(getUrgencyTopBarColor('WAITING')).toBe('bg-status-low-stock');
  });

  it('returns primary color class for NEW', () => {
    expect(getUrgencyTopBarColor('NEW')).toBe('bg-primary');
  });
});

describe('getUrgencyBadgeClasses', () => {
  it('returns red badge classes for URGENT', () => {
    expect(getUrgencyBadgeClasses('URGENT')).toContain('text-status-out-of-stock');
  });

  it('returns amber badge classes for WAITING', () => {
    expect(getUrgencyBadgeClasses('WAITING')).toContain('text-status-low-stock');
  });

  it('returns primary badge classes for NEW', () => {
    expect(getUrgencyBadgeClasses('NEW')).toContain('text-primary');
  });
});

describe('getUrgencyTimerColor', () => {
  it('returns red for URGENT', () => {
    expect(getUrgencyTimerColor('URGENT')).toBe('text-status-out-of-stock');
  });

  it('returns amber for WAITING', () => {
    expect(getUrgencyTimerColor('WAITING')).toBe('text-status-low-stock');
  });

  it('returns primary for NEW', () => {
    expect(getUrgencyTimerColor('NEW')).toBe('text-primary');
  });
});

describe('formatElapsedTime', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatElapsedTime(0)).toBe('0:00');
  });

  it('formats 65 seconds as 1:05', () => {
    expect(formatElapsedTime(65)).toBe('1:05');
  });

  it('formats 600 seconds as 10:00', () => {
    expect(formatElapsedTime(600)).toBe('10:00');
  });

  it('formats 525 seconds as 8:45', () => {
    expect(formatElapsedTime(525)).toBe('8:45');
  });
});

describe('getElapsedSeconds', () => {
  it('calculates elapsed seconds from a past timestamp', () => {
    const now = new Date('2024-01-01T10:05:00Z');
    const createdAt = '2024-01-01T10:00:00Z';
    expect(getElapsedSeconds(createdAt, now)).toBe(300);
  });

  it('returns 0 for future timestamps', () => {
    const now = new Date('2024-01-01T10:00:00Z');
    const createdAt = '2024-01-01T10:05:00Z';
    expect(getElapsedSeconds(createdAt, now)).toBe(0);
  });

  it('returns 0 for same timestamp', () => {
    const now = new Date('2024-01-01T10:00:00Z');
    const createdAt = '2024-01-01T10:00:00Z';
    expect(getElapsedSeconds(createdAt, now)).toBe(0);
  });
});
