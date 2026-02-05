import React, { useState, useEffect, useContext } from 'react';
import {
  Save, Upload, AlertCircle, Check, Building2, Mail, Phone, MapPin,
  Globe, Palette, Bell, Users, Tag, Plus, Edit2, Trash2, X,
  Settings as SettingsIcon
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useTenant } from '../context/TenantProvider';
import UserManagement from './UserManagement';

// Business types
const BUSINESS_TYPES = [
  { value: 'salon-spa', label: 'Salon & Spa' },
  { value: 'restaurant-food', label: 'Restaurant & Food Service' },
  { value: 'retail-store', label: 'Retail Store' },
  { value: 'gym-fitness', label: 'Gym & Fitness Center' },
  { value: 'healthcare-clinic', label: 'Healthcare & Clinic' },
  { value: 'auto-services', label: 'Auto Services' },
  { value: 'professional-services', label: 'Professional Services' },
  { value: 'education-training', label: 'Education & Training' },
  { value: 'event-planning', label: 'Event Planning' },
  { value: 'consulting-firm', label: 'Consulting Firm' },
  { value: 'engineering-services', label: 'Engineering Services' },
  { value: 'architecture-construction', label: 'Architecture & Construction' },
  { value: 'legal-services', label: 'Legal Services' },
  { value: 'accounting-finance', label: 'Accounting & Finance' },
  { value: 'real-estate', label: 'Real Estate Agency' },
  { value: 'insurance-agency', label: 'Insurance Agency' },
  { value: 'marketing-agency', label: 'Marketing Agency' },
  { value: 'it-services', label: 'IT Services & Software' },
  { value: 'place-of-worship', label: 'Place of Worship/Religious Organization' },
  { value: 'other-business', label: 'Other Business' }
];

const Settings = () => {
  const { user, tenantInfo, refreshTenantInfo } = useContext(AuthContext);
  const { makeRequest } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('business');

  // Category management state
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [formData, setFormData] = useState({
    businessName: '',
    businessType: '',
    contactInfo: {
      email: '',
      phone: '',
      address: '',
      website: ''
    },
    branding: {
      logo: '',
      primaryColor: '#3B82F6',
      secondaryColor: '#10B981'
    },
    settings: {
      notificationEmails: [''],
      notificationEmail: '',
      timezone: 'UTC',
      currency: 'NGN',
      vatRate: 7.5
    }
  });

  const SETTINGS_CACHE_KEY = 'pumphouse_settings_cache';

  useEffect(() => {
    const cached = sessionStorage.getItem(SETTINGS_CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setFormData(data);
          setLoading(false);
        }
      } catch (e) {
        console.warn('Invalid settings cache');
      }
    }
    fetchTenantSettings();
    fetchCategories();
  }, []);

  const fetchTenantSettings = async () => {
    const cached = sessionStorage.getItem(SETTINGS_CACHE_KEY);
    if (!cached) setLoading(true);

    try {
      const data = await makeRequest('/api/settings');
      const newFormData = {
        businessName: data.businessName || '',
        businessType: data.businessType || '',
        contactInfo: {
          email: data.contactInfo?.email || '',
          phone: data.contactInfo?.phone || '',
          address: data.contactInfo?.address || '',
          website: data.contactInfo?.website || ''
        },
        branding: {
          logo: data.branding?.logo || '',
          primaryColor: data.branding?.primaryColor || '#3B82F6',
          secondaryColor: data.branding?.secondaryColor || '#10B981'
        },
        settings: {
          notificationEmails: data.settings?.notificationEmails?.length > 0 ? data.settings.notificationEmails : [''],
          notificationEmail: data.settings?.notificationEmail || '',
          timezone: data.settings?.timezone || 'UTC',
          currency: data.settings?.currency || 'NGN',
          vatRate: data.settings?.vatRate || 7.5
        }
      };
      setFormData(newFormData);
      sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ data: newFormData, timestamp: Date.now() }));
      setError('');
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  const handleSimpleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEmailChange = (index, value) => {
    const newEmails = [...formData.settings.notificationEmails];
    newEmails[index] = value;
    setFormData(prev => ({
      ...prev,
      settings: { ...prev.settings, notificationEmails: newEmails }
    }));
  };

  const addEmailField = () => {
    setFormData(prev => ({
      ...prev,
      settings: { ...prev.settings, notificationEmails: [...prev.settings.notificationEmails, ''] }
    }));
  };

  const removeEmailField = (index) => {
    if (formData.settings.notificationEmails.length > 1) {
      const newEmails = formData.settings.notificationEmails.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        settings: { ...prev.settings, notificationEmails: newEmails }
      }));
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Logo file size must be less than 2MB');
        return;
      }
      const formDataUpload = new FormData();
      formDataUpload.append('logo', file);
      try {
        setSaving(true);
        const response = await makeRequest('/api/settings/logo', { method: 'POST', data: formDataUpload });
        const logoUrl = response.logoUrl || response.data?.logoUrl;
        if (logoUrl) {
          handleInputChange('branding', 'logo', logoUrl);
          setSuccess('Logo uploaded successfully');
          if (refreshTenantInfo) await refreshTenantInfo();
          setTimeout(() => setSuccess(''), 3000);
        }
      } catch (err) {
        setError(err.message || 'Failed to upload logo');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setSaving(true);
      await makeRequest('/api/settings/logo', { method: 'DELETE' });
      handleInputChange('branding', 'logo', '');
      setSuccess('Logo removed successfully');
      if (refreshTenantInfo) await refreshTenantInfo();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to remove logo');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!formData.businessName?.trim()) {
        throw new Error('Business name is required');
      }
      const cleanedData = {
        ...formData,
        settings: {
          ...formData.settings,
          notificationEmails: formData.settings.notificationEmails.filter(email => email.trim() !== '')
        }
      };
      await makeRequest('/api/settings/update', { method: 'PUT', data: cleanedData });
      setSuccess('Settings saved successfully!');
      if (refreshTenantInfo) await refreshTenantInfo();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Category Management
  const fetchCategories = async () => {
    try {
      const response = await makeRequest('/api/categories');
      setCategories(response.categories || response.data?.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      setError('Category name is required');
      return;
    }
    setCategoryLoading(true);
    try {
      const response = await makeRequest('/api/categories', { method: 'POST', data: newCategory });
      setCategories([...categories, response.category || response.data?.category || response]);
      setNewCategory({ name: '', description: '' });
      setSuccess('Category added successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to add category');
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory.name.trim()) {
      setError('Category name is required');
      return;
    }
    setCategoryLoading(true);
    try {
      const response = await makeRequest(`/api/categories/${editingCategory._id}`, {
        method: 'PUT',
        data: { name: editingCategory.name, description: editingCategory.description || '' }
      });
      setCategories(categories.map(cat =>
        cat._id === editingCategory._id ? (response.category || response.data?.category || response) : cat
      ));
      setEditingCategory(null);
      setSuccess('Category updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update category');
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    setCategoryLoading(true);
    try {
      await makeRequest(`/api/categories/${id}`, { method: 'DELETE' });
      setCategories(categories.filter(cat => cat._id !== id));
      setSuccess('Category deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete category');
    } finally {
      setCategoryLoading(false);
    }
  };

  const tabs = [
    { id: 'business', label: 'Business', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'system', label: 'System', icon: SettingsIcon }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 text-sm sm:text-base mt-1">Manage your business settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5 text-green-500" />
          <p className="text-green-600 text-sm">{success}</p>
        </div>
      )}

      {/* Business Tab */}
      {activeTab === 'business' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Business Details */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => handleSimpleChange('businessName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                <select
                  value={formData.businessType}
                  onChange={(e) => handleSimpleChange('businessType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select type</option>
                  {BUSINESS_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.contactInfo.email}
                  onChange={(e) => handleInputChange('contactInfo', 'email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.contactInfo.phone}
                  onChange={(e) => handleInputChange('contactInfo', 'phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.contactInfo.address}
                  onChange={(e) => handleInputChange('contactInfo', 'address', e.target.value)}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={formData.contactInfo.website}
                  onChange={(e) => handleInputChange('contactInfo', 'website', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Branding */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Branding</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                <div className="flex items-start gap-4">
                  <div className="relative group">
                    {formData.branding.logo ? (
                      <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                        <img src={formData.branding.logo} alt="Logo" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <Trash2 className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                        <span className="text-2xl font-bold text-gray-400">
                          {formData.businessName?.charAt(0)?.toUpperCase() || 'B'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logo-upload" />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 text-sm"
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </label>
                    <p className="text-xs text-gray-500 mt-1">Max 2MB</p>
                  </div>
                </div>
              </div>

              {/* Colors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand Colors</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Primary</label>
                    <div className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg">
                      <input
                        type="color"
                        value={formData.branding.primaryColor}
                        onChange={(e) => handleInputChange('branding', 'primaryColor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={formData.branding.primaryColor}
                        onChange={(e) => handleInputChange('branding', 'primaryColor', e.target.value)}
                        className="flex-1 text-xs font-mono bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Secondary</label>
                    <div className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg">
                      <input
                        type="color"
                        value={formData.branding.secondaryColor}
                        onChange={(e) => handleInputChange('branding', 'secondaryColor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={formData.branding.secondaryColor}
                        onChange={(e) => handleInputChange('branding', 'secondaryColor', e.target.value)}
                        className="flex-1 text-xs font-mono bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Email</label>
                <input
                  type="email"
                  value={formData.settings.notificationEmail}
                  onChange={(e) => handleInputChange('settings', 'notificationEmail', e.target.value)}
                  placeholder={formData.contactInfo.email || "Enter notification email"}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Recipients</label>
                {formData.settings.notificationEmails.map((email, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => handleEmailChange(index, e.target.value)}
                      placeholder="Email address"
                      className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {formData.settings.notificationEmails.length > 1 && (
                      <button type="button" onClick={() => removeEmailField(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addEmailField} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add email
                </button>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <UserManagement />
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Product & Service Categories</h3>

          {/* Add Category */}
          <div className="p-4 bg-gray-50 rounded-lg mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={editingCategory ? editingCategory.name : newCategory.name}
                onChange={(e) => editingCategory
                  ? setEditingCategory({ ...editingCategory, name: e.target.value })
                  : setNewCategory({ ...newCategory, name: e.target.value })
                }
                placeholder="Category name"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                value={editingCategory ? (editingCategory.description || '') : newCategory.description}
                onChange={(e) => editingCategory
                  ? setEditingCategory({ ...editingCategory, description: e.target.value })
                  : setNewCategory({ ...newCategory, description: e.target.value })
                }
                placeholder="Description (optional)"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                disabled={categoryLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {editingCategory ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {categoryLoading ? 'Saving...' : (editingCategory ? 'Update' : 'Add Category')}
              </button>
              {editingCategory && (
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Categories List */}
          {categories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No categories yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map((category) => (
                <div key={category._id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{category.name}</p>
                    {category.description && (
                      <p className="text-sm text-gray-500 truncate">{category.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(category)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(category._id, category.name)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Preferences</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={formData.settings.timezone}
                  onChange={(e) => handleInputChange('settings', 'timezone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="UTC">UTC (GMT+0)</option>
                  <option value="Africa/Lagos">West Africa Time (GMT+1)</option>
                  <option value="Europe/London">GMT (GMT+0)</option>
                  <option value="America/New_York">Eastern Time (GMT-5)</option>
                  <option value="America/Los_Angeles">Pacific Time (GMT-8)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={formData.settings.currency}
                  onChange={(e) => handleInputChange('settings', 'currency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="NGN">Nigerian Naira (₦)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="EUR">Euro (€)</option>
                  <option value="GBP">British Pound (£)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={formData.settings.vatRate}
                  onChange={(e) => handleInputChange('settings', 'vatRate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default Settings;
