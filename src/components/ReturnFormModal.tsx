import React, { useState, useEffect, useRef } from 'react';
import { ReturnItem, Supplier, ReturnReason, MasterProduct } from '../types/inventory';
import {
  X,
  Camera,
  Building2,
  Plus,
  Sparkles,
  AlertCircle,
  Calendar,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  Database,
  Upload,
  RefreshCw,
} from 'lucide-react';

interface ReturnFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveItem: (item: ReturnItem, newSupplier?: Supplier, newMasterProduct?: MasterProduct) => void;
  suppliers: Supplier[];
  masterProducts?: MasterProduct[];
  initialBarcode?: string;
  onOpenScanner: () => void;
  editingItem?: ReturnItem | null;
}

const REASONS: ReturnReason[] = [
  'Kemasan Rusak / Bocor',
  'Cacat Produksi / Malfungsi',
  'Mendekati / Lewat Expired',
  'Salah Kirim / Tidak Sesuai PO',
  'Barang Pecah / Penyok',
  'Komplain Pelanggan',
  'Lainnya',
];

const CATEGORIES = [
  'Makanan & Minuman',
  'Personal Care & Kosmetik',
  'Home Care & Kebersihan',
  'Farmasi & Obat-obatan',
  'Elektronik & Perkakas',
  'Bahan Baku / Lainnya',
];

const UNITS = ['Pcs', 'Karton', 'Dus', 'Pack', 'Box', 'Lusin', 'Kg'];

/**
 * Kompres gambar client-side agar muat dengan cepat & efisien di Cloud Firestore
 */
const compressImage = (fileOrBlob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const maxDim = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // JPEG kualitas 0.72 (~40-60KB)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        resolve(dataUrl);
      } else {
        resolve(img.src);
      }
    };

    img.onerror = reject;
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
};

export const ReturnFormModal: React.FC<ReturnFormModalProps> = ({
  isOpen,
  onClose,
  onSaveItem,
  suppliers,
  masterProducts = [],
  initialBarcode = '',
  onOpenScanner,
  editingItem = null,
}) => {
  // Form fields
  const [barcode, setBarcode] = useState('');
  const [itemName, setItemName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('Pcs');
  const [returnReason, setReturnReason] = useState<ReturnReason>(REASONS[0]);
  const [conditionNotes, setConditionNotes] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [locationSlot, setLocationSlot] = useState('Rak Retur A-01');
  const [estimatedValue, setEstimatedValue] = useState<number | ''>('');

  // Photo state (Opsional)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Master product autofill state
  const [matchedMaster, setMatchedMaster] = useState<MasterProduct | null>(null);
  const [saveToMasterDb, setSaveToMasterDb] = useState(false);

  // Inline Add New Supplier state
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupPic, setNewSupPic] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');
  const [newSupDefaultDueDays, setNewSupDefaultDueDays] = useState(7);
  const [newSupAddress, setNewSupAddress] = useState('');

  const [formError, setFormError] = useState<string | null>(null);

  const uniqueSuppliers = React.useMemo(() => {
    const map = new Map<string, Supplier>();
    for (const s of suppliers) {
      if (s && s.id) {
        map.set(s.id, s);
      }
    }
    return Array.from(map.values());
  }, [suppliers]);

  // Helper to add days
  const addDaysToDate = (dateStr: string, days: number): string => {
    const d = new Date(dateStr || Date.now());
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Turn off camera stream when modal closes or unmounts
  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startLiveCamera = async () => {
    try {
      stopLiveCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Gagal membuka kamera langsung:', err);
      alert('Tidak dapat mengakses kamera perangkat. Anda dapat menggunakan opsi Unggah Foto.');
    }
  };

  const capturePhotoFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      setPhotoUrl(dataUrl);
    }
    stopLiveCamera();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPhotoUrl(compressed);
    } catch (err) {
      console.warn('Gagal memproses foto:', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Master product lookup helper by Barcode or SKU
  const performMasterLookup = (searchQuery: string) => {
    const clean = searchQuery.trim().toLowerCase();
    if (!clean) {
      setMatchedMaster(null);
      return;
    }

    const found = masterProducts.find(
      (p) =>
        p.barcode.trim().toLowerCase() === clean ||
        (p.sku && p.sku.trim().toLowerCase() === clean)
    );
    if (found) {
      setMatchedMaster(found);
      if (found.barcode) setBarcode(found.barcode);
      setItemName(found.itemName);
      setSku(found.sku || `SKU-${found.barcode.slice(-6)}`);

      // Match category/department if available
      if (found.department) {
        const foundCategory = CATEGORIES.find(
          (c) => c.toLowerCase() === found.department.toLowerCase()
        );
        setCategory(foundCategory || found.department);
      }

      if (found.unit) {
        setUnit(found.unit);
      }

      // Check if supplier exists in existing supplier list
      const matchedSup = suppliers.find(
        (s) => s.name.trim().toLowerCase() === found.supplierName.trim().toLowerCase()
      );

      if (matchedSup) {
        setSelectedSupplierId(matchedSup.id);
        setIsAddingNewSupplier(false);
      } else {
        // Prepopulate inline new supplier fields
        setIsAddingNewSupplier(true);
        setNewSupName(found.supplierName);
        setNewSupPhone(found.supplierPhone || '');
        setNewSupEmail(found.supplierEmail || '');
        setNewSupPic('PIC Rekanan');
      }
    } else {
      setMatchedMaster(null);
    }
  };

  // Initial loading when modal opens
  useEffect(() => {
    if (isOpen) {
      const todayStr = new Date().toISOString().split('T')[0];

      if (editingItem) {
        setBarcode(editingItem.barcode);
        setItemName(editingItem.itemName);
        setSku(editingItem.sku || '');
        setCategory(editingItem.category);
        setSelectedSupplierId(editingItem.supplierId);
        setQuantity(editingItem.quantity);
        setUnit(editingItem.unit);
        setReturnReason(editingItem.returnReason);
        setConditionNotes(editingItem.conditionNotes);
        setReceivedDate(editingItem.receivedDate);
        setDueDate(editingItem.dueDate);
        setLocationSlot(editingItem.locationSlot);
        setEstimatedValue(editingItem.estimatedValue || '');
        setPhotoUrl(editingItem.photoUrl || null);
        setIsAddingNewSupplier(false);
        setSaveToMasterDb(false);
        setMatchedMaster(null);
      } else {
        // New item defaults
        const currentBarcode = initialBarcode || '';
        setBarcode(currentBarcode);
        setItemName('');
        setSku('');
        setCategory(CATEGORIES[0]);
        setQuantity(1);
        setUnit('Pcs');
        setReturnReason(REASONS[0]);
        setConditionNotes('');
        setReceivedDate(todayStr);
        setLocationSlot('Rak Retur A-01');
        setEstimatedValue('');
        setPhotoUrl(null);
        setIsAddingNewSupplier(false);
        setSaveToMasterDb(false);

        const firstSup = suppliers[0];
        if (firstSup) {
          setSelectedSupplierId(firstSup.id);
          setDueDate(addDaysToDate(todayStr, firstSup.defaultDueDays || 7));
        } else {
          setSelectedSupplierId('');
          setDueDate(addDaysToDate(todayStr, 7));
        }

        if (currentBarcode) {
          performMasterLookup(currentBarcode);
        } else {
          setMatchedMaster(null);
        }
      }
      setFormError(null);
      setIsCameraActive(false);
    } else {
      stopLiveCamera();
    }

    return () => {
      stopLiveCamera();
    };
  }, [isOpen, initialBarcode, editingItem, suppliers]);

  // When supplier changes, auto update due date if creating new item
  const handleSupplierChange = (supId: string) => {
    setSelectedSupplierId(supId);
    if (!editingItem && supId) {
      const targetSup = suppliers.find((s) => s.id === supId);
      if (targetSup) {
        setDueDate(addDaysToDate(receivedDate, targetSup.defaultDueDays || 7));
      }
    }
  };

  // Generate random unique barcode for items without printed barcode
  const handleGenerateBarcode = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random3 = Math.floor(100 + Math.random() * 900);
    const genCode = `899${random3}${timestamp}`;
    setBarcode(genCode);
    performMasterLookup(genCode);
  };

  const handleBarcodeChange = (val: string) => {
    setBarcode(val);
    if (!editingItem && val.trim().length >= 3) {
      performMasterLookup(val);
    } else if (!val.trim()) {
      setMatchedMaster(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!barcode.trim()) {
      setFormError('Mohon isi atau scan Barcode barang.');
      return;
    }
    if (!itemName.trim()) {
      setFormError('Nama barang return wajib diisi.');
      return;
    }

    let finalSupplier: Supplier | undefined;
    let finalSupplierId = selectedSupplierId;
    let finalSupplierName = '';
    let finalSupplierPic = '';
    let finalSupplierPhone = '';
    let finalSupplierEmail = '';

    if (isAddingNewSupplier) {
      if (!newSupName.trim()) {
        setFormError('Nama Supplier baru wajib diisi.');
        return;
      }
      if (!newSupPhone.trim() && !newSupEmail.trim()) {
        setFormError('Mohon masukkan minimal Nomor WhatsApp atau Gmail supplier baru.');
        return;
      }

      const generatedSupId = `sup-${Date.now()}`;
      finalSupplier = {
        id: generatedSupId,
        code: `SUP-${newSupName.slice(0, 4).toUpperCase().replace(/\s/g, '')}`,
        name: newSupName.trim(),
        picName: newSupPic.trim() || 'PIC Rekanan',
        phone: newSupPhone.trim(),
        email: newSupEmail.trim(),
        address: newSupAddress.trim(),
        defaultDueDays: Number(newSupDefaultDueDays) || 7,
        createdAt: new Date().toISOString(),
      };

      finalSupplierId = generatedSupId;
      finalSupplierName = finalSupplier.name;
      finalSupplierPic = finalSupplier.picName;
      finalSupplierPhone = finalSupplier.phone;
      finalSupplierEmail = finalSupplier.email;
    } else {
      const matchedSup = suppliers.find((s) => s.id === selectedSupplierId);
      if (!matchedSup) {
        setFormError('Mohon pilih Supplier atau tambahkan supplier baru.');
        return;
      }
      finalSupplierName = matchedSup.name;
      finalSupplierPic = matchedSup.picName;
      finalSupplierPhone = matchedSup.phone;
      finalSupplierEmail = matchedSup.email;
    }

    if (!dueDate) {
      setFormError('Tenggat waktu pengambilan barang wajib ditentukan.');
      return;
    }

    // Determine initial status based on due date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let status: ReturnItem['status'] = 'Menunggu Pengambilan';
    if (editingItem && (editingItem.status === 'Sudah Diambil' || editingItem.status === 'Diganti Baru')) {
      status = editingItem.status;
    } else if (diffDays < 0) {
      status = 'Lewat Tenggat';
    } else if (diffDays <= 2) {
      status = 'Mendekati Tenggat';
    }

    const itemToSave: ReturnItem = {
      id: editingItem ? editingItem.id : `ret-${Date.now()}`,
      barcode: barcode.trim(),
      itemName: itemName.trim(),
      sku: sku.trim() || `SKU-${barcode.trim().slice(-6)}`,
      supplierId: finalSupplierId,
      supplierName: finalSupplierName || 'Supplier',
      supplierPic: finalSupplierPic || '',
      supplierPhone: finalSupplierPhone || '',
      supplierEmail: finalSupplierEmail || '',
      quantity: Number(quantity) || 1,
      unit,
      category,
      returnReason,
      conditionNotes: conditionNotes.trim() || '',
      receivedDate,
      dueDate,
      status,
      locationSlot: locationSlot.trim() || 'Area Retur',
      ...(estimatedValue ? { estimatedValue: Number(estimatedValue) } : {}),
      ...(photoUrl ? { photoUrl } : {}),
      warningHistory: editingItem?.warningHistory || [],
      createdAt: editingItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optional Master Product if user checked saveToMasterDb
    let newMasterProductToSave: MasterProduct | undefined;
    if (saveToMasterDb && !matchedMaster) {
      newMasterProductToSave = {
        id: `prod-${barcode.trim().replace(/[^a-zA-Z0-9_-]/g, '')}`,
        barcode: barcode.trim(),
        itemName: itemName.trim(),
        department: category,
        sku: sku.trim() || `SKU-${barcode.trim().slice(-6)}`,
        supplierName: finalSupplierName,
        supplierPhone: finalSupplierPhone,
        supplierEmail: finalSupplierEmail,
        unit,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    stopLiveCamera();
    onSaveItem(itemToSave, finalSupplier, newMasterProductToSave);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div>
            <h2 className="font-semibold text-base tracking-tight">
              {editingItem ? 'Edit Data Barang Return' : 'Input Barang Return Masuk'}
            </h2>
            <div className="text-xs text-neutral-400">
              Autofill database master XLSX, foto fisik, dan pengaturan tenggat waktu
            </div>
          </div>
          <button
            onClick={() => {
              stopLiveCamera();
              onClose();
            }}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Master Product Lookup Status Banner */}
          {matchedMaster && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>✓ Ditemukan di Database Master Produk (XLSX)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-800">
                    Autofill Aktif
                  </span>
                </div>
                <div className="text-emerald-800 mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span>Produk: <strong>{matchedMaster.itemName}</strong> · Dept: <strong>{matchedMaster.department}</strong> · Supplier: <strong>{matchedMaster.supplierName}</strong></span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    matchedMaster.procurementType === 'CONSIGNMENT'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-blue-100 text-blue-800 border-blue-300'
                  }`}>
                    {matchedMaster.procurementType === 'CONSIGNMENT' ? 'Konsinyasi' : 'Outright (Beli Putus)'}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  Nama produk, SKU, kategori, dan supplier telah terisi otomatis. Anda hanya perlu menentukan jumlah, alasan retur, kondisi fisik, dan foto (opsional).
                </div>
              </div>
            </div>
          )}

          {/* Barcode & Scanning Section */}
          <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-800">
                Barcode / Kode Barang Return <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Scan Kamera
                </button>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="text-xs text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-300 px-2 py-1 rounded-md flex items-center gap-1 font-medium transition-colors cursor-pointer"
                  title="Generate barcode acak"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Kode Otomatis
                </button>
              </div>
            </div>

            <input
              type="text"
              required
              placeholder="Contoh: 8992753210118 atau RET-2026-001"
              value={barcode}
              onChange={(e) => handleBarcodeChange(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
            />

            {!matchedMaster && barcode.trim().length >= 4 && !editingItem && (
              <div className="flex items-center justify-between pt-1 text-[11px] text-amber-700 bg-amber-50/80 p-2 rounded border border-amber-200">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Barcode belum ada di database master XLSX.</span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-neutral-800">
                  <input
                    type="checkbox"
                    checked={saveToMasterDb}
                    onChange={(e) => setSaveToMasterDb(e.target.checked)}
                    className="rounded text-neutral-900 focus:ring-neutral-900"
                  />
                  <span>Simpan juga ke Master Database</span>
                </label>
              </div>
            )}
          </div>

          {/* General Item Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Nama Barang / Produk <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Indomie Goreng Spesial 85g (Dus Basah)"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Kode SKU (Nomor SKU)
              </label>
              <input
                type="text"
                placeholder="Contoh: IDM-GOR-85G"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Departemen / Kategori Barang
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity, Unit & Slot */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Jumlah Retur (Qty) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Satuan Barang
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Lokasi Simpan Gudang
              </label>
              <input
                type="text"
                placeholder="Contoh: Rak Retur A-02"
                value={locationSlot}
                onChange={(e) => setLocationSlot(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>

          {/* Supplier Section (Kategorisasi Per-Supplier) */}
          <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-neutral-700" />
                <span className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                  Kategori Supplier & Kontak Warning
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingNewSupplier(!isAddingNewSupplier)}
                className="text-xs text-neutral-900 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingNewSupplier ? 'Pilih Dari Daftar Supplier' : 'Input Supplier Baru'}
              </button>
            </div>

            {isAddingNewSupplier ? (
              /* Inline new supplier form */
              <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-3">
                <div className="text-xs font-bold text-neutral-800">
                  Data Supplier Baru (Disimpan otomatis ke daftar rekanan):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Nama Perusahaan / Supplier *
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: PT Sumber Alfaria / CV Berkah"
                      value={newSupName}
                      onChange={(e) => setNewSupName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Nama PIC / Kontak Person
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Bpk. Joko (Admin Klaim)"
                      value={newSupPic}
                      onChange={(e) => setNewSupPic(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Nomor WhatsApp (Untuk Warning WA) *
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 081234567890"
                      value={newSupPhone}
                      onChange={(e) => setNewSupPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Email / Gmail (Untuk Warning Email) *
                    </label>
                    <input
                      type="email"
                      placeholder="Contoh: klaim.supplier@gmail.com"
                      value={newSupEmail}
                      onChange={(e) => setNewSupEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Standar Tenggat Retur (Hari)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={newSupDefaultDueDays}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 7;
                        setNewSupDefaultDueDays(val);
                        setDueDate(addDaysToDate(receivedDate, val));
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Alamat / Catatan Supplier
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Pergudangan Marunda Blok C"
                      value={newSupAddress}
                      onChange={(e) => setNewSupAddress(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Existing supplier selection */
              <div className="space-y-2">
                <select
                  value={selectedSupplierId}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                >
                  <option value="" disabled>
                    -- Pilih Supplier Rekanan --
                  </option>
                  {uniqueSuppliers.map((sup, idx) => (
                    <option key={sup.id ? `${sup.id}-${idx}` : `sup-${idx}`} value={sup.id}>
                      {sup.name} ({sup.code}) - WA: {sup.phone || '-'}
                    </option>
                  ))}
                </select>

                {/* Display active supplier details for warning info */}
                {selectedSupplierId && (
                  (() => {
                    const activeSup = suppliers.find((s) => s.id === selectedSupplierId);
                    if (!activeSup) return null;
                    return (
                      <div className="text-xs text-neutral-600 bg-white p-2.5 rounded border border-neutral-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>
                            PIC: <strong className="text-neutral-800">{activeSup.picName || '-'}</strong>
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            Batas Retur Normal: {activeSup.defaultDueDays || 7} Hari
                          </span>
                        </div>
                        <div className="flex items-center gap-4 font-mono text-[11px]">
                          <span>📱 WA: {activeSup.phone || '-'}</span>
                          <span>✉️ Gmail: {activeSup.email || '-'}</span>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>

          {/* Dates & Deadlines */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Tanggal Barang Masuk Retur <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => {
                  setReceivedDate(e.target.value);
                  const activeSup = suppliers.find((s) => s.id === selectedSupplierId);
                  const days = activeSup?.defaultDueDays || 7;
                  setDueDate(addDaysToDate(e.target.value, days));
                }}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1 flex items-center justify-between">
                <span>
                  Tenggat Waktu Pengambilan <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] font-normal text-amber-700">Batas akhir sebelum warning</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
              />
            </div>
          </div>

          {/* Alasan Return & Catatan */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Alasan Retur Barang <span className="text-rose-500">*</span>
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value as ReturnReason)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Catatan Kondisi Fisik / Kerusakan
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Kardus sobek sudut kanan bawah, isi kaleng penyok, segel masih utuh..."
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Estimasi Nilai Barang (Rp, Opsional)
              </label>
              <input
                type="number"
                placeholder="Contoh: 250000"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>

          {/* Fitur Foto Barang Return (Opsional) */}
          <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-neutral-700" />
                <span className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                  Foto Bukti Fisik Barang Retur (Opsional)
                </span>
              </div>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus Foto
                </button>
              )}
            </div>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Live Camera View if Active */}
            {isCameraActive ? (
              <div className="space-y-3 bg-neutral-900 p-3 rounded-lg text-white">
                <div className="relative aspect-4/3 max-h-64 rounded-md overflow-hidden bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={stopLiveCamera}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs rounded text-neutral-300 cursor-pointer"
                  >
                    Batal Kamera
                  </button>
                  <button
                    type="button"
                    onClick={capturePhotoFromCamera}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    Jepret Foto Sekarang
                  </button>
                </div>
              </div>
            ) : photoUrl ? (
              /* Photo Preview Thumbnail */
              <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-neutral-200">
                <img
                  src={photoUrl}
                  alt="Bukti Fisik Barang Retur"
                  className="w-20 h-20 object-cover rounded-md border border-neutral-300 shadow-2xs"
                />
                <div className="space-y-1.5 flex-1">
                  <div className="text-xs font-semibold text-neutral-900 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Foto Bukti Fisik Siap Disimpan</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Foto telah dikompres secara optimal dan akan tersimpan di Cloud Firestore.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={startLiveCamera}
                      className="text-xs text-neutral-700 hover:text-neutral-900 border border-neutral-300 px-2 py-1 rounded bg-neutral-50 cursor-pointer"
                    >
                      Ambil Ulang (Kamera)
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-neutral-700 hover:text-neutral-900 border border-neutral-300 px-2 py-1 rounded bg-neutral-50 cursor-pointer"
                    >
                      Pilih dari Galeri
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Dual Photo Capture Buttons */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={startLiveCamera}
                  className="p-3 bg-white hover:bg-neutral-50 border border-dashed border-neutral-300 hover:border-neutral-400 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Ambil Foto Langsung (Kamera)</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-white hover:bg-neutral-50 border border-dashed border-neutral-300 hover:border-neutral-400 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-neutral-600" />
                  <span>Unggah dari File / Galeri</span>
                </button>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              stopLiveCamera();
              onClose();
            }}
            className="px-4 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-md text-sm font-medium transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md text-sm font-semibold transition-colors shadow-xs cursor-pointer"
          >
            {editingItem ? 'Simpan Perubahan' : 'Simpan Barang Return'}
          </button>
        </div>
      </div>
    </div>
  );
};
