import React from 'react';

export interface SeatIndicatorProps {
  seatId: number;
  status: 0 | 1;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-label',
  lg: 'w-12 h-12 text-sm',
};

export const SeatIndicator: React.FC<SeatIndicatorProps> = ({
  seatId,
  status,
  size = 'md',
}) => {
  const isOccupied = status === 1;

  const baseClasses =
    'flex items-center justify-center font-label rounded transition-all duration-300';

  const statusClasses = isOccupied
    ? 'bg-[#D81B60] text-white shadow-sm'
    : 'bg-[#F3F4F6] border border-[#E5E7EB]';

  return (
    <div
      className={`${baseClasses} ${sizeClasses[size]} ${statusClasses}`}
      data-testid={`seat-indicator-${seatId}`}
      data-status={status}
    >
      {seatId}
    </div>
  );
};

export default SeatIndicator;
