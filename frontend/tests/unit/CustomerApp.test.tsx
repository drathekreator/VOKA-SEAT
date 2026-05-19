/**
 * CustomerApp — shell integration tests after the Section-21 rewrite.
 *
 * Behaviour highlights validated here:
 *   - Customer auth is OPTIONAL (Requirement 13.1). The shell boots
 *     straight into the tabbed view regardless of auth state — no auth
 *     gate.
 *   - Login / Register screens only mount when the customer explicitly
 *     asks (e.g. via the guest Profile CTA). Auth overlays expose a
 *     "Continue as guest" dismiss button.
 *   - Tab navigation, CartSummaryBar visibility, Checkout overlay,
 *     PaymentSuccess routing, and OrderHistory routing all behave the
 *     same as before.
 *
 * The auth context is fully mocked via `useSyncExternalStore` so
 * tests can mutate `mockAuthState` mid-render and have consumers
 * re-render with the new value.
 *
 * Validates: Requirements 13.1, 13.4, 13.13, 13.14, 17.5, 17.8–17.11,
 * 12.10.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { useSyncExternalStore, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// useAuth / AuthProvider mock.
// ---------------------------------------------------------------------------

interface MockAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { email: string; name: string } | null;
  token: string | null;
  login: Mock;
  register: Mock;
  logout: Mock;
}

let mockAuthState: MockAuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  token: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};

const authSubscribers = new Set<() => void>();

function subscribeAuth(cb: () => void): () => void {
  authSubscribers.add(cb);
  return () => authSubscribers.delete(cb);
}

function notifyAuthChange() {
  authSubscribers.forEach((cb) => cb());
}

function setMockAuth(patch: Partial<MockAuthState>) {
  mockAuthState = { ...mockAuthState, ...patch };
  notifyAuthChange();
}

function resetMockAuthState() {
  mockAuthState = {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    token: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  };
  authSubscribers.clear();
}

vi.mock('../../src/customer/auth/useAuth', () => ({
  // Pass-through provider so descendants render as if there were no context.
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () =>
    useSyncExternalStore(
      subscribeAuth,
      () => mockAuthState,
      () => mockAuthState,
    ),
  VOKAFE_JWT_STORAGE_KEY: 'vokafe_customer_jwt',
  VOKAFE_USER_STORAGE_KEY: 'vokafe_customer_user',
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// ---------------------------------------------------------------------------
// View component stubs.
// ---------------------------------------------------------------------------

vi.mock('../../src/customer/views/MenuView', () => ({
  default: ({ onAddToCart }: { onAddToCart: (id: number) => void }) => (
    <div data-testid="mock-menu-view">
      Menu Mock
      <button data-testid="mock-add-to-cart" onClick={() => onAddToCart(1)}>
        Add
      </button>
    </div>
  ),
  formatIDR: (n: number) => `Rp ${n}`,
}));

vi.mock('../../src/customer/views/TablesView', () => ({
  default: () => <div data-testid="mock-tables-view">Tables Mock</div>,
}));

vi.mock('../../src/customer/views/CartView', () => ({
  default: ({
    items,
    onUpdateCart,
    onCheckout,
  }: {
    items: { id: number; name: string; quantity: number; priceAtOrder: number }[];
    onUpdateCart: (items: unknown[]) => void;
    onCheckout?: () => void;
  }) => (
    <div data-testid="mock-cart-view">
      Cart Mock — {items.length} items
      <button data-testid="mock-clear-cart" onClick={() => onUpdateCart([])}>
        Clear
      </button>
      <button data-testid="mock-cart-checkout" onClick={() => onCheckout?.()}>
        Checkout
      </button>
    </div>
  ),
}));

vi.mock('../../src/customer/views/ProfileView', () => ({
  default: ({
    onSignIn,
    onNavigateToOrderHistory,
  }: {
    onSignIn?: () => void;
    onNavigateToOrderHistory?: () => void;
  }) => (
    <div data-testid="mock-profile-view">
      Profile Mock
      <button data-testid="mock-profile-sign-in" onClick={() => onSignIn?.()}>
        Sign In
      </button>
      <button
        data-testid="mock-profile-go-history"
        onClick={() => onNavigateToOrderHistory?.()}
      >
        Order History
      </button>
    </div>
  ),
}));

vi.mock('../../src/customer/views/CheckoutView', () => ({
  default: ({
    onPaymentConfirmed,
    onBack,
  }: {
    onPaymentConfirmed: (method: string, orderNumber: number) => void;
    onBack?: () => void;
  }) => (
    <div data-testid="mock-checkout-view">
      Checkout Mock
      <button
        data-testid="mock-checkout-confirm"
        onClick={() => onPaymentConfirmed('e_wallet', 42)}
      >
        Confirm Payment
      </button>
      <button data-testid="mock-checkout-back" onClick={() => onBack?.()}>
        Back
      </button>
    </div>
  ),
}));

vi.mock('../../src/customer/views/PaymentSuccessView', () => ({
  default: ({
    orderNumber,
    wasGuestCheckout,
    onViewOrderStatus,
    onBackToMenu,
    onSaveOrderToAccount,
  }: {
    orderNumber: number | string;
    wasGuestCheckout?: boolean;
    onViewOrderStatus: () => void;
    onBackToMenu: () => void;
    onSaveOrderToAccount?: () => void;
  }) => (
    <div data-testid="mock-payment-success-view">
      Payment Success Mock — #{orderNumber}
      {wasGuestCheckout && (
        <button
          data-testid="mock-payment-success-save"
          onClick={() => onSaveOrderToAccount?.()}
        >
          Save Order to Account
        </button>
      )}
      <button
        data-testid="mock-payment-success-view-order"
        onClick={onViewOrderStatus}
      >
        View Order Status
      </button>
      <button
        data-testid="mock-payment-success-back-to-menu"
        onClick={onBackToMenu}
      >
        Back to Menu
      </button>
    </div>
  ),
}));

vi.mock('../../src/customer/views/OrderHistoryView', () => ({
  default: ({
    onSelectOrder,
    onBrowseMenu,
  }: {
    onSelectOrder: (id: number) => void;
    onBrowseMenu: () => void;
  }) => (
    <div data-testid="mock-order-history-view">
      Order History Mock
      <button
        data-testid="mock-order-history-select"
        onClick={() => onSelectOrder(7)}
      >
        Select Order
      </button>
      <button data-testid="mock-order-history-browse" onClick={onBrowseMenu}>
        Browse Menu
      </button>
    </div>
  ),
}));

vi.mock('../../src/customer/views/OrderDetailView', () => ({
  default: ({
    orderId,
    onBack,
  }: {
    orderId: number;
    onBack: () => void;
  }) => (
    <div data-testid="mock-order-detail-view">
      Order Detail Mock — #{orderId}
      <button data-testid="mock-order-detail-back" onClick={onBack}>
        Back
      </button>
    </div>
  ),
}));

vi.mock('../../src/customer/auth/LoginScreen', () => ({
  default: ({
    onLoginSuccess,
    onNavigateToRegister,
  }: {
    onLoginSuccess?: () => void;
    onNavigateToRegister?: () => void;
  }) => (
    <div data-testid="mock-login-screen">
      Login Mock
      <button
        data-testid="mock-login-success"
        onClick={() => {
          // Simulate the real login flow: useAuth becomes authenticated,
          // then the screen notifies the shell.
          setMockAuth({
            isAuthenticated: true,
            user: { email: 'jane@example.com', name: 'Test User' },
            token: 'test-token',
          });
          onLoginSuccess?.();
        }}
      >
        Log in
      </button>
      <button
        data-testid="mock-login-go-register"
        onClick={() => onNavigateToRegister?.()}
      >
        Sign Up
      </button>
    </div>
  ),
}));

vi.mock('../../src/customer/auth/RegisterScreen', () => ({
  default: ({
    onNavigateToLogin,
  }: {
    onNavigateToLogin?: () => void;
    onRegisterSuccess?: () => void;
  }) => (
    <div data-testid="mock-register-screen">
      Register Mock
      <button
        data-testid="mock-register-go-login"
        onClick={() => onNavigateToLogin?.()}
      >
        Login
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports under test (after vi.mock so the mocks are honored).
// ---------------------------------------------------------------------------
import CustomerApp from '../../src/customer/CustomerApp';

/**
 * URL-aware fetch stub. The customer shell now also fetches
 * `/api/orders/history` to populate the Profile-tab badge — those
 * requests need to return an empty `{ orders: [] }` shape so they
 * don't break the menu-fetch flow that `mock-add-to-cart` relies on.
 */
function stubFetchWithMenu(menuItems: Array<{ id: number; name: string; price: number }>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/orders/history')) {
      return Promise.resolve(
        new Response(JSON.stringify({ orders: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(menuItems), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
}

beforeEach(() => {
  resetMockAuthState();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CustomerApp — boot state', () => {
  it('shows a loading spinner while useAuth.isLoading is true', () => {
    setMockAuth({ isLoading: true });

    render(<CustomerApp />);

    expect(screen.getByTestId('customer-app-loading')).toBeDefined();
    expect(screen.queryByTestId('mock-login-screen')).toBeNull();
    expect(screen.queryByTestId('mock-menu-view')).toBeNull();
  });

  it('boots into the Menu tab as a guest (auth is optional)', () => {
    render(<CustomerApp />);

    expect(screen.getByTestId('mock-menu-view')).toBeDefined();
    expect(screen.getByTestId('customer-top-app-bar')).toBeDefined();
    expect(screen.getByTestId('tab-menu')).toBeDefined();
    // Auth overlay must NOT mount automatically — that was the
    // hard-gate behaviour we removed.
    expect(screen.queryByTestId('mock-login-screen')).toBeNull();
    expect(screen.queryByTestId('mock-register-screen')).toBeNull();
  });
});

describe('CustomerApp — explicit auth overlay', () => {
  it('opens the Login overlay when the guest Profile CTA fires', () => {
    render(<CustomerApp />);

    fireEvent.click(screen.getByTestId('tab-profile'));
    fireEvent.click(screen.getByTestId('mock-profile-sign-in'));

    expect(screen.getByTestId('mock-login-screen')).toBeDefined();
    expect(screen.queryByTestId('customer-top-app-bar')).toBeNull();
    expect(screen.getByTestId('auth-dismiss')).toBeDefined();
  });

  it('flips to Register when "Sign Up" is tapped, and back to Login', () => {
    render(<CustomerApp />);

    // Open the auth overlay first via the guest Profile CTA.
    fireEvent.click(screen.getByTestId('tab-profile'));
    fireEvent.click(screen.getByTestId('mock-profile-sign-in'));

    fireEvent.click(screen.getByTestId('mock-login-go-register'));
    expect(screen.getByTestId('mock-register-screen')).toBeDefined();
    expect(screen.queryByTestId('mock-login-screen')).toBeNull();

    fireEvent.click(screen.getByTestId('mock-register-go-login'));
    expect(screen.getByTestId('mock-login-screen')).toBeDefined();
    expect(screen.queryByTestId('mock-register-screen')).toBeNull();
  });

  it('"Continue as guest" dismisses the overlay back to the Profile tab', () => {
    render(<CustomerApp />);

    fireEvent.click(screen.getByTestId('tab-profile'));
    fireEvent.click(screen.getByTestId('mock-profile-sign-in'));

    expect(screen.getByTestId('mock-login-screen')).toBeDefined();
    fireEvent.click(screen.getByTestId('auth-dismiss'));

    expect(screen.queryByTestId('mock-login-screen')).toBeNull();
    expect(screen.getByTestId('mock-profile-view')).toBeDefined();
  });

  it('transitions to the authenticated shell after a successful login', () => {
    render(<CustomerApp />);

    fireEvent.click(screen.getByTestId('tab-profile'));
    fireEvent.click(screen.getByTestId('mock-profile-sign-in'));

    act(() => {
      fireEvent.click(screen.getByTestId('mock-login-success'));
    });

    expect(screen.getByTestId('customer-top-app-bar')).toBeDefined();
    expect(screen.getByTestId('mock-profile-view')).toBeDefined();
    expect(screen.queryByTestId('mock-login-screen')).toBeNull();
  });
});

describe('CustomerApp — authenticated shell', () => {
  beforeEach(() => {
    setMockAuth({
      isAuthenticated: true,
      user: { email: 'jane@example.com', name: 'Test User' },
      token: 'test-token',
    });
  });

  it('renders Menu as the default active tab (Requirement 17.5)', () => {
    render(<CustomerApp />);

    expect(screen.getByTestId('mock-menu-view')).toBeDefined();
    expect(screen.queryByTestId('mock-tables-view')).toBeNull();
    expect(screen.queryByTestId('mock-cart-view')).toBeNull();
    expect(screen.queryByTestId('mock-profile-view')).toBeNull();
  });

  it('switches to Tables view when the Tables tab is tapped', () => {
    render(<CustomerApp />);

    fireEvent.click(screen.getByTestId('tab-tables'));

    expect(screen.getByTestId('mock-tables-view')).toBeDefined();
    expect(screen.queryByTestId('mock-menu-view')).toBeNull();
  });

  it('switches to Cart view when the Cart tab is tapped', () => {
    render(<CustomerApp />);

    fireEvent.click(screen.getByTestId('tab-cart'));

    expect(screen.getByTestId('mock-cart-view')).toBeDefined();
    expect(screen.queryByTestId('mock-menu-view')).toBeNull();
  });

  it('switches to Profile view when the Profile tab is tapped', () => {
    render(<CustomerApp />);

    fireEvent.click(screen.getByTestId('tab-profile'));

    expect(screen.getByTestId('mock-profile-view')).toBeDefined();
    expect(screen.queryByTestId('mock-menu-view')).toBeNull();
  });

  it('renders the Customer Top App Bar on every authenticated tab', () => {
    render(<CustomerApp />);

    expect(screen.getByTestId('customer-top-app-bar')).toBeDefined();

    fireEvent.click(screen.getByTestId('tab-cart'));
    expect(screen.getByTestId('customer-top-app-bar')).toBeDefined();

    fireEvent.click(screen.getByTestId('tab-profile'));
    expect(screen.getByTestId('customer-top-app-bar')).toBeDefined();
  });
});

describe('CustomerApp — CartSummaryBar visibility (Requirements 17.8–17.11)', () => {
  beforeEach(() => {
    setMockAuth({
      isAuthenticated: true,
      user: { email: 'jane@example.com', name: 'Test User' },
      token: 'test-token',
    });
  });

  it('is hidden on the Menu tab when the cart is empty', () => {
    render(<CustomerApp />);

    expect(screen.queryByTestId('cart-summary-bar')).toBeNull();
  });

  it('appears on the Menu tab once the cart has at least one item', async () => {
    const fetchSpy = stubFetchWithMenu([{ id: 1, name: 'Iced Latte', price: 25000 }]);

    render(<CustomerApp />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-add-to-cart'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('cart-summary-bar')).toBeDefined();
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('is hidden on non-Menu tabs even when the cart has items', async () => {
    stubFetchWithMenu([{ id: 1, name: 'Iced Latte', price: 25000 }]);

    render(<CustomerApp />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-add-to-cart'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('cart-summary-bar')).toBeDefined();

    fireEvent.click(screen.getByTestId('tab-tables'));
    expect(screen.queryByTestId('cart-summary-bar')).toBeNull();
  });

  it('"View Cart" tap switches to the Cart tab', async () => {
    stubFetchWithMenu([{ id: 1, name: 'Iced Latte', price: 25000 }]);

    render(<CustomerApp />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-add-to-cart'));
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId('cart-summary-view-cart'));

    expect(screen.getByTestId('mock-cart-view')).toBeDefined();
    expect(screen.queryByTestId('mock-menu-view')).toBeNull();
  });
});

describe('CustomerApp — overlay routing', () => {
  beforeEach(() => {
    setMockAuth({
      isAuthenticated: true,
      user: { email: 'jane@example.com', name: 'Test User' },
      token: 'test-token',
    });
  });

  it('opens the Order History overlay from Profile and returns to Menu via "Browse Menu"', () => {
    render(<CustomerApp />);

    fireEvent.click(screen.getByTestId('tab-profile'));
    fireEvent.click(screen.getByTestId('mock-profile-go-history'));

    expect(screen.getByTestId('mock-order-history-view')).toBeDefined();
    expect(screen.queryByTestId('tab-menu')).toBeNull();
    expect(screen.queryByTestId('customer-top-app-bar')).toBeNull();

    fireEvent.click(screen.getByTestId('mock-order-history-browse'));

    expect(screen.getByTestId('mock-menu-view')).toBeDefined();
    expect(screen.queryByTestId('mock-order-history-view')).toBeNull();
    expect(screen.getByTestId('tab-menu')).toBeDefined();
  });

  it('routes Order History card tap into the Order Detail view', () => {
    render(<CustomerApp />);

    fireEvent.click(screen.getByTestId('tab-profile'));
    fireEvent.click(screen.getByTestId('mock-profile-go-history'));
    fireEvent.click(screen.getByTestId('mock-order-history-select'));

    const detailView = screen.getByTestId('mock-order-detail-view');
    expect(detailView).toBeDefined();
    expect(detailView.textContent).toContain('#7');
  });

  it('Cart → Checkout overlay hides TopAppBar and BottomNav', async () => {
    stubFetchWithMenu([{ id: 1, name: 'Iced Latte', price: 25000 }]);

    render(<CustomerApp />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-add-to-cart'));
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId('tab-cart'));
    fireEvent.click(screen.getByTestId('mock-cart-checkout'));

    expect(screen.getByTestId('mock-checkout-view')).toBeDefined();
    expect(screen.queryByTestId('customer-top-app-bar')).toBeNull();
    expect(screen.queryByTestId('tab-menu')).toBeNull();
  });

  it('Checkout onPaymentConfirmed opens PaymentSuccess with the order number', async () => {
    stubFetchWithMenu([{ id: 1, name: 'Iced Latte', price: 25000 }]);

    render(<CustomerApp />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-add-to-cart'));
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId('tab-cart'));
    fireEvent.click(screen.getByTestId('mock-cart-checkout'));
    fireEvent.click(screen.getByTestId('mock-checkout-confirm'));

    const successView = screen.getByTestId('mock-payment-success-view');
    expect(successView.textContent).toContain('#42');
  });

  it('PaymentSuccess "Back to Menu" returns to Menu and clears the cart (Requirement 12.10)', async () => {
    stubFetchWithMenu([{ id: 1, name: 'Iced Latte', price: 25000 }]);

    render(<CustomerApp />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-add-to-cart'));
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId('tab-cart'));
    expect(screen.getByTestId('mock-cart-view').textContent).toContain('1 items');

    fireEvent.click(screen.getByTestId('mock-cart-checkout'));
    fireEvent.click(screen.getByTestId('mock-checkout-confirm'));

    fireEvent.click(screen.getByTestId('mock-payment-success-back-to-menu'));
    expect(screen.getByTestId('mock-menu-view')).toBeDefined();
    expect(screen.queryByTestId('cart-summary-bar')).toBeNull();
  });

  it('PaymentSuccess "View Order Status" opens the Order Detail view', async () => {
    stubFetchWithMenu([{ id: 1, name: 'Iced Latte', price: 25000 }]);

    render(<CustomerApp />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-add-to-cart'));
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId('tab-cart'));
    fireEvent.click(screen.getByTestId('mock-cart-checkout'));
    fireEvent.click(screen.getByTestId('mock-checkout-confirm'));
    fireEvent.click(screen.getByTestId('mock-payment-success-view-order'));

    const detailView = screen.getByTestId('mock-order-detail-view');
    expect(detailView).toBeDefined();
    expect(detailView.textContent).toContain('#42');
  });

  it('shows the "Save Order to Account" CTA on PaymentSuccess after a guest checkout', async () => {
    // Guest checkout: no user/token in mock auth state.
    setMockAuth({
      isAuthenticated: false,
      user: null,
      token: null,
    });

    stubFetchWithMenu([{ id: 1, name: 'Iced Latte', price: 25000 }]);

    render(<CustomerApp />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-add-to-cart'));
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId('tab-cart'));
    fireEvent.click(screen.getByTestId('mock-cart-checkout'));
    fireEvent.click(screen.getByTestId('mock-checkout-confirm'));

    expect(screen.getByTestId('mock-payment-success-save')).toBeDefined();
  });
});
