import { describe, it, expect } from 'vitest';
import { classifyInventoryAlert } from '../../src/utils/inventoryAlert';

describe('classifyInventoryAlert', () => {
  it('returns "red" when quantity is 0', () => {
    expect(classifyInventoryAlert(0, 5)).toBe('red');
    expect(classifyInventoryAlert(0, 0)).toBe('red');
    expect(classifyInventoryAlert(0, 100)).toBe('red');
  });

  it('returns "amber" when 0 < quantity <= minimumThreshold', () => {
    expect(classifyInventoryAlert(1, 5)).toBe('amber');
    expect(classifyInventoryAlert(5, 5)).toBe('amber');
    expect(classifyInventoryAlert(3, 10)).toBe('amber');
    expect(classifyInventoryAlert(1, 1)).toBe('amber');
  });

  it('returns "none" when quantity > minimumThreshold', () => {
    expect(classifyInventoryAlert(6, 5)).toBe('none');
    expect(classifyInventoryAlert(100, 10)).toBe('none');
    expect(classifyInventoryAlert(1, 0)).toBe('none');
  });

  it('handles edge case where threshold is 0 and quantity > 0', () => {
    // quantity > threshold (0), so should be 'none'
    expect(classifyInventoryAlert(1, 0)).toBe('none');
    expect(classifyInventoryAlert(50, 0)).toBe('none');
  });

  it('handles large values correctly', () => {
    expect(classifyInventoryAlert(1000, 999)).toBe('none');
    expect(classifyInventoryAlert(999, 999)).toBe('amber');
    expect(classifyInventoryAlert(0, 9999)).toBe('red');
  });
});
