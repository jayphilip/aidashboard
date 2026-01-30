// Utility to clear PGlite database - run this in console if sync is broken
export async function clearPgliteDatabase() {
  // Delete the IndexedDB database
  const dbName = 'aidashboard';

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => {
      console.log('✅ PGlite database cleared successfully');
      console.log('🔄 Please refresh the page');
      resolve(true);
    };

    request.onerror = () => {
      console.error('❌ Failed to clear PGlite database');
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn('⚠️ Database deletion blocked - close all tabs and try again');
    };
  });
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).clearPgliteDB = clearPgliteDatabase;
}
