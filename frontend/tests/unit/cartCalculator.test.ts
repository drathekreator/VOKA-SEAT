import { describe, it, expect } from 'vitest';
import { calculateTotal, adjustQuantity } from '../../src/utils/cartCalculator';
import type { CartItem } from '../../src/utils/cartCalculator';

describe('calculateTotal', () => {
  it('returns 0 for an empty cart', () => {
    expect(calculateTotal([])).toBe(0);
  });

  it('returns correct total for a single item', () => {
    const items: CartItem[] = [
      { id: 1, menuItemId: 10, name: 'Latte', quantity: 2, priceAtOrder: 25000 },
    ];
    expect(calculateTotal(items)).toBe(50000);
  });

  it('returns correct total for multiple items', () => {
    const items: CartItem[] = [
      { id: 1, menuItemId: 10, name: 'Latte', quantity: 2, priceAtOrder: 25000 },
      { id: 2, menuItemId: 11, name: 'Croissant', quantity: 3, priceAtOrder: 15000 },
    ];
    expect(calculateTotal(items)).toBe(95000);
  });
});

describe('adjustQuantity', () => {
  const baseItems: CartItem[] = [
    { id: 1, menuItemId: 10, name: 'Latte', quantity: 3, priceAtOrder: 25000 },
    { id: 2, menuItemId: 11, name: 'Croissant', quantity: 1, priceAtOrder: 15000 },
  ];

  it('increases quantity by 1', () => {
    const result = adjustQuantity(baseItems, 1, 'increase');
    expect(result.find((i) => i.id === 1)?.quantity).toBe(4);
  });

  it('caps quantity at 99 on increase', () => {
    const items: CartItem[] = [
      { id: 1, menuItemId: 10, name: 'Latte', quantity: 99, priceAtOrder: 25000 },
    ];
    const result = adjustQuantity(items, 1, 'increase');
    expect(result[0].quantity).toBe(99);
  });

  it('decreases quantity by 1 when quantity > 1', () => {
    const result = adjustQuantity(baseItems, 1, 'decrease');
    expect(result.find((i) => i.id === 1)?.quantity).toBe(2);
  });

  it('removes item when quantity is 1 and action is decrease', () => {
    const result = adjustQuantity(baseItems, 2, 'decrease');
    expect(result.find((i) => i.id === 2)).toBeUndefined();
    expect(result.length).toBe(1);
  });

  it('does not mutate the original array', () => {
    const original = [...baseItems];
    adjustQuantity(baseItems, 1, 'increase');
    expect(baseItems).toEqual(original);
  });

  it('returns unchanged array if itemId not found', () => {
    const result = adjustQuantity(baseItems, 999, 'increase');
    expect(result).toEqual(baseItems);
  });
});
