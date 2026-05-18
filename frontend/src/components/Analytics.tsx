import React, { useState, useEffect, useCallback } from 'react';
import { adminFetch } from '../admin/adminFetch';

interface SalesData {
  currentTotal: number;
  previousTotal: number;
  trendPercentage: number | string;
  period: string;
  message?: string;
}

interface PeakHour {
  hour: number;
  avgOccupancy: number;
}

interface SeatEfficiency {
  zone: string;
  avgOccupancyDuration: number;
  turnoverRate: number;
}

interface OccupancyData {
  peakHours: PeakHour[];
  seatEfficiency: SeatEfficiency[];
  message?: string;
}

const API_BASE = '/api/analytics';

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${suffix}`;
}

function formatZoneLabel(zone: string): string {
  switch (zone) {
    case 'left':
      return 'Left (Barista)';
    case 'center':
      return 'Center (Meja Beton)';
    case 'upper':
      return 'Upper (Kursi Tangga)';
    default:
      return zone;
  }
}

function generateCsvContent(
  salesData: SalesData | null,
  occupancyData: OccupancyData | null,
  period: string
): string {
  const lines: string[] = [];

  // Sales section
  lines.push('Section,Metric,Value');
  lines.push(`Sales,Period,${period}`);
  if (salesData) {
    lines.push(`Sales,Current Total,${salesData.currentTotal}`);
    lines.push(`Sales,Previous Total,${salesData.previousTotal}`);
    lines.push(`Sales,Trend Percentage,${salesData.trendPercentage}`);
  }

  lines.push('');

  // Peak Hours section
  lines.push('Peak Hours');
  lines.push('Rank,Hour,Avg Occupancy (%)');
  if (occupancyData && occupancyData.peakHours.length > 0) {
    occupancyData.peakHours.forEach((ph, idx) => {
      lines.push(`${idx + 1},${formatHour(ph.hour)},${Math.round(ph.avgOccupancy * 100) / 100}`);
    });
  }

  lines.push('');

  // Seat Efficiency section
  lines.push('Seat Efficiency');
  lines.push('Zone,Avg Occupancy Duration (min),Turnover Rate');
  if (occupancyData && occupancyData.seatEfficiency.length > 0) {
    occupancyData.seatEfficiency.forEach((se) => {
      lines.push(`${formatZoneLabel(se.zone)},${se.avgOccupancyDuration},${se.turnoverRate}`);
    });
  }

  return lines.join('\n');
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const Analytics: React.FC = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [salesRes, occupancyRes] = await Promise.all([
        adminFetch(`${API_BASE}/sales?period=${period}`),
        adminFetch(`${API_BASE}/occupancy`),
      ]);

      if (!salesRes.ok || !occupancyRes.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const sales: SalesData = await salesRes.json();
      const occupancy: OccupancyData = await occupancyRes.json();

      setSalesData(sales);
      setOccupancyData(occupancy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCsv = () => {
    const content = generateCsvContent(salesData, occupancyData, period);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCsv(content, `vokafe-analytics-${period}-${timestamp}.csv`);
  };

  const hasNoData =
    salesData?.message === 'No data available' &&
    occupancyData?.message === 'No data available';

  const trendValue =
    salesData && typeof salesData.trendPercentage === 'number'
      ? salesData.trendPercentage
      : null;

  const trendIsPositive = trendValue !== null && trendValue >= 0;
  const trendDisplay =
    salesData?.trendPercentage === '+100%'
      ? '+100%'
      : trendValue !== null
        ? `${trendIsPositive ? '+' : ''}${trendValue.toFixed(1)}%`
        : '0%';

  return (
    <div className="p-container-margin bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="font-section-title text-section-title text-on-background">Analytics</h2>
          <p className="font-body text-body text-on-surface-variant mt-2">
            Sales performance, peak hours, and seat efficiency metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Toggle */}
          <div className="flex bg-surface-container-high rounded-full border border-outline-variant overflow-hidden">
            <button
              onClick={() => setPeriod('daily')}
              className={`px-4 py-2 font-body text-body transition-colors ${
                period === 'daily'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setPeriod('weekly')}
              className={`px-4 py-2 font-body text-body transition-colors ${
                period === 'weekly'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Weekly
            </button>
          </div>
          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={loading || hasNoData}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg hover:bg-secondary-container active:scale-[0.98] transition-all font-body text-body font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">download</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            <span className="font-body text-body">Loading analytics data...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-status-out-of-stock/10 border border-status-out-of-stock/30 rounded-lg p-6 text-center">
          <span className="material-symbols-outlined text-status-out-of-stock text-3xl mb-2">error</span>
          <p className="font-body text-body text-status-out-of-stock">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg font-body text-body hover:bg-secondary-container transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && hasNoData && (
        <div className="bg-surface rounded-lg border border-border-soft p-12 text-center">
          <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-4">
            insert_chart_outlined
          </span>
          <p className="font-card-title text-card-title text-on-background mb-2">
            No data available for the selected period
          </p>
          <p className="font-body text-body text-on-surface-variant">
            Analytics will appear here once orders and seat activity are recorded.
          </p>
        </div>
      )}

      {/* Data Content */}
      {!loading && !error && !hasNoData && (
        <div className="space-y-6">
          {/* Sales Section */}
          <section className="bg-surface rounded-lg border border-border-soft shadow-sm p-6">
            <h3 className="font-card-title text-card-title text-on-background mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">payments</span>
              Sales Overview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Current Total */}
              <div className="bg-surface-container-low rounded-lg p-4 border border-border-soft">
                <p className="font-small-text text-small-text text-on-surface-variant mb-1">
                  Current {period === 'daily' ? 'Day' : 'Week'}
                </p>
                <p className="text-2xl font-bold text-on-background">
                  Rp {salesData?.currentTotal?.toLocaleString('id-ID') ?? '0'}
                </p>
              </div>
              {/* Previous Total */}
              <div className="bg-surface-container-low rounded-lg p-4 border border-border-soft">
                <p className="font-small-text text-small-text text-on-surface-variant mb-1">
                  Previous {period === 'daily' ? 'Day' : 'Week'}
                </p>
                <p className="text-2xl font-bold text-on-background">
                  Rp {salesData?.previousTotal?.toLocaleString('id-ID') ?? '0'}
                </p>
              </div>
              {/* Trend */}
              <div className="bg-surface-container-low rounded-lg p-4 border border-border-soft">
                <p className="font-small-text text-small-text text-on-surface-variant mb-1">
                  Trend
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-2xl font-bold ${
                      trendIsPositive || salesData?.trendPercentage === '+100%'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {trendDisplay}
                  </span>
                  <span
                    className={`material-symbols-outlined ${
                      trendIsPositive || salesData?.trendPercentage === '+100%'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {trendIsPositive || salesData?.trendPercentage === '+100%'
                      ? 'trending_up'
                      : 'trending_down'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Peak Hours Section */}
          <section className="bg-surface rounded-lg border border-border-soft shadow-sm p-6">
            <h3 className="font-card-title text-card-title text-on-background mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">schedule</span>
              Peak Hours (Top 3)
            </h3>
            {occupancyData && occupancyData.peakHours.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {occupancyData.peakHours.map((ph, idx) => (
                  <div
                    key={ph.hour}
                    className="bg-surface-container-low rounded-lg p-4 border border-border-soft flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-bold text-primary">#{idx + 1}</span>
                    </div>
                    <div>
                      <p className="font-card-title text-card-title text-on-background">
                        {formatHour(ph.hour)}
                      </p>
                      <p className="font-small-text text-small-text text-on-surface-variant">
                        {Math.round(ph.avgOccupancy * 100) / 100} avg occupancy
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body text-body text-on-surface-variant">
                No peak hour data available.
              </p>
            )}
          </section>

          {/* Seat Efficiency Section */}
          <section className="bg-surface rounded-lg border border-border-soft shadow-sm p-6">
            <h3 className="font-card-title text-card-title text-on-background mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">chair_alt</span>
              Seat Efficiency by Zone
            </h3>
            {occupancyData && occupancyData.seatEfficiency.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border-soft">
                      <th className="font-label text-label text-on-surface-variant py-3 px-4">
                        Zone
                      </th>
                      <th className="font-label text-label text-on-surface-variant py-3 px-4">
                        Avg Occupancy Duration (min)
                      </th>
                      <th className="font-label text-label text-on-surface-variant py-3 px-4">
                        Turnover Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {occupancyData.seatEfficiency.map((se) => (
                      <tr
                        key={se.zone}
                        className="border-b border-border-soft last:border-b-0 hover:bg-surface-container-low transition-colors"
                      >
                        <td className="font-body text-body text-on-background py-3 px-4">
                          {formatZoneLabel(se.zone)}
                        </td>
                        <td className="font-body text-body text-on-background py-3 px-4">
                          {se.avgOccupancyDuration}
                        </td>
                        <td className="font-body text-body text-on-background py-3 px-4">
                          {se.turnoverRate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="font-body text-body text-on-surface-variant">
                No seat efficiency data available.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default Analytics;
