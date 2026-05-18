import React, { useState, useEffect } from 'react';

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string | null;
  isAvailable: boolean;
}

export interface MenuViewProps {
  onAddToCart: (menuItemId: number) => void;
  /** Optional search query from the TopAppBar. Filters items by name. */
  searchQuery?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
      '<rect width="200" height="200" fill="#F3F4F6"/>' +
      '<text x="100" y="100" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14" fill="#9CA3AF">No Image</text>' +
      '</svg>'
  );

/**
 * Formats a number as IDR currency with thousands separator.
 * Example: 25000 → "Rp 25.000"
 */
export function formatIDR(amount: number): string {
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${formatted}`;
}

/**
 * Truncates a string to a maximum length, appending "..." if truncated.
 */
export function truncateDescription(text: string, maxLength: number = 120): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * MenuView — Customer App menu catalog.
 *
 * MD3 token migration (task 15.4): the surface, text and primary tokens
 * (`bg-surface-container-lowest`, `text-on-surface`, `text-on-surface-variant`,
 * `bg-primary text-on-primary`) replace the prior flat `bg-white`, `text-gray-*`
 * utilities. Quick-add-to-cart icon now uses `material-symbols-outlined`
 * (`add`).
 */
const MenuView: React.FC<MenuViewProps> = ({ onAddToCart, searchQuery = '' }) => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_URL}/api/menu`);
        if (!response.ok) {
          throw new Error(`Failed to fetch menu: ${response.status}`);
        }
        const data: MenuItem[] = await response.json();
        setItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load menu');
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, []);

  // Extract unique categories from items
  const categories = Array.from(new Set(items.map((item) => item.category))).sort();

  // Filter items by active category and search query
  const filteredItems = items.filter((item) => {
    const matchesCategory = activeCategory ? item.category === activeCategory : true;
    const matchesSearch = searchQuery.trim().length === 0
      ? true
      : item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = PLACEHOLDER_IMAGE;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="menu-loading">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="menu-error">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-error-container" aria-hidden="true">
              error
            </span>
          </div>
          <p className="text-sm text-error">{error}</p>
          <button
            className="mt-2 px-4 py-2 text-sm bg-primary text-on-primary rounded-lg active:scale-95 transition-transform"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-20 bg-surface-container-lowest min-h-screen" data-testid="menu-view">
      {/* Category filter bar */}
      <div
        className="sticky top-0 bg-surface-container-lowest z-10 py-3 -mx-4 px-4 border-b border-outline-variant overflow-x-auto"
        data-testid="category-filter"
      >
        <div className="flex gap-2 min-w-max">
          <button
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              activeCategory === null
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant'
            }`}
            onClick={() => setActiveCategory(null)}
            data-testid="category-all"
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeCategory === category
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
              onClick={() => setActiveCategory(category)}
              data-testid={`category-${category}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Menu items grid */}
      {filteredItems.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-on-surface-variant">No items found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mt-4" data-testid="menu-grid">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant shadow-sm ${
                !item.isAvailable ? 'opacity-60 grayscale' : ''
              }`}
              data-testid={`menu-item-${item.id}`}
            >
              {/* Item image */}
              <div className="relative aspect-square bg-surface-container">
                <img
                  src={item.imageUrl || PLACEHOLDER_IMAGE}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                  loading="lazy"
                />
                {!item.isAvailable && (
                  <div
                    className="absolute top-2 left-2 bg-error text-on-primary text-[10px] font-bold px-2 py-0.5 rounded"
                    data-testid={`unavailable-badge-${item.id}`}
                  >
                    Unavailable
                  </div>
                )}
              </div>

              {/* Item details */}
              <div className="p-3">
                <h3 className="text-sm font-semibold text-on-surface leading-tight line-clamp-1">
                  {item.name}
                </h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed line-clamp-2">
                  {truncateDescription(item.description)}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-on-surface">
                    {formatIDR(item.price)}
                  </span>
                  <button
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                      item.isAvailable
                        ? 'bg-primary text-on-primary active:scale-95'
                        : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
                    }`}
                    onClick={() => item.isAvailable && onAddToCart(item.id)}
                    disabled={!item.isAvailable}
                    aria-label={`Add ${item.name} to cart`}
                    data-testid={`add-to-cart-${item.id}`}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      add
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MenuView;
