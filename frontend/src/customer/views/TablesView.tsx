import React, { useState } from 'react';
import { CustomerSeatIndicator } from '../components/CustomerSeatIndicator';
import IndoorOutdoorToggle, {
  type IndoorOutdoorMode,
} from '../components/IndoorOutdoorToggle';
import SeatLegend from '../components/SeatLegend';
import ScanQrFab from '../components/ScanQrFab';
import { useSeats } from '../../hooks/useSeats';

/**
 * TablesView — Customer App live seat availability map.
 *
 * Layout chrome (task 18.1):
 *   - `IndoorOutdoorToggle` at the top — Indoor is the default active state.
 *   - `SeatLegend` (mint Available + magenta Occupied) below the toggle.
 *   - When Indoor is active, the full Floor Plan Reference is rendered:
 *       - Zona Atas (tribune) — 4 rows × 3 column groups
 *       - Zona Kiri vertical strip with seats 1–4
 *       - Zona Tengah & Kanan — 6 Meja Beton in a 2×3 grid with sensor
 *         positions on top and bottom edges
 *   - When Outdoor is active, a "Coming Soon" placeholder card replaces the
 *     floor plan and NO seat indicators are rendered (Requirement 11.10).
 *   - `ScanQrFab` floats bottom-right on this view only — tap shows a
 *     "Coming soon" toast (Requirement 11.12 / 11.13).
 *
 * Spec references:
 *   - Requirement 11.1 (full 24-seat floor plan in scrollable container)
 *   - Requirement 11.5 (mint-green available, magenta occupied)
 *   - Requirement 11.7 (tribune row structure)
 *   - Requirement 11.8 (Meja Beton 2×3 grid with sensor positions)
 *   - Requirement 11.9 (Zona Kiri vertical strip)
 *   - Requirement 11.10 (Indoor/Outdoor toggle, Outdoor placeholder, no seats)
 *   - Requirement 11.11 (legend below the toggle)
 *   - Requirement 11.12 (QR FAB anchored bottom-right with glow shadow)
 *   - Requirement 11.13 (QR FAB tap shows "Coming soon" toast, no backend)
 */
const TablesView: React.FC = () => {
  const { seats, isConnected } = useSeats();
  const [mode, setMode] = useState<IndoorOutdoorMode>('indoor');

  const getSeatStatus = (id: number): 0 | 1 => {
    const seat = seats.find((s) => s.id === id);
    return seat ? seat.status : 0;
  };

  // Zona Atas row structure (per column group) — same as Admin Tablespace.
  const tribuneRows = [
    [11, 12, 12, 13], // Row 1 (front)
    [17, 16, 15, 14], // Row 2
    [18, 19, 20, 20], // Row 3
    [24, 23, 22, 21], // Row 4 (back)
  ];

  // Zona Tengah & Kanan table layout (2×3 grid).
  const tableGrid = [
    [5, 7, 8], // Top row
    [6, 9, 10], // Bottom row
  ];

  return (
    <div
      className="relative flex flex-col h-full bg-surface-container-lowest"
      data-testid="tables-view"
    >
      {/* Connectivity indicator */}
      {!isConnected && (
        <div
          className="sticky top-0 z-10 bg-error text-on-primary text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-1"
          data-testid="connectivity-indicator"
          role="alert"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            wifi_off
          </span>
          Live updates unavailable — reconnecting…
        </div>
      )}

      {/* Scrollable/pannable floor plan container */}
      <div
        className="flex-1 overflow-auto touch-pan-x touch-pan-y overscroll-contain"
        data-testid="floor-plan-container"
      >
        <div className="min-w-[360px] p-4 pb-8">
          {/* Indoor / Outdoor toggle */}
          <div className="mb-4">
            <IndoorOutdoorToggle active={mode} onChange={setMode} />
          </div>

          {/* Legend */}
          <div className="mb-4">
            <SeatLegend />
          </div>

          {mode === 'outdoor' ? (
            // Requirement 11.10: Outdoor placeholder, no seat indicators.
            <div
              data-testid="outdoor-placeholder"
              className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-8 mt-4 max-w-md mx-auto flex flex-col items-center text-center gap-3"
            >
              <span
                className="material-symbols-outlined text-5xl text-primary"
                aria-hidden="true"
              >
                weekend
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Outdoor seating — Coming Soon
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                We're working on bringing live availability to outdoor seats.
                Check back soon.
              </p>
            </div>
          ) : (
            <>
              {/* ===== ZONA ATAS — Kursi Tangga ===== */}
              <div className="mb-6 border-b border-dashed border-outline-variant pb-4">
                <div className="text-center mb-2">
                  <span className="text-xs font-semibold tracking-wider text-on-surface uppercase">
                    Kursi Tangga
                  </span>
                </div>
                <div className="flex justify-center gap-3">
                  {/* 3 Column Groups */}
                  {[0, 1, 2].map((groupIdx) => (
                    <div
                      key={groupIdx}
                      className="border border-outline-variant rounded p-2 bg-surface-container-lowest"
                      data-testid={`tribune-group-${groupIdx}`}
                    >
                      <div className="flex flex-col gap-1">
                        {tribuneRows.map((row, rowIdx) => (
                          <div
                            key={rowIdx}
                            className="flex gap-1"
                            data-testid={`tribune-row-${rowIdx}`}
                          >
                            {row.map((seatId, colIdx) => (
                              <CustomerSeatIndicator
                                key={`${groupIdx}-${rowIdx}-${colIdx}`}
                                id={seatId}
                                status={getSeatStatus(seatId)}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ===== LOWER SECTION: Zona Kiri + Zona Tengah & Kanan ===== */}
              <div className="flex gap-4">
                {/* ===== ZONA KIRI — Barista dan Kasir ===== */}
                <div className="flex gap-2" data-testid="zona-kiri">
                  {/* Barista Label Block */}
                  <div className="w-12 bg-surface-container border border-outline-variant rounded flex items-center justify-center relative min-h-[200px]">
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap text-on-surface-variant text-[9px] font-semibold tracking-widest">
                      BARISTA DAN KASIR
                    </span>
                  </div>
                  {/* Seats 1-4 vertically */}
                  <div className="flex flex-col gap-3 justify-center">
                    {[1, 2, 3, 4].map((seatId) => (
                      <CustomerSeatIndicator
                        key={seatId}
                        id={seatId}
                        status={getSeatStatus(seatId)}
                      />
                    ))}
                  </div>
                </div>

                {/* ===== ZONA TENGAH & KANAN — Meja Beton ===== */}
                <div
                  className="flex-1 flex flex-col justify-center"
                  data-testid="zona-tengah-kanan"
                >
                  <div className="text-center mb-3">
                    <span className="text-xs font-semibold tracking-wider text-on-surface uppercase">
                      Meja Beton
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto w-full">
                    {tableGrid.map((row) =>
                      row.map((tableId) => (
                        <div
                          key={tableId}
                          className="flex flex-col items-center gap-1"
                          data-testid={`meja-${tableId}`}
                        >
                          {/* Top 2 sensor positions */}
                          <div className="flex gap-1">
                            <CustomerSeatIndicator
                              id={tableId}
                              status={getSeatStatus(tableId)}
                            />
                            <CustomerSeatIndicator
                              id={tableId}
                              status={getSeatStatus(tableId)}
                            />
                          </div>
                          {/* Table surface */}
                          <div className="w-16 h-10 bg-[#926019] flex items-center justify-center text-on-primary text-[10px] font-medium rounded-sm shadow-sm">
                            Meja {tableId}
                          </div>
                          {/* Bottom 2 sensor positions */}
                          <div className="flex gap-1">
                            <CustomerSeatIndicator
                              id={tableId}
                              status={getSeatStatus(tableId)}
                            />
                            <CustomerSeatIndicator
                              id={tableId}
                              status={getSeatStatus(tableId)}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Label */}
              <div className="mt-4 text-center border-t border-dashed border-outline-variant pt-3">
                <span className="text-on-surface-variant tracking-[0.2em] text-[10px] uppercase">
                  JALAN UTAMA
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* QR scanner FAB — only shown on the Tables view (Requirement 11.12). */}
      <ScanQrFab />
    </div>
  );
};

export default TablesView;
