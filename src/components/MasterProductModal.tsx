import React, { useState, useMemo, useRef } from 'react';
import { MasterProduct, ProcurementType } from '../types/inventory';
import {
  parseMasterProductsFromExcel,
  downloadMasterTemplateExcel,
} from '../utils/excelService';
import {
  X,
  Database,
  Upload,
  Download,
  Plus,
  Search,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Package,
  Building2,
  Tag,
  Layers,
} from 'lucide-react';

interface MasterProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterProducts: MasterProduct[];
  onSaveMasterProduct: (product: MasterProduct) => void;
  onBatchSaveMasterProducts: (products: MasterProduct[]) => void;
  onDeleteMasterProduct: (productId: string) => void;
}

export const MasterProductModal: React.FC<MasterProductModalProps> = ({
  isOpen,
  onClose,
  masterProducts,
  onSaveMasterProduct,
  onBatchSaveMasterProducts,
  onDeleteMasterProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [selectedKriteriaFilter, setSelectedKriteriaFilter] = useState('ALL');

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

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    masterProducts.forEach((p) => {
      if (p.department) set.add(p.department);
    });
    return Array.from(set).sort();
  }, [masterProducts]);

  const filteredProducts = useMemo(() => {
    return masterProducts.filter((p) => {
      const matchSearch =
        p.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.department && p.department.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchDept =
        selectedDeptFilter === 'ALL' || p.department === selectedDeptFilter;

      const matchKriteria =
        selectedKriteriaFilter === 'ALL' ||
        (selectedKriteriaFilter === 'OUTRIGHT' && (!p.procurementType || p.procurementType === 'OUTRIGHT')) ||
        (selectedKriteriaFilter === 'CONSIGNMENT' && p.procurementType === 'CONSIGNMENT');

      return matchSearch && matchDept && matchKriteria;
    });
  }, [masterProducts, searchTerm, selectedDeptFilter, selectedKriteriaFilter]);

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
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      const result = await parseMasterProductsFromExcel(file);
      if (result.products.length === 0) {
        setImportStatus({
          success: false,
          message: 'Tidak ada baris data produk yang valid ditemukan dalam file Excel ini.',
        });
      } else {
        onBatchSaveMasterProducts(result.products);
        setImportStatus({
          success: true,
          message: `Berhasil mengimpor & menyinkronkan ${result.products.length} data produk dari file "${file.name}" ke Cloud Firestore!`,
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base tracking-tight">
                  Database Master Produk (XLSX / Excel)
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-medium">
                  {masterProducts.length} Produk Terdaftar
                </span>
              </div>
              <div className="text-xs text-neutral-400">
                Data master untuk autofill otomatis saat scan barcode barang return
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar (Import / Download Template / Add Manual) */}
        <div className="bg-neutral-50 px-6 py-3 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Import Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isImporting ? 'Memproses Excel...' : 'Impor Database XLSX'}</span>
            </button>

            {/* Download Template Button */}
            <button
              onClick={() => downloadMasterTemplateExcel()}
              className="px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-700 rounded-lg text-xs font-semibold border border-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span>Download Template XLSX</span>
            </button>
          </div>

          <button
            onClick={handleStartCreate}
            className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ Tambah Produk Manual</span>
          </button>
        </div>

        {/* Notification Status Banner */}
        {importStatus && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
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
              <span>{importStatus.message}</span>
            </div>
            <button
              onClick={() => setImportStatus(null)}
              className="text-neutral-500 hover:text-neutral-800 ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Edit / Create Form View */}
          {isEditing ? (
            <div className="bg-neutral-50 p-5 rounded-xl border border-neutral-300 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div className="font-semibold text-sm text-neutral-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>
                    {editingId ? 'Edit Data Master Produk' : 'Tambah Master Produk Baru'}
                  </span>
                </div>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-800"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      Nomor SKU
                    </label>
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="Contoh: IDM-GOR-85G"
                      className="w-full px-3 py-2 text-xs font-mono border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
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
                      Departement / Kategori <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Contoh: Makanan & Minuman / Farmasi / Kosmetik"
                      className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Kriteria / Sistem Pengadaan <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={procurementType}
                      onChange={(e) => setProcurementType(e.target.value as ProcurementType)}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 font-semibold"
                    >
                      <option value="OUTRIGHT">OUTRIGHT (Beli Putus)</option>
                      <option value="CONSIGNMENT">CONSIGNMENT (Konsinyasi)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Satuan Standar
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    >
                      <option value="Pcs">Pcs</option>
                      <option value="Karton">Karton</option>
                      <option value="Dus">Dus</option>
                      <option value="Pack">Pack</option>
                      <option value="Box">Box</option>
                      <option value="Lusin">Lusin</option>
                      <option value="Kg">Kg</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Nama Suplier Rekanan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="Contoh: PT Indofood CBP Sukses Makmur"
                      className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      required
                    />
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
                      Gmail / Email Suplier (Opsional)
                    </label>
                    <input
                      type="email"
                      value={supplierEmail}
                      onChange={(e) => setSupplierEmail(e.target.value)}
                      placeholder="Contoh: vendor.retur@gmail.com"
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
                    {editingId ? 'Simpan Perubahan' : 'Tambahkan ke Master'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari barcode, nama produk, nomor SKU, atau nama supplier..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedKriteriaFilter}
                    onChange={(e) => setSelectedKriteriaFilter(e.target.value)}
                    className="px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
                  >
                    <option value="ALL">Semua Kriteria</option>
                    <option value="OUTRIGHT">Outright (Beli Putus)</option>
                    <option value="CONSIGNMENT">Konsinyasi (Consignment)</option>
                  </select>

                  {departments.length > 0 && (
                    <select
                      value={selectedDeptFilter}
                      onChange={(e) => setSelectedDeptFilter(e.target.value)}
                      className="px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
                    >
                      <option value="ALL">Semua Dept ({masterProducts.length})</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Table List of Master Products */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-neutral-700 border-collapse">
                    <thead className="bg-neutral-100/80 text-neutral-600 font-semibold uppercase text-[10px] tracking-wider border-b border-neutral-200">
                      <tr>
                        <th className="py-2.5 px-3">Barcode & SKU</th>
                        <th className="py-2.5 px-3">Nama Produk</th>
                        <th className="py-2.5 px-3">Kriteria</th>
                        <th className="py-2.5 px-3">Departement</th>
                        <th className="py-2.5 px-3">Suplier Rekanan</th>
                        <th className="py-2.5 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 bg-white">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-neutral-400">
                            <FileSpreadsheet className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                            <p className="font-semibold text-neutral-600">
                              Belum ada master produk yang sesuai
                            </p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              Silakan unggah file database XLSX Anda atau tambah manual.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-neutral-50/80 transition-colors">
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
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                                  Konsinyasi
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-300">
                                  Outright (Beli Putus)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                                {p.department}
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
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleStartEdit(p)}
                                  className="p-1 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                                  title="Edit Produk"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Hapus master produk "${p.itemName}" (${p.barcode})?`)) {
                                      onDeleteMasterProduct(p.id);
                                    }
                                  }}
                                  className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                                  title="Hapus Produk"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Tersinkronisasi Realtime dengan Cloud Firestore</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
