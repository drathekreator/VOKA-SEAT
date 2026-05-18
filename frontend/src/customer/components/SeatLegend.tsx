import React from 'react';

/**
 * SeatLegend
 *
 * Two-entry legend rendered above the Customer App Tables floor plan:
 *   - Mint-green swatch (#6cf8bb) labelled "Available"
 *   - Magenta swatch (#D81B60) labelled "Occupied"
 *
 * Both labels use `text-on-surface-variant text-xs` per the Customer_MD3_Tokens.
 *
 * Implementation note: literal-hex Tailwind arbitrary values are used for the
 * swatches so the colors are verifiable by inspecting `className` directly,
 * mirroring the pattern used by `CustomerSeatIndicator`. This keeps the
 * legend visually correct even if the MD3 Tailwind theme tokens are not in
 * scope at the call site.
 *
 * Spec references:
 *   - Requirement 11.11 (Available + Occupied legend below the toggle)
 *   - design.md "Tables view enhancements"
 */
export const SeatLegend: React.FC = () => {
  return (
    <div
      role="list"
      aria-label="Seat status legend"
      data-testid="seat-legend"
      className="flex items-center justify-center gap-6"
    >
      <div role="listitem" className="flex items-center gap-2" data-testid="seat-legend-available">
        <div
          className="w-3 h-3 rounded bg-[#6cf8bb]"
          aria-hidden="true"
          data-testid="seat-legend-swatch-available"
        />
        <span className="text-on-surface-variant text-xs">Available</span>
      </div>
      <div role="listitem" className="flex items-center gap-2" data-testid="seat-legend-occupied">
        <div
          className="w-3 h-3 rounded bg-[#D81B60]"
          aria-hidden="true"
          data-testid="seat-legend-swatch-occupied"
        />
        <span className="text-on-surface-variant text-xs">Occupied</span>
      </div>
    </div>
  );
};

export default SeatLegend;
