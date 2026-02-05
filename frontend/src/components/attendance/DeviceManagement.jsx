// frontend/src/components/attendance/DeviceManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../context/TenantProvider';
import {
  Plus, RefreshCw, Power, Upload, AlertCircle,
  CheckCircle, Clock, XCircle, Wifi, WifiOff,
  Fingerprint, Trash2, X, Monitor, Activity,
  Search, Radio, ArrowRight
} from 'lucide-react';

const DeviceManagement = () => {
  const { makeRequest } = useTenant();

  // State management
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [staff, setStaff] = useState([]);
  const [commandQueue, setCommandQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal states
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);

  // Discovery state
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [selectedDiscoveredDevice, setSelectedDiscoveredDevice] = useState(null);
  const [discoveryInstructions, setDiscoveryInstructions] = useState(null);

  // Form states
  const [newDevice, setNewDevice] = useState({
    name: '',
    serialNumber: '',
    deviceKey: '0', // Default COMM KEY is 0 on ZKTeco devices
    deviceType: 'fingerprint',
    location: '',
    description: '',
    ipAddress: '',
    port: 4370
  });

  const [enrollmentData, setEnrollmentData] = useState({
    staffId: '',
    fingerId: 0,
    deviceSN: ''
  });

  const [pollingCommands, setPollingCommands] = useState(new Set());

  const [syncOptions, setSyncOptions] = useState({
    syncAll: false,
    selectedStaffIds: []
  });

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await makeRequest('/api/devices');
      setDevices(response.devices || []);
      setError('');
    } catch (err) {
      console.error('Error fetching devices:', err);
      setError('Failed to load devices: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  // Fetch staff
  const fetchStaff = useCallback(async () => {
    try {
      const response = await makeRequest('/api/staff');
      const activeStaff = (response.staff || []).filter(
        s => s.status === 'active' && !s.employeeId?.startsWith('CONFIG_')
      );
      setStaff(activeStaff);
    } catch (err) {
      console.error('Error fetching staff:', err);
    }
  }, [makeRequest]);

  // Fetch command queue
  const fetchCommandQueue = useCallback(async (deviceSN = null) => {
    try {
      const url = deviceSN
        ? `/api/device-commands/pending/${deviceSN}`
        : `/api/device-commands/all?status=pending&limit=100`;
      const response = await makeRequest(url);
      setCommandQueue(response.commands || []);
    } catch (err) {
      console.error('Error fetching command queue:', err);
    }
  }, [makeRequest]);

  // Fetch discovered devices
  const fetchDiscoveredDevices = useCallback(async () => {
    try {
      setDiscoveryLoading(true);
      const response = await makeRequest('/api/adms/discover');
      setDiscoveredDevices(response.discoveredDevices || []);
      setDiscoveryInstructions(response.instructions || null);
      setError('');
      return response;
    } catch (err) {
      console.error('Error fetching discovered devices:', err);
      setError('Failed to scan for devices: ' + err.message);
      return null;
    } finally {
      setDiscoveryLoading(false);
    }
  }, [makeRequest]);

  // Register a discovered device
  const handleRegisterDiscoveredDevice = async (e) => {
    e.preventDefault();

    if (!selectedDiscoveredDevice) {
      setError('No device selected');
      return;
    }

    if (!newDevice.name) {
      setError('Device name is required');
      return;
    }

    try {
      setLoading(true);
      await makeRequest('/api/adms/register-discovered', {
        method: 'POST',
        body: JSON.stringify({
          serialNumber: selectedDiscoveredDevice.serialNumber,
          name: newDevice.name,
          deviceKey: newDevice.deviceKey,
          location: newDevice.location || selectedDiscoveredDevice.ip,
          deviceType: newDevice.deviceType,
          description: newDevice.description
        })
      });

      setSuccess('Device registered successfully! It should now appear online.');
      setShowDiscoveryModal(false);
      setSelectedDiscoveredDevice(null);
      resetNewDeviceForm();
      await fetchDevices();
      await fetchDiscoveredDevices();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to register device');
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchDevices();
    fetchStaff();
    fetchCommandQueue();
  }, [fetchDevices, fetchStaff, fetchCommandQueue]);

  // Auto-refresh device status every 30 seconds
  // COMMENTED OUT: Replaced by real-time polling via pollCommandStatus()
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     fetchDevices();
  //     if (selectedDevice) {
  //       fetchCommandQueue(selectedDevice.serialNumber);
  //     }
  //   }, 30000);
  //   return () => clearInterval(interval);
  // }, [fetchDevices, fetchCommandQueue, selectedDevice]);

  // Add device
  const handleAddDevice = async (e) => {
    e.preventDefault();

    if (!newDevice.name || !newDevice.serialNumber || !newDevice.deviceKey) {
      setError('Device name, serial number, and device key are required');
      return;
    }

    try {
      setLoading(true);
      await makeRequest('/api/devices', {
        method: 'POST',
        body: JSON.stringify(newDevice)
      });

      setSuccess('Device added successfully! Waiting for connection...');
      setShowAddDeviceModal(false);
      resetNewDeviceForm();
      await fetchDevices();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to add device');
    } finally {
      setLoading(false);
    }
  };

  // Test device connection - uses dedicated test endpoint
  const handleTestConnection = async (deviceSN) => {
    try {
      setLoading(true);
      const result = await makeRequest(`/api/adms/test-connection/${deviceSN}`);

      // Show diagnosis in an alert or success message
      const diagnosis = result.diagnosis || 'Unknown status';
      const lastSeen = result.device?.lastSeenFormatted || 'Never';
      const pending = result.commands?.pending || 0;

      setSuccess(`${diagnosis}\nLast seen: ${lastSeen}\nPending commands: ${pending}`);
      await fetchDevices();
      setTimeout(() => setSuccess(''), 8000);
    } catch (err) {
      setError('Connection test failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Enroll fingerprint
  const handleEnrollFingerprint = async (e) => {
    e.preventDefault();

    const selectedStaff = staff.find(s => s._id === enrollmentData.staffId);
    if (!selectedStaff) {
      setError('Please select a staff member');
      return;
    }

    try {
      setLoading(true);
      const response = await makeRequest('/api/device-commands/enroll-fingerprint', {
        method: 'POST',
        body: JSON.stringify({
          deviceSN: enrollmentData.deviceSN,
          pin: selectedStaff.employeeId,
          fingerId: enrollmentData.fingerId
        })
      });

      setSuccess(`Fingerprint enrollment queued for ${selectedStaff.firstName}. Device will prompt user to place finger.`);
      setShowEnrollModal(false);
      resetEnrollmentForm();
      await fetchCommandQueue(enrollmentData.deviceSN);

      setTimeout(() => setSuccess(''), 10000);
    } catch (err) {
      setError('Failed to queue fingerprint enrollment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Real-time command status polling
  const pollCommandStatus = async (commandId) => {
    if (pollingCommands.has(commandId)) {
      return; // Already polling this command
    }

    setPollingCommands(prev => new Set(prev).add(commandId));

    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const status = await makeRequest(`/api/device-commands/status/${commandId}`);

        if (status.command.status === 'acknowledged') {
          setSuccess(`Command executed successfully! (${status.command.commandType})`);
          setPollingCommands(prev => {
            const newSet = new Set(prev);
            newSet.delete(commandId);
            return newSet;
          });
          await fetchCommandQueue();
          return;
        }

        if (status.command.status === 'failed') {
          setError(`Command failed: ${status.command.deviceResponse || 'Unknown error'}`);
          setPollingCommands(prev => {
            const newSet = new Set(prev);
            newSet.delete(commandId);
            return newSet;
          });
          await fetchCommandQueue();
          return;
        }

        // Still pending or sent - continue polling
        await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds

      } catch (err) {
        console.error('Error polling command status:', err);
      }
    }

    // Timeout after 60 seconds
    setError('Command timeout - still pending. Check command queue for updates.');
    setPollingCommands(prev => {
      const newSet = new Set(prev);
      newSet.delete(commandId);
      return newSet;
    });
  };

  // Push stored fingerprint template to device
  const handlePushFingerprint = async (staffMember, fingerId, deviceSN) => {
    try {
      setLoading(true);
      const response = await makeRequest('/api/device-commands/upload-fingerprint', {
        method: 'POST',
        body: JSON.stringify({
          deviceSN: deviceSN,
          staffId: staffMember._id,
          fingerId: fingerId
        })
      });

      setSuccess(`Fingerprint template queued for ${staffMember.firstName}`);
      pollCommandStatus(response.command.commandId);

    } catch (err) {
      setError('Failed to push fingerprint: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Push stored face template to device
  const handlePushFace = async (staffMember, faceId, deviceSN) => {
    try {
      setLoading(true);
      const response = await makeRequest('/api/device-commands/upload-face', {
        method: 'POST',
        body: JSON.stringify({
          deviceSN: deviceSN,
          staffId: staffMember._id,
          faceId: faceId
        })
      });

      setSuccess(`Face template queued for ${staffMember.firstName}`);
      pollCommandStatus(response.command.commandId);

    } catch (err) {
      setError('Failed to push face: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sync staff to device
  const handleSyncStaff = async (e) => {
    e.preventDefault();

    if (!syncOptions.syncAll && syncOptions.selectedStaffIds.length === 0) {
      setError('Please select staff to sync or choose "Sync All"');
      return;
    }

    try {
      setLoading(true);

      if (syncOptions.syncAll) {
        const response = await makeRequest('/api/device-commands/sync-all-staff', {
          method: 'POST',
          body: JSON.stringify({ deviceSN: selectedDevice.serialNumber })
        });

        setSuccess(`${response.totalQueued} staff members queued for sync.`);
      } else {
        const response = await makeRequest('/api/device-commands/sync-staff', {
          method: 'POST',
          body: JSON.stringify({
            deviceSN: selectedDevice.serialNumber,
            staffIds: syncOptions.selectedStaffIds
          })
        });

        setSuccess(`${response.totalQueued} staff members queued for sync.`);
      }

      setShowSyncModal(false);
      resetSyncOptions();
      await fetchCommandQueue(selectedDevice.serialNumber);

      setTimeout(() => setSuccess(''), 10000);
    } catch (err) {
      setError('Failed to queue staff sync: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reboot device
  const handleRebootDevice = async (deviceSN) => {
    if (!window.confirm('Are you sure you want to reboot this device?')) {
      return;
    }

    try {
      setLoading(true);
      await makeRequest('/api/device-commands/reboot', {
        method: 'POST',
        body: JSON.stringify({ deviceSN })
      });
      setSuccess('Device reboot command sent. Device will restart in 5 seconds.');
      await fetchCommandQueue(deviceSN);
    } catch (err) {
      setError('Failed to reboot device: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete device
  const handleDeleteDevice = async (deviceId, deviceName) => {
    if (!window.confirm(`Are you sure you want to delete device "${deviceName}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await makeRequest(`/api/devices/${deviceId}`, {
        method: 'DELETE'
      });
      setSuccess('Device deleted successfully');
      await fetchDevices();
    } catch (err) {
      setError('Failed to delete device: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const resetNewDeviceForm = () => {
    setNewDevice({
      name: '',
      serialNumber: '',
      deviceKey: '0', // Default COMM KEY is 0 on ZKTeco devices
      deviceType: 'fingerprint',
      location: '',
      description: '',
      ipAddress: '',
      port: 4370
    });
  };

  const resetEnrollmentForm = () => {
    setEnrollmentData({
      staffId: '',
      fingerId: 0,
      deviceSN: ''
    });
  };

  const resetSyncOptions = () => {
    setSyncOptions({
      syncAll: false,
      selectedStaffIds: []
    });
  };

  const getDeviceStatusBadge = (device) => {
    const isOnline = device.lastSeen && (new Date() - new Date(device.lastSeen)) < 120000;

    if (isOnline) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
          <Wifi className="w-3 h-3" />
          Online
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
          <WifiOff className="w-3 h-3" />
          Offline
        </span>
      );
    }
  };

  const getFingerName = (fingerId) => {
    const fingerNames = [
      'Right Thumb', 'Right Index', 'Right Middle', 'Right Ring', 'Right Pinky',
      'Left Thumb', 'Left Index', 'Left Middle', 'Left Ring', 'Left Pinky'
    ];
    return fingerNames[fingerId] || `Finger ${fingerId}`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getCommandStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">Pending</span>;
      case 'sent':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">Sent</span>;
      case 'acknowledged':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Success</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">Failed</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  // RENDER COMPONENT
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">Device Management</h2>
            <p className="text-blue-100 mt-1 text-sm sm:text-base">Manage biometric devices and staff enrollment</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <button
              onClick={async () => {
                setShowDiscoveryModal(true);
                await fetchDiscoveredDevices();
              }}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold text-sm sm:text-base"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden xs:inline">Discover</span>
              <span className="xs:hidden">Discover Devices</span>
            </button>
            <button
              onClick={() => setShowAddDeviceModal(true)}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Add Manually</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-700 text-sm">{success}</p>
          <button onClick={() => setSuccess('')} className="ml-auto text-green-600 hover:text-green-800">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Device Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Monitor className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Total Devices</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{devices.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Wifi className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Online</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {devices.filter(d => d.lastSeen && (new Date() - new Date(d.lastSeen)) < 120000).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <WifiOff className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Offline</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {devices.filter(d => !d.lastSeen || (new Date() - new Date(d.lastSeen)) >= 120000).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">Pending Cmds</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{commandQueue.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Device List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Registered Devices</h3>
            <button
              onClick={() => fetchDevices()}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {loading && devices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="p-12 text-center">
            <Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No devices registered yet</p>
            <p className="text-sm text-gray-500">Click "Add Device" to register your first biometric device</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Serial Number
                  </th>
                  <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {devices.map((device) => (
                  <tr key={device._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0">
                          {device.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 text-sm sm:text-base truncate max-w-[100px] sm:max-w-none">{device.name}</div>
                          <div className="text-xs text-gray-500 capitalize">{device.deviceType || 'fingerprint'}</div>
                          {/* Show serial on mobile below name */}
                          <div className="md:hidden text-xs text-gray-400 font-mono truncate">{device.serialNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-sm font-mono text-gray-700">
                      {device.serialNumber}
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 text-sm text-gray-700">
                      {device.location || 'Not specified'}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      {getDeviceStatusBadge(device)}
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-700">
                      {formatTimestamp(device.lastSeen)}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                      {/* Mobile: Compact action buttons */}
                      <div className="flex items-center justify-end gap-1 sm:gap-2 flex-wrap sm:flex-nowrap">
                        <button
                          onClick={() => {
                            setSelectedDevice(device);
                            setShowSyncModal(true);
                          }}
                          className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Sync Staff"
                        >
                          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDevice(device);
                            setEnrollmentData({ ...enrollmentData, deviceSN: device.serialNumber });
                            setShowEnrollModal(true);
                          }}
                          className="p-1.5 sm:p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Enroll Fingerprint"
                        >
                          <Fingerprint className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => handleTestConnection(device.serialNumber)}
                          className="p-1.5 sm:p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Test Connection"
                        >
                          <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => handleRebootDevice(device.serialNumber)}
                          className="hidden lg:block p-1.5 sm:p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Reboot Device"
                        >
                          <Power className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDevice(device);
                            fetchCommandQueue(device.serialNumber);
                            setShowQueueModal(true);
                          }}
                          className="p-1.5 sm:p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View Command Queue"
                        >
                          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDevice(device._id, device.name)}
                          className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Device"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Device Modal */}
      {showAddDeviceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-900">Add New Device</h3>
              <button
                onClick={() => {
                  setShowAddDeviceModal(false);
                  resetNewDeviceForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddDevice}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Device Name *
                  </label>
                  <input
                    type="text"
                    value={newDevice.name}
                    onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Main Entrance"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Serial Number * (from device)
                  </label>
                  <input
                    type="text"
                    value={newDevice.serialNumber}
                    onChange={(e) => setNewDevice({ ...newDevice, serialNumber: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    placeholder="e.g., BISI231560021"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Find this on the device's System Info page
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    COMM Key (0-999999)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="999999"
                    value={newDevice.deviceKey}
                    onChange={(e) => setNewDevice({ ...newDevice, deviceKey: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ZKTeco COMM Key (default is 0)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Device Type *
                  </label>
                  <select
                    value={newDevice.deviceType}
                    onChange={(e) => setNewDevice({ ...newDevice, deviceType: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="fingerprint">Fingerprint</option>
                    <option value="face">Face Recognition</option>
                    <option value="card">RFID Card</option>
                    <option value="hybrid">Hybrid (Multiple Methods)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={newDevice.location}
                    onChange={(e) => setNewDevice({ ...newDevice, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Reception Desk, Branch A Main Entrance"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newDevice.description}
                    onChange={(e) => setNewDevice({ ...newDevice, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="3"
                    placeholder="Additional notes about this device"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDeviceModal(false);
                    resetNewDeviceForm();
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Fingerprint Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Enroll Fingerprint</h3>
              <button
                onClick={() => {
                  setShowEnrollModal(false);
                  resetEnrollmentForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEnrollFingerprint}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Staff Member *
                  </label>
                  <select
                    value={enrollmentData.staffId}
                    onChange={(e) => setEnrollmentData({ ...enrollmentData, staffId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Choose staff...</option>
                    {staff.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.firstName} {s.lastName} ({s.employeeId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Finger *
                  </label>
                  <select
                    value={enrollmentData.fingerId}
                    onChange={(e) => setEnrollmentData({ ...enrollmentData, fingerId: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                      <option key={i} value={i}>{getFingerName(i)}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Instructions:</strong> After clicking "Start Enrollment", the device will prompt the user to place their finger on the sensor 3 times. User must be at the device to complete enrollment.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEnrollModal(false);
                    resetEnrollmentForm();
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Fingerprint className="w-4 h-4" />
                  {loading ? 'Queuing...' : 'Start Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sync Staff Modal */}
      {showSyncModal && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-900">Sync Staff to {selectedDevice.name}</h3>
              <button
                onClick={() => {
                  setShowSyncModal(false);
                  resetSyncOptions();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSyncStaff}>
              <div className="px-6 py-4 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <input
                    type="checkbox"
                    checked={syncOptions.syncAll}
                    onChange={(e) => setSyncOptions({ ...syncOptions, syncAll: e.target.checked, selectedStaffIds: [] })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-900">
                    Sync All Active Staff ({staff.length} members)
                  </label>
                </div>

                {!syncOptions.syncAll && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Or Select Specific Staff
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg divide-y">
                      {staff.map((s) => (
                        <label key={s._id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={syncOptions.selectedStaffIds.includes(s._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSyncOptions({
                                  ...syncOptions,
                                  selectedStaffIds: [...syncOptions.selectedStaffIds, s._id]
                                });
                              } else {
                                setSyncOptions({
                                  ...syncOptions,
                                  selectedStaffIds: syncOptions.selectedStaffIds.filter(id => id !== s._id)
                                });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {s.firstName} {s.lastName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {s.employeeId} - {s.position}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Staff will be added to the device's user list. This process may take a few minutes for large numbers of staff. Commands will be queued and processed by the device.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setShowSyncModal(false);
                    resetSyncOptions();
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {loading ? 'Syncing...' : 'Start Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Command Queue Modal */}
      {showQueueModal && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-900">
                Command Queue - {selectedDevice.name}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!confirm('Clear all pending commands for this device?')) return;
                    try {
                      setLoading(true);
                      await makeRequest(`/api/adms/commands/clear/${selectedDevice.serialNumber}`, {
                        method: 'DELETE'
                      });
                      setSuccess('Pending commands cleared');
                      await fetchCommandQueue(selectedDevice.serialNumber);
                      setTimeout(() => setSuccess(''), 3000);
                    } catch (err) {
                      setError(err.message || 'Failed to clear commands');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || commandQueue.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </button>
                <button
                  onClick={() => setShowQueueModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {commandQueue.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No pending commands for this device</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {commandQueue.map((cmd) => (
                    <div key={cmd.commandId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">{cmd.commandType}</span>
                          {getCommandStatusBadge(cmd.status)}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(cmd.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <strong>Command ID:</strong> {cmd.commandId}
                      </div>
                      {cmd.parameters && Object.keys(cmd.parameters).length > 0 && (
                        <div className="text-sm text-gray-600 mt-1">
                          <strong>Parameters:</strong> {JSON.stringify(cmd.parameters)}
                        </div>
                      )}
                      {cmd.createdBy && (
                        <div className="text-sm text-gray-600 mt-1">
                          <strong>Created by:</strong> {cmd.createdBy}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end sticky bottom-0 bg-white">
              <button
                onClick={() => setShowQueueModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Discovery Modal */}
      {showDiscoveryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Discover Devices</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Find devices that are pointing to this server
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchDiscoveredDevices}
                  disabled={discoveryLoading}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${discoveryLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => {
                    setShowDiscoveryModal(false);
                    setSelectedDiscoveredDevice(null);
                    resetNewDeviceForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {/* Instructions */}
              {discoveryInstructions && !selectedDiscoveredDevice && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-blue-800 mb-2">Setup Instructions</h4>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>{discoveryInstructions.step1}</li>
                    <li>{discoveryInstructions.step2}</li>
                    <li>{discoveryInstructions.step3}</li>
                    <li>{discoveryInstructions.step4}</li>
                    <li>{discoveryInstructions.step5}</li>
                  </ol>
                </div>
              )}

              {discoveryLoading ? (
                <div className="text-center py-12">
                  <Radio className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse" />
                  <p className="text-gray-600">Scanning for devices...</p>
                </div>
              ) : !selectedDiscoveredDevice ? (
                // Show discovered devices list
                <>
                  {discoveredDevices.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">No devices discovered yet</p>
                      <p className="text-sm text-gray-500">
                        Make sure your device's ADMS domain is set correctly and the device is powered on
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 mb-4">
                        Found {discoveredDevices.length} device(s) waiting to be registered:
                      </p>
                      {discoveredDevices.map((device) => (
                        <div
                          key={device.serialNumber}
                          className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedDiscoveredDevice(device);
                            setNewDevice({
                              ...newDevice,
                              serialNumber: device.serialNumber,
                              location: device.ip || ''
                            });
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <Radio className="w-6 h-6 text-green-600" />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 font-mono">
                                  {device.serialNumber}
                                </div>
                                <div className="text-sm text-gray-500">
                                  IP: {device.ip || 'Unknown'} | Connected {device.connectionCount} time(s)
                                </div>
                                {device.firmwareVersion && (
                                  <div className="text-xs text-gray-400">
                                    {device.firmwareVersion}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold">
                                Ready to Register
                              </span>
                              <ArrowRight className="w-5 h-5 text-gray-400" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // Show registration form for selected device
                <form onSubmit={handleRegisterDiscoveredDevice}>
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setSelectedDiscoveredDevice(null)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <ArrowRight className="w-4 h-4 rotate-180" />
                      Back to device list
                    </button>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <Radio className="w-8 h-8 text-green-600" />
                      <div>
                        <div className="font-semibold text-green-800">
                          {selectedDiscoveredDevice.serialNumber}
                        </div>
                        <div className="text-sm text-green-600">
                          Device found at IP: {selectedDiscoveredDevice.ip || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Device Name *
                      </label>
                      <input
                        type="text"
                        value={newDevice.name}
                        onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Main Entrance, Reception"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        COMM Key (0-999999)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="999999"
                        value={newDevice.deviceKey}
                        onChange={(e) => setNewDevice({ ...newDevice, deviceKey: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        ZKTeco COMM Key from device settings (default is 0)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Device Type
                      </label>
                      <select
                        value={newDevice.deviceType}
                        onChange={(e) => setNewDevice({ ...newDevice, deviceType: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="fingerprint">Fingerprint</option>
                        <option value="face">Face Recognition</option>
                        <option value="card">RFID Card</option>
                        <option value="hybrid">Hybrid (Multiple Methods)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location
                      </label>
                      <input
                        type="text"
                        value={newDevice.location}
                        onChange={(e) => setNewDevice({ ...newDevice, location: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Front Door, Back Office"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedDiscoveredDevice(null)}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {loading ? 'Registering...' : 'Register Device'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {!selectedDiscoveredDevice && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end sticky bottom-0 bg-white">
                <button
                  onClick={() => {
                    setShowDiscoveryModal(false);
                    setSelectedDiscoveredDevice(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceManagement;
