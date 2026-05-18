import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Seat {
  id: number;
  status: 0 | 1;
  zone: string;
  updatedAt: string;
}

interface UseSeatsReturn {
  seats: Seat[];
  isConnected: boolean;
  error: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function useSeats(): UseSeatsReturn {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const updateSeat = useCallback((update: { id: number; status: number; updatedAt?: string }) => {
    setSeats((prev) => {
      const index = prev.findIndex((s) => s.id === update.id);
      if (index === -1) return prev;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        status: update.status as 0 | 1,
        updatedAt: update.updatedAt || new Date().toISOString(),
      };
      return updated;
    });
  }, []);

  useEffect(() => {
    // Fetch initial seat state from REST API
    const fetchSeats = async () => {
      try {
        const response = await fetch(`${API_URL}/api/seats`);
        if (!response.ok) {
          throw new Error(`Failed to fetch seats: ${response.status}`);
        }
        const data: Seat[] = await response.json();
        setSeats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch initial seat data');
      }
    };

    fetchSeats();

    // Connect to Socket.IO server
    const socket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('all_seats', (data: Seat[]) => {
      setSeats(data);
    });

    socket.on('seat_update', (data: { id: number; status: number; updatedAt?: string }) => {
      updateSeat(data);
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    // Cleanup on unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('all_seats');
      socket.off('seat_update');
      socket.off('error');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [updateSeat]);

  return { seats, isConnected, error };
}
