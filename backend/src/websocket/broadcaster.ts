import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

export interface SeatUpdate {
  id: number;
  status: number;
  updatedAt: string;
}

export interface SeatState {
  id: number;
  status: number;
  zone: string;
  updatedAt: Date | string;
}

/**
 * Sets up the Socket.IO WebSocket server with CORS configuration
 * and initial state emission on client connection.
 *
 * - In development: allows all origins
 * - In production: restricts to CORS_ORIGIN env var
 * - On connection: emits `all_seats` with all 24 seat statuses
 * - On DB error during connection: emits `error` event
 */
export function setupWebSocket(httpServer: HttpServer, prisma: PrismaClient): Server {
  // Accept a single origin or a comma-separated list (e.g. customer +
  // admin subdomains). In dev allow all.
  const rawOrigin =
    process.env.NODE_ENV === 'production'
      ? (process.env.CORS_ORIGIN || 'http://localhost:5173')
      : '*';
  const corsOrigin =
    rawOrigin === '*'
      ? '*'
      : rawOrigin.split(',').map((s) => s.trim()).filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', async (socket: Socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);

    try {
      const seats = await prisma.seat.findMany({
        select: {
          id: true,
          status: true,
          zone: true,
          updatedAt: true,
        },
        orderBy: { id: 'asc' },
      });

      const seatPayload: SeatState[] = seats.map((seat) => ({
        id: seat.id,
        status: seat.status,
        zone: seat.zone,
        updatedAt: seat.updatedAt,
      }));

      socket.emit('all_seats', seatPayload);
    } catch (error) {
      console.error('❌ Failed to load initial seat state:', error);
      socket.emit('error', { message: 'Could not load initial seat state' });
    }

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Broadcasts a seat update event to all connected clients.
 * Payload: { id, status, updatedAt }
 */
export function broadcastSeatUpdate(io: Server, seat: { id: number; status: number; updatedAt: Date | string }): void {
  const payload: SeatUpdate = {
    id: seat.id,
    status: seat.status,
    updatedAt: typeof seat.updatedAt === 'string' ? seat.updatedAt : seat.updatedAt.toISOString(),
  };

  io.emit('seat_update', payload);
}
