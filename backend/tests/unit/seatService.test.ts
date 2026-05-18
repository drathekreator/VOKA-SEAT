import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertSeat } from '../../src/services/seatService';

describe('seatService', () => {
  const mockUpsert = vi.fn();
  const mockPrisma = {
    seat: {
      upsert: mockUpsert,
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upsertSeat', () => {
    it('upserts a seat with correct parameters for left zone (seat 1-4)', async () => {
      const mockSeat = { id: 2, status: 1, zone: 'left', updatedAt: new Date() };
      mockUpsert.mockResolvedValue(mockSeat);

      const result = await upsertSeat(2, 1, mockPrisma);

      expect(mockUpsert).toHaveBeenCalledWith({
        where: { id: 2 },
        update: { status: 1 },
        create: { id: 2, status: 1, zone: 'left' },
      });
      expect(result).toEqual(mockSeat);
    });

    it('upserts a seat with correct zone for center zone (seat 5-10)', async () => {
      const mockSeat = { id: 7, status: 0, zone: 'center', updatedAt: new Date() };
      mockUpsert.mockResolvedValue(mockSeat);

      const result = await upsertSeat(7, 0, mockPrisma);

      expect(mockUpsert).toHaveBeenCalledWith({
        where: { id: 7 },
        update: { status: 0 },
        create: { id: 7, status: 0, zone: 'center' },
      });
      expect(result).toEqual(mockSeat);
    });

    it('upserts a seat with correct zone for upper zone (seat 11-24)', async () => {
      const mockSeat = { id: 15, status: 1, zone: 'upper', updatedAt: new Date() };
      mockUpsert.mockResolvedValue(mockSeat);

      const result = await upsertSeat(15, 1, mockPrisma);

      expect(mockUpsert).toHaveBeenCalledWith({
        where: { id: 15 },
        update: { status: 1 },
        create: { id: 15, status: 1, zone: 'upper' },
      });
      expect(result).toEqual(mockSeat);
    });

    it('throws on database error', async () => {
      mockUpsert.mockRejectedValue(new Error('Connection refused'));

      await expect(upsertSeat(1, 0, mockPrisma)).rejects.toThrow('Connection refused');
    });

    it('assigns correct zone for boundary seat IDs', async () => {
      // Seat 4 should be "left"
      mockUpsert.mockResolvedValue({ id: 4, status: 0, zone: 'left', updatedAt: new Date() });
      await upsertSeat(4, 0, mockPrisma);
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ zone: 'left' }),
      }));

      vi.clearAllMocks();

      // Seat 5 should be "center"
      mockUpsert.mockResolvedValue({ id: 5, status: 1, zone: 'center', updatedAt: new Date() });
      await upsertSeat(5, 1, mockPrisma);
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ zone: 'center' }),
      }));

      vi.clearAllMocks();

      // Seat 10 should be "center"
      mockUpsert.mockResolvedValue({ id: 10, status: 0, zone: 'center', updatedAt: new Date() });
      await upsertSeat(10, 0, mockPrisma);
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ zone: 'center' }),
      }));

      vi.clearAllMocks();

      // Seat 11 should be "upper"
      mockUpsert.mockResolvedValue({ id: 11, status: 1, zone: 'upper', updatedAt: new Date() });
      await upsertSeat(11, 1, mockPrisma);
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ zone: 'upper' }),
      }));
    });

    it('returns the upserted seat object', async () => {
      const now = new Date();
      const mockSeat = { id: 1, status: 1, zone: 'left', updatedAt: now };
      mockUpsert.mockResolvedValue(mockSeat);

      const result = await upsertSeat(1, 1, mockPrisma);

      expect(result).toEqual({ id: 1, status: 1, zone: 'left', updatedAt: now });
    });
  });
});
