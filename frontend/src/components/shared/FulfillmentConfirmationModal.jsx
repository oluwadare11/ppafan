import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Check, X, Truck, Archive } from 'lucide-react';

/**
 * FulfillmentConfirmationModal - Shows after marking invoice as paid
 * Allows user to choose how to handle inventory reduction
 *
 * Props:
 * - isOpen: boolean - Whether the modal is open
 * - onClose: () => void - Called when modal should close
 * - onConfirm: (method, items) => void - Called when user confirms fulfillment
 * - invoice: object - The invoice being fulfilled
 * - inventoryStock: object - Map of inventoryItemId -> currentStock
 * - makeRequest: function - API request function
 * - loading: boolean - Whether fulfillment is in progress
 */
const FulfillmentConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  invoice,
  inventoryStock = {},
  loading = false
}) => {
  const [fulfillmentMethod, setFulfillmentMethod] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);

  // Get inventory items from the invoice
  const inventoryItems = invoice?.items?.filter(
    item => item.lineItemType === 'inventory' && item.inventoryItemId
  ) || [];

  // Initialize selected items when modal opens
  useEffect(() => {
    if (isOpen && inventoryItems.length > 0) {
      setSelectedItems(
        inventoryItems.map((item, index) => ({
          lineItemIndex: index,
          inventoryItemId: item.inventoryItemId,
          sku: item.sku,
          description: item.description,
          quantityRequired: item.quantity,
          quantityFulfilled: item.quantityFulfilled || 0,
          quantityToFulfill: item.quantity - (item.quantityFulfilled || 0),
          currentStock: inventoryStock[item.inventoryItemId] ?? item._inventoryData?.currentStock ?? 0,
          costPrice: item.costPrice || 0,
          selected: true
        }))
      );
    }
  }, [isOpen, invoice]);

  // Calculate totals
  const calculateTotals = () => {
    let totalToFulfill = 0;
    let totalCOGS = 0;
    let hasStockIssues = false;

    selectedItems.forEach(item => {
      if (item.selected) {
        const qtyToFulfill = fulfillmentMethod === 'available'
          ? Math.min(item.quantityToFulfill, item.currentStock)
          : item.quantityToFulfill;

        totalToFulfill += qtyToFulfill;
        totalCOGS += qtyToFulfill * item.costPrice;

        if (item.quantityToFulfill > item.currentStock) {
          hasStockIssues = true;
        }
      }
    });

    return { totalToFulfill, totalCOGS, hasStockIssues };
  };

  const { totalToFulfill, totalCOGS, hasStockIssues } = calculateTotals();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const handleConfirm = () => {
    const itemsToFulfill = selectedItems
      .filter(item => item.selected)
      .map(item => ({
        lineItemIndex: item.lineItemIndex,
        inventoryItemId: item.inventoryItemId,
        quantityToFulfill: fulfillmentMethod === 'available'
          ? Math.min(item.quantityToFulfill, item.currentStock)
          : item.quantityToFulfill,
        costPrice: item.costPrice
      }));

    onConfirm(fulfillmentMethod, itemsToFulfill);
  };

  if (!isOpen) return null;

  // No inventory items - nothing to fulfill
  if (inventoryItems.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="px-6 py-4 border-b bg-green-500 rounded-t-xl">
            <div className="flex items-center gap-3">
              <Check className="h-6 w-6 text-white" />
              <h2 className="text-lg font-semibold text-white">Invoice Marked as Paid</h2>
            </div>
          </div>
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Recorded</h3>
            <p className="text-gray-600 text-sm">
              This invoice has no inventory items linked. No stock adjustment needed.
            </p>
          </div>
          <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
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
        <div className="px-6 py-4 border-b bg-gradient-to-r from-green-500 to-green-600 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="h-6 w-6 text-white" />
              <div>
                <h2 className="text-lg font-semibold text-white">Fulfill Invoice</h2>
                <p className="text-green-100 text-sm">Invoice #{invoice?.invoiceNumber}</p>
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
          {/* Stock Warning */}
          {hasStockIssues && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Stock Warning</p>
                <p className="text-yellow-700">
                  Some items have insufficient stock. You can fulfill available quantities only
                  or fulfill all (which may result in negative stock).
                </p>
              </div>
            </div>
          )}

          {/* Inventory Items Table */}
          <div className="border rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-100 px-4 py-2 border-b">
              <h3 className="font-medium text-gray-700">Inventory Items to Fulfill</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Item</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Required</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">In Stock</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">To Fulfill</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">COGS</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedItems.map((item, index) => {
                  const qtyToFulfill = fulfillmentMethod === 'available'
                    ? Math.min(item.quantityToFulfill, item.currentStock)
                    : item.quantityToFulfill;
                  const hasIssue = item.quantityToFulfill > item.currentStock;

                  return (
                    <tr key={index} className={hasIssue ? 'bg-yellow-50' : ''}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{item.description}</p>
                          <p className="text-xs text-gray-500">SKU: {item.sku || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {item.quantityToFulfill}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.currentStock === 0
                            ? 'bg-red-100 text-red-700'
                            : item.currentStock < item.quantityToFulfill
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.currentStock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {fulfillmentMethod === 'skip' ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          <span className={hasIssue && fulfillmentMethod === 'all' ? 'text-yellow-600 font-medium' : ''}>
                            {qtyToFulfill}
                            {hasIssue && fulfillmentMethod === 'all' && (
                              <span className="text-xs ml-1">(→ {item.currentStock - item.quantityToFulfill})</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {fulfillmentMethod === 'skip' ? '-' : formatCurrency(qtyToFulfill * item.costPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {fulfillmentMethod !== 'skip' && (
                <tfoot className="bg-gray-50 font-medium">
                  <tr>
                    <td colSpan="3" className="px-4 py-3 text-right">Total COGS:</td>
                    <td className="px-4 py-3 text-center">{totalToFulfill} units</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(totalCOGS)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Fulfillment Method Selection */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-700">Choose Fulfillment Method</h3>

            <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
              fulfillmentMethod === 'all' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="fulfillmentMethod"
                value="all"
                checked={fulfillmentMethod === 'all'}
                onChange={(e) => setFulfillmentMethod(e.target.value)}
                className="mt-1 text-green-600 focus:ring-green-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-gray-900">Fulfill All</span>
                  {hasStockIssues && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                      May go negative
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Reduce inventory for all items, even if stock goes negative (for backorders)
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
              fulfillmentMethod === 'available' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="fulfillmentMethod"
                value="available"
                checked={fulfillmentMethod === 'available'}
                onChange={(e) => setFulfillmentMethod(e.target.value)}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-gray-900">Fulfill Available Only</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Only reduce inventory up to what's currently in stock (partial fulfillment)
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
              fulfillmentMethod === 'skip' ? 'border-gray-500 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name="fulfillmentMethod"
                value="skip"
                checked={fulfillmentMethod === 'skip'}
                onChange={(e) => setFulfillmentMethod(e.target.value)}
                className="mt-1 text-gray-600 focus:ring-gray-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-gray-900">Skip - Handle Manually</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Don't adjust inventory now. You can manually reduce stock in StockFlow later.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {fulfillmentMethod === 'skip'
              ? 'No inventory changes will be made'
              : `${totalToFulfill} units will be reduced from inventory`}
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
                fulfillmentMethod === 'skip'
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
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
                  {fulfillmentMethod === 'skip' ? 'Confirm (No Changes)' : 'Confirm & Fulfill'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FulfillmentConfirmationModal;
