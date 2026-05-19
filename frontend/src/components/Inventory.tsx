import React, { useState, useEffect, useCallback } from 'react';
import { classifyInventoryAlert } from '../utils/inventoryAlert';
import { adminFetch } from '../admin/adminFetch';

interface InventoryItem {
  id: number;
  itemName: string;
  quantity: number;
  unit: string;
  minimumThreshold: number;
  createdAt: string;
  updatedAt: string;
}

interface EditModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSave: (id: number, payload: { quantity: number; minimumThreshold: number }) => Promise<void>;
}

/**
 * Modal that lets the admin update both the current quantity and the
 * minimum-threshold of an inventory item in a single round-trip. Replaces
 * the previous inline-edit UI which only allowed quantity edits and gave
 * no indication that changes had been saved.
 *
 * Validation is intentionally loose (only "non-negative integer") because
 * the backend already enforces full validation on the PATCH endpoint.
 */
const EditModal: React.FC<EditModalProps> = ({ item, onClose, onSave }) => {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [minThreshold, setMinThreshold] = useState(String(item.minimumThreshold));
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    const q = parseInt(quantity, 10);
    const t = parseInt(minThreshold, 10);
    if (isNaN(q) || q < 0 || isNaN(t) || t < 0) {
      setErrorMsg('Quantity and threshold must be non-negative integers.');
      return;
    }
    setErrorMsg(null);
    setSaving(true);
    try {
      await onSave(item.id, { quantity: q, minimumThreshold: t });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-edit-title"
      data-testid="inventory-edit-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 flex flex-col gap-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="inventory-edit-title"
              className="font-section-title text-section-title text-on-background"
            >
              Edit Inventory
            </h3>
            <p className="font-body text-body text-on-surface-variant">
              {item.itemName} ({item.unit})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-label text-label text-on-surface-variant">
              Current stock
            </span>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              data-testid="inventory-edit-quantity"
              className="px-3 py-2 border border-outline-variant rounded-lg font-body text-body bg-surface-container-low focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-label text-label text-on-surface-variant">
              Minimum threshold
            </span>
            <input
              type="number"
              min="0"
              value={minThreshold}
              onChange={(e) => setMinThreshold(e.target.value)}
              data-testid="inventory-edit-min-threshold"
              className="px-3 py-2 border border-outline-variant rounded-lg font-body text-body bg-surface-container-low focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          {errorMsg && (
            <p
              role="alert"
              data-testid="inventory-edit-error"
              className="text-sm text-status-out-of-stock"
            >
              {errorMsg}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="inventory-edit-save"
            className="px-4 py-2 bg-primary text-on-primary rounded-lg disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  );
};

const Inventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const fetchInventory = useCallback(async () => {
    try {
      const res = await adminFetch('/api/inventory');

      if (!res.ok) {
        throw new Error(`Failed to fetch inventory (${res.status})`);
      }

      const data: InventoryItem[] = await res.json();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleSave = useCallback(
    async (id: number, payload: { quantity: number; minimumThreshold: number }) => {
      const res = await adminFetch(`/api/inventory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Failed to update inventory (${res.status})`);
      }
      const updated: InventoryItem = await res.json();
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
    [],
  );

  // Items that need restocking (below threshold)
  const restockItems = items.filter(
    (item) => classifyInventoryAlert(item.quantity, item.minimumThreshold) !== 'none'
  );

  if (loading) {
    return (
      <div className="p-container-margin bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            <span className="font-body text-body">Loading inventory...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-container-margin bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="bg-error-container border border-error rounded-lg p-6 max-w-md text-center">
            <span className="material-symbols-outlined text-error text-4xl mb-2">error</span>
            <p className="font-body text-body text-on-error-container">{error}</p>
            <button
              onClick={() => { setLoading(true); setError(null); fetchInventory(); }}
              className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg font-body text-body hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-container-margin bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="font-section-title text-section-title text-on-background">Inventory</h2>
          <p className="font-body text-body text-on-surface-variant mt-2">
            Track raw material stock levels and restock alerts.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-full border border-outline-variant shadow-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
          <span className="font-card-title text-card-title text-primary">{items.length}</span>
          <span className="font-body text-body text-on-surface-variant">Items</span>
        </div>
      </div>

      {/* Restock Alert Banner */}
      {restockItems.length > 0 && (
        <div className="mb-6 bg-status-out-of-stock/5 border border-status-out-of-stock/20 rounded-lg p-4" role="alert">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-status-out-of-stock mt-0.5">warning</span>
            <div>
              <h3 className="font-card-title text-card-title text-status-out-of-stock mb-1">
                Restock Alert
              </h3>
              <p className="font-body text-body text-on-surface-variant">
                The following items need restocking:{' '}
                {restockItems.map((item, idx) => (
                  <span key={item.id}>
                    <strong className={
                      classifyInventoryAlert(item.quantity, item.minimumThreshold) === 'red'
                        ? 'text-status-out-of-stock'
                        : 'text-status-low-stock'
                    }>
                      {item.itemName}
                    </strong>
                    {idx < restockItems.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-surface rounded-lg border border-border-soft shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container-low border-b border-border-soft">
              <th className="text-left px-6 py-4 font-label text-label text-on-surface-variant uppercase tracking-wider">
                Item Name
              </th>
              <th className="text-left px-6 py-4 font-label text-label text-on-surface-variant uppercase tracking-wider">
                Unit
              </th>
              <th className="text-right px-6 py-4 font-label text-label text-on-surface-variant uppercase tracking-wider">
                Current Stock
              </th>
              <th className="text-right px-6 py-4 font-label text-label text-on-surface-variant uppercase tracking-wider">
                Min Threshold
              </th>
              <th className="text-center px-6 py-4 font-label text-label text-on-surface-variant uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-6 py-4 font-label text-label text-on-surface-variant uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const alert = classifyInventoryAlert(item.quantity, item.minimumThreshold);
              const rowBg =
                alert === 'red'
                  ? 'bg-red-50'
                  : alert === 'amber'
                  ? 'bg-amber-50'
                  : '';
              const textColor =
                alert === 'red'
                  ? 'text-status-out-of-stock'
                  : alert === 'amber'
                  ? 'text-status-low-stock'
                  : 'text-on-background';

              return (
                <tr
                  key={item.id}
                  data-testid={`inventory-row-${item.id}`}
                  className={`border-b border-border-soft last:border-b-0 hover:bg-surface-container-low transition-colors ${rowBg}`}
                >
                  <td className={`px-6 py-4 font-body text-body ${textColor} font-medium`}>
                    {item.itemName}
                  </td>
                  <td className="px-6 py-4 font-body text-body text-on-surface-variant">
                    {item.unit}
                  </td>
                  <td className={`px-6 py-4 font-body text-body text-right ${textColor} font-medium`}>
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 font-body text-body text-right text-on-surface-variant">
                    {item.minimumThreshold}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {alert === 'red' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-out-of-stock/10 text-status-out-of-stock font-label text-label font-bold">
                        <span className="w-2 h-2 rounded-full bg-status-out-of-stock"></span>
                        Out of Stock
                      </span>
                    )}
                    {alert === 'amber' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-low-stock/10 text-status-low-stock font-label text-label font-bold">
                        <span className="w-2 h-2 rounded-full bg-status-low-stock"></span>
                        Low Stock
                      </span>
                    )}
                    {alert === 'none' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-success/10 text-status-success font-label text-label font-bold">
                        <span className="w-2 h-2 rounded-full bg-status-success"></span>
                        In Stock
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      data-testid={`inventory-edit-button-${item.id}`}
                      className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 active:scale-[0.98] transition-all inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {items.length === 0 && (
          <div className="flex items-center justify-center py-12 text-on-surface-variant">
            <span className="material-symbols-outlined mr-2">inventory_2</span>
            <span className="font-body text-body">No inventory items found.</span>
          </div>
        )}
      </div>

      {editingItem && (
        <EditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default Inventory;
