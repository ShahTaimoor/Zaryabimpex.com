import Dexie from 'dexie';

/**
 * Offline Database for POS System
 * 
 * Tables:
 * - pendingSync: Transactions (sales, purchases, etc.) created offline
 * - products: Cache of products for offline lookup
 * - customers: Cache of customers for offline lookup
 * - settings: Local app settings
 */
export const db = new Dexie('POS_Offline_DB');

db.version(1).stores({
  pendingSync: '++id, type, clientSideId, status, createdAt',
  products: 'id, name, barcode, sku, categoryId',
  customers: 'id, name, phone, email',
  settings: 'key, value'
});

// Helper to add to sync queue
export const queueForSync = async (type, data) => {
  const clientSideId = crypto.randomUUID();
  await db.pendingSync.add({
    type,
    clientSideId,
    data,
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  return clientSideId;
};
