import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignTableDialog } from '../../src/components/AssignTableDialog';

const mockSeats = [
  { id: 1, status: 0 as const, zone: 'left' },
  { id: 2, status: 1 as const, zone: 'left' },
  { id: 3, status: 0 as const, zone: 'left' },
  { id: 5, status: 0 as const, zone: 'center' },
  { id: 6, status: 1 as const, zone: 'center' },
  { id: 11, status: 0 as const, zone: 'upper' },
  { id: 12, status: 1 as const, zone: 'upper' },
];

const allOccupiedSeats = [
  { id: 1, status: 1 as const, zone: 'left' },
  { id: 2, status: 1 as const, zone: 'left' },
  { id: 5, status: 1 as const, zone: 'center' },
  { id: 11, status: 1 as const, zone: 'upper' },
];

describe('AssignTableDialog', () => {
  it('does not render when isOpen is false', () => {
    render(
      <AssignTableDialog
        isOpen={false}
        orderId={1}
        seats={mockSeats}
        onClose={vi.fn()}
        onAssign={vi.fn()}
      />
    );
    expect(screen.queryByTestId('assign-table-dialog')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(
      <AssignTableDialog
        isOpen={true}
        orderId={92}
        seats={mockSeats}
        onClose={vi.fn()}
        onAssign={vi.fn()}
      />
    );
    expect(screen.getByTestId('assign-table-dialog')).toBeInTheDocument();
    expect(screen.getByText('Order #92')).toBeInTheDocument();
  });

  it('shows only available seats (status=0)', () => {
    render(
      <AssignTableDialog
        isOpen={true}
        orderId={1}
        seats={mockSeats}
        onClose={vi.fn()}
        onAssign={vi.fn()}
      />
    );
    // Available seats: 1, 3, 5, 11
    expect(screen.getByTestId('seat-option-1')).toBeInTheDocument();
    expect(screen.getByTestId('seat-option-3')).toBeInTheDocument();
    expect(screen.getByTestId('seat-option-5')).toBeInTheDocument();
    expect(screen.getByTestId('seat-option-11')).toBeInTheDocument();

    // Occupied seats should NOT appear
    expect(screen.queryByTestId('seat-option-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('seat-option-6')).not.toBeInTheDocument();
    expect(screen.queryByTestId('seat-option-12')).not.toBeInTheDocument();
  });

  it('shows "No seats available" when all seats are occupied', () => {
    render(
      <AssignTableDialog
        isOpen={true}
        orderId={1}
        seats={allOccupiedSeats}
        onClose={vi.fn()}
        onAssign={vi.fn()}
      />
    );
    expect(screen.getByTestId('no-seats-message')).toBeInTheDocument();
    expect(screen.getByText('No seats available')).toBeInTheDocument();
  });

  it('groups seats by zone', () => {
    render(
      <AssignTableDialog
        isOpen={true}
        orderId={1}
        seats={mockSeats}
        onClose={vi.fn()}
        onAssign={vi.fn()}
      />
    );
    expect(screen.getByText('Barista dan Kasir')).toBeInTheDocument();
    expect(screen.getByText('Meja Beton')).toBeInTheDocument();
    expect(screen.getByText('Kursi Tangga')).toBeInTheDocument();
  });

  it('calls onAssign with orderId and selected seatId on confirm', () => {
    const onAssign = vi.fn();
    render(
      <AssignTableDialog
        isOpen={true}
        orderId={92}
        seats={mockSeats}
        onClose={vi.fn()}
        onAssign={onAssign}
      />
    );

    // Select seat 5
    fireEvent.click(screen.getByTestId('seat-option-5'));
    // Confirm
    fireEvent.click(screen.getByTestId('assign-table-confirm'));

    expect(onAssign).toHaveBeenCalledWith(92, 5);
  });

  it('confirm button is disabled when no seat is selected', () => {
    render(
      <AssignTableDialog
        isOpen={true}
        orderId={1}
        seats={mockSeats}
        onClose={vi.fn()}
        onAssign={vi.fn()}
      />
    );
    const confirmBtn = screen.getByTestId('assign-table-confirm');
    expect(confirmBtn).toBeDisabled();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <AssignTableDialog
        isOpen={true}
        orderId={1}
        seats={mockSeats}
        onClose={onClose}
        onAssign={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('assign-table-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <AssignTableDialog
        isOpen={true}
        orderId={1}
        seats={mockSeats}
        onClose={onClose}
        onAssign={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('assign-table-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    render(
      <AssignTableDialog
        isOpen={true}
        orderId={1}
        seats={mockSeats}
        onClose={onClose}
        onAssign={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('assign-table-cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
