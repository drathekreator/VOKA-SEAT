/**
 * Classifies the alert level for an inventory item based on its
 * current quantity and configured minimum threshold.
 *
 * - 'red': quantity is zero (out of stock)
 * - 'amber': quantity is above zero but at or below the minimum threshold (low stock)
 * - 'none': quantity is above the minimum threshold (adequate stock)
 *
 * @param quantity - Current stock quantity (non-negative integer)
 * @param minimumThreshold - Configured minimum threshold (non-negative integer)
 * @returns Alert classification: 'red' | 'amber' | 'none'
 */
export function classifyInventoryAlert(
  quantity: number,
  minimumThreshold: number
): 'red' | 'amber' | 'none' {
  if (quantity === 0) {
    return 'red';
  }
  if (quantity <= minimumThreshold) {
    return 'amber';
  }
  return 'none';
}
