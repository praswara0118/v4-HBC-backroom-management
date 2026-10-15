import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  query,
  where,
  limit,
  orderBy,
  getCountFromServer,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ReturnItem, Supplier, MasterProduct, StorageLocation } from '../types/inventory';
import {
  INITIAL_SUPPLIERS,
  INITIAL_RETURN_ITEMS,
  INITIAL_MASTER_PRODUCTS,
  INITIAL_STORAGE_LOCATIONS,
} from '../data/seedData';
import { calculateReturnStatus } from '../utils/notification';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ITEMS_COLLECTION = 'returnItems';
const SUPPLIERS_COLLECTION = 'suppliers';
const MASTER_PRODUCTS_COLLECTION = 'masterProducts';
const STORAGE_LOCATIONS_COLLECTION = 'storageLocations';

/**
 * Initialize Firestore data if collections are empty
 */
export async function seedInitialFirestoreData(): Promise<void> {
  try {
    // 1. Fast local check (0 Firestore operations)
    const hasSeededLocal = localStorage.getItem('returku_system_seeded') === 'true';
    if (hasSeededLocal) {
      return;
    }

    // 2. Check metadata document (costs at most 1 read)
    const testRef = doc(db, 'systemMetadata', 'initial_seed');
    try {
      const testSnap = await getDoc(testRef);
      if (testSnap.exists()) {
        localStorage.setItem('returku_system_seeded', 'true');
        return;
      }
    } catch {}

    // 3. Check each collection with limit(1) (costs at most 1 read each, instead of reading thousands of docs!)
    const [suppliersSnapshot, itemsSnapshot, masterSnapshot, storageSnapshot] = await Promise.all([
      getDocs(query(collection(db, SUPPLIERS_COLLECTION), limit(1))),
      getDocs(query(collection(db, ITEMS_COLLECTION), limit(1))),
      getDocs(query(collection(db, MASTER_PRODUCTS_COLLECTION), limit(1))),
      getDocs(query(collection(db, STORAGE_LOCATIONS_COLLECTION), limit(1))),
    ]);

    const batch = writeBatch(db);
    let hasWrites = false;

    if (suppliersSnapshot.empty) {
      for (const sup of INITIAL_SUPPLIERS) {
        batch.set(doc(db, SUPPLIERS_COLLECTION, sup.id), sanitizeDataForFirestore(sup));
        hasWrites = true;
      }
    }

    if (itemsSnapshot.empty) {
      for (const item of INITIAL_RETURN_ITEMS) {
        batch.set(doc(db, ITEMS_COLLECTION, item.id), sanitizeDataForFirestore(item));
        hasWrites = true;
      }
    }

    if (masterSnapshot.empty) {
      for (const prod of INITIAL_MASTER_PRODUCTS) {
        batch.set(doc(db, MASTER_PRODUCTS_COLLECTION, prod.id), sanitizeDataForFirestore(prod));
        hasWrites = true;
      }
    }

    if (storageSnapshot.empty) {
      for (const loc of INITIAL_STORAGE_LOCATIONS) {
        batch.set(doc(db, STORAGE_LOCATIONS_COLLECTION, loc.id), sanitizeDataForFirestore(loc));
        hasWrites = true;
      }
    }

    if (hasWrites) {
      await batch.commit();
    }

    // Persist completion marker
    try {
      await setDoc(testRef, {
        seededAt: new Date().toISOString(),
        version: '1.0',
      });
    } catch {}
    localStorage.setItem('returku_system_seeded', 'true');
  } catch (error) {
    console.warn('Initial seeding skipped or already seeded:', error);
    localStorage.setItem('returku_system_seeded', 'true');
  }
}

/**
 * Subscribe to real-time return items updates
 */
export function subscribeToReturnItems(
  onUpdate: (items: ReturnItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(db, ITEMS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const itemsMap = new Map<string, ReturnItem>();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ReturnItem;
        itemsMap.set(docSnap.id, {
          ...data,
          id: docSnap.id,
          status: calculateReturnStatus(data),
        });
      });
      const items = Array.from(itemsMap.values());
      // Sort newest first
      items.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      onUpdate(items);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      console.warn('Firestore snapshot error on items stream:', error);
    }
  );
}

/**
 * Subscribe to real-time suppliers updates
 */
export function subscribeToSuppliers(
  onUpdate: (suppliers: Supplier[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(db, SUPPLIERS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const suppliersMap = new Map<string, Supplier>();
      snapshot.forEach((docSnap) => {
        suppliersMap.set(docSnap.id, {
          ...(docSnap.data() as Supplier),
          id: docSnap.id,
        });
      });
      const suppliers = Array.from(suppliersMap.values());
      suppliers.sort((a, b) => a.name.localeCompare(b.name));
      onUpdate(suppliers);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      console.warn('Firestore snapshot error on suppliers stream:', error);
    }
  );
}

/**
 * Subscribe to real-time master products updates
 */
export function subscribeToMasterProducts(
  onUpdate: (products: MasterProduct[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(db, MASTER_PRODUCTS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const productsMap = new Map<string, MasterProduct>();
      snapshot.forEach((docSnap) => {
        productsMap.set(docSnap.id, {
          ...(docSnap.data() as MasterProduct),
          id: docSnap.id,
        });
      });
      const products = Array.from(productsMap.values());
      products.sort((a, b) => a.itemName.localeCompare(b.itemName));
      onUpdate(products);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      console.warn('Firestore snapshot error on master products stream:', error);
    }
  );
}

/**
 * Subscribe to real-time storage locations updates
 */
export function subscribeToStorageLocations(
  onUpdate: (locations: StorageLocation[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(db, STORAGE_LOCATIONS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const map = new Map<string, StorageLocation>();
      snapshot.forEach((docSnap) => {
        map.set(docSnap.id, {
          ...(docSnap.data() as StorageLocation),
          id: docSnap.id,
        });
      });
      const locations = Array.from(map.values());
      locations.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      onUpdate(locations);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      console.warn('Firestore snapshot error on storage locations stream:', error);
    }
  );
}

// =========================================================================
// OPTIMASI KUOTA FIRESTORE: CACHING, HITUNGAN COUNT MURAH & QUERY PAGINATION
// =========================================================================

interface MasterCounts {
  total: number;
  consignment: number;
  outright: number;
  lastUpdated: number;
}

let cachedCounts: MasterCounts | null = null;
let cachedStorageCount: { count: number; lastUpdated: number } | null = null;

// Memory cache for individual barcode lookups to avoid repeat Firestore reads
const masterBarcodeCache = new Map<string, MasterProduct>();
const storageBarcodeCache = new Map<string, StorageLocation>();

export function invalidateMasterProductCache(): void {
  cachedCounts = null;
  masterBarcodeCache.clear();
  try {
    sessionStorage.removeItem('hbc_master_counts');
  } catch {}
}

export function invalidateStorageLocationCache(): void {
  cachedStorageCount = null;
  storageBarcodeCache.clear();
  try {
    sessionStorage.removeItem('hbc_storage_count');
  } catch {}
}

/**
 * Dapatkan total item master produk, konsinyasi, dan outright dengan getCountFromServer
 * (Hanya menggunakan 1 read unit per 1.000 dokumen, sangat hemat kuota)
 * dan simpan di cache client selama 3 menit.
 */
export async function getMasterProductCounts(
  forceRefresh = false
): Promise<{ total: number; consignment: number; outright: number }> {
  const now = Date.now();
  const CACHE_TTL_MS = 3 * 60 * 1000; // 3 menit

  if (!forceRefresh && cachedCounts && now - cachedCounts.lastUpdated < CACHE_TTL_MS) {
    return {
      total: cachedCounts.total,
      consignment: cachedCounts.consignment,
      outright: cachedCounts.outright,
    };
  }

  // Coba ambil dari sessionStorage
  if (!forceRefresh) {
    try {
      const stored = sessionStorage.getItem('hbc_master_counts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && now - parsed.lastUpdated < CACHE_TTL_MS) {
          cachedCounts = parsed;
          return {
            total: parsed.total,
            consignment: parsed.consignment,
            outright: parsed.outright,
          };
        }
      }
    } catch {}
  }

  try {
    const colRef = collection(db, MASTER_PRODUCTS_COLLECTION);
    const [totalSnap, consignmentSnap, outrightSnap] = await Promise.all([
      getCountFromServer(colRef),
      getCountFromServer(query(colRef, where('procurementType', '==', 'CONSIGNMENT'))),
      getCountFromServer(query(colRef, where('procurementType', '==', 'OUTRIGHT'))),
    ]);

    const total = totalSnap.data().count;
    const consignment = consignmentSnap.data().count;
    const outright = outrightSnap.data().count;

    cachedCounts = {
      total,
      consignment,
      outright,
      lastUpdated: now,
    };

    try {
      sessionStorage.setItem('hbc_master_counts', JSON.stringify(cachedCounts));
    } catch {}

    return { total, consignment, outright };
  } catch (err) {
    console.warn('Gagal menghitung master product via getCountFromServer, fallback:', err);
    try {
      const local = localStorage.getItem('returku_master_products_v1');
      if (local) {
        const items = JSON.parse(local) as MasterProduct[];
        const total = items.length;
        const consignment = items.filter((i) => i.procurementType === 'CONSIGNMENT').length;
        const outright = items.filter((i) => !i.procurementType || i.procurementType === 'OUTRIGHT').length;
        return { total, consignment, outright };
      }
    } catch {}
    return { total: 0, consignment: 0, outright: 0 };
  }
}

/**
 * Hitung jumlah total lokasi penyimpanan dengan getCountFromServer
 */
export async function getStorageLocationsCount(forceRefresh = false): Promise<number> {
  const now = Date.now();
  const CACHE_TTL_MS = 3 * 60 * 1000;

  if (!forceRefresh && cachedStorageCount && now - cachedStorageCount.lastUpdated < CACHE_TTL_MS) {
    return cachedStorageCount.count;
  }

  try {
    const colRef = collection(db, STORAGE_LOCATIONS_COLLECTION);
    const snap = await getCountFromServer(colRef);
    const count = snap.data().count;
    cachedStorageCount = { count, lastUpdated: now };
    try {
      sessionStorage.setItem('hbc_storage_count', JSON.stringify(cachedStorageCount));
    } catch {}
    return count;
  } catch (err) {
    console.warn('Gagal menghitung storage locations via getCountFromServer, fallback:', err);
    try {
      const local = localStorage.getItem('returku_storage_locations_v1');
      if (local) {
        return (JSON.parse(local) as any[]).length;
      }
    } catch {}
    return 0;
  }
}

/**
 * Cari produk berdasarkan barcode secara tepat sasaran (hanya 1 read, atau 0 read jika ada di cache)
 */
export async function getMasterProductByBarcode(
  barcode: string,
  localFallbackList: MasterProduct[] = []
): Promise<MasterProduct | null> {
  const cleanCode = (barcode || '').trim().toLowerCase();
  if (!cleanCode) return null;

  // 1. Cek memory cache
  if (masterBarcodeCache.has(cleanCode)) {
    return masterBarcodeCache.get(cleanCode)!;
  }

  // 2. Cek local list yang sedang aktif di client
  const foundInLocal = localFallbackList.find(
    (p) => p.barcode && p.barcode.toLowerCase().trim() === cleanCode
  );
  if (foundInLocal) {
    masterBarcodeCache.set(cleanCode, foundInLocal);
    return foundInLocal;
  }

  // 3. Cek localStorage
  try {
    const raw = localStorage.getItem('returku_master_products_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as MasterProduct[];
      const hit = parsed.find(
        (p) => p.barcode && p.barcode.toLowerCase().trim() === cleanCode
      );
      if (hit) {
        masterBarcodeCache.set(cleanCode, hit);
        return hit;
      }
    }
  } catch {}

  // 4. Query tepat sasaran ke Firestore dengan limit(1)
  try {
    const q = query(
      collection(db, MASTER_PRODUCTS_COLLECTION),
      where('barcode', '==', barcode.trim()),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const prod = {
        ...(docSnap.data() as MasterProduct),
        id: docSnap.id,
      };
      masterBarcodeCache.set(cleanCode, prod);
      return prod;
    }
  } catch (err) {
    console.warn('Gagal mencari master product by barcode di Firestore:', err);
  }

  return null;
}

/**
 * Cari data lokasi penyimpanan berdasarkan barcode secara tepat sasaran (1 read, atau 0 jika di cache)
 */
export async function getStorageLocationByBarcode(
  barcode: string,
  localFallbackList: StorageLocation[] = []
): Promise<StorageLocation | null> {
  const cleanCode = (barcode || '').trim().toLowerCase();
  if (!cleanCode) return null;

  if (storageBarcodeCache.has(cleanCode)) {
    return storageBarcodeCache.get(cleanCode)!;
  }

  const foundInLocal = localFallbackList.find(
    (l) => l.barcode && l.barcode.toLowerCase().trim() === cleanCode
  );
  if (foundInLocal) {
    storageBarcodeCache.set(cleanCode, foundInLocal);
    return foundInLocal;
  }

  try {
    const raw = localStorage.getItem('returku_storage_locations_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as StorageLocation[];
      const hit = parsed.find(
        (l) => l.barcode && l.barcode.toLowerCase().trim() === cleanCode
      );
      if (hit) {
        storageBarcodeCache.set(cleanCode, hit);
        return hit;
      }
    }
  } catch {}

  try {
    const q = query(
      collection(db, STORAGE_LOCATIONS_COLLECTION),
      where('barcode', '==', barcode.trim()),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const loc = {
        ...(docSnap.data() as StorageLocation),
        id: docSnap.id,
      };
      storageBarcodeCache.set(cleanCode, loc);
      return loc;
    }
  } catch (err) {
    console.warn('Gagal mencari storage location by barcode di Firestore:', err);
  }

  return null;
}

/**
 * Simpan daftar departemen di cache client agar tidak re-fetch terus menerus
 */
export function getCachedDepartments(): string[] {
  try {
    const raw = localStorage.getItem('hbc_cached_departments');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveCachedDepartments(departments: string[]): void {
  try {
    localStorage.setItem('hbc_cached_departments', JSON.stringify(departments));
  } catch {}
}

export function sanitizeDataForFirestore<T extends Record<string, any>>(data: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'object' && item !== null ? sanitizeDataForFirestore(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeDataForFirestore(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Save or update a return item
 */
export async function saveReturnItemToFirestore(item: ReturnItem): Promise<void> {
  const docRef = doc(db, ITEMS_COLLECTION, item.id);
  try {
    const payload = sanitizeDataForFirestore(item);
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ITEMS_COLLECTION}/${item.id}`);
  }
}

/**
 * Delete a return item
 */
export async function deleteReturnItemFromFirestore(itemId: string): Promise<void> {
  const docRef = doc(db, ITEMS_COLLECTION, itemId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${ITEMS_COLLECTION}/${itemId}`);
  }
}

/**
 * Batch delete return items using writeBatch in chunks of 450
 */
export async function batchDeleteReturnItemsFromFirestore(itemIds: string[]): Promise<void> {
  if (!itemIds || itemIds.length === 0) return;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
    const chunk = itemIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, ITEMS_COLLECTION, id));
    }
    try {
      await batch.commit();
    } catch (err) {
      console.warn('Error committing batch delete for return items:', err);
    }
  }
}

/**
 * Save or update a supplier
 */
export async function saveSupplierToFirestore(supplier: Supplier): Promise<void> {
  const docRef = doc(db, SUPPLIERS_COLLECTION, supplier.id);
  try {
    const payload = sanitizeDataForFirestore(supplier);
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SUPPLIERS_COLLECTION}/${supplier.id}`);
  }
}

/**
 * Delete a supplier
 */
export async function deleteSupplierFromFirestore(supplierId: string): Promise<void> {
  const docRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${SUPPLIERS_COLLECTION}/${supplierId}`);
  }
}

/**
 * Batch delete suppliers using writeBatch in chunks of 450
 */
export async function batchDeleteSuppliersFromFirestore(supplierIds: string[]): Promise<void> {
  if (!supplierIds || supplierIds.length === 0) return;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < supplierIds.length; i += CHUNK_SIZE) {
    const chunk = supplierIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, SUPPLIERS_COLLECTION, id));
    }
    try {
      await batch.commit();
    } catch (err) {
      console.warn('Error committing batch delete for suppliers:', err);
    }
  }
}

/**
 * Save or update a master product
 */
export async function saveMasterProductToFirestore(product: MasterProduct): Promise<void> {
  const docRef = doc(db, MASTER_PRODUCTS_COLLECTION, product.id);
  try {
    const payload = sanitizeDataForFirestore(product);
    await setDoc(docRef, payload, { merge: true });
    invalidateMasterProductCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${MASTER_PRODUCTS_COLLECTION}/${product.id}`);
  }
}

/**
 * Bulk save master products from imported Excel / XLSX using Firestore writeBatch (chunks of 450)
 * Menghindari 1.000+ sequential HTTP requests dan menghemat koneksi jaringan.
 */
export async function batchSaveMasterProductsToFirestore(
  products: MasterProduct[],
  onProgress?: (savedCount: number, totalCount: number) => void
): Promise<{ successCount: number; failCount: number }> {
  if (!products || products.length === 0) return { successCount: 0, failCount: 0 };

  const CHUNK_SIZE = 450;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const product of chunk) {
      try {
        const docRef = doc(db, MASTER_PRODUCTS_COLLECTION, product.id);
        const payload = sanitizeDataForFirestore(product);
        batch.set(docRef, payload, { merge: true });
      } catch (err) {
        console.warn('Error queuing product in batch:', product.barcode, err);
        failCount++;
      }
    }

    try {
      await batch.commit();
      successCount += chunk.length;
      if (onProgress) {
        onProgress(successCount, products.length);
      }
    } catch (err) {
      console.warn('Batch commit failed for chunk, executing individual fallback:', err);
      // Fallback per-doc jika batch gagal
      for (const product of chunk) {
        try {
          const docRef = doc(db, MASTER_PRODUCTS_COLLECTION, product.id);
          const payload = sanitizeDataForFirestore(product);
          await setDoc(docRef, payload, { merge: true });
          successCount++;
        } catch {
          failCount++;
        }
      }
    }
  }

  invalidateMasterProductCache();
  return { successCount, failCount };
}

/**
 * Delete a master product
 */
export async function deleteMasterProductFromFirestore(productId: string): Promise<void> {
  const docRef = doc(db, MASTER_PRODUCTS_COLLECTION, productId);
  try {
    await deleteDoc(docRef);
    invalidateMasterProductCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${MASTER_PRODUCTS_COLLECTION}/${productId}`);
  }
}

/**
 * Batch delete master products directly using writeBatch without downloading the entire collection
 * (MENGHEMAT 14.000+ READS YANG SEBELUMNYA TERJADI SAAT MENGHAPUS PRODUK)
 */
export async function batchDeleteMasterProductsFromFirestore(productIds: string[]): Promise<void> {
  if (!productIds || productIds.length === 0) return;

  const CHUNK_SIZE = 450;
  for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
    const chunk = productIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const id of chunk) {
      const docRef = doc(db, MASTER_PRODUCTS_COLLECTION, id);
      batch.delete(docRef);
    }

    try {
      await batch.commit();
    } catch (err) {
      console.warn('Error committing delete batch:', err);
    }
  }

  invalidateMasterProductCache();
}

/**
 * Clear all master products from Firestore
 */
export async function clearAllMasterProductsFromFirestore(ids?: string[]): Promise<void> {
  try {
    if (ids && ids.length > 0) {
      await batchDeleteMasterProductsFromFirestore(ids);
      invalidateMasterProductCache();
      return;
    }
    const snapshot = await getDocs(collection(db, MASTER_PRODUCTS_COLLECTION));
    const docs = snapshot.docs;
    const CHUNK_SIZE = 450;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
    invalidateMasterProductCache();
  } catch (error) {
    console.warn('Error clearing master products from Firestore:', error);
  }
}

/**
 * Save or update a storage location
 */
export async function saveStorageLocationToFirestore(location: StorageLocation): Promise<void> {
  const docRef = doc(db, STORAGE_LOCATIONS_COLLECTION, location.id);
  try {
    const payload = sanitizeDataForFirestore(location);
    await setDoc(docRef, payload, { merge: true });
    invalidateStorageLocationCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${STORAGE_LOCATIONS_COLLECTION}/${location.id}`);
  }
}

/**
 * Bulk save storage locations using writeBatch in chunks
 */
export async function batchSaveStorageLocationsToFirestore(locations: StorageLocation[]): Promise<void> {
  if (!locations || locations.length === 0) return;

  const CHUNK_SIZE = 450;
  for (let i = 0; i < locations.length; i += CHUNK_SIZE) {
    const chunk = locations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const loc of chunk) {
      const docRef = doc(db, STORAGE_LOCATIONS_COLLECTION, loc.id);
      batch.set(docRef, sanitizeDataForFirestore(loc), { merge: true });
    }

    try {
      await batch.commit();
    } catch (err) {
      console.warn('Error committing storage location batch:', err);
    }
  }

  invalidateStorageLocationCache();
}

/**
 * Delete a storage location
 */
export async function deleteStorageLocationFromFirestore(locationId: string): Promise<void> {
  const docRef = doc(db, STORAGE_LOCATIONS_COLLECTION, locationId);
  try {
    await deleteDoc(docRef);
    invalidateStorageLocationCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${STORAGE_LOCATIONS_COLLECTION}/${locationId}`);
  }
}
