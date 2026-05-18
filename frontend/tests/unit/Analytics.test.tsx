import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Analytics from '../../src/components/Analytics';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

const salesResponse = {
  currentTotal: 1500000,
  previousTotal: 1200000,
  trendPercentage: 25.0,
  period: 'daily',
};

const occupancyResponse = {
  peakHours: [
    { hour: 10, avgOccupancy: 18.5 },
    { hour: 14, avgOccupancy: 15.2 },
    { hour: 9, avgOccupancy: 12.0 },
  ],
  seatEfficiency: [
    { zone: 'left', avgOccupancyDuration: 45.3, turnoverRate: 2.1 },
    { zone: 'center', avgOccupancyDuration: 62.7, turnoverRate: 1.5 },
    { zone: 'upper', avgOccupancyDuration: 38.9, turnoverRate: 3.2 },
  ],
};

function mockSuccessResponses() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/sales')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(salesResponse),
      });
    }
    if (url.includes('/occupancy')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(occupancyResponse),
      });
    }
    return Promise.reject(new Error('Unknown URL'));
  });
}

function mockNoDataResponses() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/sales')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            currentTotal: 0,
            previousTotal: 0,
            trendPercentage: 0,
            period: 'daily',
            message: 'No data available',
          }),
      });
    }
    if (url.includes('/occupancy')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            peakHours: [],
            seatEfficiency: [],
            message: 'No data available',
          }),
      });
    }
    return Promise.reject(new Error('Unknown URL'));
  });
}

describe('Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<Analytics />);
    expect(screen.getByText('Loading analytics data...')).toBeInTheDocument();
  });

  it('displays sales data after successful fetch', async () => {
    mockSuccessResponses();
    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText('Sales Overview')).toBeInTheDocument();
    });

    expect(screen.getByText(/1\.500\.000/)).toBeInTheDocument();
    expect(screen.getByText(/1\.200\.000/)).toBeInTheDocument();
    expect(screen.getByText('+25.0%')).toBeInTheDocument();
  });

  it('displays peak hours section with top 3 time slots', async () => {
    mockSuccessResponses();
    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText('Peak Hours (Top 3)')).toBeInTheDocument();
    });

    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
    expect(screen.getByText('2:00 PM')).toBeInTheDocument();
    expect(screen.getByText('9:00 AM')).toBeInTheDocument();
  });

  it('displays seat efficiency table with zone data', async () => {
    mockSuccessResponses();
    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText('Seat Efficiency by Zone')).toBeInTheDocument();
    });

    expect(screen.getByText('Left (Barista)')).toBeInTheDocument();
    expect(screen.getByText('Center (Meja Beton)')).toBeInTheDocument();
    expect(screen.getByText('Upper (Kursi Tangga)')).toBeInTheDocument();
    expect(screen.getByText('45.3')).toBeInTheDocument();
    expect(screen.getByText('2.1')).toBeInTheDocument();
  });

  it('displays "no data available" message when no data exists', async () => {
    mockNoDataResponses();
    render(<Analytics />);

    await waitFor(() => {
      expect(
        screen.getByText('No data available for the selected period')
      ).toBeInTheDocument();
    });
  });

  it('displays error state when fetch fails', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 500 })
    );
    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch analytics data')).toBeInTheDocument();
    });
  });

  it('toggles between daily and weekly periods', async () => {
    mockSuccessResponses();
    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText('Sales Overview')).toBeInTheDocument();
    });

    // Click weekly button
    fireEvent.click(screen.getByText('Weekly'));

    // Verify fetch was called with weekly period
    await waitFor(() => {
      const calls = mockFetch.mock.calls;
      const lastSalesCall = calls.filter((c: string[]) => c[0].includes('/sales')).pop();
      expect(lastSalesCall?.[0]).toContain('period=weekly');
    });
  });

  it('triggers CSV download when Export CSV button is clicked', async () => {
    mockSuccessResponses();

    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText('Sales Overview')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Export CSV'));

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('shows positive trend with green color and up arrow', async () => {
    mockSuccessResponses();
    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText('+25.0%')).toBeInTheDocument();
    });

    const trendElement = screen.getByText('+25.0%');
    expect(trendElement.className).toContain('text-green-600');
  });

  it('shows negative trend with red color', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/sales')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              currentTotal: 800000,
              previousTotal: 1200000,
              trendPercentage: -33.3,
              period: 'daily',
            }),
        });
      }
      if (url.includes('/occupancy')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(occupancyResponse),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText('-33.3%')).toBeInTheDocument();
    });

    const trendElement = screen.getByText('-33.3%');
    expect(trendElement.className).toContain('text-red-600');
  });

  it('disables Export CSV button when loading', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<Analytics />);

    const exportBtn = screen.getByText('Export CSV');
    expect(exportBtn.closest('button')).toBeDisabled();
  });

  it('includes auth token in fetch headers', async () => {
    // adminFetch reads the JWT from the new admin-keyed storage slot.
    localStorage.setItem('vokafe_admin_jwt', 'test-jwt-token');
    mockSuccessResponses();
    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText('Sales Overview')).toBeInTheDocument();
    });

    const fetchCalls = mockFetch.mock.calls;
    const headers = fetchCalls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-jwt-token');
  });
});
