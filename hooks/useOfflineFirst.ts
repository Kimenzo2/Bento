import { useState, useEffect, useCallback, useRef } from 'react';
import { BookProject, SavedBook } from '../types';

/**
 * IndexedDB configuration
 */
const DB_NAME = 'GenesisOfflineDB';
const DB_VERSION = 1;
const STORE_BOOKS = 'books';
const STORE_SYNC_QUEUE = 'syncQueue';

interface SyncQueueItem {
    id: string;
    type: 'create' | 'update' | 'delete';
    data: SavedBook | string;
    timestamp: number;
    retries: number;
}

/**
 * Opens the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Books store
            if (!db.objectStoreNames.contains(STORE_BOOKS)) {
                const booksStore = db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
                booksStore.createIndex('lastModified', 'lastModified', { unique: false });
                booksStore.createIndex('user_id', 'user_id', { unique: false });
            }

            // Sync queue store
            if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
                const syncStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' });
                syncStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

/**
 * Hook for offline-first data management
 */
export function useOfflineFirst<T extends { id: string }>(
    storeName: string,
    onlineSync?: (items: T[]) => Promise<void>,
    onlineFetch?: () => Promise<T[]>
) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingChanges, setPendingChanges] = useState(0);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const dbRef = useRef<IDBDatabase | null>(null);

    // Initialize database
    useEffect(() => {
        openDatabase().then(db => {
            dbRef.current = db;
        }).catch(console.error);

        return () => {
            dbRef.current?.close();
        };
    }, []);

    // Monitor online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Count pending changes
    useEffect(() => {
        const countPending = async () => {
            if (!dbRef.current) return;
            
            const transaction = dbRef.current.transaction(STORE_SYNC_QUEUE, 'readonly');
            const store = transaction.objectStore(STORE_SYNC_QUEUE);
            const count = await new Promise<number>((resolve, reject) => {
                const request = store.count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            setPendingChanges(count);
        };

        countPending();
        const interval = setInterval(countPending, 5000);
        return () => clearInterval(interval);
    }, []);

    /**
     * Save item to local IndexedDB
     */
    const saveLocal = useCallback(async (item: T): Promise<void> => {
        if (!dbRef.current) {
            await openDatabase().then(db => { dbRef.current = db; });
        }

        const db = dbRef.current!;
        const transaction = db.transaction([storeName, STORE_SYNC_QUEUE], 'readwrite');
        
        // Save to main store
        const mainStore = transaction.objectStore(storeName);
        await new Promise<void>((resolve, reject) => {
            const request = mainStore.put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        // Add to sync queue if offline
        if (!navigator.onLine) {
            const syncStore = transaction.objectStore(STORE_SYNC_QUEUE);
            const queueItem: SyncQueueItem = {
                id: `sync-${item.id}-${Date.now()}`,
                type: 'update',
                data: item as unknown as SavedBook,
                timestamp: Date.now(),
                retries: 0
            };
            await new Promise<void>((resolve, reject) => {
                const request = syncStore.put(queueItem);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }, [storeName]);

    /**
     * Get item from local IndexedDB
     */
    const getLocal = useCallback(async (id: string): Promise<T | undefined> => {
        if (!dbRef.current) {
            await openDatabase().then(db => { dbRef.current = db; });
        }

        const db = dbRef.current!;
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }, [storeName]);

    /**
     * Get all items from local IndexedDB
     */
    const getAllLocal = useCallback(async (): Promise<T[]> => {
        if (!dbRef.current) {
            await openDatabase().then(db => { dbRef.current = db; });
        }

        const db = dbRef.current!;
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }, [storeName]);

    /**
     * Delete item from local IndexedDB
     */
    const deleteLocal = useCallback(async (id: string): Promise<void> => {
        if (!dbRef.current) {
            await openDatabase().then(db => { dbRef.current = db; });
        }

        const db = dbRef.current!;
        const transaction = db.transaction([storeName, STORE_SYNC_QUEUE], 'readwrite');
        
        const mainStore = transaction.objectStore(storeName);
        await new Promise<void>((resolve, reject) => {
            const request = mainStore.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        // Add to sync queue if offline
        if (!navigator.onLine) {
            const syncStore = transaction.objectStore(STORE_SYNC_QUEUE);
            const queueItem: SyncQueueItem = {
                id: `sync-delete-${id}-${Date.now()}`,
                type: 'delete',
                data: id,
                timestamp: Date.now(),
                retries: 0
            };
            await new Promise<void>((resolve, reject) => {
                const request = syncStore.put(queueItem);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }, [storeName]);

    /**
     * Sync pending changes with server
     */
    const syncWithServer = useCallback(async (): Promise<void> => {
        if (!navigator.onLine || !onlineSync || !dbRef.current) return;

        setIsSyncing(true);

        try {
            const db = dbRef.current;
            const transaction = db.transaction(STORE_SYNC_QUEUE, 'readonly');
            const store = transaction.objectStore(STORE_SYNC_QUEUE);
            
            const items = await new Promise<SyncQueueItem[]>((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            if (items.length === 0) {
                setLastSyncTime(new Date());
                return;
            }

            // Group by type and sync
            const updates = items
                .filter(i => i.type === 'update')
                .map(i => i.data as unknown as T);
            
            if (updates.length > 0) {
                await onlineSync(updates);
            }

            // Clear synced items from queue
            const clearTransaction = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
            const clearStore = clearTransaction.objectStore(STORE_SYNC_QUEUE);
            
            for (const item of items) {
                await new Promise<void>((resolve, reject) => {
                    const request = clearStore.delete(item.id);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }

            setLastSyncTime(new Date());
            setPendingChanges(0);
        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [onlineSync]);

    // Auto-sync when coming online
    useEffect(() => {
        if (isOnline && pendingChanges > 0) {
            syncWithServer();
        }
    }, [isOnline, pendingChanges, syncWithServer]);

    return {
        isOnline,
        isSyncing,
        pendingChanges,
        lastSyncTime,
        saveLocal,
        getLocal,
        getAllLocal,
        deleteLocal,
        syncWithServer
    };
}

/**
 * Hook specifically for offline book management
 */
export function useOfflineBooks() {
    return useOfflineFirst<SavedBook>(STORE_BOOKS);
}

export default useOfflineFirst;
