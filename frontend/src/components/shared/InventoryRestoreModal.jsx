import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Check, X, RotateCcw, Trash2 } from 'lucide-react';

/**
 * InventoryRestoreModal - Shows when creating a credit note for a fulfilled invoice
 * Allows user to choose whether to restore inventory for returned items
 *
 * Props:
 * - isOpen: boolean - Whether the modal is open
 * - onClose: () => void - Called when modal should close
 * - onConfirm: (method, items) => void - Called when user confirms restoration
 * - invoice: object - The original invoice being credited
 * - creditItems: array - Items being credited (may be partial)
 * - loading: boolean - Whether restoration is in progress
 */
const InventoryRestoreModal = ({
  isOpen,
  onClose,
  onConfirm,
  invoice,
  creditItems = [],
  loading = false
}) => {
  const [restoreMethod, setRestoreMethod] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);

  // Filter to only inventory items that were fulfilled
  const fulfilledInventoryItems = creditItems.filter(item =>
    item.lineItemType === 'inventory' &&
    item.inventoryItemId &&
    (item.quantityFulfilled || 0) > 0
  );

  // Initialize selected items when modal opens
  useEffect(() => {
    if (isOpen && fulfilledInventoryItems.length > 0) {
      setSelectedItems(
        fulfilledInventoryItems.map((item, index) => ({
          lineItemIndex: index,
          inventoryItemId: item.inventoryItemId,
          sku: item.sku,
          description: item.description,
          quantityFulfilled: item.quantityFulfilled || 0,
          quantityToRestore: item.quantity, // Amount being credited
          costPrice: item.costPrice || 0,
          selected: true,
          reason: 'return'  // 'return' | 'damaged' | 'other'
        }))
      );
    }
  }, [isOpen, creditItems]);

  // Toggle individual item selection
  const toggleItemSelection = (index) => {
    setSelectedItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  // Update item reason
  const updateItemReason = (index, reason) => {
    setSelectedItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, reason } : item
      )
    );
  };

  // Calculate totals
  const calculateTotals = () => {
    let totalToRestore = 0;
    let totalCOGS = 0;

    selectedItems.forEach(item => {
      if (item.selected && restoreMethod !== 'none') {
        totalToRestore += item.quantityToRestore;
        totalCOGS += item.quantityToRestore * item.costPrice;
      }
    });

    return { totalToRestore, totalCOGS };
  };

  const { totalToRestore, totalCOGS } = calculateTotals();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const handleConfirm = () => {
    const itemsToRestore = selectedItems
      .filter(item => item.selected && restoreMethod !== 'none')
      .map(item => ({
        lineItemIndex: item.lineItemIndex,
        inventoryItemId: item.inventoryItemId,
        quantityToRestore: item.quantityToRestore,
        costPrice: item.costPrice,
        reason: item.reason
      }));

    onConfirm(restoreMethod, itemsToRestore);
  };

  if (!isOpen) return null;

  // No fulfilled inventory items - nothing to restore
  if (fulfilledInventoryItems.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="px-6 py-4 border-b bg-blue-500 rounded-t-xl">
            <div className="flex items-center gap-3">
              <Check className="h-6 w-6 text-white" />
              <h2 className="text-lg font-semibold text-white">Credit Note Created</h2>
            </div>
          </div>
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Inventory Adjustment Needed</h3>
            <p className="text-gray-600 text-sm">
              This credit note has no fulfilled inventory items to restore.
            </p>
          </div>
          <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCcw className="h-6 w-6 text-white" />
              <div>
                <h2 className="text-lg font-semibold text-white">Restore Inventory</h2>
                <p className="text-blue-100 text-sm">Credit Note for Invoice #{invoice?.invoiceNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Restoring inventory will add the credited quantities back to stock.
              Only restore items that are being returned in sellable condition.
            </p>
          </div>

          {/* Inventory Items Table */}
          <div className="border rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-100 px-4 py-2 border-b">
              <h3 className="font-medium text-gray-700">Items to Restore</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 w-8">
                    <input
                      type="checkbox"
                      checked={selectedItems.every(item => item.selected)}
                      onChange={(e) => {
                        setSelectedItems(prev =>
                          prev.map(item => ({ ...item, selected: e.target.checked }))
                        );
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500"
                      disabled={restoreMethod === 'none'}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Item</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Qty</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Condition</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">COGS</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedItems.map((item, index) => (
                  <tr key={index} className={!item.selected ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleItemSelection(index)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                        disabled={restoreMethod === 'none'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.description}</p>
                        <p className="text-xs text-gray-500">SKU: {item.sku || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">
                      {item.quantityToRestore}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.reason}
                        onChange={(e) => updateItemReason(index, e.target.value)}
                        disabled={!item.selected || restoreMethod === 'none'}
                        className="text-xs border rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="return">Returned - Sellable</option>
                        <option value="damaged">Damaged - Not Sellable</option>
                        <option value="expired">Expired</option>
                        <option value="other">Other</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {item.selected && restoreMethod !== 'none'
                        ? formatCurrency(item.quantityToRestore * item.costPrice)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {restoreMethod !== 'none' && selectedItems.some(i => i.selected) && (
                <tfoot className="bg-gray-50 font-medium">
                  <tr>
                    <td colSpan="3" className="px-4 py-3 text-right">Total to Restore:</td>
                    <td className="px-4 py-3 text-center">{totalToRestore} units</td>
                    <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(totalCOGS)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Restore Method Selection */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-700">Choose Restoration Method</h3>

            <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
              restoreMethod === 'all' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="restoreMethod"
                value="all"
                checked={restoreMethod === 'all'}
                onChange={(e) => setRestoreMethod(e.target.value)}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-gray-900">Restore All Selected</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Add all selected items back to inventory (for items returned in sellable condition)
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
              restoreMethod === 'none' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="restoreMethod"
                value="none"
                checked={restoreMethod === 'none'}
                onChange={(e) => setRestoreMethod(e.target.value)}
                className="mt-1 text-red-600 focus:ring-red-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-gray-900">Don't Restore (Write-off)</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Items are damaged, expired, or disposed. They will not be added back to inventory.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {restoreMethod === 'none'
              ? 'Items will be written off (not restored to stock)'
              : `${totalToRestore} units will be restored to inventory`}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 ${
                restoreMethod === 'none'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {restoreMethod === 'none' ? 'Confirm Write-off' : 'Confirm & Restore'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryRestoreModal;
