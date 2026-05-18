import React, { useState, useEffect, useRef } from 'react';
import {
  classifyUrgency,
  getUrgencyTopBarColor,
  getUrgencyBadgeClasses,
  getUrgencyTimerColor,
  formatElapsedTime,
  getElapsedSeconds,
} from '../utils/orderUrgency';

export interface OrderItem {
  id: number;
  name: string;
  quantity: number;
}

export interface Order {
  id: number;
  customerName: string;
  items: OrderItem[];
  createdAt: string;
}

interface OrderQueueProps {
  orders: Order[];
  onAssignTable: (orderId: number) => void;
}

const OrderQueue: React.FC<OrderQueueProps> = ({ orders, onAssignTable }) => {
  const [now, setNow] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update the clock every second for live timers
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Sort orders by waiting time descending (longest first)
  const sortedOrders = [...orders].sort((a, b) => {
    const elapsedA = getElapsedSeconds(a.createdAt, now);
    const elapsedB = getElapsedSeconds(b.createdAt, now);
    return elapsedB - elapsedA;
  });

  return (
    <div className="p-container-margin bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="font-section-title text-section-title text-on-background">Order Queue</h2>
          <p className="font-body text-body text-on-surface-variant mt-2">Manage incoming orders and assign tables.</p>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-full border border-outline-variant shadow-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>pending_actions</span>
          <span className="font-card-title text-card-title text-primary">{orders.length}</span>
          <span className="font-body text-body text-on-surface-variant">Pending</span>
        </div>
      </div>

      {/* Queue Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedOrders.map((order) => {
          const elapsedSeconds = getElapsedSeconds(order.createdAt, now);
          const elapsedMinutes = elapsedSeconds / 60;
          const urgency = classifyUrgency(elapsedMinutes);
          const topBarColor = getUrgencyTopBarColor(urgency);
          const badgeClasses = getUrgencyBadgeClasses(urgency);
          const timerColor = getUrgencyTimerColor(urgency);
          const timerDisplay = formatElapsedTime(elapsedSeconds);

          return (
            <article
              key={order.id}
              className="bg-surface rounded-lg border border-border-soft shadow-sm p-5 flex flex-col gap-4 relative overflow-hidden group hover:shadow-md transition-shadow"
            >
              {/* Top accent bar */}
              <div className={`absolute top-0 left-0 w-full h-1 ${topBarColor}`}></div>

              {/* Header: urgency badge, order ID, customer name, timer */}
              <div className="flex justify-between items-start">
                <div>
                  <span className={`font-label text-label ${badgeClasses} px-2 py-1 rounded-md mb-2 inline-block font-bold tracking-wider`}>
                    {urgency}
                  </span>
                  <h3 className="font-card-title text-card-title text-on-background">#{order.id}</h3>
                  <p className="font-body text-body text-on-surface-variant">{order.customerName}</p>
                </div>
                <div className={`flex items-center gap-1 ${timerColor}`}>
                  <span className="material-symbols-outlined">timer</span>
                  <span className="font-body text-body font-bold">{timerDisplay}</span>
                </div>
              </div>

              {/* Item list */}
              <div className="bg-surface-container-low rounded p-3 border border-border-soft flex-1">
                <ul className="font-small-text text-small-text text-on-background space-y-2">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                      {item.quantity}x {item.name}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Assign Table button */}
              <button
                onClick={() => onAssignTable(order.id)}
                className="w-full bg-primary text-on-primary font-body text-body py-3 rounded-lg hover:bg-secondary-container active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-medium"
              >
                <span className="material-symbols-outlined">chair_alt</span>
                Assign Table
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default OrderQueue;
