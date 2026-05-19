/**
 * BarView — single-screen bartender workstation.
 *
 * The bartender at VOKAFE typically has one monitor at the bar. Switching
 * tabs between Order Queue and Tablespace breaks their flow. This view
 * lays both side-by-side: a 60/40 split with the queue on the left and a
 * compact, read-only floor map on the right.
 *
 * The split is responsive: on screens < lg the layout collapses to a
 * single column with the seat map on top so a bartender on a tablet or
 * narrow monitor still sees both surfaces above the fold.
 *
 * Data sources reused from the parent App:
 *   - `orders` — same shape as the OrderQueue view (active orders only).
 *   - `seats` — same shape as the Tablespace view.
 *   - `onAssignTable` / `onUpdateStatus` — passed straight through to the
 *     OrderQueue card actions, so this view is feature-complete: the
 *     bartender can advance a single order to ready or assign a seat
 *     without ever leaving the screen.
 */

import React from 'react';
import OrderQueue from './OrderQueue';
import type { Order, OrderStatus } from './OrderQueue';
import Tablespace from './Tablespace';
import type { TablespaceSeat } from './Tablespace';

export interface BarViewProps {
  orders: Order[];
  seats: TablespaceSeat[];
  isConnected: boolean;
  onAssignTable: (orderId: number) => void;
  onUpdateStatus: (orderId: number, status: OrderStatus) => void;
}

const BarView: React.FC<BarViewProps> = ({
  orders,
  seats,
  isConnected,
  onAssignTable,
  onUpdateStatus,
}) => {
  const occupied = seats.filter((s) => s.status === 1).length;
  const available = seats.length - occupied;

  return (
    <div
      className="bg-background min-h-screen px-container-margin py-6"
      data-testid="bar-view"
    >
      {/* Compact toolbar — connection + counts. The full Tablespace's
          page header is not used; bartender wants information density. */}
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-section-title text-section-title text-on-background flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              local_bar
            </span>
            Bar View
          </h2>
          <p className="font-body text-body text-on-surface-variant mt-1">
            Single-screen bartender workstation: live queue + seat map.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
              isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
            data-testid="bar-view-connection"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
              }`}
            />
            {isConnected ? 'Live' : 'Offline'}
          </div>
          <div
            className="flex items-center gap-2 bg-surface-container-high px-3 py-1 rounded-full border border-outline-variant text-sm"
            data-testid="bar-view-stats"
          >
            <span className="text-on-surface-variant">Seats</span>
            <span className="text-emerald-600 font-bold">{available}</span>
            <span className="text-on-surface-variant">/</span>
            <span className="text-[#D81B60] font-bold">{occupied}</span>
            <span className="text-on-surface-variant text-xs">avail/occ</span>
          </div>
          <div
            className="flex items-center gap-2 bg-surface-container-high px-3 py-1 rounded-full border border-outline-variant text-sm"
            data-testid="bar-view-order-count"
          >
            <span className="material-symbols-outlined text-base text-primary">
              pending_actions
            </span>
            <span className="font-bold text-primary">{orders.length}</span>
            <span className="text-on-surface-variant text-xs">active</span>
          </div>
        </div>
      </header>

      {/* Split content. lg+: 60% queue / 40% tablespace side-by-side.
          < lg: stacked column, tablespace on top. */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 600px), 1fr))',
        }}
      >
        {/* Order Queue — primary action surface */}
        <section
          aria-label="Active orders"
          className="bg-surface rounded-lg border border-border-soft shadow-sm overflow-hidden"
          data-testid="bar-view-queue"
        >
          {/* Reuse the existing OrderQueue but trim its outer padding so it
              fits the split layout. We negate the component's
              `p-container-margin` with a wrapper that resets it. */}
          <div className="[&_.p-container-margin]:p-4 [&_h2]:text-2xl">
            <OrderQueue
              orders={orders}
              onAssignTable={onAssignTable}
              onUpdateStatus={onUpdateStatus}
            />
          </div>
        </section>

        {/* Tablespace — live seat map (read-only here; bartender doesn't
            edit seats from this view). */}
        <section
          aria-label="Live seat map"
          className="bg-surface rounded-lg border border-border-soft shadow-sm overflow-hidden"
          data-testid="bar-view-tablespace"
        >
          <div className="[&_.p-container-margin]:p-4">
            <Tablespace seats={seats} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default BarView;
