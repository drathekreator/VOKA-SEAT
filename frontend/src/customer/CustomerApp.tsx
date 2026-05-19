import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/useAuth';
import LoginScreen from './auth/LoginScreen';
import RegisterScreen from './auth/RegisterScreen';
import TopAppBar from './components/TopAppBar';
import BottomNav, { type CustomerTabId } from './components/BottomNav';
import CartSummaryBar from './components/CartSummaryBar';
import MenuView from './views/MenuView';
import TablesView from './views/TablesView';
import CartView from './views/CartView';
import ProfileView from './views/ProfileView';
import CheckoutView, { type PaymentMethod } from './views/CheckoutView';
import PaymentSuccessView, {
  type PaymentSuccessItem,
} from './views/PaymentSuccessView';
import OrderHistoryView from './views/OrderHistoryView';
import OrderDetailView from './views/OrderDetailView';
import ToastNotice from './components/ToastNotice';
import type { CartItem } from '../utils/cartCalculator';
import { useOrderUpdates } from '../hooks/useOrderUpdates';
import {
  loadPersistedCart,
  savePersistedCart,
  clearPersistedCart,
} from './utils/persistedCart';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/** Auto-incrementing ID for cart items. */
let nextCartItemId = 1;

/**
 * Auth-screen identifier. Auth is no longer a gate — it's an overlay
 * the customer reaches by tapping "Sign In or Create Account" on the
 * Profile tab or "Save Order to Account" on the Payment Success
 * screen. `'none'` means no auth overlay is mounted.
 */
type AuthScreen = 'none' | 'login' | 'register';

/**
 * Overlay screens are rendered full-screen instead of the tab content
 * (TopAppBar and BottomNav are also hidden so each overlay can own the
 * viewport). 'none' means the active tab content is rendered normally.
 */
type OverlayScreen =
  | { type: 'none' }
  | { type: 'checkout' }
  | { type: 'payment-success' }
  | { type: 'order-history' }
  | { type: 'order-detail'; orderId: number };

const NO_OVERLAY: OverlayScreen = { type: 'none' };

/**
 * Snapshot of the order details captured at the moment payment is
 * confirmed. PaymentSuccessView needs the items and total even after
 * the cart has been cleared on "Back to Menu", so we stash a copy here.
 *
 * `wasGuestCheckout` records whether the order was placed as a guest so
 * the Payment Success screen can offer the optional "Save Order to
 * Account" CTA (Requirement 12.13 / 12.14).
 */
interface PaymentSuccessSnapshot {
  orderNumber: number;
  items: PaymentSuccessItem[];
  totalIdr: number;
  wasGuestCheckout: boolean;
}

/**
 * CustomerApp — root of the Customer App.
 *
 * Section-21 auth model: customer auth is OPTIONAL (Requirement 13.1).
 * The app boots straight into the Menu tab regardless of auth state.
 * Login and Register screens are only mounted when the customer
 * explicitly asks to sign in (e.g. from the guest Profile CTA or the
 * Payment Success "Save Order to Account" CTA).
 */
export default function CustomerApp() {
  return (
    <AuthProvider>
      <CustomerAppContent />
    </AuthProvider>
  );
}

function CustomerAppContent() {
  const { isAuthenticated, isLoading, token, user } = useAuth();

  // ---- Auth overlay ('none' until the customer asks to sign in) ----
  const [authScreen, setAuthScreen] = useState<AuthScreen>('none');

  // ---- Customer app state ----
  const [activeTab, setActiveTab] = useState<CustomerTabId>('menu');
  // Lazy initial state — read persisted cart from localStorage so the
  // customer doesn't lose their selections on reload or accidental
  // back-swipe. The next id is bumped to avoid collisions with cached
  // ids on the next add.
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const persisted = loadPersistedCart();
    if (persisted.length > 0) {
      const maxId = Math.max(...persisted.map((it) => it.id));
      if (maxId >= nextCartItemId) nextCartItemId = maxId + 1;
    }
    return persisted;
  });

  // Persist cart on every change. Empty cart clears the storage key.
  useEffect(() => {
    savePersistedCart(cartItems);
  }, [cartItems]);
  const [overlayScreen, setOverlayScreen] = useState<OverlayScreen>(NO_OVERLAY);
  const [paymentSnapshot, setPaymentSnapshot] = useState<PaymentSuccessSnapshot | null>(null);
  /**
   * Records the order id that just came out of a guest checkout. After
   * a guest signs in from the Payment Success screen we attempt to
   * claim that order via PATCH /api/orders/:id/claim so the new
   * customer's history shows it (Requirement 12.13).
   */
  const [pendingClaimOrderId, setPendingClaimOrderId] = useState<number | null>(null);

  // ---- Search state (Menu tab only) --------------------------------
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Number of orders the current customer has in `pending`/`preparing`/`ready`.
  // Drives the badge on the Profile tab so customers always know there's
  // something happening for them to look at in Order History.
  const [activeOrderCount, setActiveOrderCount] = useState(0);

  // Single-slot toast for ephemeral user feedback (claim success,
  // network failure, etc). The render branch reads from this state at
  // the bottom of the shell so toasts persist across overlay screens.
  const [toast, setToast] = useState<{
    message: string;
    variant: 'success' | 'error' | 'info';
  } | null>(null);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalIdr = cartItems.reduce(
    (sum, item) => sum + item.quantity * item.priceAtOrder,
    0,
  );

  // ---- Cart helpers (preserved from previous shell) -----------------
  const handleAddToCart = useCallback(async (menuItemId: number) => {
    let alreadyInCart = false;

    setCartItems((prev) => {
      const existing = prev.find((item) => item.menuItemId === menuItemId);
      if (existing) {
        alreadyInCart = true;
        return prev.map((item) =>
          item.menuItemId === menuItemId
            ? { ...item, quantity: Math.min(item.quantity + 1, 99) }
            : item,
        );
      }
      return prev;
    });

    if (alreadyInCart) return;

    try {
      const response = await fetch(`${API_URL}/api/menu`);
      if (!response.ok) return;
      const menuItems = await response.json();
      const menuItem = menuItems.find((m: { id: number }) => m.id === menuItemId);
      if (!menuItem) return;

      setCartItems((prev) => {
        const alreadyAdded = prev.find((item) => item.menuItemId === menuItemId);
        if (alreadyAdded) {
          return prev.map((item) =>
            item.menuItemId === menuItemId
              ? { ...item, quantity: Math.min(item.quantity + 1, 99) }
              : item,
          );
        }
        const newItem: CartItem = {
          id: nextCartItemId++,
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity: 1,
          priceAtOrder: Number(menuItem.price),
        };
        return [...prev, newItem];
      });
    } catch {
      // Silently fail — item won't be added if the menu fetch fails.
    }
  }, []);

  const handleUpdateCart = useCallback((updatedItems: CartItem[]) => {
    setCartItems(updatedItems);
  }, []);

  const handleTabChange = (tab: CustomerTabId) => {
    setActiveTab(tab);
    // Exit search mode when switching away from Menu.
    if (tab !== 'menu') {
      setSearchMode(false);
      setSearchQuery('');
    }
  };

  const closeOverlay = useCallback(() => {
    setOverlayScreen(NO_OVERLAY);
  }, []);

  // ---- Auth overlay handlers ---------------------------------------
  const handleSignInFromGuest = useCallback(() => {
    setAuthScreen('login');
  }, []);

  const handleAuthDismiss = useCallback(() => {
    setAuthScreen('none');
  }, []);

  /**
   * After login or register success the auth context updates
   * synchronously, but we still close the overlay explicitly so the
   * customer falls through to whatever view they were on.
   *
   * If a guest checkout just completed, we hand off to the claim flow
   * (an effect below) before doing anything else so the new account
   * picks up the order.
   */
  const handleAuthSuccess = useCallback(() => {
    setAuthScreen('none');
  }, []);

  // ---- Checkout / Payment Success / Order Detail -------------------
  const handleCartCheckout = useCallback(() => {
    setOverlayScreen({ type: 'checkout' });
  }, []);

  const handlePaymentConfirmed = useCallback(
    (_method: PaymentMethod, orderNumber: number) => {
      const snapshot: PaymentSuccessSnapshot = {
        orderNumber,
        items: cartItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
        })),
        totalIdr: cartItems.reduce(
          (sum, item) => sum + item.quantity * item.priceAtOrder,
          0,
        ),
        wasGuestCheckout: !isAuthenticated,
      };
      setPaymentSnapshot(snapshot);
      setOverlayScreen({ type: 'payment-success' });
    },
    [cartItems, isAuthenticated],
  );

  const handleBackToMenuFromSuccess = useCallback(() => {
    setCartItems([]);
    clearPersistedCart();
    setPaymentSnapshot(null);
    setPendingClaimOrderId(null);
    setActiveTab('menu');
    setOverlayScreen(NO_OVERLAY);
  }, []);

  const handleViewOrderStatusFromSuccess = useCallback(() => {
    if (!paymentSnapshot) return;
    setOverlayScreen({
      type: 'order-detail',
      orderId: paymentSnapshot.orderNumber,
    });
  }, [paymentSnapshot]);

  /**
   * Tap on "Save Order to Account" on the Payment Success screen
   * (Requirement 12.13). The order's id is queued for retroactive
   * claim, then we open the Login overlay. Once the customer signs in
   * or registers, the effect below issues PATCH /api/orders/:id/claim.
   */
  const handleSaveOrderToAccount = useCallback(() => {
    if (!paymentSnapshot) return;
    setPendingClaimOrderId(paymentSnapshot.orderNumber);
    setAuthScreen('login');
  }, [paymentSnapshot]);

  // ---- Order History / Order Detail --------------------------------
  const handleSelectOrderFromHistory = useCallback((orderId: number) => {
    setOverlayScreen({ type: 'order-detail', orderId });
  }, []);

  const handleBrowseMenuFromHistory = useCallback(() => {
    setActiveTab('menu');
    setOverlayScreen(NO_OVERLAY);
  }, []);

  const handleNavigateToOrderHistory = useCallback(() => {
    setOverlayScreen({ type: 'order-history' });
  }, []);

  // ---- Active order count for Profile badge ------------------------
  // When authenticated, fetch the most recent order page once and count
  // entries whose status is in {pending, preparing, ready}. The count
  // is then maintained live by the order-status-update effect below.
  useEffect(() => {
    if (!token || !user) {
      setActiveOrderCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/api/orders/history?page=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { orders?: Array<{ status: string }> };
        if (cancelled) return;
        const live = (body.orders ?? []).filter((o) =>
          ['pending', 'preparing', 'ready'].includes(o.status),
        ).length;
        setActiveOrderCount(live);
      } catch {
        /* network errors → leave the badge stale */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  // Live decrement of the Profile badge: when an order owned by the
  // signed-in customer reaches a terminal status (`completed` or
  // `cancelled`), drop the count by one (clamped at 0). When a new
  // order is placed (`pending`) for the same customer, increment.
  // Promotion to `preparing` / `ready` doesn't change the badge — the
  // order is still in progress.
  useOrderUpdates((update) => {
    if (!user || update.userEmail !== user.email) return;
    if (update.status === 'pending') {
      setActiveOrderCount((prev) => prev + 1);
    } else if (update.status === 'completed' || update.status === 'cancelled') {
      setActiveOrderCount((prev) => Math.max(0, prev - 1));
    }
  });

  // ---- Retroactive guest-order claim --------------------------------
  // Watches for the case where the customer signed in/registered after
  // tapping "Save Order to Account" on Payment Success. When `token`
  // becomes truthy and we have a queued order id, PATCH the claim then
  // mark the snapshot as no-longer-guest so the CTA hides immediately.
  useEffect(() => {
    if (!pendingClaimOrderId || !token) return;
    let cancelled = false;
    void (async () => {
      let succeeded = false;
      try {
        const res = await fetch(`${API_URL}/api/orders/${pendingClaimOrderId}/claim`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        succeeded = res.ok;
      } catch {
        // Network failure → toast + leave the snapshot as guest so the
        // CTA stays visible for retry.
        succeeded = false;
      } finally {
        if (cancelled) return;
        setPendingClaimOrderId(null);
        if (succeeded) {
          setPaymentSnapshot((prev) =>
            prev ? { ...prev, wasGuestCheckout: false } : prev,
          );
          setToast({ message: 'Order saved to your account.', variant: 'success' });
        } else {
          setToast({
            message: "Couldn't save the order. You can still see it from this device.",
            variant: 'error',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingClaimOrderId, token]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  if (isLoading) {
    return (
      <div
        className="min-h-screen w-full bg-surface flex items-center justify-center"
        data-testid="customer-app-loading"
        role="status"
        aria-label="Loading"
      >
        <div
          className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      </div>
    );
  }

  // ---- Explicit auth overlay (only when the customer asked) -------
  // The AuthProvider already wraps us, so LoginScreen/RegisterScreen
  // can call useAuth() directly. We render them in front of the
  // customer app so the navigation context is preserved.
  if (authScreen === 'login') {
    return (
      <div className="min-h-screen w-full bg-surface relative" data-testid="customer-app-shell">
        <LoginScreen
          onLoginSuccess={handleAuthSuccess}
          onNavigateToRegister={() => setAuthScreen('register')}
        />
        <button
          type="button"
          onClick={handleAuthDismiss}
          aria-label="Continue browsing as a guest"
          data-testid="auth-dismiss"
          className="fixed top-4 right-4 z-40 inline-flex items-center gap-1 rounded-full bg-surface-container-lowest text-on-surface-variant border border-outline-variant px-3 py-2 text-xs shadow-md3-card active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            close
          </span>
          Continue as guest
        </button>
      </div>
    );
  }

  if (authScreen === 'register') {
    return (
      <div className="min-h-screen w-full bg-surface relative" data-testid="customer-app-shell">
        <RegisterScreen
          onRegisterSuccess={handleAuthSuccess}
          onNavigateToLogin={() => setAuthScreen('login')}
        />
        <button
          type="button"
          onClick={handleAuthDismiss}
          aria-label="Continue browsing as a guest"
          data-testid="auth-dismiss"
          className="fixed top-4 right-4 z-40 inline-flex items-center gap-1 rounded-full bg-surface-container-lowest text-on-surface-variant border border-outline-variant px-3 py-2 text-xs shadow-md3-card active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            close
          </span>
          Continue as guest
        </button>
      </div>
    );
  }

  // ---- Overlay screens (Checkout / PaymentSuccess / OrderHistory / OrderDetail) ----

  if (overlayScreen.type === 'checkout') {
    return (
      <div className="min-h-screen w-full bg-surface" data-testid="customer-app-shell">
        <CheckoutView
          items={cartItems}
          onPaymentConfirmed={handlePaymentConfirmed}
          onBack={closeOverlay}
        />
      </div>
    );
  }

  if (overlayScreen.type === 'payment-success' && paymentSnapshot) {
    return (
      <div className="min-h-screen w-full bg-surface" data-testid="customer-app-shell">
        <PaymentSuccessView
          orderNumber={paymentSnapshot.orderNumber}
          items={paymentSnapshot.items}
          totalIdr={paymentSnapshot.totalIdr}
          wasGuestCheckout={paymentSnapshot.wasGuestCheckout}
          onViewOrderStatus={handleViewOrderStatusFromSuccess}
          onBackToMenu={handleBackToMenuFromSuccess}
          onSaveOrderToAccount={handleSaveOrderToAccount}
        />
      </div>
    );
  }

  if (overlayScreen.type === 'order-history') {
    // Order History is gated by Requirement 19.1 — only authenticated
    // users reach it. If the customer somehow opened this overlay
    // without a session (e.g. by logging out mid-overlay) we redirect
    // them back to Profile.
    if (!isAuthenticated) {
      return (
        <div className="min-h-screen w-full bg-surface flex flex-col" data-testid="customer-app-shell">
          <div className="flex-1 flex items-center justify-center px-margin-mobile text-center">
            <div className="flex flex-col items-center gap-md max-w-xs">
              <p className="font-body-md text-body-md text-on-surface">
                Please sign in to view your order history.
              </p>
              <button
                type="button"
                onClick={() => {
                  setOverlayScreen(NO_OVERLAY);
                  setActiveTab('profile');
                  setAuthScreen('login');
                }}
                className="px-md py-sm bg-primary text-on-primary rounded-xl shadow-primary-glow active:scale-95 transition-transform"
                data-testid="order-history-needs-auth"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen w-full bg-surface flex flex-col" data-testid="customer-app-shell">
        <header
          className="sticky top-0 z-30 flex items-center gap-sm bg-surface px-margin-mobile h-16 border-b border-outline-variant"
          data-testid="order-history-header"
        >
          <button
            type="button"
            aria-label="Back"
            data-testid="order-history-back"
            onClick={() => {
              setActiveTab('profile');
              closeOverlay();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_back
            </span>
          </button>
          <h1 className="font-headline-sm text-headline-sm text-on-surface">Order History</h1>
        </header>
        <div className="flex-1 overflow-y-auto">
          <OrderHistoryView
            onSelectOrder={handleSelectOrderFromHistory}
            onBrowseMenu={handleBrowseMenuFromHistory}
          />
        </div>
      </div>
    );
  }

  if (overlayScreen.type === 'order-detail') {
    // OrderDetailView requires auth — guest order details are reached
    // via the session-scoped flow from Payment Success → View Order
    // Status, but only the authenticated branch (where the JWT carries
    // the email that owns the order) actually fetches successfully.
    return (
      <div className="min-h-screen w-full bg-surface flex flex-col" data-testid="customer-app-shell">
        <OrderDetailView
          orderId={overlayScreen.orderId}
          onBack={() => {
            if (paymentSnapshot) {
              handleBackToMenuFromSuccess();
            } else {
              setOverlayScreen({ type: 'order-history' });
            }
          }}
        />
      </div>
    );
  }

  // ---- Authenticated-or-guest tabbed shell -------------------------
  return (
    <div className="flex flex-col min-h-screen bg-surface" data-testid="customer-app-shell">
      <TopAppBar
        isAuthenticated
        searchMode={activeTab === 'menu' && searchMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClick={() => setSearchMode(true)}
        onSearchClose={() => {
          setSearchMode(false);
          setSearchQuery('');
        }}
      />

      <main
        className="flex-1 pb-16 overflow-y-auto"
        role="main"
        data-testid="customer-app-main"
      >
        {activeTab === 'menu' && (
          <div data-testid="view-menu">
            <MenuView onAddToCart={handleAddToCart} searchQuery={searchQuery} />
          </div>
        )}
        {activeTab === 'tables' && (
          <div data-testid="view-tables">
            <TablesView />
          </div>
        )}
        {activeTab === 'cart' && (
          <div data-testid="view-cart">
            <CartView
              items={cartItems}
              onUpdateCart={handleUpdateCart}
              onCheckout={handleCartCheckout}
            />
          </div>
        )}
        {activeTab === 'profile' && (
          <div data-testid="view-profile">
            <ProfileView
              onSignIn={handleSignInFromGuest}
              onNavigateToOrderHistory={handleNavigateToOrderHistory}
            />
          </div>
        )}
      </main>

      {activeTab === 'menu' && cartCount >= 1 && (
        <CartSummaryBar
          itemCount={cartCount}
          totalIdr={cartTotalIdr}
          onViewCart={() => setActiveTab('cart')}
        />
      )}

      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        cartCount={cartCount}
        activeOrderCount={activeOrderCount}
      />

      {/* Single global toast slot — overlays both the tabbed shell and
          full-screen overlays so feedback never gets hidden behind a
          higher-stack screen. */}
      <ToastNotice
        message={toast?.message ?? null}
        variant={toast?.variant ?? 'info'}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
