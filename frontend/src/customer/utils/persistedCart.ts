/**
 * localStorage-backed persistence for the customer App cart.
 *
 * Cart items live in the URL-less SPA state by default; reloading the
 * page or accidentally swiping back wipes them. This module bridges
 * the cart state to localStorage under a single, versioned key so the
 * cart survives navigation, reloads, and even browser restarts.
 *
 * Storage layout:
 *   localStorage[VOKAFE_CART_STORAGE_KEY] = JSON({ v: 1, items: CartItem[] })
 *
 * The version field future-proofs against breaking shape changes —
 * any cached cart with a mismatched version is dropped on read so the
 * old shape can never crash the deserializer in the running app.
 */

import type { CartItem } from '../../utils/cartCalculator';

export const VOKAFE_CART_STORAGE_KEY = 'vokafe_customer_cart';
const CART_STORAGE_VERSION = 1;

interface PersistedCartShape {
  v: number;
  items: CartItem[];
}

/**
 * Type-guard for the persisted shape. Rejects anything that doesn't
 * look like our exact `{ v: 1, items: CartItem[] }` envelope.
 */
function isPersistedCart(value: unknown): value is PersistedCartShape {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.v !== CART_STORAGE_VERSION) return false;
  if (!Array.isArray(v.items)) return false;
  return v.items.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const it = item as Record<string, unknown>;
    return (
      typeof it.id === 'number' &&
      typeof it.menuItemId === 'number' &&
      typeof it.name === 'string' &&
      typeof it.quantity === 'number' &&
      typeof it.priceAtOrder === 'number'
    );
  });
}

/**
 * Read the persisted cart from localStorage. Returns an empty array on
 * any failure mode (missing key, corrupted JSON, version mismatch) and
 * silently scrubs the bad entry so it doesn't keep failing.
 */
export function loadPersistedCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VOKAFE_CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!isPersistedCart(parsed)) {
      localStorage.removeItem(VOKAFE_CART_STORAGE_KEY);
      return [];
    }
    return parsed.items;
  } catch {
    try {
      localStorage.removeItem(VOKAFE_CART_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return [];
  }
}

/**
 * Persist the cart to localStorage. Empty cart clears the key so
 * stale state isn't left behind after checkout completion.
 */
export function savePersistedCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(VOKAFE_CART_STORAGE_KEY);
      return;
    }
    const envelope: PersistedCartShape = { v: CART_STORAGE_VERSION, items };
    localStorage.setItem(VOKAFE_CART_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Quota errors / privacy mode — silently degrade. The cart still
    // works in-memory; it just won't survive a reload.
  }
}

/**
 * Drop any persisted cart state. Called after successful checkout so
 * the next session doesn't see the just-paid items.
 */
export function clearPersistedCart(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(VOKAFE_CART_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
