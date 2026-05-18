import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSeats } from '../../src/hooks/useSeats';
import { io } from 'socket.io-client';

// Mock socket.io-client
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockDisconnect = vi.fn();

const mockSocket = {
  on: mockOn,
  off: mockOff,
  disconnect: mockDisconnect,
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useSeats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOn.mockImplementation(() => mockSocket);
    mockOff.mockImplementation(() => mockSocket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return initial state with empty seats, disconnected, and no error', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useSeats());

    expect(result.current.seats).toEqual([]);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should fetch initial seats from API on mount', async () => {
    const mockSeats = [
      { id: 1, status: 0, zone: 'left', updatedAt: '2024-01-01T00:00:00Z' },
      { id: 2, status: 1, zone: 'left', updatedAt: '2024-01-01T00:00:00Z' },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSeats,
    });

    const { result } = renderHook(() => useSeats());

    await waitFor(() => {
      expect(result.current.seats).toEqual(mockSeats);
    });

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/api/seats');
  });

  it('should set error when initial fetch fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useSeats());

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch seats: 500');
    });
  });

  it('should set error when fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSeats());

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });

  it('should register socket event listeners on mount', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    renderHook(() => useSeats());

    const registeredEvents = mockOn.mock.calls.map((call) => call[0]);
    expect(registeredEvents).toContain('connect');
    expect(registeredEvents).toContain('disconnect');
    expect(registeredEvents).toContain('all_seats');
    expect(registeredEvents).toContain('seat_update');
    expect(registeredEvents).toContain('error');
  });

  it('should set isConnected to true on socket connect event', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useSeats());

    // Find the connect handler and call it
    const connectCall = mockOn.mock.calls.find((call) => call[0] === 'connect');
    expect(connectCall).toBeDefined();

    act(() => {
      connectCall![1]();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('should set isConnected to false on socket disconnect event', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useSeats());

    // First connect
    const connectCall = mockOn.mock.calls.find((call) => call[0] === 'connect');
    act(() => {
      connectCall![1]();
    });
    expect(result.current.isConnected).toBe(true);

    // Then disconnect
    const disconnectCall = mockOn.mock.calls.find((call) => call[0] === 'disconnect');
    act(() => {
      disconnectCall![1]();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('should update seats when all_seats event is received', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const allSeats = [
      { id: 1, status: 0, zone: 'left', updatedAt: '2024-01-01T00:00:00Z' },
      { id: 5, status: 1, zone: 'center', updatedAt: '2024-01-01T00:00:00Z' },
    ];

    const { result } = renderHook(() => useSeats());

    const allSeatsCall = mockOn.mock.calls.find((call) => call[0] === 'all_seats');
    expect(allSeatsCall).toBeDefined();

    act(() => {
      allSeatsCall![1](allSeats);
    });

    expect(result.current.seats).toEqual(allSeats);
  });

  it('should update a single seat when seat_update event is received', async () => {
    const initialSeats = [
      { id: 1, status: 0 as const, zone: 'left', updatedAt: '2024-01-01T00:00:00Z' },
      { id: 2, status: 0 as const, zone: 'left', updatedAt: '2024-01-01T00:00:00Z' },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => initialSeats,
    });

    const { result } = renderHook(() => useSeats());

    await waitFor(() => {
      expect(result.current.seats).toEqual(initialSeats);
    });

    const seatUpdateCall = mockOn.mock.calls.find((call) => call[0] === 'seat_update');
    expect(seatUpdateCall).toBeDefined();

    act(() => {
      seatUpdateCall![1]({ id: 1, status: 1, updatedAt: '2024-01-01T01:00:00Z' });
    });

    expect(result.current.seats[0].status).toBe(1);
    expect(result.current.seats[0].updatedAt).toBe('2024-01-01T01:00:00Z');
    // Seat 2 should remain unchanged
    expect(result.current.seats[1].status).toBe(0);
  });

  it('should set error when socket error event is received', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useSeats());

    const errorCall = mockOn.mock.calls.find((call) => call[0] === 'error');
    expect(errorCall).toBeDefined();

    act(() => {
      errorCall![1]({ message: 'Database unreachable' });
    });

    expect(result.current.error).toBe('Database unreachable');
  });

  it('should clear error on reconnect', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useSeats());

    // Simulate error
    const errorCall = mockOn.mock.calls.find((call) => call[0] === 'error');
    act(() => {
      errorCall![1]({ message: 'Connection lost' });
    });
    expect(result.current.error).toBe('Connection lost');

    // Simulate reconnect
    const connectCall = mockOn.mock.calls.find((call) => call[0] === 'connect');
    act(() => {
      connectCall![1]();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isConnected).toBe(true);
  });

  it('should cleanup socket on unmount', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { unmount } = renderHook(() => useSeats());

    unmount();

    expect(mockOff).toHaveBeenCalledWith('connect');
    expect(mockOff).toHaveBeenCalledWith('disconnect');
    expect(mockOff).toHaveBeenCalledWith('all_seats');
    expect(mockOff).toHaveBeenCalledWith('seat_update');
    expect(mockOff).toHaveBeenCalledWith('error');
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should create socket with correct reconnection config', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    renderHook(() => useSeats());

    expect(io).toHaveBeenCalledWith('http://localhost:4000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  });
});
