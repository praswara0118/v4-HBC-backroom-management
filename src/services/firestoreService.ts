import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
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
    // Check if initial seeding has already been completed in this environment
    const hasSeededLocal = localStorage.getItem('returku_system_seeded') === 'true';
    if (hasSeededLocal) {
      return; // Data has already been seeded in the past; never re-populate over cleared/deleted databases!
    }

    const testRef = doc(db, 'systemMetadata', 'initial_seed');
    try {
      const testSnap = await getDoc(testRef);
      if (testSnap.exists()) {
        localStorage.setItem('returku_system_seeded', 'true');
        return; // Seeded in Firestore already; respect user's deleted/emptied state
      }
    } catch {}

    const suppliersSnapshot = await getDocs(collection(db, SUPPLIERS_COLLECTION));
    if (suppliersSnapshot.empty) {
      for (const sup of INITIAL_SUPPLIERS) {
        await setDoc(doc(db, SUPPLIERS_COLLECTION, sup.id), sup);
      }
    }

    const itemsSnapshot = await getDocs(collection(db, ITEMS_COLLECTION));
    if (itemsSnapshot.empty) {
      for (const item of INITIAL_RETURN_ITEMS) {
        await setDoc(doc(db, ITEMS_COLLECTION, item.id), item);
      }
    }

    const masterSnapshot = await getDocs(collection(db, MASTER_PRODUCTS_COLLECTION));
    if (masterSnapshot.empty) {
      for (const prod of INITIAL_MASTER_PRODUCTS) {
        await setDoc(doc(db, MASTER_PRODUCTS_COLLECTION, prod.id), prod);
      }
    }

    const storageSnapshot = await getDocs(collection(db, STORAGE_LOCATIONS_COLLECTION));
    if (storageSnapshot.empty) {
      for (const loc of INITIAL_STORAGE_LOCATIONS) {
        await setDoc(doc(db, STORAGE_LOCATIONS_COLLECTION, loc.id), loc);
      }
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
 * Save or update a master product
 */
export async function saveMasterProductToFirestore(product: MasterProduct): Promise<void> {
  const docRef = doc(db, MASTER_PRODUCTS_COLLECTION, product.id);
  try {
    const payload = sanitizeDataForFirestore(product);
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${MASTER_PRODUCTS_COLLECTION}/${product.id}`);
  }
}

/**
 * Bulk save master products from imported Excel / XLSX
 */
export async function batchSaveMasterProductsToFirestore(products: MasterProduct[]): Promise<void> {
  for (const product of products) {
    try {
      const docRef = doc(db, MASTER_PRODUCTS_COLLECTION, product.id);
      const payload = sanitizeDataForFirestore(product);
      await setDoc(docRef, payload, { merge: true });
    } catch (err) {
      console.warn('Error saving product in batch:', product.barcode, err);
    }
  }
}

/**
 * Delete a master product
 */
export async function deleteMasterProductFromFirestore(productId: string): Promise<void> {
  const docRef = doc(db, MASTER_PRODUCTS_COLLECTION, productId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${MASTER_PRODUCTS_COLLECTION}/${productId}`);
  }
}

/**
 * Batch delete master products
 */
export async function batchDeleteMasterProductsFromFirestore(productIds: string[]): Promise<void> {
  if (!productIds || productIds.length === 0) return;
  const idsSet = new Set(productIds);

  // 1. Direct delete by product id
  await Promise.all(
    productIds.map(async (id) => {
      try {
        const docRef = doc(db, MASTER_PRODUCTS_COLLECTION, id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Error deleting master product by doc id:', id, err);
      }
    })
  );

  // 2. Extra safety: query documents in masterProducts and delete any whose id matches
  try {
    const snapshot = await getDocs(collection(db, MASTER_PRODUCTS_COLLECTION));
    const toDeleteDocs = snapshot.docs.filter((d) => {
      const data = d.data() as any;
      return idsSet.has(d.id) || (data && data.id && idsSet.has(data.id));
    });
    await Promise.all(
      toDeleteDocs.map(async (d) => {
        try {
          await deleteDoc(d.ref);
        } catch (e) {
          console.warn('Error removing matched doc:', d.id, e);
        }
      })
    );
  } catch (err) {
    console.warn('Cleanup check error on batch delete:', err);
  }
}

/**
 * Clear all master products from Firestore
 */
export async function clearAllMasterProductsFromFirestore(ids?: string[]): Promise<void> {
  try {
    if (ids && ids.length > 0) {
      await batchDeleteMasterProductsFromFirestore(ids);
      return;
    }
    const snapshot = await getDocs(collection(db, MASTER_PRODUCTS_COLLECTION));
    const docs = snapshot.docs;
    const batchSize = 50;
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      await Promise.all(chunk.map((d) => deleteDoc(d.ref)));
    }
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${STORAGE_LOCATIONS_COLLECTION}/${location.id}`);
  }
}

/**
 * Bulk save storage locations
 */
export async function batchSaveStorageLocationsToFirestore(locations: StorageLocation[]): Promise<void> {
  for (const loc of locations) {
    try {
      const docRef = doc(db, STORAGE_LOCATIONS_COLLECTION, loc.id);
      const payload = sanitizeDataForFirestore(loc);
      await setDoc(docRef, payload, { merge: true });
    } catch (err) {
      console.warn('Error saving storage location in batch:', loc.barcode, err);
    }
  }
}

/**
 * Delete a storage location
 */
export async function deleteStorageLocationFromFirestore(locationId: string): Promise<void> {
  const docRef = doc(db, STORAGE_LOCATIONS_COLLECTION, locationId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${STORAGE_LOCATIONS_COLLECTION}/${locationId}`);
  }
}
