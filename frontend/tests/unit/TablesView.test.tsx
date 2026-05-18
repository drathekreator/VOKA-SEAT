import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TablesView from '../../src/customer/views/TablesView';

// Mock the useSeats hook
const mockUseSeats = vi.fn();
vi.mock('../../src/hooks/useSeats', () => ({
  useSeats: () => mockUseSeats(),
}));

function createMockSeats(overrides: Array<{ id: number; status: 0 | 1 }> = []) {
  const seats = [];
  for (let i = 1; i <= 4; i++) seats.push({ id: i, status: 0 as const, zone: 'left', updatedAt: '' });
  for (let i = 5; i <= 10; i++) seats.push({ id: i, status: 0 as const, zone: 'center', updatedAt: '' });
  for (let i = 11; i <= 24; i++) seats.push({ id: i, status: 0 as const, zone: 'upper', updatedAt: '' });

  for (const override of overrides) {
    const seat = seats.find((s) => s.id === override.id);
    if (seat) seat.status = override.status;
  }
  return seats;
}

describe('TablesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSeats.mockReturnValue({
      seats: createMockSeats(),
      isConnected: true,
      error: null,
    });
  });

  it('renders the tables view container', () => {
    render(<TablesView />);
    expect(screen.getByTestId('tables-view')).toBeInTheDocument();
  });

  it('renders the scrollable floor plan container', () => {
    render(<TablesView />);
    expect(screen.getByTestId('floor-plan-container')).toBeInTheDocument();
  });

  it('renders 3 tribune column groups for Zona Atas', () => {
    render(<TablesView />);
    expect(screen.getByTestId('tribune-group-0')).toBeInTheDocument();
    expect(screen.getByTestId('tribune-group-1')).toBeInTheDocument();
    expect(screen.getByTestId('tribune-group-2')).toBeInTheDocument();
  });

  it('renders Zona Kiri section', () => {
    render(<TablesView />);
    expect(screen.getByTestId('zona-kiri')).toBeInTheDocument();
  });

  it('renders Zona Tengah & Kanan section', () => {
    render(<TablesView />);
    expect(screen.getByTestId('zona-tengah-kanan')).toBeInTheDocument();
  });

  it('renders all 6 Meja Beton tables (5-10)', () => {
    render(<TablesView />);
    for (let i = 5; i <= 10; i++) {
      expect(screen.getByTestId(`meja-${i}`)).toBeInTheDocument();
    }
  });

  it('renders seat indicators for seats 1-4 in Zona Kiri', () => {
    render(<TablesView />);
    for (let i = 1; i <= 4; i++) {
      expect(screen.getAllByTestId(`customer-seat-indicator-${i}`).length).toBeGreaterThan(0);
    }
  });

  it('renders Kursi Tangga label', () => {
    render(<TablesView />);
    expect(screen.getByText('Kursi Tangga')).toBeInTheDocument();
  });

  it('renders Meja Beton label', () => {
    render(<TablesView />);
    expect(screen.getByText('Meja Beton')).toBeInTheDocument();
  });

  it('renders BARISTA DAN KASIR label', () => {
    render(<TablesView />);
    expect(screen.getByText('BARISTA DAN KASIR')).toBeInTheDocument();
  });

  it('does NOT show connectivity indicator when connected', () => {
    render(<TablesView />);
    expect(screen.queryByTestId('connectivity-indicator')).not.toBeInTheDocument();
  });

  it('shows connectivity indicator when disconnected', () => {
    mockUseSeats.mockReturnValue({
      seats: createMockSeats(),
      isConnected: false,
      error: null,
    });

    render(<TablesView />);
    const indicator = screen.getByTestId('connectivity-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveTextContent('Live updates unavailable');
  });

  it('renders occupied seats with correct status', () => {
    mockUseSeats.mockReturnValue({
      seats: createMockSeats([{ id: 3, status: 1 }]),
      isConnected: true,
      error: null,
    });

    render(<TablesView />);
    const seatIndicators = screen.getAllByTestId('customer-seat-indicator-3');
    // At least one should show occupied status
    const occupied = seatIndicators.find((el) => el.getAttribute('data-status') === '1');
    expect(occupied).toBeDefined();
  });

  it('renders available seats with correct status', () => {
    render(<TablesView />);
    const seatIndicators = screen.getAllByTestId('customer-seat-indicator-1');
    const available = seatIndicators.find((el) => el.getAttribute('data-status') === '0');
    expect(available).toBeDefined();
  });

  it('floor plan container has overflow-auto for scrollability', () => {
    render(<TablesView />);
    const container = screen.getByTestId('floor-plan-container');
    expect(container.className).toContain('overflow-auto');
  });

  it('floor plan container has touch-pan classes for pannable support', () => {
    render(<TablesView />);
    const container = screen.getByTestId('floor-plan-container');
    expect(container.className).toContain('touch-pan-x');
    expect(container.className).toContain('touch-pan-y');
  });

  it('renders legend with Occupied and Available labels', () => {
    render(<TablesView />);
    expect(screen.getByText('Occupied')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  // ============================================================================
  // Task 18.1 — Indoor/Outdoor toggle, SeatLegend, and ScanQrFab
  // ============================================================================

  it('mounts the SeatLegend component', () => {
    render(<TablesView />);
    expect(screen.getByTestId('seat-legend')).toBeInTheDocument();
    expect(screen.getByTestId('seat-legend-available')).toBeInTheDocument();
    expect(screen.getByTestId('seat-legend-occupied')).toBeInTheDocument();
  });

  it('mounts the IndoorOutdoorToggle with Indoor active by default', () => {
    render(<TablesView />);
    const toggle = screen.getByTestId('indoor-outdoor-toggle');
    expect(toggle).toBeInTheDocument();

    const indoor = screen.getByTestId('indoor-outdoor-segment-indoor');
    const outdoor = screen.getByTestId('indoor-outdoor-segment-outdoor');
    expect(indoor.getAttribute('data-active')).toBe('true');
    expect(outdoor.getAttribute('data-active')).toBe('false');
  });

  it('shows the floor plan and hides the Outdoor placeholder when Indoor is active', () => {
    render(<TablesView />);
    expect(screen.getByTestId('tribune-group-0')).toBeInTheDocument();
    expect(screen.queryByTestId('outdoor-placeholder')).toBeNull();
  });

  it('hides the floor plan and shows the "Coming Soon" placeholder when Outdoor is selected (Requirement 11.10)', () => {
    render(<TablesView />);
    fireEvent.click(screen.getByTestId('indoor-outdoor-segment-outdoor'));

    // Floor plan zones should be gone — no seat indicators rendered (Req 11.10).
    expect(screen.queryByTestId('tribune-group-0')).toBeNull();
    expect(screen.queryByTestId('zona-kiri')).toBeNull();
    expect(screen.queryByTestId('zona-tengah-kanan')).toBeNull();
    expect(screen.queryByTestId('meja-5')).toBeNull();
    expect(screen.queryByTestId('customer-seat-indicator-1')).toBeNull();

    // Placeholder shown.
    const placeholder = screen.getByTestId('outdoor-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder.textContent).toContain('Coming Soon');
  });

  it('switching back to Indoor restores the floor plan', () => {
    render(<TablesView />);
    fireEvent.click(screen.getByTestId('indoor-outdoor-segment-outdoor'));
    expect(screen.queryByTestId('tribune-group-0')).toBeNull();

    fireEvent.click(screen.getByTestId('indoor-outdoor-segment-indoor'));
    expect(screen.getByTestId('tribune-group-0')).toBeInTheDocument();
    expect(screen.queryByTestId('outdoor-placeholder')).toBeNull();
  });

  it('mounts the ScanQrFab on the Tables view (Requirement 11.12)', () => {
    render(<TablesView />);
    expect(screen.getByTestId('scan-qr-fab')).toBeInTheDocument();
  });

  it('keeps the ScanQrFab visible while on the Outdoor placeholder', () => {
    render(<TablesView />);
    fireEvent.click(screen.getByTestId('indoor-outdoor-segment-outdoor'));
    expect(screen.getByTestId('scan-qr-fab')).toBeInTheDocument();
  });
});
