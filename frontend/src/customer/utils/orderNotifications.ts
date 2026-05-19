/**
 * Browser notification helpers for Customer App order status updates.
 *
 * Usage pattern:
 *   1. On mount of any view that wants to surface status notifications,
 *      call `requestOrderNotificationPermission()`. It's idempotent.
 *   2. When a `order_status_update` arrives via Socket.IO and the order
 *      belongs to the authenticated user, call
 *      `notifyOrderStatusChange(orderId, status, customerName)`.
 *
 * The notification only fires for status transitions that are
 * meaningful to the customer (`preparing`, `ready`). Other transitions
 * (`pending`, `completed`, `cancelled`) are too noisy to be useful as
 * notifications — the in-app pill update is sufficient.
 */

const MEANINGFUL_TRANSITIONS = new Set(['preparing', 'ready']);

const STATUS_TITLE: Record<string, string> = {
  preparing: 'Order is being prepared',
  ready: 'Your order is ready! 🎉',
};

const STATUS_BODY: Record<string, string> = {
  preparing: 'The barista has started on your order.',
  ready: 'Pick it up at the counter or check Tables for your assigned seat.',
};

/**
 * Ask the browser for notification permission. Safe to call multiple
 * times — the browser only shows the prompt once per origin/session.
 *
 * Returns the resulting permission state so callers can decide whether
 * to show fallback UI for `denied`. We swallow errors silently because
 * a missing or denied permission is not a hard failure for the app.
 */
export async function requestOrderNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Fire a browser notification for an order status transition. No-op
 * unless the permission is granted, the runtime supports the
 * Notifications API, and the status is in MEANINGFUL_TRANSITIONS.
 *
 * The visible body string includes the order number so the customer
 * can correlate it with the in-app order history at a glance.
 */
export function notifyOrderStatusChange(
  orderId: number,
  status: string,
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!MEANINGFUL_TRANSITIONS.has(status)) return;

  const title = STATUS_TITLE[status] ?? 'Order update';
  const body = `Order #${orderId}: ${STATUS_BODY[status] ?? status}`;

  try {
    new Notification(title, {
      body,
      icon: '/logos.svg',
      badge: '/logos.svg',
      tag: `voka-order-${orderId}`,        // dedupe per order
      // `renotify: true` is honoured by browsers that support it so
      // the same tag still vibrates / re-shows for repeated transitions.
      ...({ renotify: true } as object),
    });
  } catch {
    // Some browsers (notably iOS Safari at write-time) throw on
    // construction outside a service worker context. Treat as no-op.
  }
}
