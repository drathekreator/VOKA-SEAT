import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Tablespace from './components/Tablespace'
import type { TablespaceSeat } from './components/Tablespace'
import OrderQueue from './components/OrderQueue'
import type { Order } from './components/OrderQueue'
import Inventory from './components/Inventory'
import Analytics from './components/Analytics'
import AssignTableDialog from './components/AssignTableDialog'
import type { AssignTableSeat } from './components/AssignTableDialog'
import { useSeats } from './hooks/useSeats'
import { adminFetch } from './admin/adminFetch'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignOrderId, setAssignOrderId] = useState<number | null>(null);

  // Use the shared useSeats hook for real-time seat data across all views
  const { seats, isConnected } = useSeats();

  // Map seats to the format expected by Tablespace component
  const tablespaceSeats: TablespaceSeat[] = seats.map((s) => ({
    id: s.id,
    status: s.status,
    zone: s.zone,
  }));

  // Map seats to the format expected by AssignTableDialog
  const assignTableSeats: AssignTableSeat[] = seats.map((s) => ({
    id: s.id,
    status: s.status,
    zone: s.zone,
  }));

  // Fetch pending orders from backend (uses admin JWT via adminFetch)
  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        const response = await adminFetch('/api/orders/pending');
        if (response.ok) {
          const data = await response.json();
          setPendingOrders(data);
        }
      } catch {
        // Orders will remain empty until backend is available
      }
    };
    fetchPendingOrders();
  }, []);

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
        // Remove the order from the pending queue
        setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
      }
    } catch {
      // Handle error silently; order remains in queue
    } finally {
      setAssignDialogOpen(false);
      setAssignOrderId(null);
    }
  }, []);

  const handleAssignClose = useCallback(() => {
    setAssignDialogOpen(false);
    setAssignOrderId(null);
  }, []);

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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Seats Available */}
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

              {/* Seats Occupied */}
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

              {/* Pending Orders */}
              <div className="bg-surface rounded-lg border border-border-soft shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-600">pending_actions</span>
                  </div>
                  <span className="font-body text-body text-on-surface-variant">Pending Orders</span>
                </div>
                <p className="text-2xl font-bold text-on-background">{pendingOrders.length}</p>
              </div>

              {/* Connection Status */}
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
        return <OrderQueue orders={pendingOrders} onAssignTable={handleAssignTable} />;

      case 'tablespace':
        return <Tablespace seats={tablespaceSeats} />;

      case 'inventory':
        return <Inventory />;

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
        {/* TopNavBar */}
        <header className="fixed top-0 right-0 left-[240px] h-navbar-height bg-surface/80 backdrop-blur-md border-b border-border-soft flex justify-between items-center px-container-margin z-20">
          <div className="relative flex items-center bg-surface-container rounded-full px-4 py-2 w-72 focus-within:ring-2 focus-within:ring-primary/20">
            <span className="material-symbols-outlined text-on-surface-variant mr-2">search</span>
            <input className="bg-transparent border-none outline-none text-body w-full placeholder-on-surface-variant p-0 focus:ring-0" placeholder="Search..." type="text" />
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status indicator */}
            {!isConnected && (
              <div className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium mr-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                Offline
              </div>
            )}
            <button className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <button className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">help</span>
            </button>
            <div className="ml-2 w-10 h-10 rounded-full border border-border-soft overflow-hidden">
              <img alt="Profile" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCkLWTqGDQAz7r7I8DDJmTcQaIeqxy7YggAAplz9fW-lrLRl9Ls1CLpVVfpxmnbb8qCgVPrsaH_UASpYRK8Wc3gqsL31VNJNE2pR_buWv5EWirYeNBeTiskI2RfqyR8abotszBG5-GiG5f18AsRO56XPqu8oWJmudR2h_Xdc9vAikkofEppM4MKM2vqAClNZT82ONbPHm5O6QpQ8k4mw9uz2ZaFGhgLW7LJr3eQRg4xM-C5b03lJEYsnrboUwZlKdrSne26eqtlh-4" />
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
