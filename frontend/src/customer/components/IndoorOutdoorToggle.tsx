import React from 'react';

/**
 * IndoorOutdoorToggle
 *
 * Segmented control for the Customer App Tables view that lets the customer
 * switch between the Indoor floor plan (default, full 24-seat layout) and
 * a forward-compatible Outdoor placeholder.
 *
 * Track  : `bg-surface-container` (#f0edf1) with `shadow-inner`
 * Active : `bg-surface-container-lowest` (#ffffff) + `shadow-sm` + `text-primary`
 * Idle   : `text-on-surface-variant` (#5c3f40)
 *
 * Tactile feedback: `active:scale-95` on each segment.
 *
 * Spec references:
 *   - Requirement 11.10 (Indoor default; Outdoor placeholder shows "Coming Soon")
 *   - Requirement 18.18 (active:scale tactile feedback)
 *   - design.md "Tables view enhancements"
 */

export type IndoorOutdoorMode = 'indoor' | 'outdoor';

export interface IndoorOutdoorToggleProps {
  /** Currently active segment. Indoor is the spec-default initial value. */
  active: IndoorOutdoorMode;
  /** Invoked with the next segment when the customer taps the inactive one. */
  onChange: (next: IndoorOutdoorMode) => void;
}

const SEGMENTS: ReadonlyArray<{ id: IndoorOutdoorMode; label: string }> = [
  { id: 'indoor', label: 'Indoor' },
  { id: 'outdoor', label: 'Outdoor' },
];

const TRACK_CLASSES =
  'bg-surface-container shadow-inner rounded-lg p-1 flex w-full max-w-sm mx-auto';

const ACTIVE_CLASSES =
  'flex-1 py-2 rounded-md bg-surface-container-lowest shadow-sm ' +
  'text-primary font-label-md text-label-md text-center transition-all ' +
  'active:scale-95';

const IDLE_CLASSES =
  'flex-1 py-2 rounded-md text-on-surface-variant font-label-md text-label-md ' +
  'text-center transition-all hover:bg-surface-container-high active:scale-95';

export const IndoorOutdoorToggle: React.FC<IndoorOutdoorToggleProps> = ({
  active,
  onChange,
}) => {
  return (
    <div
      role="tablist"
      aria-label="Indoor or outdoor seating"
      data-testid="indoor-outdoor-toggle"
      className={TRACK_CLASSES}
    >
      {SEGMENTS.map((segment) => {
        const isActive = active === segment.id;
        return (
          <button
            key={segment.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`indoor-outdoor-segment-${segment.id}`}
            data-active={isActive ? 'true' : 'false'}
            onClick={() => {
              if (!isActive) {
                onChange(segment.id);
              }
            }}
            className={isActive ? ACTIVE_CLASSES : IDLE_CLASSES}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
};

export default IndoorOutdoorToggle;
