import React from 'react';
import { SeatIndicator } from './SeatIndicator';

export interface TablespaceSeat {
  id: number;
  status: 0 | 1;
  zone: string;
}

export interface TablespaceProps {
  seats: TablespaceSeat[];
}

const Tablespace: React.FC<TablespaceProps> = ({ seats }) => {
  const getSeatStatus = (id: number): 0 | 1 => {
    const seat = seats.find((s) => s.id === id);
    return seat ? seat.status : 0;
  };

  // Zona Atas row structure (per column group)
  const tribuneRows = [
    [11, 12, 12, 13], // Row 1 (front)
    [17, 16, 15, 14], // Row 2
    [18, 19, 20, 20], // Row 3
    [24, 23, 22, 21], // Row 4 (back)
  ];

  // Zona Tengah & Kanan table layout (2×3 grid)
  const tableGrid = [
    [5, 7, 8],   // Top row
    [6, 9, 10],  // Bottom row
  ];

  return (
    <div className="p-8 h-full flex flex-col bg-bg-soft-white min-h-screen">
      {/* Page Header */}
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="font-section-title text-section-title text-text-primary mb-1">Tablespace</h2>
          <p className="font-body text-body text-text-secondary">Real-time Table Order Availability Status</p>
        </div>
        <div className="flex gap-4">
          <button className="px-4 py-2 border-2 border-primary text-primary font-medium rounded-DEFAULT hover:bg-surface-container transition-colors font-body text-body">
            Export Report
          </button>
          <button className="px-4 py-2 bg-primary text-bg-soft-white font-medium rounded-DEFAULT hover:bg-primary-container transition-colors font-body text-body shadow-sm">
            Restock Alert
          </button>
        </div>
      </header>

      {/* Map Card */}
      <div className="bg-bg-soft-white border border-border-soft rounded-lg p-6 shadow-sm flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-card-title text-card-title text-text-primary uppercase tracking-wide">VOKAFE&apos;S MAP</h3>
          {/* Legend */}
          <div className="flex items-center gap-3">
            <span className="font-body text-small-text text-text-secondary">Status</span>
            <div className="flex border border-border-soft rounded overflow-hidden">
              <div className="px-3 py-1 bg-status-occupied text-bg-soft-white font-label text-label flex items-center gap-1">
                Occupied
              </div>
              <div className="px-3 py-1 bg-bg-secondary text-text-primary font-label text-label flex items-center gap-1">
                Available
              </div>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative border border-border-soft rounded-lg p-8 bg-surface-container-lowest flex-1 flex flex-col overflow-hidden">

          {/* ===== ZONA ATAS — Kursi Tangga ===== */}
          <div className="mb-8 border-b border-dashed border-border-soft pb-6">
            <div className="text-center mb-3">
              <span className="font-card-title text-card-title tracking-wider text-text-primary uppercase">Kursi Tangga</span>
            </div>
            <div className="flex justify-center gap-6">
              {/* 3 Column Groups */}
              {[0, 1, 2].map((groupIdx) => (
                <div
                  key={groupIdx}
                  className="border border-border-soft rounded p-3 bg-white"
                  data-testid={`tribune-group-${groupIdx}`}
                >
                  <div className="flex flex-col gap-2">
                    {tribuneRows.map((row, rowIdx) => (
                      <div key={rowIdx} className="flex gap-2" data-testid={`tribune-row-${rowIdx}`}>
                        {row.map((seatId, colIdx) => (
                          <SeatIndicator
                            key={`${groupIdx}-${rowIdx}-${colIdx}`}
                            seatId={seatId}
                            status={getSeatStatus(seatId)}
                            size="sm"
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
          <div className="flex flex-1 gap-6">

            {/* ===== ZONA KIRI — Barista dan Kasir ===== */}
            <div className="flex gap-4" data-testid="zona-kiri">
              {/* Barista Label Block */}
              <div className="w-20 bg-[#E2E8F0] border border-[#CBD5E1] rounded flex items-center justify-center relative min-h-[280px]">
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap text-[#64748B] font-label text-label tracking-widest">
                  BARISTA DAN KASIR
                </span>
              </div>
              {/* Seats 1-4 vertically */}
              <div className="flex flex-col gap-4 justify-center">
                {[1, 2, 3, 4].map((seatId) => (
                  <div key={seatId} className="flex items-center gap-2">
                    <SeatIndicator
                      seatId={seatId}
                      status={getSeatStatus(seatId)}
                      size="md"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ===== ZONA TENGAH & KANAN — Meja Beton ===== */}
            <div className="flex-1 flex flex-col justify-center" data-testid="zona-tengah-kanan">
              <div className="text-center mb-4">
                <span className="font-card-title text-card-title tracking-wider text-text-primary uppercase">Meja Beton</span>
              </div>
              <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto w-full">
                {tableGrid.map((row) =>
                  row.map((tableId) => (
                    <div
                      key={tableId}
                      className="flex flex-col items-center gap-1"
                      data-testid={`meja-${tableId}`}
                    >
                      {/* Top 2 sensor positions */}
                      <div className="flex gap-2">
                        <SeatIndicator
                          seatId={tableId}
                          status={getSeatStatus(tableId)}
                          size="sm"
                        />
                        <SeatIndicator
                          seatId={tableId}
                          status={getSeatStatus(tableId)}
                          size="sm"
                        />
                      </div>
                      {/* Table surface */}
                      <div className="w-24 h-14 bg-[#926019] flex items-center justify-center text-white font-body text-body rounded-sm shadow-sm">
                        Meja {tableId}
                      </div>
                      {/* Bottom 2 sensor positions */}
                      <div className="flex gap-2">
                        <SeatIndicator
                          seatId={tableId}
                          status={getSeatStatus(tableId)}
                          size="sm"
                        />
                        <SeatIndicator
                          seatId={tableId}
                          status={getSeatStatus(tableId)}
                          size="sm"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Bottom Label */}
          <div className="mt-6 text-center border-t border-dashed border-border-soft pt-4">
            <span className="text-[#94A3B8] tracking-[0.3em] font-label text-sm uppercase">JALAN UTAMA</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Tablespace;
