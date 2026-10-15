import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MasterProduct, ProcurementType, Supplier } from '../types/inventory';
import {
  parseMasterProductsFromExcel,
  downloadMasterTemplateExcel,
} from '../utils/excelService';
import { SearchableSupplierSelect, SupplierOption } from './SearchableSupplierSelect';
import {
  Lock,
  Unlock,
  KeyRound,
  Database,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  FileSpreadsheet,
  Package,
  Building2,
  RefreshCw,
  X,
  Edit,
  Eye,
  EyeOff,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  RotateCcw,
} from 'lucide-react';

interface DatabaseManagementViewProps {
  masterProducts: MasterProduct[];
  suppliers: Supplier[];
  onSaveMasterProduct: (product: MasterProduct) => void;
  onBatchSaveMasterProducts: (products: MasterProduct[]) => void;
  onDeleteMasterProduct: (productId: string) => void;
  onBatchDeleteMasterProducts: (productIds: string[]) => void;
  onClearAllMasterProducts: (idsToClear?: string[]) => void;
  onBackToReturnPage?: () => void;
}

const DATABASE_PASSWORD = 'HBCKWS1007';

export const DatabaseManagementView: React.FC<DatabaseManagementViewProps> = ({
  masterProducts,
  suppliers,
  onSaveMasterProduct,
  onBatchSaveMasterProducts,
  onDeleteMasterProduct,
  onBatchDeleteMasterProducts,
  onClearAllMasterProducts,
  onBackToReturnPage,
}) => {
  // Authentication state
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('returku_db_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Table filters & search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'CONSIGNMENT' | 'OUTRIGHT'>('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('ALL');

  // Pagination state (Hemat Kuota & Beban Tampilan)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Multi-select for deletion
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Form states for manual add/edit
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  const [itemName, setItemName] = useState('');
  const [department, setDepartment] = useState('');
  const [sku, setSku] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [procurementType, setProcurementType] = useState<ProcurementType>('OUTRIGHT');
  const [formError, setFormError] = useState<string | null>(null);

  // Real-time detection of similar suppliers in database when typing
  const similarSuppliers = useMemo(() => {
    const q = supplierName.trim().toLowerCase();
    if (q.length < 2) return [];

    const map = new Map<string, { name: string; phone?: string; email?: string }>();
    suppliers.forEach((s) => {
      if (s.name.toLowerCase().includes(q)) {
        map.set(s.name.toLowerCase(), { name: s.name, phone: s.phone, email: s.email });
      }
    });

    masterProducts.forEach((p) => {
      if (p.supplierName && p.supplierName.toLowerCase().includes(q)) {
        const key = p.supplierName.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name: p.supplierName, phone: p.supplierPhone, email: p.supplierEmail });
        }
      }
    });

    return Array.from(map.values()).slice(0, 5);
  }, [supplierName, suppliers, masterProducts]);

  // Import states for 2 distinct channels
  const [isImporting, setIsImporting] = useState(false);
  const [activeImportType, setActiveImportType] = useState<ProcurementType | null>(null);
  const [importStatus, setImportStatus] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);

  const consignmentInputRef = useRef<HTMLInputElement | null>(null);
  const outrightInputRef = useRef<HTMLInputElement | null>(null);

  // Stats
  const consignmentProducts = useMemo(
    () => masterProducts.filter((p) => p.procurementType === 'CONSIGNMENT'),
    [masterProducts]
  );
  const outrightProducts = useMemo(
    () => masterProducts.filter((p) => !p.procurementType || p.procurementType === 'OUTRIGHT'),
    [masterProducts]
  );

  // 1. Cascading Filter: Departemen dinamis menyesuaikan Kriteria
  const cascadingDepartments = useMemo(() => {
    const set = new Set<string>();
    masterProducts.forEach((p) => {
      const matchType =
        selectedTypeFilter === 'ALL' ||
        (selectedTypeFilter === 'CONSIGNMENT' && p.procurementType === 'CONSIGNMENT') ||
        (selectedTypeFilter === 'OUTRIGHT' && (!p.procurementType || p.procurementType === 'OUTRIGHT'));
      if (matchType && p.department) {
        set.add(p.department.trim());
      }
    });
    return Array.from(set).sort();
  }, [masterProducts, selectedTypeFilter]);

  // 2. Cascading Filter: Daftar Supplier dinamis menyesuaikan Kriteria & Departemen
  const cascadingSuppliers = useMemo(() => {
    const countsMap = new Map<string, number>();
    masterProducts.forEach((p) => {
      const matchType =
        selectedTypeFilter === 'ALL' ||
        (selectedTypeFilter === 'CONSIGNMENT' && p.procurementType === 'CONSIGNMENT') ||
        (selectedTypeFilter === 'OUTRIGHT' && (!p.procurementType || p.procurementType === 'OUTRIGHT'));

      const matchDept =
        selectedDeptFilter === 'ALL' || (p.department && p.department.trim() === selectedDeptFilter);

      if (matchType && matchDept && p.supplierName) {
        const sName = p.supplierName.trim();
        countsMap.set(sName, (countsMap.get(sName) || 0) + 1);
      }
    });

    const list: SupplierOption[] = Array.from(countsMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [masterProducts, selectedTypeFilter, selectedDeptFilter]);

  // Filtered products list with 3 cascading filters + search
  const filteredProducts = useMemo(() => {
    return masterProducts.filter((p) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.barcode.toLowerCase().includes(q) ||
        p.itemName.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
        (p.department && p.department.toLowerCase().includes(q));

      const matchType =
        selectedTypeFilter === 'ALL' ||
        (selectedTypeFilter === 'CONSIGNMENT' && p.procurementType === 'CONSIGNMENT') ||
        (selectedTypeFilter === 'OUTRIGHT' && (!p.procurementType || p.procurementType === 'OUTRIGHT'));

      const matchDept =
        selectedDeptFilter === 'ALL' || (p.department && p.department.trim() === selectedDeptFilter);

      const matchSupplier =
        selectedSupplierFilter === 'ALL' ||
        (p.supplierName && p.supplierName.trim().toLowerCase() === selectedSupplierFilter.toLowerCase().trim());

      return matchSearch && matchType && matchDept && matchSupplier;
    });
  }, [masterProducts, searchTerm, selectedTypeFilter, selectedDeptFilter, selectedSupplierFilter]);

  // Reset pagination ke halaman 1 saat filter atau kata kunci berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTypeFilter, selectedDeptFilter, selectedSupplierFilter, pageSize]);

  // Total Halaman
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  // Produk yang ditampilkan sesuai pagination
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIndex, startIndex + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Handle password submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === DATABASE_PASSWORD) {
      setIsUnlocked(true);
      setAuthError(null);
      setPasswordInput('');
      try {
        sessionStorage.setItem('returku_db_unlocked', 'true');
      } catch {}
    } else {
      // Show plain error message without exposing typed characters
      setAuthError('Kata sandi yang Anda masukkan salah. Akses database tetap terkunci. Silakan coba lagi.');
      setPasswordInput('');
    }
  };

  const handleLockDatabase = () => {
    setIsUnlocked(false);
    setSelectedProductIds(new Set());
    setIsEditing(false);
    try {
      sessionStorage.removeItem('returku_db_unlocked');
    } catch {}
  };

  // Checkbox Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      const newSet = new Set<string>();
      filteredProducts.forEach((p) => newSet.add(p.id));
      setSelectedProductIds(newSet);
    }
  };

  const handleToggleSelectItem = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedProductIds(next);
  };

  // In-app interactive confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    mode: 'SELECTED' | 'CLEAR_ALL' | 'CLEAR_CONSIGNMENT' | 'CLEAR_OUTRIGHT' | 'SINGLE';
    productIds?: string[];
    singleProduct?: MasterProduct;
    title: string;
    description: string;
    badgeText: string;
    confirmButtonText: string;
  } | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);

  // Trigger Confirmation Dialogs
  const requestDeleteSelected = () => {
    const count = selectedProductIds.size;
    if (count === 0) return;
    const ids = Array.from(selectedProductIds);
    setDeleteDialog({
      isOpen: true,
      mode: 'SELECTED',
      productIds: ids,
      title: `Hapus ${count} Produk Terpilih?`,
      description: `Anda akan menghapus ${count} produk terpilih secara permanen dari database master dan Cloud Firestore. Tindakan ini tidak dapat dibatalkan.`,
      badgeText: `${count} Produk Dipilih`,
      confirmButtonText: `Ya, Hapus (${count}) Produk`,
    });
  };

  const requestClearAllData = (type?: ProcurementType) => {
    let targetLabel = 'SELURUH data master produk';
    let mode: 'CLEAR_ALL' | 'CLEAR_CONSIGNMENT' | 'CLEAR_OUTRIGHT' = 'CLEAR_ALL';
    let idsToClear: string[] | undefined;
    let count = masterProducts.length;

    if (type === 'CONSIGNMENT') {
      targetLabel = 'seluruh data produk CONSIGNMENT (Konsinyasi)';
      mode = 'CLEAR_CONSIGNMENT';
      idsToClear = consignmentProducts.map((p) => p.id);
      count = consignmentProducts.length;
    } else if (type === 'OUTRIGHT') {
      targetLabel = 'seluruh data produk OUTRIGHT (Beli Putus)';
      mode = 'CLEAR_OUTRIGHT';
      idsToClear = outrightProducts.map((p) => p.id);
      count = outrightProducts.length;
    }

    setDeleteDialog({
      isOpen: true,
      mode,
      productIds: idsToClear,
      title: `Kosongkan ${type ? (type === 'CONSIGNMENT' ? 'Produk Consignment' : 'Produk Outright') : 'Seluruh Database Master'}?`,
      description: `PERINGATAN: Tindakan ini akan MENGOSONGKAN ${count} produk (${targetLabel}) secara permanen dari penyimpanan dan Cloud Firestore. Data yang dikosongkan tidak akan muncul kembali saat halaman dimuat ulang.`,
      badgeText: `Total ${count} Produk Akan Dihapus`,
      confirmButtonText: 'Ya, Kosongkan Sekarang',
    });
  };

  const requestDeleteSingle = (p: MasterProduct) => {
    setDeleteDialog({
      isOpen: true,
      mode: 'SINGLE',
      singleProduct: p,
      title: `Hapus Produk "${p.itemName}"?`,
      description: `Produk dengan barcode ${p.barcode} dan SKU ${p.sku || '-'} dari suplier ${p.supplierName} akan dihapus secara permanen dari database master.`,
      badgeText: p.barcode,
      confirmButtonText: 'Ya, Hapus Produk Ini',
    });
  };

  // Preview selected items in confirmation modal
  const selectedItemsPreview = useMemo(() => {
    if (!deleteDialog || deleteDialog.mode !== 'SELECTED' || !deleteDialog.productIds) return [];
    const idSet = new Set(deleteDialog.productIds);
    return masterProducts.filter((p) => idSet.has(p.id));
  }, [deleteDialog, masterProducts]);

  // Execute Deletion after User Confirms in Modal
  const handleConfirmDelete = async () => {
    if (!deleteDialog) return;
    setIsDeletingLoading(true);

    try {
      if (deleteDialog.mode === 'SELECTED' && deleteDialog.productIds) {
        const ids = deleteDialog.productIds;
        await onBatchDeleteMasterProducts(ids);
        setSelectedProductIds(new Set());
        setImportStatus({
          success: true,
          message: `Berhasil menghapus ${ids.length} produk terpilih dari database master & Cloud Firestore.`,
        });
      } else if (deleteDialog.mode === 'SINGLE' && deleteDialog.singleProduct) {
        const p = deleteDialog.singleProduct;
        await onDeleteMasterProduct(p.id);
        setSelectedProductIds((prev) => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        });
        setImportStatus({
          success: true,
          message: `Produk "${p.itemName}" (${p.barcode}) berhasil dihapus dari database.`,
        });
      } else if (
        deleteDialog.mode === 'CLEAR_ALL' ||
        deleteDialog.mode === 'CLEAR_CONSIGNMENT' ||
        deleteDialog.mode === 'CLEAR_OUTRIGHT'
      ) {
        await onClearAllMasterProducts(deleteDialog.productIds);
        setSelectedProductIds(new Set());
        setImportStatus({
          success: true,
          message: `Berhasil mengosongkan ${
            deleteDialog.mode === 'CLEAR_CONSIGNMENT'
              ? 'seluruh data produk Consignment'
              : deleteDialog.mode === 'CLEAR_OUTRIGHT'
              ? 'seluruh data produk Outright'
              : 'seluruh data database master produk'
          }.`,
        });
      }
    } catch (err: any) {
      console.error('Error executing delete in database view:', err);
      setImportStatus({
        success: false,
        message: err?.message || 'Terjadi kesalahan saat menghapus data. Silakan coba kembali.',
      });
    } finally {
      setIsDeletingLoading(false);
      setDeleteDialog(null);
    }
  };

  // File Upload Handler for Consignment or Outright
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    forcedType: ProcurementType
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setActiveImportType(forcedType);
    setImportStatus(null);

    try {
      const result = await parseMasterProductsFromExcel(file, forcedType);
      if (result.products.length === 0) {
        setImportStatus({
          success: false,
          message: `Tidak ada data produk yang valid ditemukan dalam file "${file.name}".`,
        });
      } else {
        onBatchSaveMasterProducts(result.products);
        setImportStatus({
          success: true,
          message: `Berhasil mengimpor ${result.products.length} data produk ${forcedType} dari file "${file.name}" ke Cloud Firestore!`,
          count: result.products.length,
        });
      }
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: err.message || 'Terjadi kesalahan saat memproses file Excel.',
      });
    } finally {
      setIsImporting(false);
      setActiveImportType(null);
      if (consignmentInputRef.current) consignmentInputRef.current.value = '';
      if (outrightInputRef.current) outrightInputRef.current.value = '';
    }
  };

  // Manual Add / Edit
  const handleStartCreate = () => {
    setIsEditing(true);
    setEditingId(null);
    setBarcode('');
    setItemName('');
    setDepartment('');
    setSku('');
    setSupplierName('');
    setSupplierPhone('');
    setSupplierEmail('');
    setUnit('Pcs');
    setProcurementType('OUTRIGHT');
    setFormError(null);
  };

  const handleStartEdit = (p: MasterProduct) => {
    setIsEditing(true);
    setEditingId(p.id);
    setBarcode(p.barcode);
    setItemName(p.itemName);
    setDepartment(p.department || '');
    setSku(p.sku || '');
    setSupplierName(p.supplierName || '');
    setSupplierPhone(p.supplierPhone || '');
    setSupplierEmail(p.supplierEmail || '');
    setUnit(p.unit || 'Pcs');
    setProcurementType((p.procurementType as ProcurementType) || 'OUTRIGHT');
    setFormError(null);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) {
      setFormError('Kode Barcode wajib diisi.');
      return;
    }
    if (!itemName.trim()) {
      setFormError('Nama Produk wajib diisi.');
      return;
    }
    if (!department.trim()) {
      setFormError('Departemen / Kategori produk wajib diisi.');
      return;
    }
    if (!supplierName.trim()) {
      setFormError('Nama Suplier wajib diisi.');
      return;
    }

    const cleanBarcode = barcode.trim();
    const productToSave: MasterProduct = {
      id: editingId || `prod-${cleanBarcode.replace(/[^a-zA-Z0-9_-]/g, '')}`,
      barcode: cleanBarcode,
      itemName: itemName.trim(),
      department: department.trim(),
      sku: sku.trim() || `SKU-${cleanBarcode.slice(-6)}`,
      supplierName: supplierName.trim(),
      procurementType,
      ...(supplierPhone.trim() ? { supplierPhone: supplierPhone.trim() } : {}),
      ...(supplierEmail.trim() ? { supplierEmail: supplierEmail.trim() } : {}),
      unit: unit.trim() || 'Pcs',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    onSaveMasterProduct(productToSave);
    setIsEditing(false);
    setEditingId(null);
    setImportStatus({
      success: true,
      message: `Produk "${productToSave.itemName}" berhasil disimpan ke database master.`,
    });
  };

  // ==========================================
  // RENDER: PASSWORD LOCK SCREEN (Jika Belum Login)
  // ==========================================
  if (!isUnlocked) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
          {/* Header */}
          <div className="bg-neutral-900 text-white p-6 text-center relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#b8126f] to-rose-700 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-rose-900/30">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Halaman Database Terkunci</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Akses khusus pengelolaan seluruh file, data master Consignment &amp; Outright HBC
            </p>
          </div>

          {/* Form */}
          <div className="p-6">
            {authError && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Akses Ditolak</div>
                  <div className="text-[11px] mt-0.5">{authError}</div>
                </div>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wider">
                  Password Database
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Masukkan password..."
                    className="w-full pl-9 pr-10 py-2.5 text-sm font-mono border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 transition-all"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  Karakter password selalu disembunyikan untuk menjaga keamanan data.
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-98"
              >
                <Unlock className="w-4 h-4 text-emerald-400" />
                <span>Buka Kunci Halaman Database</span>
              </button>

              {onBackToReturnPage && (
                <button
                  type="button"
                  onClick={onBackToReturnPage}
                  className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Kembali ke Halaman Retur
                </button>
              )}
            </form>
          </div>

          {/* Footer note */}
          <div className="bg-neutral-50 px-6 py-3 border-t border-neutral-200 text-center text-[11px] text-neutral-400">
            AEON Health &amp; Beauty Care © 2026 — Sistem Proteksi Logistik
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: UNLOCKED DATABASE MANAGEMENT PAGE
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Top Header Card with Lock Status and Quick Actions */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-850 to-neutral-900 text-white p-5 rounded-2xl shadow-md border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">Halaman Database Master Produk</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" />
                Terotentikasi
              </span>
            </div>
            <p className="text-xs text-neutral-300 mt-0.5">
              Kelola master data produk Consignment &amp; Outright, impor file XLSX, dan sinkronisasi SKU/Barcode.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleStartCreate}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Produk Manual</span>
          </button>

          <button
            onClick={handleLockDatabase}
            className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-medium border border-neutral-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Kunci kembali halaman database"
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>Kunci Kembali</span>
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Master */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              Total Master Produk
            </div>
            <div className="text-xl font-bold font-mono text-neutral-900">
              {masterProducts.length} <span className="text-xs font-normal text-neutral-500">item</span>
            </div>
          </div>
        </div>

        {/* Consignment */}
        <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-amber-50/40 to-white">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Database Consignment
            </div>
            <div className="text-xl font-bold font-mono text-amber-900">
              {consignmentProducts.length} <span className="text-xs font-normal text-amber-700">Konsinyasi</span>
            </div>
          </div>
        </div>

        {/* Outright */}
        <div className="bg-white p-4 rounded-xl border border-blue-200/80 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-blue-50/40 to-white">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
              Database Outright
            </div>
            <div className="text-xl font-bold font-mono text-blue-900">
              {outrightProducts.length} <span className="text-xs font-normal text-blue-700">Beli Putus</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2 JENIS JALUR IMPORT: CONSIGNMENT VS OUTRIGHT */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>2 Opsi Jalur Import File Database (Excel / CSV)</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Pilih jalur import sesuai jenis pengadaan barang untuk memastikan klasifikasi produk otomatis tersimpan dengan tepat.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* JALUR 1: CONSIGNMENT (KONSINYASI) */}
          <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/30 hover:bg-amber-50/50 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wide">
                  Jalur 1: Konsinyasi
                </span>
                <span className="text-xs font-mono font-semibold text-amber-800">
                  {consignmentProducts.length} Produk Aktif
                </span>
              </div>
              <h3 className="font-bold text-sm text-neutral-900">
                Import Database Produk Consignment
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Gunakan jalur ini untuk mengunggah master produk barang titipan / konsinyasi rekanan. Semua baris data akan otomatis diberi label <strong>CONSIGNMENT</strong>.
              </p>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-2">
              {/* Hidden input */}
              <input
                ref={consignmentInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileUpload(e, 'CONSIGNMENT')}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => consignmentInputRef.current?.click()}
                disabled={isImporting}
                className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {isImporting && activeImportType === 'CONSIGNMENT'
                    ? 'Memproses Consignment...'
                    : 'Upload File Consignment'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => downloadMasterTemplateExcel('CONSIGNMENT')}
                className="py-2 px-3 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download template Excel khusus produk Consignment"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                <span>Template XLSX</span>
              </button>
            </div>
          </div>

          {/* JALUR 2: OUTRIGHT (BELI PUTUS) */}
          <div className="p-4 rounded-xl border-2 border-blue-300 bg-blue-50/30 hover:bg-blue-50/50 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-200 text-blue-900 uppercase tracking-wide">
                  Jalur 2: Beli Putus
                </span>
                <span className="text-xs font-mono font-semibold text-blue-800">
                  {outrightProducts.length} Produk Aktif
                </span>
              </div>
              <h3 className="font-bold text-sm text-neutral-900">
                Import Database Produk Outright
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Gunakan jalur ini untuk mengunggah master produk barang beli putus / langsung dari supplier. Semua baris data akan otomatis diberi label <strong>OUTRIGHT</strong>.
              </p>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-2">
              {/* Hidden input */}
              <input
                ref={outrightInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileUpload(e, 'OUTRIGHT')}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => outrightInputRef.current?.click()}
                disabled={isImporting}
                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {isImporting && activeImportType === 'OUTRIGHT'
                    ? 'Memproses Outright...'
                    : 'Upload File Outright'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => downloadMasterTemplateExcel('OUTRIGHT')}
                className="py-2 px-3 bg-white hover:bg-blue-50 text-blue-900 border border-blue-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download template Excel khusus produk Outright"
              >
                <Download className="w-3.5 h-3.5 text-blue-700" />
                <span>Template XLSX</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status notification */}
        {importStatus && (
          <div
            className={`p-3.5 text-xs rounded-xl flex items-center justify-between border ${
              importStatus.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {importStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{importStatus.message}</span>
            </div>
            <button
              onClick={() => setImportStatus(null)}
              className="p-1 hover:bg-neutral-200/50 rounded text-neutral-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Manual Add / Edit Form Modal/Drawer */}
      {isEditing && (
        <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div className="font-bold text-sm text-neutral-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>{editingId ? 'Edit Data Master Produk' : 'Tambah Produk Master Baru'}</span>
            </div>
            <button
              onClick={() => setIsEditing(false)}
              className="text-xs text-neutral-500 hover:text-neutral-800 font-medium"
            >
              Batal
            </button>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSaveForm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Kode Barcode <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Contoh: 8992753210118"
                  className="w-full px-3 py-2 text-xs font-mono border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Nomor SKU (Stock Keeping Unit)
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Contoh: IDM-GOR-85G"
                  className="w-full px-3 py-2 text-xs font-mono border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Kriteria Pengadaan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={procurementType}
                  onChange={(e) => setProcurementType(e.target.value as ProcurementType)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 font-bold bg-white"
                >
                  <option value="CONSIGNMENT">CONSIGNMENT (Konsinyasi)</option>
                  <option value="OUTRIGHT">OUTRIGHT (Beli Putus)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Nama Produk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Contoh: Indomie Goreng Spesial 85g"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Departemen / Kategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Contoh: Health & Beauty / Food"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  required
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Nama Suplier Rekanan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Contoh: PT Daya Mulia Sejahtera"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  required
                />

                {/* Real-time Similar Supplier Alert Box */}
                {similarSuppliers.length > 0 && (
                  <div className="mt-1.5 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1 font-bold text-amber-900 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Supplier serupa di database ({similarSuppliers.length}):</span>
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {similarSuppliers.map((s, idx) => (
                        <div
                          key={idx}
                          className="p-1.5 bg-white rounded border border-amber-200 flex items-center justify-between gap-1.5"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-neutral-900 text-[11px] truncate">{s.name}</div>
                            {s.phone && (
                              <div className="text-[10px] text-neutral-500 font-mono">WA: {s.phone}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSupplierName(s.name);
                              if (s.phone) setSupplierPhone(s.phone);
                              if (s.email) setSupplierEmail(s.email);
                            }}
                            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-semibold shrink-0 cursor-pointer"
                            title="Klik untuk memilih supplier ini otomatis"
                          >
                            Pilih
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  No WhatsApp Suplier (Opsional)
                </label>
                <input
                  type="text"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Gmail Suplier (Opsional)
                </label>
                <input
                  type="email"
                  value={supplierEmail}
                  onChange={(e) => setSupplierEmail(e.target.value)}
                  placeholder="Contoh: vendor@gmail.com"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800"
              >
                {editingId ? 'Simpan Perubahan' : 'Tambahkan ke Database Master'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3 FILTER BERTINGKAT, SEARCH, & DELETION ACTION BAR */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-4">
        {/* Row 1: Search Bar on Top */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari cepat Barcode, SKU, Nama Barang, Departemen, atau Suplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white shadow-2xs font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Row 2: 3 Pilihan Filter Bertingkat: 1. Kriteria | 2. Departemen | 3. Suplier (Searchable Dropdown) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-neutral-50/80 p-3.5 rounded-xl border border-neutral-200/90">
          {/* Filter 1: Kriteria */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-600 flex items-center gap-1.5 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b8126f]"></span>
              <span>1. Kriteria Pengadaan</span>
            </label>
            <div className="flex items-center gap-1 p-0.5 bg-white border border-neutral-300 rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('ALL')}
                className={`flex-1 py-1.5 px-1.5 text-[11px] font-semibold rounded-lg transition-colors text-center cursor-pointer ${
                  selectedTypeFilter === 'ALL'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Semua ({masterProducts.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('CONSIGNMENT')}
                className={`flex-1 py-1.5 px-1.5 text-[11px] font-semibold rounded-lg transition-colors text-center cursor-pointer ${
                  selectedTypeFilter === 'CONSIGNMENT'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                Konsinyasi ({consignmentProducts.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('OUTRIGHT')}
                className={`flex-1 py-1.5 px-1.5 text-[11px] font-semibold rounded-lg transition-colors text-center cursor-pointer ${
                  selectedTypeFilter === 'OUTRIGHT'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-800 hover:bg-blue-50'
                }`}
              >
                Outright ({outrightProducts.length})
              </button>
            </div>
          </div>

          {/* Filter 2: Departemen (Dinamis menyesuaikan Kriteria) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-600 flex items-center gap-1.5 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              <span>2. Departemen / Kategori</span>
            </label>
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 shadow-2xs font-medium text-neutral-800 cursor-pointer"
            >
              <option value="ALL">Semua Departemen ({cascadingDepartments.length} Dept)</option>
              {cascadingDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Suplier (Searchable Dropdown dinamis menyesuaikan Kriteria & Dept) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-600 flex items-center gap-1.5 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              <span>3. Suplier (Searchable Dropdown)</span>
            </label>
            <SearchableSupplierSelect
              options={cascadingSuppliers}
              selectedValue={selectedSupplierFilter}
              onSelect={(sup) => setSelectedSupplierFilter(sup)}
              placeholder="Cari & Pilih Suplier..."
              allLabel="Semua Suplier"
            />
          </div>
        </div>

        {/* Active Filter Chips & Reset All Button */}
        {(selectedTypeFilter !== 'ALL' ||
          selectedDeptFilter !== 'ALL' ||
          selectedSupplierFilter !== 'ALL' ||
          searchTerm) && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-neutral-500">
            <span className="font-semibold text-neutral-700 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              Filter Aktif:
            </span>
            {selectedTypeFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-200 text-neutral-800 text-[11px] font-medium">
                Kriteria: <strong>{selectedTypeFilter === 'CONSIGNMENT' ? 'Konsinyasi' : 'Outright'}</strong>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('ALL')}
                  className="hover:text-rose-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedDeptFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 text-[11px] font-medium">
                Dept: <strong>{selectedDeptFilter}</strong>
                <button
                  type="button"
                  onClick={() => setSelectedDeptFilter('ALL')}
                  className="hover:text-rose-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedSupplierFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-medium">
                Suplier: <strong>{selectedSupplierFilter}</strong>
                <button
                  type="button"
                  onClick={() => setSelectedSupplierFilter('ALL')}
                  className="hover:text-rose-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-800 text-[11px] font-medium">
                Cari: <strong>"{searchTerm}"</strong>
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="hover:text-rose-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedTypeFilter('ALL');
                setSelectedDeptFilter('ALL');
                setSelectedSupplierFilter('ALL');
                setSearchTerm('');
              }}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 ml-auto cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Semua Filter</span>
            </button>
          </div>
        )}

        {/* Row 3: DELETION ACTION BAR (Hapus Terpilih / Kosongkan Semua) */}
        <div className="pt-3 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/70 p-3 rounded-xl">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="select-all-master"
              checked={
                paginatedProducts.length > 0 &&
                paginatedProducts.every((p) => selectedProductIds.has(p.id))
              }
              onChange={() => {
                const isAllPageSelected =
                  paginatedProducts.length > 0 &&
                  paginatedProducts.every((p) => selectedProductIds.has(p.id));
                if (isAllPageSelected) {
                  const next = new Set(selectedProductIds);
                  paginatedProducts.forEach((p) => next.delete(p.id));
                  setSelectedProductIds(next);
                } else {
                  const next = new Set(selectedProductIds);
                  paginatedProducts.forEach((p) => next.add(p.id));
                  setSelectedProductIds(next);
                }
              }}
              className="w-4 h-4 rounded text-neutral-900 focus:ring-0 cursor-pointer"
            />
            <label
              htmlFor="select-all-master"
              className="text-xs font-semibold text-neutral-700 cursor-pointer select-none"
            >
              Pilih Halaman Ini ({paginatedProducts.length} produk)
            </label>
            {selectedProductIds.size > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-900 text-white font-mono font-bold">
                {selectedProductIds.size} Dipilih
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* OPSI 1: HAPUS PILIHAN / KUSTOM */}
            {selectedProductIds.size > 0 && (
              <button
                type="button"
                onClick={requestDeleteSelected}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs animate-in fade-in"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus ({selectedProductIds.size}) Produk Terpilih</span>
              </button>
            )}

            {/* OPSI 2: HAPUS SEMUA / KOSONGKAN DATA */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => requestClearAllData(selectedTypeFilter !== 'ALL' ? selectedTypeFilter : undefined)}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Kosongkan data"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>
                  {selectedTypeFilter === 'CONSIGNMENT'
                    ? 'Kosongkan Consignment'
                    : selectedTypeFilter === 'OUTRIGHT'
                    ? 'Kosongkan Outright'
                    : 'Kosongkan Seluruh Data'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* TABLE OF MASTER PRODUCTS (PAGINATED) */}
        <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-700 border-collapse">
              <thead className="bg-neutral-100/90 text-neutral-600 font-semibold uppercase text-[10px] tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="py-2.5 px-3 w-8 text-center">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-2.5 px-3">Barcode &amp; SKU</th>
                  <th className="py-2.5 px-3">Nama Produk</th>
                  <th className="py-2.5 px-3">Kriteria</th>
                  <th className="py-2.5 px-3">Departemen</th>
                  <th className="py-2.5 px-3">Suplier Rekanan</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                      <FileSpreadsheet className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
                      <p className="font-semibold text-neutral-700">
                        Tidak ada data produk yang cocok dengan filter
                      </p>
                      <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                        Coba sesuaikan pilihan kriteria, departemen, suplier, atau kata kunci pencarian Anda.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((p) => {
                    const isSelected = selectedProductIds.has(p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-rose-50/50' : 'hover:bg-neutral-50/80'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectItem(p.id)}
                            className="w-4 h-4 rounded text-neutral-900 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-bold text-neutral-900">
                            {p.barcode}
                          </div>
                          <div className="font-mono text-[10px] text-neutral-500">
                            SKU: {p.sku || '-'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-neutral-900">
                            {p.itemName}
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            Satuan: {p.unit || 'Pcs'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {p.procurementType === 'CONSIGNMENT' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              Konsinyasi
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300">
                              Outright (Beli Putus)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                            {p.department || 'Umum'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-neutral-800">
                            {p.supplierName}
                          </div>
                          {(p.supplierPhone || p.supplierEmail) && (
                            <div className="text-[10px] text-neutral-500">
                              {p.supplierPhone && <span>WA: {p.supplierPhone} </span>}
                              {p.supplierEmail && <span>· {p.supplierEmail}</span>}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(p)}
                              className="p-1.5 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                              title="Edit Produk"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteSingle(p)}
                              className="p-1.5 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Hapus Produk"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION CONTROLS & INFO BAR */}
        <div className="pt-3 border-t border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-neutral-600">
          {/* Left: Summary and Page Size Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              Menampilkan <strong>{filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> -{' '}
              <strong>{Math.min(currentPage * pageSize, filteredProducts.length)}</strong> dari{' '}
              <strong>{filteredProducts.length}</strong> produk (Total Master:{' '}
              <strong>{masterProducts.length}</strong> item)
            </div>

            <div className="flex items-center gap-1.5 text-neutral-500">
              <span>Limit per hal:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 border border-neutral-300 rounded-lg bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
              >
                <option value={25}>25 item</option>
                <option value={50}>50 item</option>
                <option value={100}>100 item</option>
              </select>
            </div>
          </div>

          {/* Right: Page Buttons */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {/* First Page */}
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-700 transition-colors cursor-pointer"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Prev Page */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-700 transition-colors cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    return (
                      p === 1 ||
                      p === totalPages ||
                      (p >= currentPage - 2 && p <= currentPage + 2)
                    );
                  })
                  .map((pageNumber, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && pageNumber - prev > 1;

                    return (
                      <React.Fragment key={pageNumber}>
                        {showEllipsis && <span className="px-1 text-neutral-400">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            currentPage === pageNumber
                              ? 'bg-neutral-900 text-white shadow-xs'
                              : 'border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              {/* Next Page */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-700 transition-colors cursor-pointer"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Last Page */}
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-700 transition-colors cursor-pointer"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* IN-APP CONFIRMATION MODAL FOR DELETION & EMPTYING (NO BROWSER POPUPS) */}
      {/* ========================================================= */}
      {deleteDialog?.isOpen && (
        <div
          className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeletingLoading) setDeleteDialog(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-neutral-200 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-rose-50/80 border-b border-rose-100 p-5 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base text-neutral-900 truncate">
                  {deleteDialog.title}
                </h3>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-200/80 text-rose-800">
                  {deleteDialog.badgeText}
                </span>
              </div>
              <button
                type="button"
                disabled={isDeletingLoading}
                onClick={() => setDeleteDialog(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-neutral-600 leading-relaxed">
                {deleteDialog.description}
              </p>

              {/* Preview if deleting selected items */}
              {deleteDialog.mode === 'SELECTED' && selectedItemsPreview.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wide">
                    Pratinjau Produk Yang Dipilih:
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-neutral-200 rounded-xl p-2.5 bg-neutral-50/70 divide-y divide-neutral-200/60">
                    {selectedItemsPreview.slice(0, 5).map((p) => (
                      <div key={p.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs gap-2">
                        <div className="truncate flex-1">
                          <span className="font-semibold text-neutral-900">{p.itemName}</span>
                          <span className="text-[10px] font-mono text-neutral-500 ml-1.5">({p.barcode})</span>
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide shrink-0 ${
                            p.procurementType === 'CONSIGNMENT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {p.procurementType === 'CONSIGNMENT' ? 'Konsinyasi' : 'Outright'}
                        </span>
                      </div>
                    ))}
                    {selectedItemsPreview.length > 5 && (
                      <div className="text-[11px] text-neutral-500 pt-1 italic text-center">
                        + {selectedItemsPreview.length - 5} produk lainnya
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preview if deleting single item */}
              {deleteDialog.mode === 'SINGLE' && deleteDialog.singleProduct && (
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1 text-xs">
                  <div className="font-bold text-neutral-900">{deleteDialog.singleProduct.itemName}</div>
                  <div className="text-neutral-500 font-mono text-[11px]">
                    Barcode: {deleteDialog.singleProduct.barcode} | SKU: {deleteDialog.singleProduct.sku || '-'}
                  </div>
                  <div className="text-neutral-500 text-[11px]">
                    Suplier: {deleteDialog.singleProduct.supplierName}
                  </div>
                </div>
              )}

              {/* Notice */}
              <div className="p-3 bg-neutral-100/90 rounded-xl text-[11px] text-neutral-600 flex items-start gap-2 border border-neutral-200">
                <AlertCircle className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
                <span>
                  Perubahan akan langsung dihapus dari memori dan disinkronkan ke Cloud Firestore. Data tidak akan muncul kembali saat halaman dimuat ulang.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-neutral-50 px-5 py-3.5 border-t border-neutral-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingLoading}
                onClick={() => setDeleteDialog(null)}
                className="px-4 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-700 transition-colors cursor-pointer disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleteDialog.confirmButtonText}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
