import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createSeatsRouter } from '../../src/routes/seats';

describe('seats REST API', () => {
  const mockFindMany = vi.fn();
  const mockFindUnique = vi.fn();
  const mockPrisma = {
    seat: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
    },
  } as any;

  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/seats', createSeatsRouter(mockPrisma));
  });

  describe('GET /api/seats', () => {
    it('returns all 24 seats ordered by id', async () => {
      const mockSeats = [
        { id: 1, status: 0, zone: 'left', updatedAt: new Date('2024-01-01') },
        { id: 2, status: 1, zone: 'left', updatedAt: new Date('2024-01-01') },
        { id: 3, status: 0, zone: 'left', updatedAt: new Date('2024-01-01') },
      ];
      mockFindMany.mockResolvedValue(mockSeats);

      const res = await request(app).get('/api/seats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].id).toBe(1);
      expect(res.body[1].id).toBe(2);
      expect(mockFindMany).toHaveBeenCalledWith({
        orderBy: { id: 'asc' },
        select: { id: true, status: true, zone: true, updatedAt: true },
      });
    });

    it('returns 500 on database error', async () => {
      mockFindMany.mockRejectedValue(new Error('DB connection failed'));

      const res = await request(app).get('/api/seats');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch seats');
    });
  });

  describe('GET /api/seats/:id', () => {
    it('returns a single seat by valid id', async () => {
      const mockSeat = { id: 5, status: 1, zone: 'center', updatedAt: new Date('2024-01-01') };
      mockFindUnique.mockResolvedValue(mockSeat);

      const res = await request(app).get('/api/seats/5');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(5);
      expect(res.body.status).toBe(1);
      expect(res.body.zone).toBe('center');
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 5 },
        select: { id: true, status: true, zone: true, updatedAt: true },
      });
    });

    it('returns 400 for non-integer id', async () => {
      const res = await request(app).get('/api/seats/abc');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Bad Request');
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns 400 for id below 1', async () => {
      const res = await request(app).get('/api/seats/0');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Bad Request');
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns 400 for id above 24', async () => {
      const res = await request(app).get('/api/seats/25');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Bad Request');
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns 400 for floating point id', async () => {
      const res = await request(app).get('/api/seats/3.5');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Bad Request');
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when seat not found in database', async () => {
      mockFindUnique.mockResolvedValue(null);

      const res = await request(app).get('/api/seats/20');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Seat not found');
    });

    it('returns 500 on database error', async () => {
      mockFindUnique.mockRejectedValue(new Error('DB connection failed'));

      const res = await request(app).get('/api/seats/1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch seat');
    });
  });
});
