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

const Inventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');

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

  const handleUpdateQuantity = async (id: number, newQuantity: number) => {
    try {
      const res = await adminFetch(`/api/inventory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: newQuantity }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update inventory (${res.status})`);
      }

      const updated: InventoryItem = await res.json();
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inventory');
    } finally {
      setEditingId(null);
      setEditValue('');
    }
  };

  const handleEditStart = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditValue(String(item.quantity));
  };

  const handleEditConfirm = (id: number) => {
    const parsed = parseInt(editValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      handleUpdateQuantity(id, parsed);
    } else {
      setEditingId(null);
      setEditValue('');
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter') {
      handleEditConfirm(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditValue('');
    }
  };

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
                  className={`border-b border-border-soft last:border-b-0 hover:bg-surface-container-low transition-colors ${rowBg}`}
                >
                  <td className={`px-6 py-4 font-body text-body ${textColor} font-medium`}>
                    {item.itemName}
                  </td>
                  <td className="px-6 py-4 font-body text-body text-on-surface-variant">
                    {item.unit}
                  </td>
                  <td className={`px-6 py-4 font-body text-body text-right ${textColor} font-medium`}>
                    {editingId === item.id ? (
                      <input
                        type="number"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleEditConfirm(item.id)}
                        onKeyDown={(e) => handleEditKeyDown(e, item.id)}
                        className="w-20 px-2 py-1 border border-primary rounded text-right font-body text-body bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                        autoFocus
                        aria-label={`Edit quantity for ${item.itemName}`}
                      />
                    ) : (
                      <button
                        onClick={() => handleEditStart(item)}
                        className="hover:bg-surface-container-high px-2 py-1 rounded transition-colors cursor-pointer"
                        title="Click to edit quantity"
                        aria-label={`Edit quantity for ${item.itemName}, current value ${item.quantity}`}
                      >
                        {item.quantity}
                      </button>
                    )}
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
    </div>
  );
};

export default Inventory;
