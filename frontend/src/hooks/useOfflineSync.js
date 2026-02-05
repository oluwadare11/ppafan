// Custom hook for managing offline/online status and syncing transactions
import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineQueue } from '../utils/offlineQueue';

export const useOfflineSync = (makeRequest, tenantId) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const syncInProgress = useRef(false);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: Online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('Network: Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update queue count
  const updateQueueCount = useCallback(async () => {
    try {
      const count = await offlineQueue.getQueueCount(tenantId);
      setQueueCount(count);
    } catch (error) {
      console.error('Error updating queue count:', error);
    }
  }, [tenantId]);

  // Initialize and update queue count
  useEffect(() => {
    offlineQueue.init().then(updateQueueCount).catch(console.error);
  }, [updateQueueCount]);

  // Sync queued transactions when online
  const syncTransactions = useCallback(async () => {
    if (!isOnline || syncInProgress.current || !makeRequest) {
      return { success: false, reason: 'Cannot sync' };
    }

    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      const pendingTransactions = await offlineQueue.getPendingTransactions(tenantId);

      if (pendingTransactions.length === 0) {
        setIsSyncing(false);
        syncInProgress.current = false;
        return { success: true, synced: 0 };
      }

      console.log(`Syncing ${pendingTransactions.length} offline transactions...`);

      let successCount = 0;
      let failCount = 0;

      for (const queuedTx of pendingTransactions) {
        try {
          // Extract the actual transaction data (remove queue metadata)
          const { id, timestamp, status, retryCount, syncedAt, error, ...transactionData } = queuedTx;

          // Send to server
          await makeRequest('/api/pos-transactions', {
            method: 'POST',
            body: JSON.stringify(transactionData)
          });

          // Mark as synced
          await offlineQueue.updateTransactionStatus(id, 'synced');
          successCount++;
        } catch (error) {
          console.error('Error syncing transaction:', error);

          // Update retry count and error
          await offlineQueue.updateTransactionStatus(
            queuedTx.id,
            'pending',
            error.message
          );
          failCount++;

          // If retry count exceeds threshold, mark as failed
          if ((queuedTx.retryCount || 0) >= 3) {
            await offlineQueue.updateTransactionStatus(
              queuedTx.id,
              'failed',
              'Max retries exceeded'
            );
          }
        }
      }

      // Cleanup synced transactions
      await offlineQueue.clearSyncedTransactions();

      // Update queue count
      await updateQueueCount();

      setLastSyncTime(new Date());
      setIsSyncing(false);
      syncInProgress.current = false;

      console.log(`Sync complete: ${successCount} success, ${failCount} failed`);

      return {
        success: true,
        synced: successCount,
        failed: failCount,
        total: pendingTransactions.length
      };
    } catch (error) {
      console.error('Sync error:', error);
      setIsSyncing(false);
      syncInProgress.current = false;
      return { success: false, error: error.message };
    }
  }, [isOnline, makeRequest, tenantId, updateQueueCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queueCount > 0 && !syncInProgress.current) {
      // Delay sync by 2 seconds to ensure connection is stable
      const timer = setTimeout(() => {
        syncTransactions();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, queueCount, syncTransactions]);

  // Queue transaction for offline processing
  const queueTransaction = useCallback(async (transaction) => {
    try {
      const id = await offlineQueue.addTransaction({
        ...transaction,
        tenantId
      });
      await updateQueueCount();
      return { success: true, id };
    } catch (error) {
      console.error('Error queuing transaction:', error);
      return { success: false, error: error.message };
    }
  }, [tenantId, updateQueueCount]);

  return {
    isOnline,
    isSyncing,
    queueCount,
    lastSyncTime,
    syncTransactions,
    queueTransaction,
    updateQueueCount
  };
};
