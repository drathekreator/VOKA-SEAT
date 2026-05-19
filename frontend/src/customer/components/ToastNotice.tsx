/**
 * Lightweight toast notice for ephemeral feedback in the Customer App.
 *
 * Renders a single dismissible toast at the top-center of the viewport.
 * Auto-dismisses after `durationMs` (default 3000). Multiple
 * simultaneous toasts are NOT supported — the parent owns the queue if
 * needed. For VOKA-SEAT MVP we only need single-shot feedback for
 * "Order saved to account" / "Couldn't save order", so the simpler API
 * is preferred.
 */

import { useEffect } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastNoticeProps {
  /** Toast text. Component renders nothing when `message` is null. */
  message: string | null;
  /** Visual style. Defaults to `info`. */
  variant?: ToastVariant;
  /** Auto-dismiss timeout in ms. Defaults to 3000. */
  durationMs?: number;
  /** Fired when auto-dismiss timer expires or the user taps the close button. */
  onDismiss: () => void;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; icon: string }> = {
  success: { bg: 'bg-emerald-600', icon: 'check_circle' },
  error: { bg: 'bg-rose-600', icon: 'error' },
  info: { bg: 'bg-slate-800', icon: 'info' },
};

export default function ToastNotice({
  message,
  variant = 'info',
  durationMs = 3000,
  onDismiss,
}: ToastNoticeProps) {
  // Auto-dismiss timer. Resets on every new message (so consecutive
  // toasts each get the full duration even if the parent stomps the
  // state quickly).
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  const style = VARIANT_STYLES[variant];
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={`toast-${variant}`}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] ${style.bg} text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm max-w-[90vw]`}
    >
      <span className="material-symbols-outlined text-base" aria-hidden="true">
        {style.icon}
      </span>
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="material-symbols-outlined text-base opacity-80 hover:opacity-100 active:scale-95"
      >
        close
      </button>
    </div>
  );
}
