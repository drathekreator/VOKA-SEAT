import { describe, it, expect } from 'vitest';
import { calculateSalesTrend, rankPeakHours } from '../../src/services/analyticsService';

describe('analyticsService', () => {
  describe('calculateSalesTrend', () => {
    it('returns percentage change when previous > 0', () => {
      // (150 - 100) / 100 * 100 = 50.0
      expect(calculateSalesTrend(150, 100)).toBe(50);
    });

    it('returns negative percentage when current < previous', () => {
      // (80 - 100) / 100 * 100 = -20.0
      expect(calculateSalesTrend(80, 100)).toBe(-20);
    });

    it('returns 0 when current equals previous', () => {
      expect(calculateSalesTrend(100, 100)).toBe(0);
    });

    it('rounds to 1 decimal place', () => {
      // (133 - 100) / 100 * 100 = 33.0
      expect(calculateSalesTrend(133, 100)).toBe(33);
      // (1 - 3) / 3 * 100 = -66.6666... → -66.7
      expect(calculateSalesTrend(1, 3)).toBe(-66.7);
    });

    it('returns "+100%" when previous is 0 and current > 0', () => {
      expect(calculateSalesTrend(50, 0)).toBe('+100%');
      expect(calculateSalesTrend(1, 0)).toBe('+100%');
    });

    it('returns 0 when both current and previous are 0', () => {
      expect(calculateSalesTrend(0, 0)).toBe(0);
    });
  });

  describe('rankPeakHours', () => {
    it('returns top 3 hours sorted by avgOccupancy descending', () => {
      const data = [
        { hour: 8, avgOccupancy: 30 },
        { hour: 12, avgOccupancy: 90 },
        { hour: 14, avgOccupancy: 85 },
        { hour: 18, avgOccupancy: 70 },
        { hour: 20, avgOccupancy: 40 },
      ];

      const result = rankPeakHours(data);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ hour: 12, avgOccupancy: 90 });
      expect(result[1]).toEqual({ hour: 14, avgOccupancy: 85 });
      expect(result[2]).toEqual({ hour: 18, avgOccupancy: 70 });
    });

    it('returns fewer than 3 if less data available', () => {
      const data = [
        { hour: 10, avgOccupancy: 50 },
        { hour: 15, avgOccupancy: 60 },
      ];

      const result = rankPeakHours(data);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ hour: 15, avgOccupancy: 60 });
      expect(result[1]).toEqual({ hour: 10, avgOccupancy: 50 });
    });

    it('returns empty array when no data has occupancy', () => {
      const data = [
        { hour: 8, avgOccupancy: 0 },
        { hour: 9, avgOccupancy: 0 },
      ];

      const result = rankPeakHours(data);
      expect(result).toHaveLength(0);
    });

    it('returns empty array for empty input', () => {
      const result = rankPeakHours([]);
      expect(result).toHaveLength(0);
    });

    it('filters out entries with zero occupancy', () => {
      const data = [
        { hour: 8, avgOccupancy: 0 },
        { hour: 10, avgOccupancy: 50 },
        { hour: 12, avgOccupancy: 0 },
        { hour: 14, avgOccupancy: 80 },
      ];

      const result = rankPeakHours(data);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ hour: 14, avgOccupancy: 80 });
      expect(result[1]).toEqual({ hour: 10, avgOccupancy: 50 });
    });

    it('returns exactly 3 when input has exactly 3 valid entries', () => {
      const data = [
        { hour: 9, avgOccupancy: 20 },
        { hour: 11, avgOccupancy: 60 },
        { hour: 15, avgOccupancy: 40 },
      ];

      const result = rankPeakHours(data);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ hour: 11, avgOccupancy: 60 });
      expect(result[1]).toEqual({ hour: 15, avgOccupancy: 40 });
      expect(result[2]).toEqual({ hour: 9, avgOccupancy: 20 });
    });
  });
});
