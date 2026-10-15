import React, { useState, useMemo, useEffect } from 'react';
import { Supplier, ReturnItem } from '../types/inventory';
import {
  generateConsolidatedSupplierMessage,
  getWhatsAppUrl,
  getGmailComposeUrl,
} from '../utils/notification';
import {
  X,
  Building2,
  Plus,
  MessageSquare,
  Mail,
  Edit,
  Trash2,
  ExternalLink,
  Search,
  AlertTriangle,
  Clock,
  Package,
  CheckCircle2,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface SupplierListModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  items: ReturnItem[];
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onBatchDeleteSuppliers?: (supplierIds: string[]) => void;
  onFilterBySupplier: (supplierId: string) => void;
}

export const SupplierListModal: React.FC<SupplierListModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  items,
  onSaveSupplier,
  onDeleteSupplier,
  onBatchDeleteSuppliers,
  onFilterBySupplier,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSup, setEditingSup] = useState<Supplier | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Multi-select state for Custom Select Deletion
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [picName, setPicName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [defaultDueDays, setDefaultDueDays] = useState(7);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingSup(null);
    setName('');
    setCode('');
    setPicName('');
    setPhone('');
    setEmail('');
    setDefaultDueDays(7);
    setAddress('');
    setNotes('');
  };

  const handleStartEdit = (sup: Supplier) => {
    setEditingSup(sup);
    setIsCreating(true);
    setName(sup.name);
    setCode(sup.code);
    setPicName(sup.picName);
    setPhone(sup.phone);
    setEmail(sup.email);
    setDefaultDueDays(sup.defaultDueDays || 7);
    setAddress(sup.address || '');
    setNotes(sup.notes || '');
  };

  // Deteksi real-time supplier yang serupa di database saat mengetik nama (cth: ketik "Daya" -> tampilkan "PT. DAYA MULIA SEJAHTERA")
  const similarSuppliers = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (q.length < 2) return [];

    const words = q.split(/\s+/).filter((w) => w.length > 1);

    return suppliers
      .filter((s) => {
        if (!s || !s.name) return false;
        if (editingSup && s.id === editingSup.id) return false;
        const sName = s.name.toLowerCase();
        const sCode = (s.code || '').toLowerCase();

        // 1. Cek langsung substring nama atau kode
        if (sName.includes(q) || sCode.includes(q)) return true;

        // 2. Cek kesamaan kata kunci (misal "daya" di dalam "PT Daya Mulia")
        return words.some((word) => sName.includes(word));
      })
      .slice(0, 5);
  }, [name, suppliers, editingSup]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const savedSupplier: Supplier = {
      id: editingSup ? editingSup.id : `sup-${Date.now()}`,
      code: code.trim() || `SUP-${name.slice(0, 4).toUpperCase().replace(/\s/g, '')}`,
      name: name.trim(),
      picName: picName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      defaultDueDays: Number(defaultDueDays) || 7,
      address: address.trim(),
      notes: notes.trim(),
      createdAt: editingSup ? editingSup.createdAt : new Date().toISOString(),
    };

    onSaveSupplier(savedSupplier);
    setIsCreating(false);
    setEditingSup(null);
  };

  const handleSendConsolidatedWA = (supplier: Supplier) => {
    const supItems = items.filter((i) => i.supplierId === supplier.id);
    const { message } = generateConsolidatedSupplierMessage(supplier, supItems);
    const url = getWhatsAppUrl(supplier.phone, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSendConsolidatedGmail = (supplier: Supplier) => {
    const supItems = items.filter((i) => i.supplierId === supplier.id);
    const { subject, message } = generateConsolidatedSupplierMessage(supplier, supItems);
    const url = getGmailComposeUrl(supplier.email, subject, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Filter & Pagination States (Default 15 supplier contoh sesuai permintaan user agar hemat memori & ringan)
  type SupplierStatusFilter = 'ALL' | 'HAS_ACTIVE' | 'OVERDUE' | 'WARNING' | 'NO_ACTIVE';
  const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>('ALL');
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Map supplier ID ke data agregasi retur (aktif, telat, mendekati batas)
  const supplierStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { totalActive: number; overdueCount: number; warningCount: number; activeItems: ReturnItem[] }
    >();

    items.forEach((item) => {
      if (!item.supplierId) return;
      const isActive = item.status !== 'Sudah Diambil' && item.status !== 'Diganti Baru';
      if (!isActive) return;

      const current = map.get(item.supplierId) || {
        totalActive: 0,
        overdueCount: 0,
        warningCount: 0,
        activeItems: [],
      };
      current.totalActive += 1;
      current.activeItems.push(item);
      if (item.status === 'Lewat Tenggat') {
        current.overdueCount += 1;
      } else if (item.status === 'Mendekati Tenggat') {
        current.warningCount += 1;
      }
      map.set(item.supplierId, current);
    });

    return map;
  }, [items]);

  // Hitung jumlah supplier untuk badge setiap tab filter
  const filterCounts = useMemo(() => {
    let hasActive = 0;
    let overdue = 0;
    let warning = 0;
    let noActive = 0;

    suppliers.forEach((s) => {
      const stats = supplierStatsMap.get(s.id);
      if (stats && stats.totalActive > 0) {
        hasActive++;
        if (stats.overdueCount > 0) overdue++;
        if (stats.warningCount > 0) warning++;
      } else {
        noActive++;
      }
    });

    return {
      all: suppliers.length,
      hasActive,
      overdue,
      warning,
      noActive,
    };
  }, [suppliers, supplierStatsMap]);

  // Filter berjenjang: Berdasarkan Status Retur Aktif / Telat / Mendekati Waktu + Pencarian Teks
  const filteredSuppliers = useMemo(() => {
    const seen = new Set<string>();
    const unique: Supplier[] = [];
    for (const s of suppliers) {
      if (s && s.id && !seen.has(s.id)) {
        seen.add(s.id);
        unique.push(s);
      }
    }

    return unique.filter((s) => {
      const stats = supplierStatsMap.get(s.id);
      const activeCount = stats?.totalActive || 0;
      const overdueCount = stats?.overdueCount || 0;
      const warningCount = stats?.warningCount || 0;

      // 1. Filter status retur
      if (statusFilter === 'HAS_ACTIVE' && activeCount === 0) return false;
      if (statusFilter === 'OVERDUE' && overdueCount === 0) return false;
      if (statusFilter === 'WARNING' && warningCount === 0) return false;
      if (statusFilter === 'NO_ACTIVE' && activeCount > 0) return false;

      // 2. Pencarian teks
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchPic = (s.picName || '').toLowerCase().includes(q);
        const matchCode = (s.code || '').toLowerCase().includes(q);
        const matchPhone = (s.phone || '').toLowerCase().includes(q);
        if (!matchName && !matchPic && !matchCode && !matchPhone) {
          return false;
        }
      }

      return true;
    });
  }, [suppliers, searchTerm, statusFilter, supplierStatsMap]);

  // Reset pagination & selection ke awal saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
    setSelectedSupplierIds(new Set());
  }, [searchTerm, statusFilter, pageSize]);

  // Handler Multi-Select / Custom Select Supplier
  const handleToggleSelectSupplier = (id: string) => {
    setSelectedSupplierIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAllSuppliers = () => {
    if (selectedSupplierIds.size === paginatedSuppliers.length && paginatedSuppliers.length > 0) {
      setSelectedSupplierIds(new Set());
    } else {
      const set = new Set<string>();
      paginatedSuppliers.forEach((s) => set.add(s.id));
      setSelectedSupplierIds(set);
    }
  };

  const handleExecuteBatchDeleteSuppliers = () => {
    if (selectedSupplierIds.size === 0) return;
    const ids = Array.from(selectedSupplierIds);
    setIsBatchDeleting(true);
    if (onBatchDeleteSuppliers) {
      onBatchDeleteSuppliers(ids);
    } else {
      ids.forEach((id) => onDeleteSupplier(id));
    }
    setSelectedSupplierIds(new Set());
    setShowBatchDeleteModal(false);
    setIsBatchDeleting(false);
  };

  // Pagination perhitungan
  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));
  const paginatedSuppliers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredSuppliers.slice(startIndex, startIndex + pageSize);
  }, [filteredSuppliers, currentPage, pageSize]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh]">
        <div className="px-5 sm:px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h2 className="font-semibold text-base tracking-tight">
                Daftar Supplier & Rekanan Retur
              </h2>
              <div className="text-xs text-neutral-400">
                Kelola kontak WhatsApp, Gmail, dan pantau status barang retur
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {!isCreating ? (
            <>
              {/* Search Bar & Tambah Supplier Button */}
              <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama supplier, kode, PIC, atau no WA..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 font-medium"
                  />
                </div>
                <button
                  onClick={handleStartCreate}
                  className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Supplier</span>
                </button>
              </div>

              {/* Filter Berjenjang: Status Barang Retur Supplier */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors border cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-neutral-900 border-neutral-900 text-white shadow-2xs'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                  }`}
                  title="Tampilkan semua supplier terdaftar"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Semua ({filterCounts.all})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('HAS_ACTIVE')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors border cursor-pointer ${
                    statusFilter === 'HAS_ACTIVE'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                  }`}
                  title="Supplier yang memiliki barang aktif untuk diretur di gudang"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Ada Barang Aktif ({filterCounts.hasActive})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('OVERDUE')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors border cursor-pointer ${
                    statusFilter === 'OVERDUE'
                      ? 'bg-rose-600 border-rose-600 text-white shadow-2xs'
                      : 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50'
                  }`}
                  title="Supplier yang memiliki barang retur yang telah lewat tenggat waktu"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Telat / Lewat Waktu ({filterCounts.overdue})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('WARNING')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors border cursor-pointer ${
                    statusFilter === 'WARNING'
                      ? 'bg-amber-600 border-amber-600 text-white shadow-2xs'
                      : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'
                  }`}
                  title="Supplier yang memiliki barang retur mendekati batas waktu (≤ 2 hari)"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Mendekati Waktu ({filterCounts.warning})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('NO_ACTIVE')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors border cursor-pointer ${
                    statusFilter === 'NO_ACTIVE'
                      ? 'bg-neutral-700 border-neutral-700 text-white shadow-2xs'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                  title="Supplier tanpa barang retur aktif saat ini"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Tanpa Barang Aktif ({filterCounts.noActive})</span>
                </button>
              </div>

              {/* Multi-Select Action Bar for Suppliers */}
              {selectedSupplierIds.size > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs animate-in fade-in shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                    <span className="font-bold text-rose-900">
                      Terpilih {selectedSupplierIds.size} supplier di halaman ini
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBatchDeleteModal(true)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus ({selectedSupplierIds.size}) Terpilih</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSupplierIds(new Set())}
                      className="px-2.5 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      Batal Pilihan
                    </button>
                  </div>
                </div>
              )}

              {/* Select All Checkbox Control */}
              {paginatedSuppliers.length > 0 && (
                <div className="flex items-center justify-between text-xs text-neutral-600 px-1">
                  <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-neutral-900">
                    <input
                      type="checkbox"
                      checked={paginatedSuppliers.length > 0 && paginatedSuppliers.every((s) => selectedSupplierIds.has(s.id))}
                      onChange={handleToggleSelectAllSuppliers}
                      className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                    />
                    <span>Pilih Semua di Halaman Ini ({paginatedSuppliers.length})</span>
                  </label>
                  {selectedSupplierIds.size > 0 && (
                    <span className="text-rose-600 font-bold">
                      {selectedSupplierIds.size} supplier terpilih
                    </span>
                  )}
                </div>
              )}

              {/* Daftar Supplier (Paginated: Default 15 data contoh) */}
              <div className="space-y-3">
                {paginatedSuppliers.map((sup, idx) => {
                  const stats = supplierStatsMap.get(sup.id) || {
                    totalActive: 0,
                    overdueCount: 0,
                    warningCount: 0,
                    activeItems: [],
                  };
                  const activeItems = stats.activeItems;
                  const overdueCount = stats.overdueCount;
                  const warningCount = stats.warningCount;
                  const isSelected = selectedSupplierIds.has(sup.id);

                  return (
                    <div
                      key={sup.id ? `${sup.id}-${idx}` : `sup-${idx}`}
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isSelected
                          ? 'border-rose-400 ring-1 ring-rose-400 bg-rose-50/20'
                          : 'border-neutral-200 bg-neutral-50/50 hover:bg-white'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectSupplier(sup.id)}
                            className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer mt-1 shrink-0"
                            title="Pilih supplier ini untuk custom select hapus"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-neutral-200 text-neutral-800">
                                {sup.code}
                              </span>
                              <h3 className="font-bold text-sm text-neutral-900">{sup.name}</h3>
                            </div>
                            <div className="text-xs text-neutral-600 mt-1 flex flex-wrap items-center gap-3">
                              <span>PIC: <strong className="text-neutral-800">{sup.picName || '-'}</strong></span>
                              <span>·</span>
                              <span>Batas Retur: <strong className="text-neutral-800">{sup.defaultDueDays || 7} Hari</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              onFilterBySupplier(sup.id);
                              onClose();
                            }}
                            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                              activeItems.length > 0
                                ? 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                            }`}
                            title="Tampilkan daftar barang retur supplier ini di halaman utama"
                          >
                            <span>{activeItems.length} Barang Aktif</span>
                            {overdueCount > 0 && (
                              <span className="text-rose-600 font-bold">({overdueCount} telat)</span>
                            )}
                            {warningCount > 0 && overdueCount === 0 && (
                              <span className="text-amber-600 font-semibold">({warningCount} mendekati batas)</span>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5 text-neutral-600 font-mono text-[11px]">
                          <div>📱 WA: {sup.phone || '(Belum ada)'}</div>
                          <div className="truncate max-w-xs">✉️ Gmail: {sup.email || '(Belum ada)'}</div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeItems.length > 0 && (
                            <>
                              <button
                                onClick={() => handleSendConsolidatedWA(sup)}
                                disabled={!sup.phone}
                                className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                  sup.phone
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                }`}
                                title="Kirim rekap WA daftar barang retur"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Rekap WA</span>
                                <ExternalLink className="w-3 h-3 opacity-75" />
                              </button>

                              <button
                                onClick={() => handleSendConsolidatedGmail(sup)}
                                disabled={!sup.email}
                                className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                  sup.email
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                }`}
                                title="Buka Gmail compose rekap barang retur"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Rekap Gmail</span>
                                <ExternalLink className="w-3 h-3 opacity-75" />
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStartEdit(sup)}
                            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer"
                            title="Edit data supplier"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSupplierToDelete(sup)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                            title="Hapus supplier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredSuppliers.length === 0 && (
                  <div className="p-8 text-center border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50/50 space-y-3">
                    <Building2 className="w-8 h-8 text-neutral-400 mx-auto" />
                    <div className="text-sm font-semibold text-neutral-700">
                      {searchTerm ? 'Tidak ada supplier yang sesuai pencarian / filter' : 'Belum ada data supplier'}
                    </div>
                    <button
                      onClick={handleStartCreate}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Input Supplier Baru Manual</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Pagination Controls Bar (Default 15 Data Contoh, Hemat Beban & Kuota) */}
              {filteredSuppliers.length > 0 && (
                <div className="pt-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      Menampilkan <strong>{(currentPage - 1) * pageSize + 1}</strong> -{' '}
                      <strong>{Math.min(currentPage * pageSize, filteredSuppliers.length)}</strong> dari{' '}
                      <strong>{filteredSuppliers.length}</strong> supplier
                    </span>
                    <span className="text-neutral-300">|</span>
                    <div className="flex items-center gap-1 text-neutral-500">
                      <span>Per hal:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="px-2 py-0.5 border border-neutral-300 rounded bg-white text-xs font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={15}>15 (Contoh)</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage <= 1}
                      className="p-1.5 rounded border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Halaman Pertama"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-1.5 rounded border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-medium">
                      Hal <strong>{currentPage}</strong> dari <strong>{totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-1.5 rounded border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Halaman Berikutnya"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage >= totalPages}
                      className="p-1.5 rounded border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Halaman Terakhir"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="text-xs font-bold text-neutral-900 border-b border-neutral-200 pb-2">
                {editingSup ? `Edit Supplier: ${editingSup.name}` : 'Tambah Supplier Baru'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Nama Supplier / PT / CV *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PT Indofood CBP Sukses Makmur / Daya"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 font-medium"
                  />

                  {/* Real-time Similar Supplier Alert Box */}
                  {similarSuppliers.length > 0 && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Terdeteksi {similarSuppliers.length} supplier serupa di database:</span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {similarSuppliers.map((s) => (
                          <div
                            key={s.id}
                            className="p-2.5 bg-white rounded-lg border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                          >
                            <div>
                              <div className="font-bold text-neutral-900 text-xs flex items-center gap-1.5">
                                <span>{s.name}</span>
                                <span className="font-mono text-[10px] bg-neutral-100 px-1.5 py-0.2 rounded text-neutral-600">
                                  {s.code}
                                </span>
                              </div>
                              <div className="text-[11px] text-neutral-500 mt-0.5 flex flex-wrap items-center gap-2">
                                <span>PIC: <strong className="text-neutral-700">{s.picName || '-'}</strong></span>
                                <span>·</span>
                                <span>WA: <strong className="text-neutral-700 font-mono">{s.phone || '-'}</strong></span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(s)}
                              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold shrink-0 cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-1"
                              title="Pilih dan edit data supplier ini langsung untuk menghindari duplikasi"
                            >
                              <span>Gunakan / Edit Data Ini</span>
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] text-amber-800 italic">
                        Tip: Gunakan data yang sudah ada di atas jika nama supplier sudah pernah didaftarkan.
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Kode Singkat Supplier
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: SUP-INDF"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Nama PIC / Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Bambang Haryanto"
                    value={picName}
                    onChange={(e) => setPicName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Nomor WhatsApp *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 081234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Email / Gmail *
                  </label>
                  <input
                    type="email"
                    placeholder="Contoh: indofood.claims@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Standar Tenggat Retur (Hari Kerja)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={defaultDueDays}
                    onChange={(e) => setDefaultDueDays(parseInt(e.target.value) || 7)}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Alamat Pabrik / Gudang Supplier
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Kawasan Industri Pulogadung"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Catatan Khusus Klaim Supplier
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Penjemputan hanya di hari Selasa & Jumat..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3.5 py-1.5 text-xs border border-neutral-300 rounded text-neutral-700 hover:bg-neutral-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded"
                >
                  Simpan Supplier
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-md text-xs font-medium transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>

      {supplierToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-neutral-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-neutral-900">
                  Konfirmasi Hapus Data Supplier
                </h3>
                <p className="text-xs text-neutral-600 mt-1">
                  Yakin ingin menghapus supplier <strong className="text-neutral-900 font-semibold">{supplierToDelete.name}</strong> ({supplierToDelete.code || 'Tanpa Kode'})?
                </p>
                {items.filter((i) => i.supplierId === supplierToDelete.id).length > 0 && (
                  <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Masih ada {items.filter((i) => i.supplierId === supplierToDelete.id).length} barang return terhubung dengan supplier ini.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToDelete = supplierToDelete.id;
                  setSupplierToDelete(null);
                  onDeleteSupplier(idToDelete);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal for Suppliers */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-neutral-900">
                Hapus {selectedSupplierIds.size} Supplier Terpilih?
              </h3>
              <p className="text-xs text-neutral-500">
                Data supplier terpilih akan dihapus secara permanen dari Cloud Firestore dan memori perangkat.
              </p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
              ⚠️ Catatan: Jika ada riwayat barang return yang masih terkait dengan supplier ini, barang tersebut tetap tersimpan di riwayat retur gudang.
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isBatchDeleting}
                onClick={() => setShowBatchDeleteModal(false)}
                className="flex-1 py-2.5 text-xs font-semibold border border-neutral-300 hover:bg-neutral-50 rounded-xl text-neutral-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isBatchDeleting}
                onClick={handleExecuteBatchDeleteSuppliers}
                className="flex-1 py-2.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBatchDeleting ? 'Menghapus...' : `Ya, Hapus (${selectedSupplierIds.size}) Supplier`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
