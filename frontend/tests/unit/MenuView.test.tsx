import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MenuView from '../../src/customer/views/MenuView';
import { formatIDR, truncateDescription } from '../../src/customer/views/MenuView';

const mockMenuItems = [
  {
    id: 1,
    name: 'Espresso',
    description: 'Rich and bold single shot espresso',
    price: 18000,
    category: 'Coffee',
    imageUrl: 'https://example.com/espresso.jpg',
    isAvailable: true,
  },
  {
    id: 2,
    name: 'Matcha Latte',
    description: 'Creamy matcha green tea latte with oat milk',
    price: 25000,
    category: 'Tea',
    imageUrl: 'https://example.com/matcha.jpg',
    isAvailable: true,
  },
  {
    id: 3,
    name: 'Croissant',
    description: 'Buttery flaky French croissant',
    price: 15000,
    category: 'Pastry',
    imageUrl: null,
    isAvailable: true,
  },
  {
    id: 4,
    name: 'Seasonal Blend',
    description: 'Limited edition seasonal coffee blend - currently out of stock',
    price: 30000,
    category: 'Coffee',
    imageUrl: 'https://example.com/seasonal.jpg',
    isAvailable: false,
  },
];

describe('MenuView', () => {
  let mockOnAddToCart: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnAddToCart = vi.fn();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    expect(screen.getByTestId('menu-loading')).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    await waitFor(() => {
      expect(screen.getByTestId('menu-error')).toBeInTheDocument();
    });
  });

  it('renders menu items after successful fetch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMenuItems,
    });
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    await waitFor(() => {
      expect(screen.getByTestId('menu-grid')).toBeInTheDocument();
    });
    expect(screen.getByTestId('menu-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-3')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-4')).toBeInTheDocument();
  });

  it('displays category filter buttons', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMenuItems,
    });
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    await waitFor(() => {
      expect(screen.getByTestId('category-all')).toBeInTheDocument();
    });
    expect(screen.getByTestId('category-Coffee')).toBeInTheDocument();
    expect(screen.getByTestId('category-Tea')).toBeInTheDocument();
    expect(screen.getByTestId('category-Pastry')).toBeInTheDocument();
  });

  it('filters items by category when a category button is clicked', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMenuItems,
    });
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    await waitFor(() => {
      expect(screen.getByTestId('menu-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('category-Coffee'));

    // Should show only Coffee items (id 1 and 4)
    expect(screen.getByTestId('menu-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-4')).toBeInTheDocument();
    expect(screen.queryByTestId('menu-item-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-item-3')).not.toBeInTheDocument();
  });

  it('shows all items when "All" category is clicked', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMenuItems,
    });
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    await waitFor(() => {
      expect(screen.getByTestId('menu-grid')).toBeInTheDocument();
    });

    // First filter by Coffee
    fireEvent.click(screen.getByTestId('category-Coffee'));
    expect(screen.queryByTestId('menu-item-2')).not.toBeInTheDocument();

    // Then click All
    fireEvent.click(screen.getByTestId('category-all'));
    expect(screen.getByTestId('menu-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-3')).toBeInTheDocument();
  });

  it('calls onAddToCart when add button is clicked for available item', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMenuItems,
    });
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    await waitFor(() => {
      expect(screen.getByTestId('menu-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-to-cart-1'));
    expect(mockOnAddToCart).toHaveBeenCalledWith(1);
  });

  it('disables add-to-cart button for unavailable items', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMenuItems,
    });
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    await waitFor(() => {
      expect(screen.getByTestId('menu-grid')).toBeInTheDocument();
    });

    const disabledButton = screen.getByTestId('add-to-cart-4');
    expect(disabledButton).toBeDisabled();
    fireEvent.click(disabledButton);
    expect(mockOnAddToCart).not.toHaveBeenCalled();
  });

  it('shows "Unavailable" badge for unavailable items', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMenuItems,
    });
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    await waitFor(() => {
      expect(screen.getByTestId('menu-grid')).toBeInTheDocument();
    });

    expect(screen.getByTestId('unavailable-badge-4')).toBeInTheDocument();
    expect(screen.queryByTestId('unavailable-badge-1')).not.toBeInTheDocument();
  });

  it('displays prices in IDR format', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMenuItems,
    });
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    await waitFor(() => {
      expect(screen.getByTestId('menu-grid')).toBeInTheDocument();
    });

    expect(screen.getByText('Rp 18.000')).toBeInTheDocument();
    expect(screen.getByText('Rp 25.000')).toBeInTheDocument();
  });

  it('uses placeholder image when imageUrl is null', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMenuItems,
    });
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    await waitFor(() => {
      expect(screen.getByTestId('menu-grid')).toBeInTheDocument();
    });

    const croissantImg = screen.getByAltText('Croissant');
    expect(croissantImg.getAttribute('src')).toContain('data:image/svg+xml');
  });

  it('replaces image with placeholder on load error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockMenuItems,
    });
    render(<MenuView onAddToCart={mockOnAddToCart} />);
    await waitFor(() => {
      expect(screen.getByTestId('menu-grid')).toBeInTheDocument();
    });

    const espressoImg = screen.getByAltText('Espresso');
    fireEvent.error(espressoImg);
    expect(espressoImg.getAttribute('src')).toContain('data:image/svg+xml');
  });
});

describe('formatIDR', () => {
  it('formats 25000 as "Rp 25.000"', () => {
    expect(formatIDR(25000)).toBe('Rp 25.000');
  });

  it('formats 1000000 as "Rp 1.000.000"', () => {
    expect(formatIDR(1000000)).toBe('Rp 1.000.000');
  });

  it('formats 500 as "Rp 500"', () => {
    expect(formatIDR(500)).toBe('Rp 500');
  });

  it('formats 0 as "Rp 0"', () => {
    expect(formatIDR(0)).toBe('Rp 0');
  });

  it('rounds decimal values', () => {
    expect(formatIDR(18500.75)).toBe('Rp 18.501');
  });
});

describe('truncateDescription', () => {
  it('returns full text if under 120 chars', () => {
    const short = 'A short description';
    expect(truncateDescription(short)).toBe(short);
  });

  it('truncates text longer than 120 chars with ellipsis', () => {
    const long = 'A'.repeat(150);
    const result = truncateDescription(long);
    expect(result.length).toBe(120);
    expect(result.endsWith('...')).toBe(true);
  });

  it('returns exact 120 chars without truncation', () => {
    const exact = 'B'.repeat(120);
    expect(truncateDescription(exact)).toBe(exact);
  });

  it('supports custom max length', () => {
    const text = 'Hello World, this is a test';
    const result = truncateDescription(text, 10);
    expect(result.length).toBe(10);
    expect(result).toBe('Hello W...');
  });
});
