import { db } from '../store/db';
import axios from 'axios';
import { toast } from 'sonner';

/**
 * SyncManager handles the synchronization of offline transactions to the server.
 * It monitors network status and processes the pendingSync queue.
 */
class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    
    if (typeof window !== 'undefined') {
      // Listen for online status
      window.addEventListener('online', () => {
        console.log('App is online. Starting sync...');
        this.startSync();
      });
      
      window.addEventListener('offline', () => {
        console.log('App is offline. Sync paused.');
      });
    }
  }

  /**
   * Initialize the sync manager
   */
  init() {
    if (navigator.onLine) {
      this.startSync();
    }
    
    // Periodically check for sync items if online
    if (!this.syncInterval) {
      this.syncInterval = setInterval(() => {
        if (navigator.onLine && !this.isSyncing) {
          this.startSync();
        }
      }, 60000); // Every minute
    }
  }

  /**
   * Start the synchronization process
   */
  async startSync() {
    if (this.isSyncing || !navigator.onLine) return;

    const pendingItems = await db.pendingSync
      .where('status')
      .equals('pending')
      .toArray();

    if (pendingItems.length === 0) return;

    this.isSyncing = true;
    console.log(`Syncing ${pendingItems.length} items...`);

    for (const item of pendingItems) {
      try {
        // Map type to endpoint
        const endpoint = this._getEndpoint(item.type);
        
        await axios.post(endpoint, {
          ...item.data,
          clientSideId: item.clientSideId,
          isSync: true // Flag to tell backend this is a sync operation
        });

        // Mark as completed
        await db.pendingSync.update(item.id, { status: 'completed' });
        // Optionally delete completed items
        // await db.pendingSync.delete(item.id);
        
      } catch (error) {
        console.error(`Failed to sync ${item.type} (ID: ${item.id}):`, error);
        
        // Handle specific errors (e.g., validation errors vs network errors)
        if (error.response && error.response.status < 500) {
          // If it's a client error, mark as failed so we don't retry forever
          await db.pendingSync.update(item.id, { status: 'failed', error: error.message });
        }
        // If it's a 500 or network error, we'll try again next time
      }
    }

    this.isSyncing = false;
    const remaining = await db.pendingSync.where('status').equals('pending').count();
    if (remaining === 0) {
      toast.success('Offline data synchronized successfully');
    }
  }

  /**
   * Get the API endpoint for a specific data type
   * @param {string} type 
   * @returns {string}
   */
  _getEndpoint(type) {
    const endpoints = {
      'sale': '/api/sales/sync',
      'purchase': '/api/purchases/sync',
      'invoice': '/api/invoices/sync',
      'customer': '/api/customers/sync'
    };
    return endpoints[type] || `/api/${type}s/sync`;
  }
}

export default new SyncManager();
