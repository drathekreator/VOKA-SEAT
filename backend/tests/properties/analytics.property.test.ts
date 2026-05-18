import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { rankPeakHours, HourlyOccupancyData } from '../../src/services/analyticsService';

/**
 * Feature: voka-seat-system, Property 17: Peak Hour Ranking
 *
 * For any set of hourly occupancy data, the peak hour analysis SHALL return
 * the top 3 time slots ranked by average seat occupancy percentage in descending
 * order. If fewer than 3 slots have data, it SHALL return only those with data.
 *
 * **Validates: Requirements 9.2**
 */
describe('Feature: voka-seat-system, Property 17: Peak Hour Ranking', () => {
  // Generator for a single hourly occupancy entry
  const hourlyEntryArb = fc.record({
    hour: fc.integer({ min: 0, max: 23 }),
    avgOccupancy: fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  });

  // Generator for a dataset of hourly occupancy entries (0 to 24 entries)
  const hourlyDatasetArb = fc.array(hourlyEntryArb, { minLength: 0, maxLength: 24 });

  it('result always has at most 3 entries', () => {
    fc.assert(
      fc.property(hourlyDatasetArb, (hourlyData) => {
        const result = rankPeakHours(hourlyData);
        expect(result.length).toBeLessThanOrEqual(3);
      }),
      { numRuns: 100 }
    );
  });

  it('result is sorted by avgOccupancy descending', () => {
    fc.assert(
      fc.property(hourlyDatasetArb, (hourlyData) => {
        const result = rankPeakHours(hourlyData);
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].avgOccupancy).toBeGreaterThanOrEqual(result[i + 1].avgOccupancy);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('if input has fewer than 3 entries with avgOccupancy > 0, result has that many entries', () => {
    fc.assert(
      fc.property(hourlyDatasetArb, (hourlyData) => {
        const withData = hourlyData.filter((slot) => slot.avgOccupancy > 0);
        const result = rankPeakHours(hourlyData);
        const expectedCount = Math.min(withData.length, 3);
        expect(result.length).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  it('all entries in result have avgOccupancy > 0', () => {
    fc.assert(
      fc.property(hourlyDatasetArb, (hourlyData) => {
        const result = rankPeakHours(hourlyData);
        for (const entry of result) {
          expect(entry.avgOccupancy).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('result entries are a subset of the input', () => {
    fc.assert(
      fc.property(hourlyDatasetArb, (hourlyData) => {
        const result = rankPeakHours(hourlyData);
        for (const entry of result) {
          const found = hourlyData.some(
            (input) => input.hour === entry.hour && input.avgOccupancy === entry.avgOccupancy
          );
          expect(found).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
