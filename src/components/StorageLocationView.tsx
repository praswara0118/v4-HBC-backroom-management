import React, { useState, useMemo, useRef } from 'react';
import {
  MasterProduct,
  StorageLocation,
  ProcurementType,
} from '../types/inventory';
import { exportStorageLocationsToExcel } from '../utils/excelService';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import {
  Search,
  Camera,
  MapPin,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Edit3,
  Trash2,
  ExternalLink,
  Tag,
  Building2,
  Eye,
  X,
  Upload,
  RefreshCw,
  FolderOpen,
  HelpCircle,
  Maximize2,
  Sparkles,
  LayoutGrid,
  List,
} from 'lucide-react';

interface StorageLocationViewProps {
  masterProducts: MasterProduct[];
  storageLocations: StorageLocation[];
  onSaveStorageLocation: (location: StorageLocation) => Promise<void>;
  onDeleteStorageLocation: (locationId: string) => Promise<void>;
  onSaveMasterProduct: (product: MasterProduct) => Promise<void>;
  onOpenMasterModal: () => void;
  showAlert: (msg: string) => void;
}

export const StorageLocationView: React.FC<StorageLocationViewProps> = ({
  masterProducts,
  storageLocations,
  onSaveStorageLocation,
  onDeleteStorageLocation,
  onSaveMasterProduct,
  onOpenMasterModal,
  showAlert,
}) => {
  // Search & active scanned item state
  const [searchInput, setSearchInput] = useState('');
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Filter state for the full inventory list
  const [filterKriteria, setFilterKriteria] = useState<'ALL' | 'OUTRIGHT' | 'CONSIGNMENT'>('ALL');
  const [filterLocationStatus, setFilterLocationStatus] = useState<'ALL' | 'HAS_LOCATION' | 'NO_LOCATION'>('ALL');
  const [filterZone, setFilterZone] = useState('ALL');
  const [tableSearch, setTableSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'SCAN' | 'DIRECTORY'>('SCAN');
  const [directoryViewMode, setDirectoryViewMode] = useState<'card' | 'table'>('card');

  // Form states for adding/editing storage location
  const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);
  const [storageZone, setStorageZone] = useState('Gudang Utama');
  const [aisleRack, setAisleRack] = useState('');
  const [shelfLevel, setShelfLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [updatedBy, setUpdatedBy] = useState('Staff Logistik');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photo viewer modal
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; title: string; locationText: string } | null>(null);

  // Camera capture modal for shelf photo
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fast map lookup: Barcode -> StorageLocation
  const locationByBarcode = useMemo(() => {
    const map = new Map<string, StorageLocation>();
    for (const loc of storageLocations) {
      if (loc.barcode) {
        map.set(loc.barcode.toLowerCase().trim(), loc);
      }
    }
    return map;
  }, [storageLocations]);

  // Fast map lookup: Barcode -> MasterProduct
  const masterByBarcode = useMemo(() => {
    const map = new Map<string, MasterProduct>();
    for (const prod of masterProducts) {
      if (prod.barcode) {
        map.set(prod.barcode.toLowerCase().trim(), prod);
      }
    }
    return map;
  }, [masterProducts]);

  // Available unique storage zones
  const uniqueZones = useMemo(() => {
    const set = new Set<string>();
    storageLocations.forEach((l) => {
      if (l.storageZone) set.add(l.storageZone);
    });
    return Array.from(set).sort();
  }, [storageLocations]);

  // Currently selected product from master
  const currentProduct = useMemo(() => {
    if (!selectedBarcode) return null;
    return masterByBarcode.get(selectedBarcode.toLowerCase().trim()) || null;
  }, [selectedBarcode, masterByBarcode]);

  // Storage location for currently selected product
  const currentLocation = useMemo(() => {
    if (!selectedBarcode) return null;
    return locationByBarcode.get(selectedBarcode.toLowerCase().trim()) || null;
  }, [selectedBarcode, locationByBarcode]);

  // Handle barcode scanned or selected
  const handleSelectBarcode = (code: string) => {
    const trimmed = code.trim();
    setSelectedBarcode(trimmed);
    setSearchInput(trimmed);
    setActiveTab('SCAN');

    const matchedProd = masterByBarcode.get(trimmed.toLowerCase());
    const matchedLoc = locationByBarcode.get(trimmed.toLowerCase());

    if (matchedProd) {
      if (matchedLoc) {
        showAlert(`✓ Ditemukan: "${matchedProd.itemName}" disimpan di ${matchedLoc.storageZone} (${matchedLoc.aisleRack})`);
      } else {
        showAlert(`⚠️ "${matchedProd.itemName}" belum memiliki catatan tempat penyimpanan. Disarankan untuk mencatat sekarang.`);
      }
    } else {
      showAlert(`Barcode "${trimmed}" belum ada di database master produk.`);
    }
  };

  // Open location form prefilled for current product
  const handleOpenAddEditLocation = (locToEdit?: StorageLocation | null) => {
    if (locToEdit) {
      setStorageZone(locToEdit.storageZone || 'Gudang Utama');
      setAisleRack(locToEdit.aisleRack || '');
      setShelfLevel(locToEdit.shelfLevel || '');
      setNotes(locToEdit.notes || '');
      setPhotoUrl(locToEdit.photoUrl || undefined);
      setUpdatedBy(locToEdit.updatedBy || 'Staff Logistik');
    } else {
      setStorageZone('Gudang Utama');
      setAisleRack('');
      setShelfLevel('');
      setNotes('');
      setPhotoUrl(undefined);
      setUpdatedBy('Staff Logistik');
    }
    setIsLocationFormOpen(true);
  };

  // Handle saving the location
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct && !selectedBarcode) return;
    if (!storageZone.trim()) {
      alert('Zona / Area penyimpanan wajib diisi.');
      return;
    }
    if (!aisleRack.trim()) {
      alert('Nomor Aisle / Rak / Bin wajib diisi.');
      return;
    }

    const bcode = selectedBarcode || currentProduct?.barcode || '';
    const locId = currentLocation?.id || `loc-${bcode.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    const newLocation: StorageLocation = {
      id: locId,
      barcode: bcode,
      sku: currentProduct?.sku || '',
      itemName: currentProduct?.itemName || `Produk ${bcode}`,
      department: currentProduct?.department || 'Umum',
      supplierName: currentProduct?.supplierName || '',
      procurementType: currentProduct?.procurementType || 'OUTRIGHT',
      storageZone: storageZone.trim(),
      aisleRack: aisleRack.trim(),
      shelfLevel: shelfLevel.trim() || undefined,
      notes: notes.trim() || undefined,
      photoUrl: photoUrl || undefined,
      updatedBy: updatedBy.trim() || 'Staff Logistik',
      createdAt: currentLocation?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    try {
      await onSaveStorageLocation(newLocation);
      setIsLocationFormOpen(false);
      showAlert(`✓ Tempat penyimpanan untuk "${newLocation.itemName}" berhasil disimpan di database.`);
    } catch (err) {
      console.error(err);
      showAlert('Gagal menyimpan lokasi penyimpanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete location
  const handleDeleteLocation = async (locId: string, itemName: string) => {
    if (confirm(`Hapus catatan lokasi penyimpanan untuk "${itemName}"? Data produk master tetap aman.`)) {
      try {
        await onDeleteStorageLocation(locId);
        showAlert(`Catatan lokasi "${itemName}" berhasil dihapus.`);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Handle toggling procurement type on master product
  const handleToggleProcurementType = async () => {
    if (!currentProduct) return;
    const newType: ProcurementType = currentProduct.procurementType === 'CONSIGNMENT' ? 'OUTRIGHT' : 'CONSIGNMENT';
    const updatedProd: MasterProduct = {
      ...currentProduct,
      procurementType: newType,
      updatedAt: new Date().toISOString(),
    };

    try {
      await onSaveMasterProduct(updatedProd);

      // If location exists, update its cached procurementType as well
      if (currentLocation) {
        await onSaveStorageLocation({
          ...currentLocation,
          procurementType: newType,
          updatedAt: new Date().toISOString(),
        });
      }
      showAlert(`✓ Kriteria produk diubah menjadi ${newType === 'CONSIGNMENT' ? 'Konsinyasi' : 'Outright (Beli Putus)'}.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle local photo file upload with image compression
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Silakan pilih file gambar (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.78);
          setPhotoUrl(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Start in-app camera capture for shelf photo
  const handleStartCameraPhoto = async () => {
    try {
      setIsCapturingPhoto(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera error:', err);
      alert('Tidak dapat mengakses kamera. Pastikan izin kamera aktif atau gunakan tombol unggah foto.');
      setIsCapturingPhoto(false);
    }
  };

  const handleCaptureFromVideo = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 800;
      canvas.height = video.videoHeight || 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoUrl(dataUrl);
      }
    }
    handleStopCamera();
  };

  const handleStopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setIsCapturingPhoto(false);
  };

  // Suggestions for autocomplete search
  const searchSuggestions = useMemo(() => {
    if (!searchInput.trim() || searchInput.trim().length < 2) return [];
    const query = searchInput.toLowerCase().trim();
    return masterProducts
      .filter(
        (p) =>
          p.barcode.toLowerCase().includes(query) ||
          p.itemName.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query)
      )
      .slice(0, 6);
  }, [searchInput, masterProducts]);

  // Filtered list for Directory Tab
  const directoryItems = useMemo(() => {
    return masterProducts.filter((p) => {
      const bcode = p.barcode.toLowerCase();
      const loc = locationByBarcode.get(bcode);

      // Kriteria filter
      if (filterKriteria === 'OUTRIGHT') {
        if (p.procurementType === 'CONSIGNMENT') return false;
      } else if (filterKriteria === 'CONSIGNMENT') {
        if (p.procurementType !== 'CONSIGNMENT') return false;
      }

      // Location status filter
      if (filterLocationStatus === 'HAS_LOCATION' && !loc) return false;
      if (filterLocationStatus === 'NO_LOCATION' && loc) return false;

      // Zone filter
      if (filterZone !== 'ALL') {
        if (!loc || loc.storageZone !== filterZone) return false;
      }

      // Search query
      if (tableSearch.trim()) {
        const query = tableSearch.toLowerCase().trim();
        const matchBarcode = p.barcode.toLowerCase().includes(query);
        const matchName = p.itemName.toLowerCase().includes(query);
        const matchSku = p.sku.toLowerCase().includes(query);
        const matchDept = (p.department || '').toLowerCase().includes(query);
        const matchSup = (p.supplierName || '').toLowerCase().includes(query);
        const matchRack = loc ? loc.aisleRack.toLowerCase().includes(query) || loc.storageZone.toLowerCase().includes(query) : false;

        if (!matchBarcode && !matchName && !matchSku && !matchDept && !matchSup && !matchRack) {
          return false;
        }
      }

      return true;
    });
  }, [masterProducts, locationByBarcode, filterKriteria, filterLocationStatus, filterZone, tableSearch]);

  // Overall metrics
  const totalMasterCount = masterProducts.length;
  const withLocationCount = storageLocations.length;
  const withoutLocationCount = Math.max(0, totalMasterCount - withLocationCount);
  const outrightCount = masterProducts.filter((p) => !p.procurementType || p.procurementType === 'OUTRIGHT').length;
  const consignmentCount = masterProducts.filter((p) => p.procurementType === 'CONSIGNMENT').length;

  return (
    <div className="flex-1 flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Top Header Card */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
              <MapPin className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Scan Barang &amp; Cek Tempat Penyimpanan
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
                  Fungsi 2
                </span>
              </h1>
              <p className="text-xs text-neutral-500 font-medium">
                Pemeriksaan kriteria produk (Outright / Konsinyasi) dan pemetaan lokasi rak simpan di gudang/toko
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] font-medium text-neutral-600">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-50 border border-neutral-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Database Barang: <strong className="text-neutral-800">masterProducts</strong> ({masterProducts.length})
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-900">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Database Lokasi: <strong className="text-blue-950">storageLocations</strong> ({storageLocations.length})
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-50 border border-neutral-200 text-neutral-600">
              <em>Terpisah dari database barang retur</em>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm transition-all"
          >
            <Camera className="w-4 h-4" />
            <span>Buka Kamera Scanner</span>
          </button>

          <button
            onClick={() => exportStorageLocationsToExcel(storageLocations, masterProducts)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white border border-neutral-300 text-neutral-700 rounded-xl text-xs font-semibold hover:bg-neutral-50 shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>

          <button
            onClick={onOpenMasterModal}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-neutral-100 border border-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold hover:bg-neutral-200/80 transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-neutral-600" />
            <span>Kelola Master Produk</span>
          </button>
        </div>
      </div>

      {/* Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            Total Produk Terdata
          </div>
          <div className="text-2xl font-bold text-neutral-900">{totalMasterCount}</div>
          <div className="text-[10px] text-neutral-400 mt-0.5">Dari database master XLSX</div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs bg-emerald-50/20">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Sudah Ada Lokasi</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{withLocationCount}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Tersimpan di rak &amp; zona</div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-3.5 shadow-2xs bg-amber-50/20">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Belum Ada Lokasi</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{withoutLocationCount}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Perlu dicatat lokasi simpannya</div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Kriteria Produk</span>
            <Tag className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Outright: {outrightCount}
            </span>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Konsinyasi: {consignmentCount}
            </span>
          </div>
          <div className="text-[10px] text-neutral-400 mt-1.5">Sistem kepemilikan barang</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
        <button
          onClick={() => setActiveTab('SCAN')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'SCAN'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Panel Scan &amp; Pemeriksaan</span>
          {selectedBarcode && (
            <span className="w-2 h-2 rounded-full bg-blue-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('DIRECTORY')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'DIRECTORY'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Daftar Seluruh Barang &amp; Lokasi ({directoryItems.length})</span>
        </button>
      </div>

      {/* TAB 1: SCAN & DETAIL SECTION */}
      {activeTab === 'SCAN' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Barcode Search & Fast Scanner Input (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs">
              <h2 className="text-sm font-bold text-neutral-900 mb-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-neutral-500" />
                <span>Pencarian / Scan Barcode Barang</span>
              </h2>
              <p className="text-xs text-neutral-500 mb-4">
                Scan menggunakan kamera, barcode gun scanner, atau ketik nomor barcode/SKU/nama produk.
              </p>

              {/* Barcode Search Box */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Masukkan barcode atau nama barang..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchInput.trim()) {
                          handleSelectBarcode(searchInput.trim());
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-xs font-mono border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-neutral-50/50"
                    />
                    {searchInput && (
                      <button
                        onClick={() => {
                          setSearchInput('');
                          setSelectedBarcode(null);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (searchInput.trim()) {
                        handleSelectBarcode(searchInput.trim());
                      }
                    }}
                    className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-colors whitespace-nowrap"
                  >
                    Cari
                  </button>
                </div>

                {/* Autocomplete Dropdown */}
                {searchSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-neutral-200 rounded-xl shadow-lg z-30 max-h-60 overflow-y-auto divide-y divide-neutral-100">
                    {searchSuggestions.map((p) => {
                      const loc = locationByBarcode.get(p.barcode.toLowerCase());
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectBarcode(p.barcode)}
                          className="w-full text-left p-2.5 hover:bg-neutral-50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-xs font-semibold text-neutral-900">{p.itemName}</div>
                            <div className="text-[10px] font-mono text-neutral-500">
                              Barcode: {p.barcode} · SKU: {p.sku}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                p.procurementType === 'CONSIGNMENT'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {p.procurementType === 'CONSIGNMENT' ? 'Konsinyasi' : 'Outright'}
                            </span>
                            {loc ? (
                              <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1 rounded">
                                Ada Lokasi
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium text-amber-700 bg-amber-50 px-1 rounded">
                                Belum Ada
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Camera Scanner Trigger */}
              <button
                onClick={() => setIsScannerOpen(true)}
                className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-blue-50 hover:bg-blue-100/80 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors"
              >
                <Camera className="w-4 h-4" />
                <span>Buka Kamera Barcode Scanner</span>
              </button>

              {/* Quick Pick Samples */}
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <div className="text-[11px] font-semibold text-neutral-500 mb-2">
                  Coba Sampel Barcode Database:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {masterProducts.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectBarcode(p.barcode)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                        selectedBarcode === p.barcode
                          ? 'bg-blue-600 text-white border-blue-600 font-bold'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {p.itemName.split(' ')[0]} ({p.procurementType === 'CONSIGNMENT' ? 'Konsinyasi' : 'Outright'})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Instruction Card */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-xs text-neutral-600">
              <div className="flex items-center gap-1.5 font-bold text-neutral-900 mb-1.5">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Petunjuk Fitur Scan Lokasi</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-neutral-600">
                <li>
                  Setiap barang di-scan akan otomatis dideteksi status kepemilikannya: <strong>Outright (Beli Putus)</strong> atau <strong>Konsinyasi</strong>.
                </li>
                <li>
                  Jika barang belum pernah dicatat lokasi simpannya, sistem akan menyarankan Anda menginput lokasi rak dan mengambil foto rak penyimpanan.
                </li>
                <li>
                  Data lokasi penyimpanan disimpan ke database Cloud terpisah (<code className="text-neutral-800">storageLocations</code>).
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Scan Result & Location Card (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {!selectedBarcode ? (
              <div className="bg-white border border-dashed border-neutral-300 rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[380px]">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <Camera className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-neutral-800 mb-1">
                  Siap Melakukan Scan Barcode
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mb-5 leading-relaxed">
                  Arahkan kamera ke barcode produk atau ketik kode barcode di sebelah kiri untuk melihat status kriteria barang dan lokasi penyimpanan.
                </p>
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Mulai Scan Kamera</span>
                </button>
              </div>
            ) : !currentProduct ? (
              /* Product Not Found in Master Database */
              <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-xs">
                <div className="flex items-start gap-3.5 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-rose-900">
                      Produk Tidak Ditemukan di Database Master
                    </h3>
                    <p className="text-xs text-rose-700 mt-0.5">
                      Barcode: <span className="font-mono font-bold">{selectedBarcode}</span> belum terdaftar di file database XLSX Anda.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-600 mb-4">
                  <p className="font-medium">
                    Untuk melanjutkan pengecekan kriteria dan lokasi simpan, silakan tambahkan produk ini ke Database Master Produk atau perbarui file XLSX master.
                  </p>
                </div>

                <button
                  onClick={onOpenMasterModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Daftarkan ke Database Master Sekarang</span>
                </button>
              </div>
            ) : (
              /* Product Found in Master Database */
              <div className="flex flex-col gap-4">
                {/* 1. PRODUCT IDENTITY & CRITERIA CARD */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-neutral-100">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                          {currentProduct.barcode}
                        </span>
                        {currentProduct.sku && (
                          <span className="font-mono text-[11px] text-neutral-500">
                            SKU: {currentProduct.sku}
                          </span>
                        )}
                        <span className="text-[11px] font-medium text-neutral-500">
                          · {currentProduct.department}
                        </span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight">
                        {currentProduct.itemName}
                      </h2>
                    </div>

                    {/* PROCUREMENT TYPE BADGE (OUTRIGHT vs CONSIGNMENT) */}
                    <div className="flex flex-col items-end gap-1.5">
                      {currentProduct.procurementType === 'CONSIGNMENT' ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <span className="text-xs font-extrabold uppercase tracking-wider">
                            CONSIGNMENT (Konsinyasi)
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-300 text-blue-800">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          <span className="text-xs font-extrabold uppercase tracking-wider">
                            OUTRIGHT (Beli Putus)
                          </span>
                        </div>
                      )}

                      <button
                        onClick={handleToggleProcurementType}
                        className="text-[10px] font-medium text-neutral-500 hover:text-blue-600 underline flex items-center gap-1"
                        title="Klik untuk ubah jenis kriteria di master database"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Ubah Kriteria Produk</span>
                      </button>
                    </div>
                  </div>

                  {/* Criteria Explanation Banner */}
                  <div
                    className={`mt-4 p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                      currentProduct.procurementType === 'CONSIGNMENT'
                        ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                        : 'bg-blue-50/60 border-blue-200 text-blue-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 shrink-0" />
                      <span>
                        {currentProduct.procurementType === 'CONSIGNMENT'
                          ? 'Barang Konsinyasi (Titip Jual) milik supplier rekanan. Penagihan berdasarkan barang terjual.'
                          : 'Barang Beli Putus (Outright). Stok dibeli penuh dan menjadi aset resmi perusahaan.'}
                      </span>
                    </div>
                    <span className="font-bold text-[10px] uppercase shrink-0 px-2 py-0.5 rounded bg-white/80 border">
                      {currentProduct.procurementType === 'CONSIGNMENT' ? 'Titip Jual' : 'Beli Putus'}
                    </span>
                  </div>

                  {/* Supplier & Product Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-xs">
                    <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
                      <div className="text-[10px] text-neutral-400 font-medium">Supplier Rekanan</div>
                      <div className="font-semibold text-neutral-800 truncate mt-0.5">
                        {currentProduct.supplierName}
                      </div>
                    </div>
                    <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
                      <div className="text-[10px] text-neutral-400 font-medium">Satuan Standar</div>
                      <div className="font-semibold text-neutral-800 mt-0.5">
                        {currentProduct.unit || 'Pcs'}
                      </div>
                    </div>
                    <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100 col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-neutral-400 font-medium">Kontak Rekanan</div>
                      <div className="font-semibold text-neutral-800 truncate mt-0.5">
                        {currentProduct.supplierPhone || currentProduct.supplierEmail || 'Tersedia di master'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. STORAGE LOCATION STATUS & DATA */}
                {currentLocation ? (
                  /* Condition A: Storage location is already registered! */
                  <div className="bg-white border border-emerald-200 rounded-2xl p-5 sm:p-6 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-100">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                        <div>
                          <h3 className="text-base font-bold text-neutral-900">
                            Lokasi Penyimpanan Terdaftar
                          </h3>
                          <p className="text-[11px] text-emerald-700 font-medium">
                            Disimpan dalam database terpisah: <code className="font-mono">storageLocations</code>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenAddEditLocation(currentLocation)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Pindahkan / Edit Lokasi</span>
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(currentLocation.id, currentProduct.itemName)}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus lokasi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Location detail cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                      <div className="p-3.5 bg-blue-50/40 border border-blue-200 rounded-xl">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">
                          Zona / Area Simpan
                        </div>
                        <div className="text-sm font-bold text-neutral-900">
                          {currentLocation.storageZone}
                        </div>
                      </div>

                      <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                          Nomor Aisle &amp; Rak
                        </div>
                        <div className="text-sm font-bold text-neutral-900 font-mono">
                          {currentLocation.aisleRack}
                        </div>
                      </div>

                      <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                          Tingkat / Level Rak
                        </div>
                        <div className="text-sm font-bold text-neutral-900">
                          {currentLocation.shelfLevel || 'Standar'}
                        </div>
                      </div>
                    </div>

                    {/* Notes if available */}
                    {currentLocation.notes && (
                      <div className="mt-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-700">
                        <span className="font-semibold text-neutral-900">Petunjuk Khusus: </span>
                        {currentLocation.notes}
                      </div>
                    )}

                    {/* Shelf Photo Display */}
                    <div className="mt-4 pt-4 border-t border-neutral-100">
                      <div className="text-xs font-bold text-neutral-800 mb-2.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-blue-600" />
                          <span>Foto Fisik Tempat Penyimpanan / Rak Barang</span>
                        </span>
                        {!currentLocation.photoUrl && (
                          <button
                            onClick={() => handleOpenAddEditLocation(currentLocation)}
                            className="text-[11px] font-semibold text-blue-600 hover:underline"
                          >
                            + Tambah Foto Rak
                          </button>
                        )}
                      </div>

                      {currentLocation.photoUrl ? (
                        <div className="relative group rounded-xl overflow-hidden border border-neutral-200 bg-neutral-900 max-h-64 sm:max-h-72 flex items-center justify-center">
                          <img
                            src={currentLocation.photoUrl}
                            alt={`Rak ${currentProduct.itemName}`}
                            className="w-full h-auto max-h-64 sm:max-h-72 object-cover cursor-pointer group-hover:opacity-90 transition-opacity"
                            onClick={() =>
                              setZoomPhoto({
                                url: currentLocation.photoUrl!,
                                title: currentProduct.itemName,
                                locationText: `${currentLocation.storageZone} (${currentLocation.aisleRack})`,
                              })
                            }
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <span className="px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs font-semibold flex items-center gap-1.5">
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span>Klik untuk Perbesar Foto Rak</span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 bg-neutral-50 border border-dashed border-neutral-300 rounded-xl text-center">
                          <p className="text-xs text-neutral-400 mb-2">
                            Belum ada foto fisik tempat penyimpanan barang ini.
                          </p>
                          <button
                            onClick={() => handleOpenAddEditLocation(currentLocation)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Unggah Foto Tempat Simpan Sekarang</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 text-[10px] text-neutral-400 flex items-center justify-between">
                      <span>Dicatat oleh: {currentLocation.updatedBy || 'Staff Logistik'}</span>
                      <span>Terakhir diperbarui: {new Date(currentLocation.updatedAt).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                ) : (
                  /* Condition B: No storage location found yet! Prompt to add one! */
                  <div className="bg-white border-2 border-amber-300 rounded-2xl p-5 sm:p-6 shadow-sm">
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-amber-950">
                          Belum Ada Informasi Tempat Penyimpanan!
                        </h3>
                        <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                          Barang ini terdaftar di database master, tetapi belum memiliki catatan lokasi rak/penyimpanan di toko maupun gudang.
                          <strong> Disarankan untuk segera menginput data tempat penyimpanan dan fotonya!</strong>
                        </p>
                      </div>
                    </div>

                    {!isLocationFormOpen ? (
                      <div className="p-5 bg-amber-50/50 rounded-xl border border-amber-200 text-center">
                        <p className="text-xs text-neutral-700 font-medium mb-4">
                          Ingin mendaftarkan rak atau tempat simpan barang ini sekarang ke database <code className="text-neutral-900 font-mono">storageLocations</code>?
                        </p>
                        <button
                          onClick={() => handleOpenAddEditLocation(null)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Input Tempat Penyimpanan &amp; Foto Rak</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* 3. INLINE FORM: ADD / EDIT STORAGE LOCATION */}
                {isLocationFormOpen && (
                  <div className="bg-white border border-blue-300 rounded-2xl p-5 sm:p-6 shadow-md animate-fade-in">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-100">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <h4 className="text-sm font-bold text-neutral-900">
                          {currentLocation ? 'Perbarui Lokasi Penyimpanan' : 'Input Data Lokasi Penyimpanan Baru'}
                        </h4>
                      </div>
                      <button
                        onClick={() => setIsLocationFormOpen(false)}
                        className="text-neutral-400 hover:text-neutral-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveLocation} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">
                            Zona / Area Penyimpanan <span className="text-rose-500">*</span>
                          </label>
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={storageZone}
                              onChange={(e) => setStorageZone(e.target.value)}
                              placeholder="Contoh: Gudang Utama / Rak Kosmetik / Chiller"
                              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                              required
                            />
                            <div className="flex flex-wrap gap-1 text-[10px]">
                              {['Gudang Utama', 'Area Display Toko HBC', 'Gudang Lantai 2', 'Chiller HBC', 'Etalase Depan'].map(
                                (z) => (
                                  <button
                                    type="button"
                                    key={z}
                                    onClick={() => setStorageZone(z)}
                                    className="px-2 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200"
                                  >
                                    {z}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">
                            Nomor Aisle &amp; Rak / Bin <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={aisleRack}
                            onChange={(e) => setAisleRack(e.target.value)}
                            placeholder="Contoh: Aisle 04 - Rak B-02 / Bin 12"
                            className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-medium"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">
                            Tingkat / Level Rak
                          </label>
                          <input
                            type="text"
                            value={shelfLevel}
                            onChange={(e) => setShelfLevel(e.target.value)}
                            placeholder="Contoh: Tingkat 2 (Eye Level) / Palet Bawah"
                            className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">
                            Petugas / PIC Pencatat
                          </label>
                          <input
                            type="text"
                            value={updatedBy}
                            onChange={(e) => setUpdatedBy(e.target.value)}
                            placeholder="Nama staff yang mencatat"
                            className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">
                            Catatan Panduan Menemukan Barang (Opsional)
                          </label>
                          <textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Contoh: Susun tegak, suhu ruang sejuk, dekat pintu akses logistik..."
                            className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* Foto Tempat Penyimpanan Barang */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                            Foto Tempat / Rak Penyimpanan Barang (Opsional)
                          </label>

                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <button
                              type="button"
                              onClick={handleStartCameraPhoto}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition-colors"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Ambil Foto via Kamera</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold border border-neutral-200 transition-colors"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Unggah dari Galeri</span>
                            </button>

                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoFileChange}
                              className="hidden"
                            />

                            {photoUrl && (
                              <button
                                type="button"
                                onClick={() => setPhotoUrl(undefined)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus Foto</span>
                              </button>
                            )}
                          </div>

                          {/* Photo Preview */}
                          {photoUrl && (
                            <div className="relative rounded-xl overflow-hidden border border-neutral-200 max-h-48 bg-neutral-900 inline-block">
                              <img
                                src={photoUrl}
                                alt="Preview Rak"
                                className="max-h-48 w-auto object-cover"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                        <button
                          type="button"
                          onClick={() => setIsLocationFormOpen(false)}
                          className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50"
                        >
                          {isSubmitting ? 'Menyimpan ke Cloud...' : '💾 Simpan Tempat Penyimpanan ke Database'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DIRECTORY OF ALL PRODUCTS & LOCATIONS */}
      {activeTab === 'DIRECTORY' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Direktori Barang &amp; Pemetaan Tempat Simpan
              </h2>
              <p className="text-xs text-neutral-500">
                Pencarian dan pemantauan barang yang sudah memiliki lokasi rak vs belum ditentukan
              </p>
            </div>

            <button
              onClick={() => exportStorageLocationsToExcel(storageLocations, masterProducts)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors w-fit"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Ekspor Daftar Lokasi (.xlsx)</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama barang, barcode, SKU, rak, atau zona..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterKriteria}
                onChange={(e) => setFilterKriteria(e.target.value as any)}
                className="px-2.5 py-2 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none font-medium"
              >
                <option value="ALL">Semua Kriteria</option>
                <option value="OUTRIGHT">Outright (Beli Putus)</option>
                <option value="CONSIGNMENT">Konsinyasi (Titip Jual)</option>
              </select>

              <select
                value={filterLocationStatus}
                onChange={(e) => setFilterLocationStatus(e.target.value as any)}
                className="px-2.5 py-2 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none font-medium"
              >
                <option value="ALL">Semua Status Lokasi</option>
                <option value="HAS_LOCATION">Sudah Ada Lokasi ({storageLocations.length})</option>
                <option value="NO_LOCATION">Belum Ada Lokasi ({withoutLocationCount})</option>
              </select>

              {uniqueZones.length > 0 && (
                <select
                  value={filterZone}
                  onChange={(e) => setFilterZone(e.target.value)}
                  className="px-2.5 py-2 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none font-medium"
                >
                  <option value="ALL">Semua Zona</option>
                  {uniqueZones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              )}

              {/* View Toggle: Card vs Table */}
              <div className="inline-flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setDirectoryViewMode('card')}
                  className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                    directoryViewMode === 'card'
                      ? 'bg-white text-neutral-900 shadow-xs font-bold'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                  title="Tampilan Kartu (Sangat ramah pengguna HP Mobile & Tablet)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kartu (HP)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDirectoryViewMode('table')}
                  className={`px-2 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                    directoryViewMode === 'table'
                      ? 'bg-white text-neutral-900 shadow-xs font-bold'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                  title="Tampilan Tabel Lengkap"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tabel</span>
                </button>
              </div>
            </div>
          </div>

          {/* Directory Content: Card Grid OR Table */}
          {directoryViewMode === 'card' ? (
            /* Card Grid View (Touch friendly, optimized for Mobile & Tablet) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {directoryItems.length === 0 ? (
                <div className="col-span-full py-12 text-center text-neutral-400">
                  <Package className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                  <p className="font-semibold text-neutral-600">Tidak ada barang yang cocok</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Coba sesuaikan kata kunci pencarian atau filter Anda.
                  </p>
                </div>
              ) : (
                directoryItems.map((prod) => {
                  const loc = locationByBarcode.get(prod.barcode.toLowerCase());
                  const isConsignment = prod.procurementType === 'CONSIGNMENT';

                  return (
                    <div
                      key={prod.id}
                      className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-xs hover:border-blue-400 transition-all flex flex-col justify-between gap-3"
                    >
                      <div>
                        {/* Top Header: Criteria Badge & Barcode */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${
                              isConsignment
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-blue-50 text-blue-800 border-blue-300'
                            }`}
                          >
                            {isConsignment ? 'Konsinyasi' : 'Outright'}
                          </span>

                          <span className="font-mono text-[11px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                            {prod.barcode}
                          </span>
                        </div>

                        {/* Product Title & Info */}
                        <h3 className="text-xs font-bold text-neutral-900 leading-snug line-clamp-2 mb-1">
                          {prod.itemName}
                        </h3>
                        <p className="text-[10px] text-neutral-500 mb-2.5">
                          {prod.department} · {prod.supplierName || 'AEON HBC'}
                        </p>

                        {/* Location Badge Box */}
                        {loc ? (
                          <div className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-0.5">
                              <MapPin className="w-3 h-3 text-emerald-600" />
                              <span>{loc.storageZone}</span>
                            </div>
                            <div className="font-mono font-bold text-neutral-900 text-xs flex items-center justify-between">
                              <span>Rak: {loc.aisleRack}</span>
                              {loc.shelfLevel && (
                                <span className="text-[10px] text-neutral-600 font-normal">
                                  {loc.shelfLevel}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-800">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Belum Ada Lokasi Rak</span>
                            </div>
                            <span className="text-[9px] font-bold uppercase text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                              Perlu Input
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Photo Thumbnail + Action Button */}
                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                        {loc?.photoUrl ? (
                          <div
                            onClick={() =>
                              setZoomPhoto({
                                url: loc.photoUrl!,
                                title: prod.itemName,
                                locationText: `${loc.storageZone} (${loc.aisleRack})`,
                              })
                            }
                            className="flex items-center gap-1.5 text-[10px] text-blue-600 font-semibold cursor-pointer hover:underline"
                          >
                            <img
                              src={loc.photoUrl}
                              alt="Foto Rak"
                              className="w-7 h-7 object-cover rounded-md border border-neutral-200"
                            />
                            <span>Lihat Foto Rak</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-neutral-400">Tidak ada foto</span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSelectBarcode(prod.barcode)}
                          className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          {loc ? 'Periksa Lokasi' : '+ Input Lokasi'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Table View */
            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-neutral-700 border-collapse">
                  <thead className="bg-neutral-100 text-neutral-600 font-semibold uppercase text-[10px] tracking-wider border-b border-neutral-200">
                    <tr>
                      <th className="py-2.5 px-3">Foto Rak</th>
                      <th className="py-2.5 px-3">Barcode &amp; SKU</th>
                      <th className="py-2.5 px-3">Nama Produk</th>
                      <th className="py-2.5 px-3">Kriteria</th>
                      <th className="py-2.5 px-3">Zona Simpan</th>
                      <th className="py-2.5 px-3">Nomor Rak &amp; Aisle</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {directoryItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-neutral-400">
                          <Package className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                          <p className="font-semibold text-neutral-600">Tidak ada barang yang cocok</p>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Coba sesuaikan kata kunci pencarian atau filter Anda.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      directoryItems.map((prod) => {
                        const loc = locationByBarcode.get(prod.barcode.toLowerCase());
                        return (
                          <tr key={prod.id} className="hover:bg-neutral-50/80 transition-colors">
                            <td className="py-2 px-3">
                              {loc?.photoUrl ? (
                                <img
                                  src={loc.photoUrl}
                                  alt="Foto Rak"
                                  onClick={() =>
                                    setZoomPhoto({
                                      url: loc.photoUrl!,
                                      title: prod.itemName,
                                      locationText: `${loc.storageZone} (${loc.aisleRack})`,
                                    })
                                  }
                                  className="w-10 h-10 object-cover rounded-lg border border-neutral-200 cursor-pointer hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-300">
                                  <Camera className="w-4 h-4" />
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">
                              <div>{prod.barcode}</div>
                              <div className="text-[10px] text-neutral-400 font-normal">
                                {prod.sku || '-'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-neutral-900">{prod.itemName}</div>
                              <div className="text-[10px] text-neutral-500">
                                {prod.department} · {prod.supplierName}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {prod.procurementType === 'CONSIGNMENT' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                  Konsinyasi
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300">
                                  Outright
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {loc ? (
                                <span className="font-semibold text-neutral-900">{loc.storageZone}</span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Belum Ada Lokasi
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {loc ? (
                                <div>
                                  <span className="font-bold text-neutral-900">{loc.aisleRack}</span>
                                  {loc.shelfLevel && (
                                    <div className="text-[10px] text-neutral-500">{loc.shelfLevel}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-neutral-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleSelectBarcode(prod.barcode)}
                                className="px-2.5 py-1 bg-neutral-900 text-white rounded-lg text-[11px] font-semibold hover:bg-neutral-800 transition-colors"
                              >
                                Detail &amp; Scan
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: BARCODE SCANNER MODAL */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        masterProducts={masterProducts}
        onBarcodeDetected={(code: string) => {
          handleSelectBarcode(code);
          setIsScannerOpen(false);
        }}
        onBarcodeNotFound={(code: string) => {
          handleSelectBarcode(code);
          setIsScannerOpen(false);
        }}
        onMasterProductFound={(prod: MasterProduct) => {
          handleSelectBarcode(prod.barcode);
          setIsScannerOpen(false);
        }}
      />

      {/* MODAL 2: IN-APP LIVE CAMERA CAPTURE FOR SHELF PHOTO */}
      {isCapturingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 flex items-center justify-between text-white border-b border-neutral-800">
              <span className="font-bold text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" />
                <span>Foto Tempat Penyimpanan Barang</span>
              </span>
              <button onClick={handleStopCamera} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative bg-black aspect-4/3 flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-8 border border-white/40 rounded-xl pointer-events-none" />
            </div>

            <div className="p-4 flex items-center justify-between gap-3 bg-neutral-900">
              <button
                type="button"
                onClick={handleStopCamera}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCaptureFromVideo}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Jepret Foto Rak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ZOOM PHOTO VIEWER */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex items-center justify-between border-b border-neutral-800 text-white">
              <div>
                <h4 className="font-bold text-sm">{zoomPhoto.title}</h4>
                <p className="text-xs text-neutral-400">Lokasi: {zoomPhoto.locationText}</p>
              </div>
              <button
                onClick={() => setZoomPhoto(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 bg-black flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img
                src={zoomPhoto.url}
                alt="Foto Rak Zoom"
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
