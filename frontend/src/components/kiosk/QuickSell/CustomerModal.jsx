// src/components/kiosk/QuickSell/CustomerModal.jsx
import { useState, useEffect, useMemo } from 'react';
import { X, Search, Tag, User, Phone, Mail } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

function CustomerModal({ customers, customerDetails, onSave, onClose, items, tenantInfo }) {
  const [activeTab, setActiveTab] = useState('add'); // 'add' or 'select'
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    departments: []
  });
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // For Tab 2 search

  // Dynamic tags from items' departments
  const availableTags = useMemo(() => {
    if (items && items.length > 0) {
      const uniqueDepts = [...new Set(items.map(item => item.department))];
      return uniqueDepts.filter(Boolean);
    }
    return tenantInfo?.posConfig?.departments || ['General'];
  }, [items, tenantInfo]);

  useEffect(() => {
    if (customerDetails) {
      setFormData({
        ...customerDetails,
        departments: customerDetails.departments || customerDetails.departments || customerDetails.tags || []
      });
    }
  }, [customerDetails]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Name field triggers search now (not phone)
    if (field === 'name') {
      setSearch(value);
      setShowSuggestions(value.length >= 2);
    }
  };

  const handleTagToggle = (tag) => {
    setFormData(prev => {
      const currentTags = prev.departments || [];
      const isSelected = currentTags.includes(tag);

      return {
        ...prev,
        departments: isSelected
          ? currentTags.filter(t => t !== tag)
          : [...currentTags, tag]
      };
    });
  };

  const handleSelectCustomerFromSuggestion = (customer) => {
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      dateOfBirth: customer.dateOfBirth || '',
      departments: customer.departments || customer.departments || customer.tags || []
    });
    setShowSuggestions(false);
    setSearch('');
  };

  const handleSelectCustomerFromList = (customer) => {
    // Directly save the selected customer
    const customerData = {
      _id: customer._id,
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      dateOfBirth: customer.dateOfBirth || '',
      departments: customer.departments || customer.departments || customer.tags || [],
      customerType: customer.customerType,
      totalSpent: customer.totalSpent,
      visitCount: customer.visitCount
    };
    onSave(customerData);
  };

  const filteredCustomersInForm = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Filter customers for Tab 2
  const filteredCustomersInList = customers.filter(c => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      c.name?.toLowerCase().includes(searchLower) ||
      c.phone?.includes(searchTerm) ||
      c.email?.toLowerCase().includes(searchLower)
    );
  });

  const sortedCustomers = [...filteredCustomersInList].sort((a, b) => {
    // Sort by totalSpent descending
    return (b.totalSpent || 0) - (a.totalSpent || 0);
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Customer name is required');
      return;
    }

    // Default to first available department if no tags selected for new customer
    const finalData = {
      ...formData,
      departments: formData.departments?.length > 0
        ? formData.departments
        : (customerDetails?._id ? formData.departments : [availableTags[0] || 'General'])
    };

    onSave(finalData);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '1rem'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: activeTab === 'select' ? '45rem' : '28rem',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width 0.3s ease'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.5rem',
            borderBottom: '1px solid #e5e7eb'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
              {activeTab === 'add' ? 'Add Customer' : 'Select Customer'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem', margin: '0.25rem 0 0 0' }}>
              {activeTab === 'add' ? 'Enter customer details' : `${sortedCustomers.length} customer(s) found`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
          <button
            onClick={() => setActiveTab('add')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'add' ? '#ffffff' : 'transparent',
              borderBottom: activeTab === 'add' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'add' ? '#3b82f6' : '#6b7280',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            ➕ Add New Customer
          </button>
          <button
            onClick={() => setActiveTab('select')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'select' ? '#ffffff' : 'transparent',
              borderBottom: activeTab === 'select' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'select' ? '#3b82f6' : '#6b7280',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            👥 Select Returning Customer
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'add' ? (
            // TAB 1: Add New Customer Form
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Name with Search */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Customer Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Enter customer name"
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        paddingRight: '2.5rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontFamily: 'Inter, sans-serif',
                        boxSizing: 'border-box'
                      }}
                    />
                    <Search size={18} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  </div>

                  {/* Suggestions Dropdown */}
                  {showSuggestions && filteredCustomersInForm.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '0.5rem',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 10,
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      {filteredCustomersInForm.slice(0, 5).map(customer => (
                        <button
                          key={customer._id}
                          type="button"
                          onClick={() => handleSelectCustomerFromSuggestion(customer)}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            border: 'none',
                            borderBottom: '1px solid #f3f4f6',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>{customer.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{customer.phone}</div>
                          {customer.departments?.length > 0 && (
                            <div style={{ fontSize: '0.65rem', color: '#3b82f6', marginTop: '0.25rem' }}>
                              {customer.departments.join(', ')}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+2348012345678"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontFamily: 'Inter, sans-serif',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="customer@example.com"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontFamily: 'Inter, sans-serif',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Date of Birth
                  </label>
                  <input
                    type="text"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    placeholder="MM-DD (e.g., 05-15)"
                    maxLength="5"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontFamily: 'Inter, sans-serif',
                      boxSizing: 'border-box'
                    }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>
                    Format: MM-DD (e.g., 05-15 for May 15)
                  </p>
                </div>

                {/* Business Tags */}
                <div>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#374151', 
                    marginBottom: '0.5rem' 
                  }}>
                    <Tag size={16} />
                    Business Tags
                  </label>
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    flexWrap: 'wrap',
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    background: '#f9fafb'
                  }}>
                    {availableTags.map(tag => {
                      const isSelected = formData.departments?.includes(tag);
                      const wasExisting = customerDetails?.departments?.includes(tag) || customerDetails?.tags?.includes(tag);
                      
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagToggle(tag)}
                          style={{
                            padding: '0.5rem 1rem',
                            border: isSelected ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            background: isSelected 
                              ? (wasExisting ? '#dbeafe' : '#bfdbfe')
                              : '#ffffff',
                            color: isSelected ? '#1e40af' : '#6b7280',
                            fontSize: '0.875rem',
                            fontWeight: isSelected ? '600' : '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontFamily: 'Inter, sans-serif',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#3b82f6';
                              e.currentTarget.style.background = '#f0f9ff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#e5e7eb';
                              e.currentTarget.style.background = '#ffffff';
                            }
                          }}
                        >
                          {tag}
                          {isSelected && wasExisting && (
                            <span style={{ 
                              fontSize: '0.65rem', 
                              padding: '0.125rem 0.375rem',
                              background: '#3b82f6',
                              color: '#ffffff',
                              borderRadius: '0.25rem',
                              fontWeight: '600'
                            }}>
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>
                    {customerDetails?._id 
                      ? 'Select additional tags for this customer (existing tags shown with ✓)'
                      : 'Select departments (defaults to first department if none selected)'}
                  </p>
                  
                  {formData.departments?.length > 0 && (
                    <div style={{ 
                      marginTop: '0.5rem', 
                      padding: '0.5rem',
                      background: '#eff6ff',
                      borderRadius: '0.375rem',
                      border: '1px solid #bfdbfe'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#1e40af' }}>
                        Selected: {formData.departments.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </form>
          ) : (
            // TAB 2: Select Returning Customer List
            <div>
              {/* Search Bar */}
              <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Search by name, phone, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      paddingLeft: '2.5rem',
                      paddingRight: '0.75rem',
                      paddingTop: '0.75rem',
                      paddingBottom: '0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontFamily: 'Inter, sans-serif',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem 1rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      background: '#ffffff',
                      color: '#6b7280',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  >
                    Clear Search
                  </button>
                )}
              </div>

              {/* Customer List */}
              <div style={{ padding: '1rem' }}>
                {sortedCustomers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <User size={48} style={{ color: '#d1d5db', margin: '0 auto 1rem' }} />
                    <p style={{ fontSize: '1rem', fontWeight: '600', color: '#6b7280', margin: 0 }}>
                      No customers found
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                      Try adjusting your search
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    {sortedCustomers.map(customer => (
                      <CustomerCard
                        key={customer._id}
                        customer={customer}
                        onSelect={handleSelectCustomerFromList}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Only show for Add New Customer tab */}
        {activeTab === 'add' && (
          <div style={{ display: 'flex', gap: '0.75rem', padding: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                background: '#ffffff',
                color: '#374151',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                borderRadius: '0.5rem',
                background: '#3b82f6',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              Save Customer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerCard({ customer, onSelect }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={() => onSelect(customer)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '0.75rem',
        border: isHovered ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        background: isHovered ? '#f0f9ff' : '#ffffff',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontFamily: 'Inter, sans-serif',
        boxShadow: isHovered ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none'
      }}
    >
      {/* Customer Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <User size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
        <h3 style={{ 
          fontSize: '0.8125rem', 
          fontWeight: '700', 
          color: '#1f2937', 
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {customer.name}
        </h3>
      </div>

      {/* Contact Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {customer.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Phone size={12} style={{ color: '#9ca3af', flexShrink: 0 }} />
            <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{customer.phone}</span>
          </div>
        )}
        {customer.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Mail size={12} style={{ color: '#9ca3af', flexShrink: 0 }} />
            <span style={{ 
              fontSize: '0.6875rem', 
              color: '#6b7280',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {customer.email}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

export default CustomerModal;