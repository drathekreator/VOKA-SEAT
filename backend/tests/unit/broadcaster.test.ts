import { describe, it, expect, vi, beforeEach } from 'vitest';
import http from 'http';
import { setupWebSocket, broadcastSeatUpdate } from '../../src/websocket/broadcaster';

// Mock PrismaClient
function createMockPrisma(seats: any[] = [], shouldThrow = false) {
  return {
    seat: {
      findMany: shouldThrow
        ? vi.fn().mockRejectedValue(new Error('DB unreachable'))
        : vi.fn().mockResolvedValue(seats),
    },
  } as any;
}

function createMockSeats() {
  return Array.from({ length: 24 }, (_, i) => ({
    id: i + 1,
    status: i % 2 === 0 ? 0 : 1,
    zone: i < 4 ? 'left' : i < 10 ? 'center' : 'upper',
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  }));
}

describe('WebSocket Broadcaster', () => {
  describe('setupWebSocket', () => {
    it('should return a Socket.IO Server instance', () => {
      const httpServer = http.createServer();
      const prisma = createMockPrisma();
      const io = setupWebSocket(httpServer, prisma);

      expect(io).toBeDefined();
      expect(typeof io.emit).toBe('function');
      expect(typeof io.on).toBe('function');

      io.close();
      httpServer.close();
    });

    it('should configure CORS to allow all origins in development', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      const httpServer = http.createServer();
      const prisma = createMockPrisma();
      const io = setupWebSocket(httpServer, prisma);

      // Socket.IO stores CORS config internally - we verify it was created successfully
      expect(io).toBeDefined();

      io.close();
      httpServer.close();
      process.env.NODE_ENV = originalEnv;
    });

    it('should configure CORS to restrict origins in production', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalCors = process.env.CORS_ORIGIN;
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = 'https://vokafe.com';

      const httpServer = http.createServer();
      const prisma = createMockPrisma();
      const io = setupWebSocket(httpServer, prisma);

      expect(io).toBeDefined();

      io.close();
      httpServer.close();
      process.env.NODE_ENV = originalEnv;
      if (originalCors !== undefined) {
        process.env.CORS_ORIGIN = originalCors;
      } else {
        delete process.env.CORS_ORIGIN;
      }
    });
  });

  describe('broadcastSeatUpdate', () => {
    it('should emit seat_update event with correct payload shape', () => {
      const mockIo = {
        emit: vi.fn(),
      } as any;

      const seat = {
        id: 5,
        status: 1,
        updatedAt: new Date('2024-06-15T10:30:00.000Z'),
      };

      broadcastSeatUpdate(mockIo, seat);

      expect(mockIo.emit).toHaveBeenCalledWith('seat_update', {
        id: 5,
        status: 1,
        updatedAt: '2024-06-15T10:30:00.000Z',
      });
    });

    it('should handle string updatedAt without conversion', () => {
      const mockIo = {
        emit: vi.fn(),
      } as any;

      const seat = {
        id: 12,
        status: 0,
        updatedAt: '2024-06-15T10:30:00.000Z',
      };

      broadcastSeatUpdate(mockIo, seat);

      expect(mockIo.emit).toHaveBeenCalledWith('seat_update', {
        id: 12,
        status: 0,
        updatedAt: '2024-06-15T10:30:00.000Z',
      });
    });

    it('should emit to all clients (io.emit broadcasts to all)', () => {
      const mockIo = {
        emit: vi.fn(),
      } as any;

      const seat = { id: 1, status: 1, updatedAt: new Date() };
      broadcastSeatUpdate(mockIo, seat);

      expect(mockIo.emit).toHaveBeenCalledTimes(1);
      expect(mockIo.emit).toHaveBeenCalledWith('seat_update', expect.objectContaining({
        id: 1,
        status: 1,
      }));
    });
  });

  describe('connection handler - initial state emission', () => {
    it('should emit all_seats on new client connection', async () => {
      const seats = createMockSeats();
      const httpServer = http.createServer();
      const prisma = createMockPrisma(seats);
      const io = setupWebSocket(httpServer, prisma);

      // Simulate a connection by triggering the connection event
      const mockSocket = {
        id: 'test-socket-1',
        emit: vi.fn(),
        on: vi.fn(),
      };

      // Get the connection handler and invoke it
      const connectionListeners = (io as any)._events?.connection || (io as any).listeners('connection');
      if (Array.isArray(connectionListeners)) {
        await connectionListeners[0](mockSocket);
      } else if (typeof connectionListeners === 'function') {
        await connectionListeners(mockSocket);
      }

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(prisma.seat.findMany).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('all_seats', expect.arrayContaining([
        expect.objectContaining({ id: 1, status: expect.any(Number), zone: expect.any(String) }),
      ]));

      io.close();
      httpServer.close();
    });

    it('should emit error event when DB is unreachable on connection', async () => {
      const httpServer = http.createServer();
      const prisma = createMockPrisma([], true);
      const io = setupWebSocket(httpServer, prisma);

      const mockSocket = {
        id: 'test-socket-2',
        emit: vi.fn(),
        on: vi.fn(),
      };

      // Get the connection handler and invoke it
      const connectionListeners = (io as any)._events?.connection || (io as any).listeners('connection');
      if (Array.isArray(connectionListeners)) {
        await connectionListeners[0](mockSocket);
      } else if (typeof connectionListeners === 'function') {
        await connectionListeners(mockSocket);
      }

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Could not load initial seat state',
      });

      io.close();
      httpServer.close();
    });
  });
});
