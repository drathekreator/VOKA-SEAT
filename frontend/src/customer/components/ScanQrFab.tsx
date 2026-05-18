import React, { useEffect, useRef, useState } from 'react';

/**
 * ScanQrFab
 *
 * 56×56 floating action button anchored to the bottom-right of the Customer
 * App Tables view. Tapping it surfaces a transient "Coming soon" toast — no
 * backend QR check-in is initiated during the MVP scope (Requirement 11.13).
 *
 * Layout & styling:
 *   - `fixed bottom-24 right-4`        — sits above the bottom nav (h-16)
 *                                         and above any cart summary bar
 *   - `w-14 h-14 rounded-full`         — 56×56 round button
 *   - `bg-primary text-on-primary`     — Customer_MD3_Tokens primary
 *   - `shadow-[0_8px_24px_rgba(225,29,72,0.3)]` — glow shadow per design
 *   - `active:scale-90`                 — tactile feedback
 *   - Icon: Material Symbols Outlined `qr_code_scanner`
 *
 * Toast:
 *   - Small dark pill positioned just above the FAB
 *   - Auto-dismisses ~2s after the most recent tap. Repeated taps reset the
 *     timer so the toast remains visible if the customer taps in quick
 *     succession.
 *
 * Spec references:
 *   - Requirement 11.12 (FAB anchored bottom-right, primary background, glow)
 *   - Requirement 11.13 (tap shows "Coming soon" toast; no backend call)
 *   - Requirement 18.18 (tactile press feedback)
 *   - design.md "Tables view enhancements"
 */

export interface ScanQrFabProps {
  /**
   * Optional override for the auto-dismiss duration in milliseconds.
   * Defaults to 2000ms. Exposed primarily for tests.
   */
  toastDurationMs?: number;
}

const DEFAULT_TOAST_DURATION_MS = 2000;

export const ScanQrFab: React.FC<ScanQrFabProps> = ({
  toastDurationMs = DEFAULT_TOAST_DURATION_MS,
}) => {
  const [showToast, setShowToast] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Cleanup any pending dismiss timer on unmount so we don't update state
  // after the component has gone away.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleClick = () => {
    setShowToast(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setShowToast(false);
      timerRef.current = null;
    }, toastDurationMs);
  };

  return (
    <>
      {showToast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="scan-qr-toast"
          className="fixed bottom-40 right-4 z-50 bg-[#1b1b1e] text-white text-xs px-3 py-2 rounded-full shadow-md pointer-events-none"
        >
          Coming soon
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        aria-label="Scan QR code"
        data-testid="scan-qr-fab"
        className={[
          'fixed bottom-24 right-4 z-40',
          'w-14 h-14 rounded-full',
          'bg-primary text-on-primary',
          'flex items-center justify-center',
          'shadow-[0_8px_24px_rgba(225,29,72,0.3)]',
          'active:scale-90 transition-transform',
          'border-none cursor-pointer',
        ].join(' ')}
      >
        <span
          className="material-symbols-outlined text-[28px]"
          aria-hidden="true"
          style={{ fontVariationSettings: '"FILL" 1' }}
        >
          qr_code_scanner
        </span>
      </button>
    </>
  );
};

export default ScanQrFab;
