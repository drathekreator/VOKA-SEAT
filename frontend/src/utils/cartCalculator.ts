/**
 * Cart calculation utilities for the Customer App.
 * Handles total computation and quantity adjustment logic.
 */

/**
 * Represents a single item in the shopping cart.
 */
export interface CartItem {
  id: number;
  menuItemId: number;
  name: string;
  quantity: number;
  priceAtOrder: number;
}

/**
 * Calculate the grand total for all items in the cart.
 * Total = sum of (quantity × priceAtOrder) for each item.
 *
 * @param items - Array of cart items
 * @returns The total amount as a number
 */
export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.priceAtOrder, 0);
}

/**
 * Adjust the quantity of a cart item.
 * - 'increase': Q + 1 (capped at 99)
 * - 'decrease' when Q > 1: Q - 1
 * - 'decrease' when Q = 1: remove item from cart
 *
 * @param items - Current cart items array
 * @param itemId - The id of the cart item to adjust
 * @param action - 'increase' or 'decrease'
 * @returns A new array with the adjusted quantities
 */
export function adjustQuantity(
  items: CartItem[],
  itemId: number,
  action: 'increase' | 'decrease'
): CartItem[] {
  if (action === 'increase') {
    return items.map((item) =>
      item.id === itemId
        ? { ...item, quantity: Math.min(item.quantity + 1, 99) }
        : item
    );
  }

  // action === 'decrease'
  return items.reduce<CartItem[]>((result, item) => {
    if (item.id !== itemId) {
      result.push(item);
    } else if (item.quantity > 1) {
      result.push({ ...item, quantity: item.quantity - 1 });
    }
    // If quantity === 1 and action is decrease, item is removed (not pushed)
    return result;
  }, []);
}
