import { formatBadge } from '../../utils/badgeFormatter';

/**
 * Customer App bottom navigation — Material Design 3 navigation bar style.
 *
 * Four tabs (left → right): Menu, Tables, Cart, Profile. The active tab is
 * rendered as a pill (bg `primary-container` = #e11d48, foreground
 * `on-primary-container` = #fffaf9). Inactive tabs render their icon and
 * label in `on-surface-variant` = #5c3f40 with a transparent pill.
 *
 * Tactile feedback: every tab button applies `active:scale-90` on press.
 * Icons are Material Symbols Outlined, loaded via the global Google Fonts
 * link wired up by task 15.1.
 *
 * The cart tab additionally displays a badge driven by `formatBadge`:
 *   - count = 0       → badge hidden
 *   - 1 ≤ count ≤ 99  → exact count rendered
 *   - count > 99      → "99+"
 *
 * Per the project notes, this component intentionally uses Tailwind
 * arbitrary-value classes (e.g. `bg-[#e11d48]`, `text-[#fffaf9]`,
 * `text-[#5c3f40]`) so it remains visually correct even if the MD3 token
 * classes from task 15.1 are not in scope at the call site.
 *
 * Spec references:
 *   - Requirement 17.1, 17.2, 17.3, 17.4, 17.5 (four-tab bottom nav)
 *   - Requirement 17.6 (cart badge formatting; Property 15)
 *   - Glossary: Customer_MD3_Tokens, Material_Symbols_Outlined
 *   - design.md "Tabs and persistent chrome"
 */

export type CustomerTabId = 'menu' | 'tables' | 'cart' | 'profile';

export interface BottomNavProps {
  /** Currently active tab id. */
  activeTab: CustomerTabId | string;
  /** Invoked with the tab id when a tab is tapped. */
  onTabChange: (tab: CustomerTabId) => void;
  /**
   * Total number of items in the cart. Used to render the cart badge.
   * Optional so the component can be embedded in flows that have no cart
   * (e.g. an unauthenticated preview); defaults to 0.
   */
  cartCount?: number;
  /**
   * Number of in-progress orders attached to the authenticated customer
   * (status `pending`, `preparing`, or `ready`). Used to render a pulse
   * badge on the Profile tab so customers always know there's something
   * to look at in Order History. Optional; defaults to 0.
   */
  activeOrderCount?: number;
}

interface TabConfig {
  id: CustomerTabId;
  label: string;
  /** Material Symbols Outlined icon name. */
  icon: string;
}

const tabs: TabConfig[] = [
  { id: 'menu', label: 'Menu', icon: 'home' },
  { id: 'tables', label: 'Tables', icon: 'grid_view' },
  { id: 'cart', label: 'Cart', icon: 'shopping_cart' },
  { id: 'profile', label: 'Profile', icon: 'person' },
];

export default function BottomNav({
  activeTab,
  onTabChange,
  cartCount = 0,
  activeOrderCount = 0,
}: BottomNavProps) {
  const badge = formatBadge(cartCount);
  const profileBadge = formatBadge(activeOrderCount);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4e1e6] z-50"
      role="navigation"
      aria-label="Bottom navigation"
    >
      <ul className="flex justify-around items-center h-16 m-0 p-0 list-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          // Active pill: primary-container background with on-primary-container
          // foreground. Inactive: transparent with on-surface-variant text.
          const pillClasses = isActive
            ? 'bg-[#e11d48] text-[#fffaf9]'
            : 'bg-transparent text-[#5c3f40]';

          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => onTabChange(tab.id)}
                className="flex items-center justify-center w-full h-full bg-transparent border-none cursor-pointer p-0 active:scale-90 transition-transform"
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`tab-${tab.id}`}
              >
                <span
                  className={`flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 rounded-full transition-colors ${pillClasses}`}
                >
                  <span className="relative inline-flex">
                    <span
                      className="material-symbols-outlined text-2xl leading-none"
                      aria-hidden="true"
                    >
                      {tab.icon}
                    </span>
                    {tab.id === 'cart' && badge !== null && (
                      <span
                        className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#e11d48] text-[#fffaf9] text-[10px] font-bold px-1 leading-none border-2 border-white"
                        data-testid="cart-badge"
                      >
                        {badge}
                      </span>
                    )}
                    {tab.id === 'profile' && profileBadge !== null && (
                      <span
                        className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1 leading-none border-2 border-white animate-pulse"
                        data-testid="profile-badge"
                        aria-label={`${activeOrderCount} active order${activeOrderCount === 1 ? '' : 's'}`}
                      >
                        {profileBadge}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium leading-none">
                    {tab.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
