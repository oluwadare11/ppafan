// Offline Transaction Queue using IndexedDB
const DB_NAME = 'PumpHouseOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'transactionQueue';

class OfflineQueue {
  constructor() {
    this.db = null;
  }

  // Initialize IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true
          });

          // Create indexes
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('status', 'status', { unique: false });
          objectStore.createIndex('tenantId', 'tenantId', { unique: false });
        }
      };
    });
  }

  // Add transaction to queue
  async addTransaction(transaction) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const queuedTransaction = {
        ...transaction,
        timestamp: new Date().toISOString(),
        status: 'pending',
        retryCount: 0
      };

      const request = store.add(queuedTransaction);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all pending transactions
  async getPendingTransactions(tenantId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        const transactions = request.result;
        // Filter by tenantId if provided
        const filtered = tenantId
          ? transactions.filter(t => t.tenantId === tenantId)
          : transactions;
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get all transactions
  async getAllTransactions() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Update transaction status
  async updateTransactionStatus(id, status, error = null) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const transaction = request.result;
        if (transaction) {
          transaction.status = status;
          transaction.syncedAt = new Date().toISOString();
          if (error) {
            transaction.error = error;
            transaction.retryCount = (transaction.retryCount || 0) + 1;
          }

          const updateRequest = store.put(transaction);
          updateRequest.onsuccess = () => resolve(transaction);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Transaction not found'));
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Delete transaction
  async deleteTransaction(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all synced transactions (cleanup)
  async clearSyncedTransactions() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.openCursor(IDBKeyRange.only('synced'));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get queue count
  async getQueueCount(tenantId) {
    const pending = await this.getPendingTransactions(tenantId);
    return pending.length;
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();
