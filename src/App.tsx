import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ReturnItem,
  Supplier,
  FilterStatus,
  WarningLog,
  MasterProduct,
  StorageLocation,
  AppNavigationMode,
  DeviceViewMode,
} from './types/inventory';
import {
  INITIAL_SUPPLIERS,
  INITIAL_RETURN_ITEMS,
  INITIAL_MASTER_PRODUCTS,
  INITIAL_STORAGE_LOCATIONS,
} from './data/seedData';
import { calculateReturnStatus, getDaysRemaining, formatIndoDate } from './utils/notification';
import { BarcodeBadge } from './components/BarcodeBadge';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { WarningModal } from './components/WarningModal';
import { ReturnFormModal } from './components/ReturnFormModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { SupplierListModal } from './components/SupplierListModal';
import { PrintSlipModal } from './components/PrintSlipModal';
import { MasterProductModal } from './components/MasterProductModal';
import { StorageLocationView } from './components/StorageLocationView';
import { DatabaseManagementView } from './components/DatabaseManagementView';
import { DeviceModeSelector } from './components/DeviceModeSelector';
import { exportAllToExcel } from './utils/excelService';
import {
  subscribeToReturnItems,
  subscribeToSuppliers,
  subscribeToMasterProducts,
  subscribeToStorageLocations,
  saveReturnItemToFirestore,
  deleteReturnItemFromFirestore,
  saveSupplierToFirestore,
  deleteSupplierFromFirestore,
  saveMasterProductToFirestore,
  batchSaveMasterProductsToFirestore,
  deleteMasterProductFromFirestore,
  batchDeleteMasterProductsFromFirestore,
  clearAllMasterProductsFromFirestore,
  saveStorageLocationToFirestore,
  deleteStorageLocationFromFirestore,
  seedInitialFirestoreData,
} from './services/firestoreService';
import { testConnection } from './firebase';
import {
  Camera,
  Plus,
  Search,
  Filter,
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MessageSquare,
  Mail,
  Download,
  Upload,
  RotateCcw,
  Eye,
  SlidersHorizontal,
  Package,
  Layers,
  ChevronRight,
  ExternalLink,
  Cloud,
  Wifi,
  WifiOff,
  Users,
  Database,
  FileSpreadsheet,
  Image as ImageIcon,
  MapPin,
  Smartphone,
  Tablet,
  Monitor,
  LayoutGrid,
  List,
  Sparkles,
} from 'lucide-react';

const STORAGE_KEY_ITEMS = 'returku_items_v1';
const STORAGE_KEY_SUPPLIERS = 'returku_suppliers_v1';
const STORAGE_KEY_MASTER_PRODUCTS = 'returku_master_products_v1';
const STORAGE_KEY_STORAGE_LOCATIONS = 'returku_storage_locations_v1';

const deduplicateSuppliers = (list: Supplier[]): Supplier[] => {
  const seen = new Set<string>();
  const result: Supplier[] = [];
  for (const s of list) {
    if (s && s.id && !seen.has(s.id)) {
      seen.add(s.id);
      result.push(s);
    }
  }
  return result;
};

const deduplicateItems = (list: ReturnItem[]): ReturnItem[] => {
  const seen = new Set<string>();
  const result: ReturnItem[] = [];
  for (const item of list) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
};

export default function App() {
  // Pilihan Tampilan Layar (Responsif Auto, Mobile, Tablet, Desktop) — DEFAULT IS AUTO (RESPONSIF)!
  const [deviceMode, setDeviceMode] = useState<DeviceViewMode>(() => {
    try {
      const saved = localStorage.getItem('returku_device_mode');
      if (saved === 'mobile' || saved === 'tablet' || saved === 'desktop' || saved === 'auto') {
        return saved as DeviceViewMode;
      }
    } catch {}
    return 'auto'; // Default tampilan adalah responsif mengikuti device yang digunakan
  });

  // Navigation mode: 'RETURN' (Fungsi 1: Manajemen Retur) | 'STORAGE' (Fungsi 2: Cek & Lokasi Simpan) | 'DATABASE' (Fungsi 3: Database & Impor)
  const [activeAppMode, setActiveAppMode] = useState<AppNavigationMode>('RETURN');

  const handleSetDeviceMode = (mode: DeviceViewMode) => {
    setDeviceMode(mode);
    try {
      localStorage.setItem('returku_device_mode', mode);
    } catch {}
    if (mode === 'mobile') {
      setViewMode('cards');
    }
    showAlert(
      `Beralih ke tampilan: ${
        mode === 'auto'
          ? '↔️ Responsif (Otomatis Sesuai Layar Perangkat) — Default'
          : mode === 'mobile'
          ? '📱 Mobile (HP)'
          : mode === 'tablet'
          ? '📟 Tablet (iPad / Terminal)'
          : '💻 Desktop (Komputer)'
      }`
    );
  };

  // Cloud & Local State
  const [items, setItems] = useState<ReturnItem[]>(INITIAL_RETURN_ITEMS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>(INITIAL_MASTER_PRODUCTS);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(INITIAL_STORAGE_LOCATIONS);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor network online/offline state
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

  // Initialize Firestore and real-time synchronization
  useEffect(() => {
    let unsubscribeItems: (() => void) | undefined;
    let unsubscribeSuppliers: (() => void) | undefined;
    let unsubscribeMasterProducts: (() => void) | undefined;
    let unsubscribeStorageLocations: (() => void) | undefined;

    const initFirebaseSync = async () => {
      try {
        await testConnection();
        await seedInitialFirestoreData();
        setIsCloudConnected(true);

        unsubscribeItems = subscribeToReturnItems(
          (liveItems) => {
            if (Array.isArray(liveItems)) {
              const unique = deduplicateItems(liveItems);
              setItems(unique);
              localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(unique));
            }
          },
          (err) => {
            console.warn('Fallback to local storage due to Firestore stream error:', err);
          }
        );

        unsubscribeSuppliers = subscribeToSuppliers(
          (liveSuppliers) => {
            if (Array.isArray(liveSuppliers)) {
              const unique = deduplicateSuppliers(liveSuppliers);
              setSuppliers(unique);
              localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(unique));
            }
          },
          (err) => {
            console.warn('Fallback to local storage due to Firestore stream error:', err);
          }
        );

        unsubscribeMasterProducts = subscribeToMasterProducts(
          (liveProducts) => {
            if (Array.isArray(liveProducts)) {
              setMasterProducts(liveProducts);
              localStorage.setItem(STORAGE_KEY_MASTER_PRODUCTS, JSON.stringify(liveProducts));
            }
          },
          (err) => {
            console.warn('Fallback to local storage due to master products stream error:', err);
          }
        );

        unsubscribeStorageLocations = subscribeToStorageLocations(
          (liveLocations) => {
            if (Array.isArray(liveLocations)) {
              setStorageLocations(liveLocations);
              localStorage.setItem(STORAGE_KEY_STORAGE_LOCATIONS, JSON.stringify(liveLocations));
            }
          },
          (err) => {
            console.warn('Fallback to local storage due to storage locations stream error:', err);
          }
        );
      } catch (err) {
        console.warn('Using local storage fallback:', err);
        setIsCloudConnected(false);
        // Load local cache if any
        try {
          const cachedItems = localStorage.getItem(STORAGE_KEY_ITEMS);
          if (cachedItems) setItems(JSON.parse(cachedItems));
          const cachedSuppliers = localStorage.getItem(STORAGE_KEY_SUPPLIERS);
          if (cachedSuppliers) setSuppliers(JSON.parse(cachedSuppliers));
          const cachedMaster = localStorage.getItem(STORAGE_KEY_MASTER_PRODUCTS);
          if (cachedMaster) setMasterProducts(JSON.parse(cachedMaster));
          const cachedStorage = localStorage.getItem(STORAGE_KEY_STORAGE_LOCATIONS);
          if (cachedStorage) setStorageLocations(JSON.parse(cachedStorage));
        } catch {
          // ignore
        }
      }
    };

    initFirebaseSync();

    return () => {
      if (unsubscribeItems) unsubscribeItems();
      if (unsubscribeSuppliers) unsubscribeSuppliers();
      if (unsubscribeMasterProducts) unsubscribeMasterProducts();
      if (unsubscribeStorageLocations) unsubscribeStorageLocations();
    };
  }, []);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Active item contexts
  const [activeItem, setActiveItem] = useState<ReturnItem | null>(null);
  const [editingItem, setEditingItem] = useState<ReturnItem | null>(null);
  const [prefilledBarcode, setPrefilledBarcode] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Toast / Quick Alert state
  const [alertNotice, setAlertNotice] = useState<string | null>(null);
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showAlert = (msg: string) => {
    setAlertNotice(msg);
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => {
      setAlertNotice(null);
    }, 4000);
  };

  // Hardware Barcode Scanner listener (USB / Bluetooth barcode gun)
  // Most barcode scanners type keys very fast and end with 'Enter'
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          const scannedCode = buffer.trim();
          buffer = '';
          const found = items.find(
            (i) => i.barcode.toLowerCase() === scannedCode.toLowerCase()
          );
          if (found) {
            setActiveItem(found);
            setIsDetailModalOpen(true);
            showAlert(`Barcode ${scannedCode} terdeteksi: ${found.itemName}`);
          } else {
            const foundMaster = masterProducts.find(
              (p) => p.barcode.toLowerCase() === scannedCode.toLowerCase()
            );
            setPrefilledBarcode(scannedCode);
            setEditingItem(null);
            setIsFormOpen(true);
            if (foundMaster) {
              showAlert(`✓ Produk "${foundMaster.itemName}" ditemukan di database master XLSX! Data terisi otomatis.`);
            } else {
              showAlert(`Barcode ${scannedCode} belum ada di master database. Silakan isi formulir return.`);
            }
          }
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, masterProducts]);

  // Derived metrics
  const activeItems = useMemo(
    () => items.filter((i) => i.status !== 'Sudah Diambil' && i.status !== 'Diganti Baru'),
    [items]
  );

  const overdueItems = useMemo(
    () => items.filter((i) => i.status === 'Lewat Tenggat'),
    [items]
  );

  const warningItems = useMemo(
    () => items.filter((i) => i.status === 'Mendekati Tenggat'),
    [items]
  );

  const completedItems = useMemo(
    () => items.filter((i) => i.status === 'Sudah Diambil' || i.status === 'Diganti Baru'),
    [items]
  );

  // Filtered items list
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status filter
      if (statusFilter === 'ACTIVE') {
        if (item.status === 'Sudah Diambil' || item.status === 'Diganti Baru') return false;
      } else if (statusFilter === 'WARNING') {
        if (item.status !== 'Mendekati Tenggat') return false;
      } else if (statusFilter === 'OVERDUE') {
        if (item.status !== 'Lewat Tenggat') return false;
      } else if (statusFilter === 'COMPLETED') {
        if (item.status !== 'Sudah Diambil' && item.status !== 'Diganti Baru') return false;
      }

      // Supplier filter
      if (selectedSupplierFilter !== 'ALL' && item.supplierId !== selectedSupplierFilter) {
        return false;
      }

      // Search query (Barcode, Name, SKU, Supplier, PIC, Reason)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchBarcode = item.barcode.toLowerCase().includes(query);
        const matchName = item.itemName.toLowerCase().includes(query);
        const matchSku = (item.sku || '').toLowerCase().includes(query);
        const matchSup = item.supplierName.toLowerCase().includes(query);
        const matchReason = item.returnReason.toLowerCase().includes(query);
        const matchSlot = item.locationSlot.toLowerCase().includes(query);

        if (!matchBarcode && !matchName && !matchSku && !matchSup && !matchReason && !matchSlot) {
          return false;
        }
      }

      return true;
    });
  }, [items, statusFilter, selectedSupplierFilter, searchQuery]);

  const uniqueSuppliers = useMemo(() => deduplicateSuppliers(suppliers), [suppliers]);
  const uniqueFilteredItems = useMemo(() => deduplicateItems(filteredItems), [filteredItems]);

  // Handler: Save return item (create or edit) -> Synced to Cloud Firestore
  const handleSaveItem = async (
    itemToSave: ReturnItem,
    newSupplier?: Supplier,
    newMasterProduct?: MasterProduct
  ) => {
    // 1. Immediately update UI state so product appears right away!
    setItems((prev) => {
      const withoutOld = prev.filter((i) => i.id !== itemToSave.id);
      const updated = deduplicateItems([itemToSave, ...withoutOld]);
      try {
        localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (newSupplier) {
      setSuppliers((prev) => {
        const withoutOld = prev.filter((s) => s.id !== newSupplier.id);
        const updated = deduplicateSuppliers([newSupplier, ...withoutOld]);
        try {
          localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    if (newMasterProduct) {
      setMasterProducts((prev) => {
        const withoutOld = prev.filter((p) => p.id !== newMasterProduct.id);
        const updated = [newMasterProduct, ...withoutOld];
        try {
          localStorage.setItem(STORAGE_KEY_MASTER_PRODUCTS, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    // 2. Reset active filters & search query so the newly added product is immediately visible!
    setStatusFilter('ALL');
    setSelectedSupplierFilter('ALL');
    setSearchQuery('');

    // 3. Persist to Cloud Firestore in background
    try {
      if (newSupplier) {
        await saveSupplierToFirestore(newSupplier);
      }
      if (newMasterProduct) {
        await saveMasterProductToFirestore(newMasterProduct);
      }
      await saveReturnItemToFirestore(itemToSave);
      showAlert(`Barang return "${itemToSave.itemName}" berhasil disimpan dan tersinkron ke Cloud.`);
    } catch (err) {
      console.warn('Saved locally, will sync when connection permits:', err);
      showAlert(`Barang return "${itemToSave.itemName}" berhasil disimpan di memori perangkat.`);
    }
  };

  // Handler: Save Master Product
  const handleSaveMasterProduct = async (productToSave: MasterProduct) => {
    setMasterProducts((prev) => {
      const withoutOld = prev.filter((p) => p.id !== productToSave.id);
      const updated = [productToSave, ...withoutOld];
      try {
        localStorage.setItem(STORAGE_KEY_MASTER_PRODUCTS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await saveMasterProductToFirestore(productToSave);
      showAlert(`Master produk "${productToSave.itemName}" berhasil disimpan & disinkronkan ke Cloud.`);
    } catch (err) {
      console.warn('Master product saved locally:', err);
      showAlert(`Master produk "${productToSave.itemName}" disimpan di perangkat.`);
    }
  };

  // Handler: Batch Save Master Products (from Excel import)
  const handleBatchSaveMasterProducts = async (products: MasterProduct[]) => {
    setMasterProducts((prev) => {
      const map = new Map<string, MasterProduct>();
      for (const p of prev) {
        map.set(p.barcode.toLowerCase(), p);
      }
      for (const p of products) {
        map.set(p.barcode.toLowerCase(), p);
      }
      const updated = Array.from(map.values());
      try {
        localStorage.setItem(STORAGE_KEY_MASTER_PRODUCTS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await batchSaveMasterProductsToFirestore(products);
      showAlert(`Berhasil menyinkronkan ${products.length} master produk ke Cloud Firestore.`);
    } catch (err) {
      console.warn('Batch master products error:', err);
    }
  };

  // Handler: Delete Master Product
  const handleDeleteMasterProduct = async (productId: string) => {
    setMasterProducts((prev) => {
      const updated = prev.filter((p) => p.id !== productId);
      try {
        localStorage.setItem(STORAGE_KEY_MASTER_PRODUCTS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await deleteMasterProductFromFirestore(productId);
      showAlert('Master produk berhasil dihapus.');
    } catch (err) {
      console.warn('Error deleting master product:', err);
    }
  };

  // Handler: Batch Delete Master Products
  const handleBatchDeleteMasterProducts = async (productIds: string[]) => {
    setMasterProducts((prev) => {
      const updated = prev.filter((p) => !productIds.includes(p.id));
      try {
        localStorage.setItem(STORAGE_KEY_MASTER_PRODUCTS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await batchDeleteMasterProductsFromFirestore(productIds);
      showAlert(`✓ ${productIds.length} produk berhasil dihapus.`);
    } catch (err) {
      console.warn('Error batch deleting master products:', err);
    }
  };

  // Handler: Clear All Master Products
  const handleClearAllMasterProducts = async (idsToClear?: string[]) => {
    let updated: MasterProduct[];
    if (idsToClear && idsToClear.length > 0) {
      updated = masterProducts.filter((p) => !idsToClear.includes(p.id));
    } else {
      updated = [];
    }
    setMasterProducts(updated);
    try {
      localStorage.setItem(STORAGE_KEY_MASTER_PRODUCTS, JSON.stringify(updated));
    } catch {}

    try {
      await clearAllMasterProductsFromFirestore(idsToClear);
      showAlert('✓ Data produk berhasil dikosongkan.');
    } catch (err) {
      console.warn('Error clearing master products:', err);
    }
  };

  // Handler: Save storage location -> Synced to Cloud Firestore & LocalStorage
  const handleSaveStorageLocation = async (locationToSave: StorageLocation) => {
    setStorageLocations((prev) => {
      const withoutOld = prev.filter((l) => l.id !== locationToSave.id);
      const updated = [locationToSave, ...withoutOld];
      try {
        localStorage.setItem(STORAGE_KEY_STORAGE_LOCATIONS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await saveStorageLocationToFirestore(locationToSave);
      showAlert(`✓ Tempat penyimpanan "${locationToSave.itemName}" berhasil disimpan ke Cloud.`);
    } catch (err) {
      console.warn('Storage location saved locally:', err);
      showAlert(`✓ Tempat penyimpanan "${locationToSave.itemName}" tersimpan di perangkat.`);
    }
  };

  // Handler: Delete storage location -> Synced to Cloud Firestore
  const handleDeleteStorageLocation = async (locationId: string) => {
    setStorageLocations((prev) => {
      const updated = prev.filter((l) => l.id !== locationId);
      try {
        localStorage.setItem(STORAGE_KEY_STORAGE_LOCATIONS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await deleteStorageLocationFromFirestore(locationId);
      showAlert('Catatan lokasi penyimpanan berhasil dihapus dari Cloud.');
    } catch (err) {
      console.warn('Error deleting storage location:', err);
    }
  };

  // Handler: Export All Data to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      exportAllToExcel(items, masterProducts, suppliers, storageLocations);
      showAlert('✓ File Excel (.xlsx) berhasil diekspor dan diunduh!');
    } catch (err: any) {
      console.error(err);
      showAlert(`Gagal mengekspor Excel: ${err.message || 'Terjadi kesalahan'}`);
    }
  };

  // Handler: Save supplier -> Synced to Cloud Firestore & LocalStorage
  const handleSaveSupplier = async (supplierToSave: Supplier) => {
    // 1. Update state & localStorage immediately
    setSuppliers((prev) => {
      const withoutOld = prev.filter((s) => s.id !== supplierToSave.id);
      const updated = deduplicateSuppliers([supplierToSave, ...withoutOld]);
      try {
        localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Also update items if this supplier's contact info or name changed
    setItems((prev) => {
      let changed = false;
      const updated = prev.map((item) => {
        if (item.supplierId === supplierToSave.id) {
          changed = true;
          return {
            ...item,
            supplierName: supplierToSave.name,
            supplierPic: supplierToSave.picName,
            supplierPhone: supplierToSave.phone,
            supplierEmail: supplierToSave.email,
          };
        }
        return item;
      });
      if (changed) {
        try {
          localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });

    // 3. Persist to Cloud Firestore
    try {
      await saveSupplierToFirestore(supplierToSave);
      showAlert(`Data supplier "${supplierToSave.name}" berhasil disimpan & tersinkron Cloud.`);
    } catch (err) {
      console.error(err);
      showAlert(`Data supplier "${supplierToSave.name}" tersimpan di perangkat.`);
    }
  };

  // Handler: Delete supplier -> Synced to Cloud Firestore & LocalStorage
  const handleDeleteSupplier = async (supplierId: string) => {
    const targetSup = suppliers.find((s) => s.id === supplierId);
    setSuppliers((prev) => {
      const updated = prev.filter((s) => s.id !== supplierId);
      try {
        localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (selectedSupplierFilter === supplierId) {
      setSelectedSupplierFilter('ALL');
    }

    try {
      await deleteSupplierFromFirestore(supplierId);
      showAlert(`Supplier "${targetSup?.name || ''}" berhasil dihapus.`);
    } catch (err) {
      console.error(err);
      showAlert(`Supplier "${targetSup?.name || ''}" dihapus dari perangkat.`);
    }
  };

  // Handler: Delete item -> Synced to Cloud Firestore
  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteReturnItemFromFirestore(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      showAlert('Barang return berhasil dihapus dari Cloud.');
    } catch (err) {
      console.error(err);
    }
  };

  // Handler: Mark item as picked up -> Synced to Cloud Firestore
  const handleMarkAsPickedUp = async (itemId: string, pickedUpBy: string) => {
    const targetItem = items.find((i) => i.id === itemId);
    if (!targetItem) return;

    const updatedItem: ReturnItem = {
      ...targetItem,
      status: 'Sudah Diambil',
      pickedUpDate: new Date().toISOString().split('T')[0],
      pickedUpBy: pickedUpBy,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveReturnItemToFirestore(updatedItem);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));
      showAlert('Status barang berhasil diperbarui di Cloud: Sudah Diambil.');
    } catch (err) {
      console.error(err);
    }
  };

  // Handler: Log warning -> Synced to Cloud Firestore
  const handleLogWarning = async (itemId: string, log: WarningLog) => {
    const targetItem = items.find((i) => i.id === itemId);
    if (!targetItem) return;

    const updatedItem: ReturnItem = {
      ...targetItem,
      warningHistory: [log, ...(targetItem.warningHistory || [])],
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveReturnItemToFirestore(updatedItem);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));
      showAlert(`Peringatan (${log.channel.toUpperCase()}) dicatat.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Handler: Scanned item selected
  const handleSelectScannedItem = (item: ReturnItem) => {
    setActiveItem(item);
    setIsDetailModalOpen(true);
  };

  // Handler: Scanned barcode not found
  const handleBarcodeNotFound = (scannedCode: string) => {
    setPrefilledBarcode(scannedCode);
    setEditingItem(null);
    setIsFormOpen(true);
  };

  // Reset to seed data
  const handleExecuteResetData = () => {
    setItems(
      INITIAL_RETURN_ITEMS.map((item) => ({
        ...item,
        status: calculateReturnStatus(item),
      }))
    );
    setSuppliers(INITIAL_SUPPLIERS);
    setMasterProducts(INITIAL_MASTER_PRODUCTS);
    setStorageLocations(INITIAL_STORAGE_LOCATIONS);
    setShowResetConfirm(false);
    showAlert('Data berhasil di-reset ke data contoh awal.');
  };

  const handleResetData = () => {
    if (confirm('Kembalikan semua data barang return, master produk, dan supplier ke data contoh awal?')) {
      handleExecuteResetData();
    }
  };

  // Export data as JSON
  const handleExportJSON = () => {
    const dataToExport = {
      exportDate: new Date().toISOString(),
      suppliers,
      items,
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `returku-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert('File backup JSON berhasil diunduh.');
  };

  // Import JSON backup
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed.items) && Array.isArray(parsed.suppliers)) {
          setItems(parsed.items);
          setSuppliers(parsed.suppliers);
          showAlert('Data backup berhasil diimpor.');
        } else {
          alert('Format file JSON tidak sesuai struktur ReturKu.');
        }
      } catch {
        alert('Gagal membaca file JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className={`min-h-screen text-neutral-900 font-sans flex flex-col transition-all duration-300 ${
        deviceMode === 'mobile'
          ? 'bg-slate-900/95 py-0 sm:py-6 sm:px-4 items-center justify-start'
          : deviceMode === 'tablet'
          ? 'bg-slate-900/90 py-0 sm:py-6 sm:px-4 items-center justify-start'
          : 'bg-neutral-100/60'
      }`}
    >
      {/* Toast Notification */}
      {alertNotice && (
        <div className="fixed bottom-5 right-5 z-50 bg-neutral-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl border border-neutral-700 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{alertNotice}</span>
        </div>
      )}

      {/* Top Device Viewport Switcher Toolbar (Mobile / Tablet / Desktop / Responsif) */}
      <DeviceModeSelector
        deviceMode={deviceMode}
        onChangeMode={handleSetDeviceMode}
        activeAppMode={activeAppMode}
        onSwitchAppMode={(mode) => setActiveAppMode(mode)}
        itemCount={items.length}
        locationCount={storageLocations.length}
        masterProductCount={masterProducts.length}
      />

      {/* Device Simulator Banner (Shown on desktop when viewing Mobile or Tablet mode) */}
      {deviceMode === 'mobile' && (
        <div className="w-full max-w-[440px] hidden sm:flex items-center justify-between text-[11px] text-slate-300 px-3 py-1.5 mb-1 bg-slate-800/90 rounded-t-xl border border-slate-700/60 shadow-xs">
          <div className="flex items-center gap-1.5 font-bold text-pink-400">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mode Layar HP Mobile (Default Aktif)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <button
              onClick={() => handleSetDeviceMode('tablet')}
              className="hover:text-white underline text-[10px] cursor-pointer"
            >
              Tablet
            </button>
            <span>·</span>
            <button
              onClick={() => handleSetDeviceMode('desktop')}
              className="hover:text-white underline text-[10px] cursor-pointer"
            >
              Desktop
            </button>
            <span>·</span>
            <button
              onClick={() => handleSetDeviceMode('auto')}
              className="hover:text-white underline text-[10px] cursor-pointer"
            >
              Layar Penuh
            </button>
          </div>
        </div>
      )}

      {deviceMode === 'tablet' && (
        <div className="w-full max-w-3xl hidden sm:flex items-center justify-between text-[11px] text-slate-300 px-3 py-1.5 mb-1 bg-slate-800/90 rounded-t-xl border border-slate-700/60 shadow-xs">
          <div className="flex items-center gap-1.5 font-bold text-blue-400">
            <Tablet className="w-3.5 h-3.5" />
            <span>Mode Layar Tablet (768px — iPad / Terminal Gudang)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <button
              onClick={() => handleSetDeviceMode('mobile')}
              className="hover:text-white underline text-[10px] cursor-pointer"
            >
              Ubah ke Mobile
            </button>
            <span>·</span>
            <button
              onClick={() => handleSetDeviceMode('desktop')}
              className="hover:text-white underline text-[10px] cursor-pointer"
            >
              Desktop
            </button>
          </div>
        </div>
      )}

      {/* Main Container Sized and Constrained by Device Mode */}
      <div
        className={`w-full flex-1 flex flex-col transition-all duration-300 ${
          deviceMode === 'mobile'
            ? 'max-w-[440px] sm:min-h-[850px] bg-neutral-100 sm:rounded-2xl sm:shadow-2xl sm:border sm:border-slate-700/80 overflow-hidden relative'
            : deviceMode === 'tablet'
            ? 'max-w-3xl sm:min-h-[850px] bg-neutral-100 sm:rounded-2xl sm:shadow-xl sm:border sm:border-slate-700/70 overflow-hidden relative'
            : deviceMode === 'desktop'
            ? 'max-w-7xl mx-auto'
            : 'w-full'
        }`}
      >
        {/* Top Header */}
        <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
          <div className="px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
            {/* Zone 1: Wordmark & Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <img
                src="/icon.svg"
                alt="AEON Health & Beauty Logo"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg shadow-xs shrink-0 object-cover"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-lg font-bold tracking-tight text-neutral-900 leading-tight">
                    HBC Return
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#b8126f] text-white tracking-wider">
                    © 2026
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-neutral-500 font-medium hidden xs:block">
                  AEON Health &amp; Beauty
                </div>
              </div>
            </div>

            {/* Zone 2: Triple Mode Switcher (1. Retur vs 2. Cek & Lokasi Simpan vs 3. Database) */}
            <div className="flex items-center p-1 bg-neutral-100 rounded-xl border border-neutral-200">
              <button
                onClick={() => setActiveAppMode('RETURN')}
                className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeAppMode === 'RETURN'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="Fungsi 1: Pengelolaan Logistik Barang Retur & Deadline Supplier"
              >
                <Package className="w-3.5 h-3.5 text-[#b8126f]" />
                <span className={deviceMode === 'mobile' ? 'inline' : 'hidden sm:inline'}>1. Retur</span>
                <span className="text-[10px] bg-neutral-200/80 text-neutral-800 px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {items.length}
                </span>
              </button>

              <button
                onClick={() => setActiveAppMode('STORAGE')}
                className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeAppMode === 'STORAGE'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="Fungsi 2: Scan Barcode, Cek Kriteria (Outright / Konsinyasi) & Lokasi Rak Simpan"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span className={deviceMode === 'mobile' ? 'inline' : 'hidden sm:inline'}>2. Lokasi</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    activeAppMode === 'STORAGE'
                      ? 'bg-blue-700 text-white'
                      : 'bg-neutral-200/80 text-neutral-800'
                  }`}
                >
                  {storageLocations.length}
                </span>
              </button>

              <button
                onClick={() => setActiveAppMode('DATABASE')}
                className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeAppMode === 'DATABASE'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="Fungsi 3: Halaman Khusus Database & Proteksi Password"
              >
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                <span className={deviceMode === 'mobile' ? 'inline' : 'hidden sm:inline'}>3. Database</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    activeAppMode === 'DATABASE'
                      ? 'bg-emerald-800 text-white'
                      : 'bg-neutral-200/80 text-neutral-800'
                  }`}
                >
                  {masterProducts.length}
                </span>
              </button>
            </div>

            {/* Zone 3: Quick Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setIsScannerOpen(true)}
                className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs whitespace-nowrap cursor-pointer"
                title="Pindai barcode barang dengan kamera atau input manual"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Scan</span>
              </button>

              <button
                onClick={() => {
                  setEditingItem(null);
                  setPrefilledBarcode('');
                  setIsFormOpen(true);
                }}
                className="px-2.5 sm:px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs whitespace-nowrap cursor-pointer"
                title="Input barang retur baru"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Retur Baru</span>
              </button>

              {/* Ekspor Excel shown on larger header or when not in mobile preview */}
              {deviceMode !== 'mobile' && (
                <button
                  onClick={handleExportExcel}
                  className="hidden lg:flex px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold items-center gap-1.5 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
                  title="Ekspor seluruh data barang retur, master produk, dan supplier ke file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Ekspor Excel</span>
                </button>
              )}
            </div>
          </div>
        </header>

      {/* Main Content Viewport: Switched based on activeAppMode */}
      {activeAppMode === 'STORAGE' ? (
        <StorageLocationView
          masterProducts={masterProducts}
          storageLocations={storageLocations}
          onSaveStorageLocation={handleSaveStorageLocation}
          onDeleteStorageLocation={handleDeleteStorageLocation}
          onSaveMasterProduct={handleSaveMasterProduct}
          onOpenMasterModal={() => setIsMasterModalOpen(true)}
          showAlert={showAlert}
        />
      ) : activeAppMode === 'DATABASE' ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-28 w-full flex-1">
          <DatabaseManagementView
            masterProducts={masterProducts}
            suppliers={uniqueSuppliers}
            onSaveMasterProduct={handleSaveMasterProduct}
            onBatchSaveMasterProducts={handleBatchSaveMasterProducts}
            onDeleteMasterProduct={handleDeleteMasterProduct}
            onBatchDeleteMasterProducts={handleBatchDeleteMasterProducts}
            onClearAllMasterProducts={handleClearAllMasterProducts}
            onBackToReturnPage={() => setActiveAppMode('RETURN')}
          />
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-28 w-full space-y-6 flex-1">
        {/* Metric Overview (Tabular figures, unboxed clean styling) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setStatusFilter('ACTIVE')}
            className={`p-4 bg-white rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'border-neutral-900 ring-1 ring-neutral-900'
                : 'border-neutral-200/90 hover:border-neutral-300'
            }`}
          >
            <div className="text-xs text-neutral-500 font-medium flex items-center justify-between">
              <span>Menunggu Pengambilan</span>
              <Package className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-neutral-900">
              {activeItems.length}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Barang fisik tersimpan di rak retur
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('OVERDUE')}
            className={`p-4 bg-white rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'OVERDUE'
                ? 'border-rose-600 ring-1 ring-rose-600 bg-rose-50/20'
                : overdueItems.length > 0
                ? 'border-rose-300 hover:border-rose-400'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="text-xs font-medium text-rose-700 flex items-center justify-between">
              <span>Lewat Tenggat Waktu</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-600">
              {overdueItems.length}
            </div>
            <div className="text-[11px] text-rose-600 mt-1 font-medium">
              Perlu segera dikirim peringatan supplier!
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('WARNING')}
            className={`p-4 bg-white rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'WARNING'
                ? 'border-amber-600 ring-1 ring-amber-600 bg-amber-50/20'
                : warningItems.length > 0
                ? 'border-amber-300 hover:border-amber-400'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="text-xs font-medium text-amber-700 flex items-center justify-between">
              <span>Mendekati Batas (≤ 2 Hari)</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-600">
              {warningItems.length}
            </div>
            <div className="text-[11px] text-amber-600 mt-1">
              Siapkan reminder WhatsApp/Gmail
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('COMPLETED')}
            className={`p-4 bg-white rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'COMPLETED'
                ? 'border-emerald-600 ring-1 ring-emerald-600'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="text-xs text-neutral-500 font-medium flex items-center justify-between">
              <span>Sudah Selesai / Diambil</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
              {completedItems.length}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              Serah terima berhasil diverifikasi
            </div>
          </div>
        </div>

        {/* Urgent Warning Quick Notification Banner (Only if there are overdue or nearing items) */}
        {(overdueItems.length > 0 || warningItems.length > 0) && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Peringatan Tenggat Waktu Pengambilan Barang Return
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Terdapat{' '}
                  <strong className="text-rose-700">{overdueItems.length} item telah jatuh tempo</strong>{' '}
                  dan{' '}
                  <strong className="text-amber-800">{warningItems.length} item mendekati tenggat</strong>.
                  Kirim peringatan ke WhatsApp atau Gmail supplier sekarang.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {overdueItems[0] && (
                <button
                  onClick={() => {
                    setActiveItem(overdueItems[0]);
                    setIsWarningModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Kirim Warning ({overdueItems[0].supplierName.slice(0, 15)}...)</span>
                </button>
              )}
              <button
                onClick={() => setIsSupplierModalOpen(true)}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Rekap Per Supplier</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari barcode (e.g. 899...), nama barang, SKU, supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-neutral-50 focus:bg-white"
              />
            </div>

            {/* Supplier Dropdown Selector & Kelola Button */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-300">
                <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs text-neutral-600 font-medium">Supplier:</span>
                <select
                  value={selectedSupplierFilter}
                  onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                  className="text-xs font-semibold bg-transparent border-none focus:outline-none text-neutral-900 pr-2"
                >
                  <option value="ALL">Semua Supplier Rekanan ({uniqueSuppliers.length})</option>
                  {uniqueSuppliers.map((sup, idx) => (
                    <option key={sup.id ? `${sup.id}-${idx}` : `sup-${idx}`} value={sup.id}>
                      {sup.name} ({sup.code})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setIsSupplierModalOpen(true)}
                className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-200 shadow-2xs cursor-pointer"
                title="Kelola data supplier (Edit, Hapus, atau Tambah Supplier Baru Manual)"
              >
                <Users className="w-3.5 h-3.5 text-neutral-600" />
                <span>Supplier</span>
              </button>

              <button
                onClick={() => setIsMasterModalOpen(true)}
                className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-200 shadow-2xs cursor-pointer"
                title="Database Master Produk XLSX (Impor/Ekspor/Kelola)"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Master XLSX</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-emerald-300 shadow-2xs cursor-pointer"
                title="Unduh semua data dalam format Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Unduh Excel</span>
              </button>

              {/* View Toggle */}
              <div className="flex items-center p-0.5 bg-neutral-100 rounded-lg border border-neutral-200">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Tabel
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'cards'
                      ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Grid Kartu
                </button>
              </div>
            </div>
          </div>

          {/* Status Tabs (Segmented Control buttons) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 text-xs">
            <span className="text-neutral-500 font-medium mr-1">Status:</span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-neutral-900 text-white font-semibold'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Semua ({items.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'ACTIVE'
                  ? 'bg-neutral-900 text-white font-semibold'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Menunggu Pengambilan ({activeItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('OVERDUE')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'OVERDUE'
                  ? 'bg-rose-600 text-white font-semibold'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Lewat Tenggat ({overdueItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('WARNING')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'WARNING'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              Mendekati Batas ({warningItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'COMPLETED'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Sudah Diambil ({completedItems.length})
            </button>
          </div>
        </div>

        {/* Data Presentation (Table or Card Grid) */}
        {uniqueFilteredItems.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center space-y-3">
            <Package className="w-10 h-10 text-neutral-400 mx-auto" />
            <h3 className="text-base font-bold text-neutral-800">
              Tidak Ada Barang Return yang Sesuai
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Tidak ditemukan data dengan kata kunci pencarian atau filter status ini. Silakan ubah filter atau daftarkan barang return baru.
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSupplierFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="px-4 py-2 border border-neutral-300 hover:bg-neutral-50 rounded-lg text-xs font-medium text-neutral-700"
              >
                Reset Semua Filter
              </button>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setPrefilledBarcode('');
                  setIsFormOpen(true);
                }}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold"
              >
                + Input Barang Return
              </button>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          /* High-Density Data Grid */
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Barcode / Produk</th>
                    <th className="py-3 px-4">Supplier & Kontak</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4">Alasan Retur</th>
                    <th className="py-3 px-4">Tenggat Waktu</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi Peringatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/80">
                  {uniqueFilteredItems.map((item, idx) => {
                    const daysLeft = getDaysRemaining(item.dueDate);
                    const isDone = item.status === 'Sudah Diambil';

                    return (
                      <tr
                        key={item.id ? `${item.id}-${idx}` : `item-${idx}`}
                        className="hover:bg-neutral-50/80 transition-colors group"
                      >
                        {/* Barcode & Item Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {item.photoUrl ? (
                              <img
                                src={item.photoUrl}
                                alt={item.itemName}
                                className="w-10 h-10 rounded-md object-cover border border-neutral-300 shrink-0 cursor-pointer hover:scale-105 transition-transform shadow-2xs"
                                onClick={() => {
                                  setActiveItem(item);
                                  setIsDetailModalOpen(true);
                                }}
                                title="Klik untuk melihat detail & foto fisik"
                              />
                            ) : null}
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-neutral-900 group-hover:text-emerald-700 transition-colors truncate">
                                {item.itemName}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="font-mono text-[11px] font-semibold text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                                  {item.barcode}
                                </span>
                                <span className="text-[11px] text-neutral-400">·</span>
                                <span className="text-[11px] text-neutral-500 font-mono">
                                  {item.locationSlot}
                                </span>
                                {item.photoUrl && (
                                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                                    📷 Ada Foto
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Supplier Info */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-900">{item.supplierName}</div>
                          <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-1.5">
                            <span>PIC: {item.supplierPic || '-'}</span>
                            <span>·</span>
                            <span className="font-mono text-neutral-600">{item.supplierPhone || '-'}</span>
                          </div>
                        </td>

                        {/* Qty */}
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono font-bold text-neutral-900 text-sm tabular-nums">
                            {item.quantity}
                          </span>{' '}
                          <span className="text-neutral-500 text-[11px]">{item.unit}</span>
                        </td>

                        {/* Reason */}
                        <td className="py-3 px-4">
                          <span className="text-neutral-700 font-medium block">
                            {item.returnReason}
                          </span>
                          {item.conditionNotes && (
                            <span className="text-[11px] text-neutral-400 truncate max-w-xs block">
                              {item.conditionNotes}
                            </span>
                          )}
                        </td>

                        {/* Due Date & Remaining days */}
                        <td className="py-3 px-4 font-mono">
                          <div className="text-neutral-800 font-medium">
                            {formatIndoDate(item.dueDate)}
                          </div>
                          {!isDone && (
                            <div className="text-[11px] mt-0.5 font-semibold">
                              {daysLeft < 0 ? (
                                <span className="text-rose-600">Lewat {Math.abs(daysLeft)} hari</span>
                              ) : daysLeft === 0 ? (
                                <span className="text-amber-600">Jatuh tempo Hari ini</span>
                              ) : daysLeft <= 2 ? (
                                <span className="text-amber-600">Sisa {daysLeft} hari</span>
                              ) : (
                                <span className="text-neutral-500">Sisa {daysLeft} hari</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded ${
                              item.status === 'Sudah Diambil'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'Lewat Tenggat'
                                ? 'bg-rose-100 text-rose-800'
                                : item.status === 'Mendekati Tenggat'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Fast Warning Button */}
                            {!isDone && (
                              <button
                                onClick={() => {
                                  setActiveItem(item);
                                  setIsWarningModalOpen(true);
                                }}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-md transition-colors"
                                title="Kirim peringatan via WhatsApp / Gmail"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* View Details */}
                            <button
                              onClick={() => {
                                setActiveItem(item);
                                setIsDetailModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md text-[11px] font-medium transition-colors"
                            >
                              Detail
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary */}
            <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
              <div>
                Menampilkan <strong className="text-neutral-800 font-mono">{uniqueFilteredItems.length}</strong> dari{' '}
                <strong className="text-neutral-800 font-mono">{items.length}</strong> total barang return
              </div>
              <div className="flex items-center gap-2">
                <span>Tekan tombol <strong>Scan Barcode</strong> untuk mencocokkan fisik barang</span>
              </div>
            </div>
          </div>
        ) : (
          /* Card Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uniqueFilteredItems.map((item, idx) => {
              const daysLeft = getDaysRemaining(item.dueDate);
              const isDone = item.status === 'Sudah Diambil';

              return (
                <div
                  key={item.id ? `${item.id}-${idx}` : `item-${idx}`}
                  className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4 hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Row: Barcode & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <BarcodeBadge value={item.barcode} height={36} />
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          item.status === 'Sudah Diambil'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'Lewat Tenggat'
                            ? 'bg-rose-100 text-rose-800'
                            : item.status === 'Mendekati Tenggat'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    {/* Title & Photo */}
                    {item.photoUrl && (
                      <div className="relative h-28 w-full rounded-lg overflow-hidden border border-neutral-200 bg-neutral-900">
                        <img
                          src={item.photoUrl}
                          alt={item.itemName}
                          className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => {
                            setActiveItem(item);
                            setIsDetailModalOpen(true);
                          }}
                        />
                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-xs font-medium flex items-center gap-1">
                          📷 Foto Fisik
                        </span>
                      </div>
                    )}

                    <div>
                      <h3 className="font-bold text-sm text-neutral-900">{item.itemName}</h3>
                      <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        <span className="font-medium text-neutral-800">{item.supplierName}</span>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="p-3 bg-neutral-50 rounded-lg text-xs space-y-1 text-neutral-600">
                      <div className="flex justify-between">
                        <span>Jumlah:</span>
                        <span className="font-mono font-bold text-neutral-900">
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Alasan:</span>
                        <span className="font-medium text-neutral-800">{item.returnReason}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Lokasi Rak:</span>
                        <span className="font-mono font-medium text-neutral-800">{item.locationSlot}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-neutral-200">
                        <span>Tenggat Ambil:</span>
                        <span
                          className={`font-semibold font-mono ${
                            daysLeft < 0 ? 'text-rose-600' : daysLeft <= 2 ? 'text-amber-600' : 'text-neutral-800'
                          }`}
                        >
                          {formatIndoDate(item.dueDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setActiveItem(item);
                        setIsDetailModalOpen(true);
                      }}
                      className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded-md text-xs font-medium"
                    >
                      Buka Detail
                    </button>

                    {!isDone ? (
                      <button
                        onClick={() => {
                          setActiveItem(item);
                          setIsWarningModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Warning Supplier</span>
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Sudah Diambil
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Utility Bar: Backup, Export & Seed Data Tools */}
        <div className="pt-4 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-neutral-700">Database & Ekspor:</span>
            <button
              onClick={handleExportExcel}
              className="text-emerald-700 hover:text-emerald-800 font-semibold underline flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Ekspor Semua ke Excel (.xlsx)</span>
            </button>

            <button
              onClick={() => setIsMasterModalOpen(true)}
              className="hover:text-neutral-900 underline flex items-center gap-1 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Database Master XLSX</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="hover:text-neutral-900 underline flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup JSON</span>
            </button>

            <label className="hover:text-neutral-900 underline flex items-center gap-1 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Impor Backup JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetData}
              className="text-neutral-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
              title="Kembalikan ke data awal"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Data Contoh</span>
            </button>
          </div>
        </div>
      </main>
      )}

      {/* Bottom Navigation Bar — FIXED DI BAWAH LAYAR SELALU TERLIHAT */}
      <nav
        aria-label="Navigasi Bawah Tetap"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-3 py-2 flex items-center justify-around shadow-2xl"
      >
        {/* 1. Retur */}
        <button
          onClick={() => {
            setActiveAppMode('RETURN');
            setStatusFilter('ALL');
            setSelectedSupplierFilter('ALL');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1 px-2 rounded-lg transition-colors cursor-pointer ${
            activeAppMode === 'RETURN'
              ? 'text-[#b8126f] font-bold'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
          title="Halaman Retur Barang Masuk"
        >
          <Package className="w-5 h-5" />
          <span>Retur ({items.length})</span>
        </button>

        {/* 2. Lokasi */}
        <button
          onClick={() => {
            setActiveAppMode('STORAGE');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1 px-2 rounded-lg transition-colors cursor-pointer ${
            activeAppMode === 'STORAGE'
              ? 'text-blue-600 font-bold'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
          title="Tempat Penyimpanan Barang"
        >
          <MapPin className="w-5 h-5" />
          <span>Lokasi ({storageLocations.length})</span>
        </button>

        {/* 3. Center Prominent SCAN Button */}
        <button
          onClick={() => setIsScannerOpen(true)}
          className="flex flex-col items-center -mt-6 group cursor-pointer"
          title="Buka Kamera Barcode / SKU Scanner Instan"
        >
          <div className="w-13 h-13 rounded-full bg-blue-600 group-hover:bg-blue-700 text-white shadow-xl flex items-center justify-center border-4 border-white transition-transform active:scale-95">
            <Camera className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-neutral-800 mt-0.5">SCAN</span>
        </button>

        {/* 4. Database */}
        <button
          onClick={() => {
            setActiveAppMode('DATABASE');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1 px-2 rounded-lg transition-colors cursor-pointer ${
            activeAppMode === 'DATABASE'
              ? 'text-emerald-700 font-bold'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
          title="Halaman Khusus Database & Proteksi Password"
        >
          <Database className="w-5 h-5 text-emerald-600" />
          <span>Database ({masterProducts.length})</span>
        </button>

        {/* 5. Supplier */}
        <button
          onClick={() => setIsSupplierModalOpen(true)}
          className="flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1 px-2 rounded-lg text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
          title="Kelola Daftar Supplier Rekanan"
        >
          <Building2 className="w-5 h-5 text-neutral-600" />
          <span>Supplier</span>
        </button>
      </nav>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 py-4 text-center text-xs text-neutral-500 pb-28">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            HBC Return © 2026 — AEON Health &amp; Beauty Care Logistik Retur Gudang
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Database Master XLSX &amp; Cloud Firestore</span>
            <span>·</span>
            <span>Mendukung Kamera Foto &amp; Barcode EAN-13, Code 128</span>
            <span>·</span>
            <span>WhatsApp &amp; Gmail</span>
          </div>
        </div>
      </footer>
      </div>

      {/* ALL MODALS */}
      {/* 1. Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        items={items}
        masterProducts={masterProducts}
        suppliers={uniqueSuppliers}
        storageLocations={storageLocations}
        onSelectScannedItem={handleSelectScannedItem}
        onBarcodeNotFound={handleBarcodeNotFound}
        onMasterProductFound={(product) => {
          setPrefilledBarcode(product.barcode);
          setEditingItem(null);
          setIsFormOpen(true);
          showAlert(`✓ Produk "${product.itemName}" ditemukan di Database Master! Data terisi otomatis.`);
        }}
      />

      {/* 2. Return Item Input / Edit Modal */}
      <ReturnFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingItem(null);
          setPrefilledBarcode('');
        }}
        onSaveItem={handleSaveItem}
        suppliers={uniqueSuppliers}
        masterProducts={masterProducts}
        initialBarcode={prefilledBarcode}
        onOpenScanner={() => {
          setIsFormOpen(false);
          setIsScannerOpen(true);
        }}
        editingItem={editingItem}
      />

      {/* 3. Item Detail Modal */}
      <ItemDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setActiveItem(null);
        }}
        item={activeItem}
        onOpenWarningModal={(item) => {
          setIsDetailModalOpen(false);
          setActiveItem(item);
          setIsWarningModalOpen(true);
        }}
        onOpenEditModal={(item) => {
          setIsDetailModalOpen(false);
          setEditingItem(item);
          setIsFormOpen(true);
        }}
        onOpenPrintSlip={(item) => {
          setActiveItem(item);
          setIsPrintModalOpen(true);
        }}
        onMarkAsPickedUp={handleMarkAsPickedUp}
        onDeleteItem={handleDeleteItem}
      />

      {/* 4. Warning Modal (WhatsApp & Gmail) */}
      <WarningModal
        isOpen={isWarningModalOpen}
        onClose={() => {
          setIsWarningModalOpen(false);
          setActiveItem(null);
        }}
        item={activeItem}
        onLogWarning={handleLogWarning}
      />

      {/* 5. Supplier Management Modal */}
      <SupplierListModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        suppliers={uniqueSuppliers}
        items={items}
        onSaveSupplier={handleSaveSupplier}
        onDeleteSupplier={handleDeleteSupplier}
        onFilterBySupplier={(supId) => setSelectedSupplierFilter(supId)}
      />

      {/* 6. Print Slip Modal */}
      <PrintSlipModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        item={activeItem}
      />

      {/* 7. Master Product Modal (XLSX Database) */}
      <MasterProductModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        masterProducts={masterProducts}
        onSaveMasterProduct={handleSaveMasterProduct}
        onBatchSaveMasterProducts={handleBatchSaveMasterProducts}
        onDeleteMasterProduct={handleDeleteMasterProduct}
      />
    </div>
  );
}
