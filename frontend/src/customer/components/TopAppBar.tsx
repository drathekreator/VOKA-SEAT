/**
 * Customer_Top_App_Bar
 *
 * Persistent 64px-tall sticky top app bar for the Customer App.
 *
 * Two modes:
 *   1. **Default** — VOKAFE logo on the left, search icon on the right.
 *   2. **Search** — full-width text input with a leading search icon and
 *      a trailing close (×) button. Activated by tapping the search icon
 *      on the Menu tab; dismissed by tapping close or switching tabs.
 *
 * Spec references:
 *   - Requirement 13.13 (display when authenticated)
 *   - Requirement 13.14 (hide when unauthenticated)
 *   - Requirement 18.11 (logo on the left at 32px height)
 */

import { useEffect, useRef } from 'react';

export interface TopAppBarProps {
  isAuthenticated?: boolean;
  /** When true the bar renders a search input instead of the logo. */
  searchMode?: boolean;
  /** Current search query value (controlled). */
  searchQuery?: string;
  /** Fires on every keystroke in the search input. */
  onSearchChange?: (query: string) => void;
  /** Fires when the search icon is tapped (to enter search mode). */
  onSearchClick?: () => void;
  /** Fires when the close button is tapped (to exit search mode). */
  onSearchClose?: () => void;
}

export default function TopAppBar({
  isAuthenticated = true,
  searchMode = false,
  searchQuery = '',
  onSearchChange,
  onSearchClick,
  onSearchClose,
}: TopAppBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when entering search mode.
  useEffect(() => {
    if (searchMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchMode]);

  if (!isAuthenticated) {
    return null;
  }

  // ---- Search mode ----
  if (searchMode) {
    return (
      <header
        role="banner"
        aria-label="VOKAFE search bar"
        data-testid="customer-top-app-bar"
        className="sticky top-0 left-0 right-0 h-16 bg-surface text-on-surface flex items-center gap-sm px-md shadow-sm z-40"
      >
        <span
          className="material-symbols-outlined text-on-surface-variant"
          aria-hidden="true"
        >
          search
        </span>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search menu..."
          aria-label="Search menu"
          data-testid="top-app-bar-search-input"
          className="flex-1 h-10 bg-transparent text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant outline-none border-none"
        />
        <button
          type="button"
          onClick={onSearchClose}
          aria-label="Close search"
          data-testid="top-app-bar-search-close"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-transparent border-none cursor-pointer text-on-surface-variant hover:bg-surface-container-high active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </header>
    );
  }

  // ---- Default mode ----
  return (
    <header
      role="banner"
      aria-label="VOKAFE top app bar"
      data-testid="customer-top-app-bar"
      className="sticky top-0 left-0 right-0 h-16 bg-surface text-on-surface flex items-center justify-between px-md shadow-sm z-40"
    >
      <img
        src="/logo-vokafe.svg"
        alt="VOKAFE"
        className="h-8 w-auto"
        data-testid="top-app-bar-logo"
      />

      <button
        type="button"
        onClick={onSearchClick}
        aria-label="Search"
        data-testid="top-app-bar-search"
        className="flex items-center justify-center w-10 h-10 rounded-full bg-transparent border-none cursor-pointer text-on-surface hover:bg-surface-container-high active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          search
        </span>
      </button>
    </header>
  );
}
