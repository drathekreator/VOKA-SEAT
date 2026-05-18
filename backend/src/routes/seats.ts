import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

/**
 * Creates the seats REST API router.
 *
 * GET /          — returns all 24 seat statuses with zone info
 * GET /:id       — returns a single seat status by id
 *
 * No authentication required for seat endpoints.
 *
 * @param prisma - PrismaClient instance for database access
 * @returns Express Router
 */
export function createSeatsRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET / — fetch all 24 seats ordered by id
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const seats = await prisma.seat.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, status: true, zone: true, updatedAt: true },
      });
      res.json(seats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch seats' });
    }
  });

  // GET /:id — fetch single seat by id
  router.get('/:id', async (req: Request, res: Response) => {
    const raw = req.params.id;
    const parsed = Number(raw);

    // Validate id is a valid integer in range [1, 24]
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) {
      res.status(400).json({ error: 'Bad Request: id must be an integer between 1 and 24' });
      return;
    }

    try {
      const seat = await prisma.seat.findUnique({
        where: { id: parsed },
        select: { id: true, status: true, zone: true, updatedAt: true },
      });

      if (!seat) {
        res.status(404).json({ error: 'Seat not found' });
        return;
      }

      res.json(seat);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch seat' });
    }
  });

  return router;
}
