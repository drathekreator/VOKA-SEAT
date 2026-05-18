/**
 * Analytics Service — Pure functions for sales trend and peak hour calculations.
 * No database access; designed for easy testing.
 */

/**
 * Calculates the sales trend percentage between current and previous period totals.
 *
 * - If previous > 0: returns ((current - previous) / previous) × 100 rounded to 1 decimal
 * - If previous = 0 and current > 0: returns "+100%"
 * - If both are 0: returns 0
 *
 * @param current - Current period sales total
 * @param previous - Previous period sales total
 * @returns Trend percentage as a number (rounded to 1 decimal), the string "+100%", or 0
 */
export function calculateSalesTrend(current: number, previous: number): number | string {
  if (previous > 0) {
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }
  if (previous === 0 && current > 0) {
    return '+100%';
  }
  return 0;
}

export interface HourlyOccupancyData {
  hour: number;
  avgOccupancy: number;
}

/**
 * Ranks hourly occupancy data and returns the top 3 peak hours.
 *
 * - Returns top 3 slots ranked by avgOccupancy descending
 * - If fewer than 3 slots have data, returns only those with data
 *
 * @param hourlyData - Array of hourly occupancy records
 * @returns Top 3 (or fewer) peak hour slots sorted by avgOccupancy descending
 */
export function rankPeakHours(
  hourlyData: Array<HourlyOccupancyData>
): Array<HourlyOccupancyData> {
  // Filter out entries with no occupancy data (avgOccupancy <= 0)
  const withData = hourlyData.filter((slot) => slot.avgOccupancy > 0);

  // Sort by avgOccupancy descending
  const sorted = [...withData].sort((a, b) => b.avgOccupancy - a.avgOccupancy);

  // Return top 3 or fewer
  return sorted.slice(0, 3);
}
