import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Package, Check, AlertTriangle, Image as ImageIcon } from 'lucide-react';

/**
 * InventoryPicker - Modal component for selecting inventory items
 * Used in Invoice and Quotation builders
 *
 * Props:
 * - isOpen: boolean - Whether the modal is open
 * - onClose: () => void - Called when modal should close
 * - onSelect: (item) => void - Called when an item is selected
 * - makeRequest: function - API request function from TenantProvider
 * - excludeIds: string[] - Array of inventory IDs to exclude (already added)
 * - includeOutOfStock: boolean - Whether to show out of stock items
 */
const InventoryPicker = ({
  isOpen,
  onClose,
  onSelect,
  makeRequest,
  excludeIds = [],
  includeOutOfStock = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);

  // Fetch inventory items when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchInventoryItems();
    }
  }, [isOpen]);

  // Filter items based on search and category
  useEffect(() => {
    let filtered = inventoryItems;

    // Exclude already added items
    if (excludeIds.length > 0) {
      filtered = filtered.filter(item => !excludeIds.includes(item._id));
    }

    // Filter out of stock if needed
    if (!includeOutOfStock) {
      filtered = filtered.filter(item => item.quantity > 0);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item =>
        item.category?._id === selectedCategory || item.category === selectedCategory
      );
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name?.toLowerCase().includes(search) ||
        item.sku?.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search) ||
        item.barcode?.toLowerCase().includes(search)
      );
    }

    setFilteredItems(filtered);
  }, [searchTerm, inventoryItems, excludeIds, includeOutOfStock, selectedCategory]);

  const fetchInventoryItems = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await makeRequest('/api/inventory', {
        method: 'GET'
      });

      if (response) {
        const items = Array.isArray(response) ? response : response.items || [];
        setInventoryItems(items);

        // Extract unique categories
        const uniqueCategories = [];
        const categoryMap = new Map();
        items.forEach(item => {
          if (item.category && !categoryMap.has(item.category._id || item.category)) {
            categoryMap.set(item.category._id || item.category, item.category);
            uniqueCategories.push(item.category);
          }
        });
        setCategories(uniqueCategories);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item) => {
    // Transform inventory item to line item format
    const lineItem = {
      lineItemType: 'inventory',
      inventoryItemId: item._id,
      sku: item.sku,
      description: item.name,
      quantity: 1,
      unitPrice: item.sellingPrice || 0,
      costPrice: item.purchasePrice || 0,
      image: item.image || null,
      imageSource: item.image ? 'inventory' : 'none',
      // Additional inventory data for reference
      _inventoryData: {
        name: item.name,
        sku: item.sku,
        currentStock: item.quantity,
        reorderLevel: item.reorderLevel,
        category: item.category,
        department: item.department
      }
    };

    onSelect(lineItem);
    onClose();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gradient-to-r from-pink-500 to-pink-600 rounded-t-xl">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-white" />
            <h2 className="text-lg font-semibold text-white">Select from Inventory</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-4 border-b bg-gray-50 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, SKU, or barcode..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-pink-100 text-pink-700 border-2 border-pink-300'
                  : 'bg-white text-gray-600 border hover:bg-gray-100'
              }`}
            >
              All Items
            </button>
            {categories.map((cat, idx) => (
              <button
                key={cat._id || idx}
                onClick={() => setSelectedCategory(cat._id || cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === (cat._id || cat)
                    ? 'bg-pink-100 text-pink-700 border-2 border-pink-300'
                    : 'bg-white text-gray-600 border hover:bg-gray-100'
                }`}
              >
                {cat.name || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
              <span className="ml-3 text-gray-600">Loading inventory...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-red-400" />
              <p>{error}</p>
              <button
                onClick={fetchInventoryItems}
                className="mt-3 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
              >
                Retry
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No items found</p>
              <p className="text-sm mt-1">
                {searchTerm ? 'Try a different search term' : 'No inventory items available'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredItems.map((item) => (
                <div
                  key={item._id}
                  onClick={() => handleSelect(item)}
                  className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md hover:border-pink-300 ${
                    item.quantity === 0 ? 'bg-gray-50 opacity-75' : 'bg-white'
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Item Image */}
                    <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-gray-300" />
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">SKU: {item.sku}</p>

                      <div className="flex items-center justify-between mt-2">
                        <span className="font-semibold text-pink-600">
                          {formatCurrency(item.sellingPrice)}
                        </span>

                        <div className="flex items-center gap-1">
                          {item.quantity === 0 ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                              Out of stock
                            </span>
                          ) : item.quantity <= (item.reorderLevel || 5) ? (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                              Low: {item.quantity}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                              In stock: {item.quantity}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryPicker;
