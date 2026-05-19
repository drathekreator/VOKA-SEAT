import { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import Tablespace from './components/Tablespace'
import type { TablespaceSeat } from './components/Tablespace'
import OrderQueue from './components/OrderQueue'
import type { Order, OrderStatus } from './components/OrderQueue'
import Inventory from './components/Inventory'
import Analytics from './components/Analytics'
import AssignTableDialog from './components/AssignTableDialog'
import type { AssignTableSeat } from './components/AssignTableDialog'
import { useSeats } from './hooks/useSeats'
import { useOrderUpdates } from './hooks/useOrderUpdates'
import { useAdminAuth } from './admin/auth/useAdminAuth'
import { adminFetch } from './admin/adminFetch'

interface ApiOrder {
  id: number;
  userEmail: string | null;
  seatId: number | null;
  status: OrderStatus;
  createdAt: string;
  user?: { name: string; email: string } | null;
  seat?: { id: number; zone: string } | null;
  items: Array<{
    id: number;
    quantity: number;
    menuItem: { name: string };
  }>;
}

function adaptOrder(api: ApiOrder): Order {
  return {
    id: api.id,
    customerName: api.user?.name ?? 'Guest',
    items: api.items.map((it) => ({
      id: it.id,
      name: it.menuItem.name,
      quantity: it.quantity,
    })),
    createdAt: api.createdAt,
    status: api.status,
    seatId: api.seatId,
  };
}

/**
 * Tabs that the TopNavBar search bar can filter. The search input is
 * disabled on tabs not in this set so we don't surface a fake feature.
 */
const SEARCHABLE_TABS = new Set(['orders', 'inventory']);

const SEARCH_PLACEHOLDER: Record<string, string> = {
  orders: 'Search orders by customer or item…',
  inventory: 'Search inventory items…',
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignOrderId, setAssignOrderId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { seats, isConnected } = useSeats();
  const { username, logout } = useAdminAuth();

  // Reset search query whenever the active tab changes so the input
  // doesn't carry stale text across views.
  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  const tablespaceSeats: TablespaceSeat[] = seats.map((s) => ({
    id: s.id,
    status: s.status,
    zone: s.zone,
  }));

  const assignTableSeats: AssignTableSeat[] = seats.map((s) => ({
    id: s.id,
    status: s.status,
    zone: s.zone,
  }));

  // Apply the TopNavBar search query against the active orders list.
  // The match is case-insensitive against customer name, item names, or
  // order id (the user might paste #42 or just 42).
  const filteredOrders = useMemo<Order[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || activeTab !== 'orders') return activeOrders;
    return activeOrders.filter((order) => {
      if (String(order.id).includes(q)) return true;
      if (order.customerName.toLowerCase().includes(q)) return true;
      return order.items.some((it) => it.name.toLowerCase().includes(q));
    });
  }, [activeOrders, searchQuery, activeTab]);

  const fetchActiveOrders = useCallback(async () => {
    try {
      const response = await adminFetch('/api/orders/active');
      if (response.ok) {
        const data: ApiOrder[] = await response.json();
        setActiveOrders(data.map(adaptOrder));
      }
    } catch {
      // Orders will remain empty until backend is available
    }
  }, []);

  useEffect(() => {
    fetchActiveOrders();
  }, [fetchActiveOrders]);

  useOrderUpdates((update) => {
    setActiveOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === update.orderId);
      if (idx === -1) {
        if (update.status === 'pending' || update.status === 'preparing' || update.status === 'ready') {
          fetchActiveOrders();
        }
        return prev;
      }
      const next = [...prev];
      if (update.status === 'completed' || update.status === 'cancelled') {
        next.splice(idx, 1);
      } else {
        next[idx] = {
          ...next[idx],
          status: update.status,
          seatId: update.seatId,
        };
      }
      return next;
    });
  });

  const handleAssignTable = useCallback((orderId: number) => {
    setAssignOrderId(orderId);
    setAssignDialogOpen(true);
  }, []);

  const handleAssignConfirm = useCallback(async (orderId: number, seatId: number) => {
    try {
      const response = await adminFetch(`/api/orders/${orderId}/assign-seat`, {
        method: 'PATCH',
        body: JSON.stringify({ seatId }),
      });

      if (response.ok) {
        setActiveOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, seatId } : o)),
        );
      }
    } catch {
      // silent — order remains in queue
    } finally {
      setAssignDialogOpen(false);
      setAssignOrderId(null);
    }
  }, []);

  const handleAssignClose = useCallback(() => {
    setAssignDialogOpen(false);
    setAssignOrderId(null);
  }, []);

  const handleUpdateStatus = useCallback(async (orderId: number, status: OrderStatus) => {
    try {
      await adminFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch {
      // Best-effort — if the request fails, the queue stays as-is.
    }
  }, []);

  /** First letter of the signed-in admin username, uppercased. */
  const avatarLetter = (username ?? 'A').charAt(0).toUpperCase();

  const isSearchable = SEARCHABLE_TABS.has(activeTab);
  const placeholderForTab = SEARCH_PLACEHOLDER[activeTab] ?? 'Search…';

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="p-container-margin bg-background min-h-screen">
            <div className="mb-8">
              <h2 className="font-section-title text-section-title text-on-background">Dashboard</h2>
              <p className="font-body text-body text-on-surface-variant mt-2">
                Welcome to VOKAFE Admin. Overview of your coffeeshop operations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-surface rounded-lg border border-border-soft shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">chair_alt</span>
                  </div>
                  <span className="font-body text-body text-on-surface-variant">Seats Available</span>
                </div>
                <p className="text-2xl font-bold text-on-background">
                  {seats.filter((s) => s.status === 0).length}
                  <span className="text-base font-normal text-on-surface-variant"> / 24</span>
                </p>
              </div>

              <div className="bg-surface rounded-lg border border-border-soft shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#D81B60]/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#D81B60]">event_seat</span>
                  </div>
                  <span className="font-body text-body text-on-surface-variant">Seats Occupied</span>
                </div>
                <p className="text-2xl font-bold text-on-background">
                  {seats.filter((s) => s.status === 1).length}
                  <span className="text-base font-normal text-on-surface-variant"> / 24</span>
                </p>
              </div>

              <div className="bg-surface rounded-lg border border-border-soft shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-600">pending_actions</span>
                  </div>
                  <span className="font-body text-body text-on-surface-variant">Active Orders</span>
                </div>
                <p className="text-2xl font-bold text-on-background">{activeOrders.length}</p>
              </div>

              <div className="bg-surface rounded-lg border border-border-soft shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
                    <span className={`material-symbols-outlined ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                      {isConnected ? 'wifi' : 'wifi_off'}
                    </span>
                  </div>
                  <span className="font-body text-body text-on-surface-variant">Live Updates</span>
                </div>
                <p className={`text-lg font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            </div>
          </div>
        );

      case 'orders':
        return (
          <OrderQueue
            orders={filteredOrders}
            onAssignTable={handleAssignTable}
            onUpdateStatus={handleUpdateStatus}
          />
        );

      case 'tablespace':
        return <Tablespace seats={tablespaceSeats} />;

      case 'inventory':
        return <Inventory searchQuery={searchQuery} />;

      case 'analytics':
        return <Analytics />;

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-background font-sans text-on-background overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="ml-[240px] flex-1 h-full overflow-y-auto pt-navbar-height relative">
        {/* TopNavBar — search is functional on Orders / Inventory tabs.
            Other tabs surface a disabled state so we don't pretend to
            offer a feature we don't support. */}
        <header
          className="fixed top-0 right-0 left-[240px] h-navbar-height bg-surface/80 backdrop-blur-md border-b border-border-soft flex justify-between items-center px-container-margin z-20"
          data-testid="admin-topnav"
        >
          <div className="flex-1 max-w-md">
            <div
              className={`relative flex items-center bg-surface-container rounded-full px-4 py-2 transition-opacity ${
                isSearchable ? 'opacity-100 focus-within:ring-2 focus-within:ring-primary/20' : 'opacity-50'
              }`}
            >
              <span className="material-symbols-outlined text-on-surface-variant mr-2">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isSearchable ? placeholderForTab : 'Search not available on this tab'}
                disabled={!isSearchable}
                data-testid="admin-topnav-search"
                className="bg-transparent border-none outline-none text-body w-full placeholder-on-surface-variant p-0 focus:ring-0 disabled:cursor-not-allowed"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  data-testid="admin-topnav-search-clear"
                  className="ml-2 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection status indicator */}
            <div
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                isConnected
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
              }`}
              data-testid="admin-topnav-connection"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
                }`}
              />
              {isConnected ? 'Live' : 'Offline'}
            </div>

            {/* Signed-in admin avatar (letter only — no stock image) */}
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm"
                aria-label={`Signed in as ${username ?? 'admin'}`}
                data-testid="admin-topnav-avatar"
              >
                {avatarLetter}
              </div>
              <button
                type="button"
                onClick={() => logout()}
                data-testid="admin-topnav-logout"
                className="px-3 py-1.5 text-sm rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high active:scale-95 transition-all flex items-center gap-1"
                aria-label="Log out"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Active View Content */}
        {renderActiveView()}
      </main>

      {/* Assign Table Dialog (shared across views) */}
      {assignOrderId !== null && (
        <AssignTableDialog
          isOpen={assignDialogOpen}
          orderId={assignOrderId}
          seats={assignTableSeats}
          onClose={handleAssignClose}
          onAssign={handleAssignConfirm}
        />
      )}
    </div>
  )
}

export default App
