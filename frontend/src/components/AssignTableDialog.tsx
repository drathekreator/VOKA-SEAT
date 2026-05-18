import React, { useState, useMemo } from 'react';
import { filterAvailableSeats } from '../utils/seatFilter';

export interface AssignTableSeat {
  id: number;
  status: 0 | 1;
  zone: string;
}

export interface AssignTableDialogProps {
  isOpen: boolean;
  orderId: number;
  seats: AssignTableSeat[];
  onClose: () => void;
  onAssign: (orderId: number, seatId: number) => void;
}

/** Zone display labels matching the VOKAFE floor plan */
const ZONE_LABELS: Record<string, string> = {
  left: 'Barista dan Kasir',
  center: 'Meja Beton',
  upper: 'Kursi Tangga',
};

/** Zone display order */
const ZONE_ORDER = ['left', 'center', 'upper'];

export const AssignTableDialog: React.FC<AssignTableDialogProps> = ({
  isOpen,
  orderId,
  seats,
  onClose,
  onAssign,
}) => {
  const [selectedSeatId, setSelectedSeatId] = useState<number | null>(null);

  // Filter to only available seats
  const availableSeats = useMemo(() => filterAvailableSeats(seats), [seats]);

  // Group available seats by zone
  const seatsByZone = useMemo(() => {
    const grouped: Record<string, AssignTableSeat[]> = {};
    for (const seat of availableSeats) {
      if (!grouped[seat.zone]) {
        grouped[seat.zone] = [];
      }
      grouped[seat.zone].push(seat);
    }
    return grouped;
  }, [availableSeats]);

  // Sorted zone keys based on defined order
  const sortedZones = useMemo(
    () => ZONE_ORDER.filter((zone) => seatsByZone[zone]?.length > 0),
    [seatsByZone]
  );

  const handleConfirm = () => {
    if (selectedSeatId !== null) {
      onAssign(orderId, selectedSeatId);
      setSelectedSeatId(null);
    }
  };

  const handleClose = () => {
    setSelectedSeatId(null);
    onClose();
  };

  if (!isOpen) return null;

  const noSeatsAvailable = availableSeats.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="assign-table-dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        data-testid="assign-table-backdrop"
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Assign Table</h2>
            <p className="text-sm text-gray-500 mt-0.5">Order #{orderId}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close dialog"
            data-testid="assign-table-close"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {noSeatsAvailable ? (
            <div
              className="flex flex-col items-center justify-center py-10 text-center"
              data-testid="no-seats-message"
            >
              <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H4M12 4v16" />
              </svg>
              <p className="text-gray-600 font-medium">No seats available</p>
              <p className="text-sm text-gray-400 mt-1">All seats are currently occupied.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {sortedZones.map((zone) => (
                <div key={zone}>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                    {ZONE_LABELS[zone] || zone}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {seatsByZone[zone].map((seat) => (
                      <button
                        key={seat.id}
                        onClick={() => setSelectedSeatId(seat.id)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${
                          selectedSeatId === seat.id
                            ? 'bg-[#D81B60] text-white shadow-md scale-105'
                            : 'bg-[#F3F4F6] border border-[#E5E7EB] text-gray-700 hover:border-[#D81B60] hover:text-[#D81B60]'
                        }`}
                        data-testid={`seat-option-${seat.id}`}
                        aria-label={`Seat ${seat.id}`}
                        aria-pressed={selectedSeatId === seat.id}
                      >
                        {seat.id}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-5 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            data-testid="assign-table-cancel"
          >
            Cancel
          </button>
          {!noSeatsAvailable && (
            <button
              onClick={handleConfirm}
              disabled={selectedSeatId === null}
              className="flex-1 py-2.5 px-4 rounded-lg bg-[#D81B60] text-white font-medium hover:bg-[#C2185B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="assign-table-confirm"
            >
              Confirm Assignment
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignTableDialog;
