import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';

interface SupplierListModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  items: ReturnItem[];
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onFilterBySupplier: (supplierId: string) => void;
}

export const SupplierListModal: React.FC<SupplierListModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  items,
  onSaveSupplier,
  onDeleteSupplier,
  onFilterBySupplier,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSup, setEditingSup] = useState<Supplier | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

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

  const filteredSuppliers = useMemo(() => {
    const seen = new Set<string>();
    const unique: Supplier[] = [];
    for (const s of suppliers) {
      if (s && s.id && !seen.has(s.id)) {
        seen.add(s.id);
        unique.push(s);
      }
    }
    return unique.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.picName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [suppliers, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="font-semibold text-base tracking-tight">
                Daftar Supplier & Rekanan Retur
              </h2>
              <div className="text-xs text-neutral-400">
                Kelola kontak WhatsApp, Gmail, dan kirim rekap retur massal
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

        <div className="p-6 overflow-y-auto space-y-4">
          {!isCreating ? (
            <>
              <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama supplier, kode, atau PIC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
                <button
                  onClick={handleStartCreate}
                  className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Supplier</span>
                </button>
              </div>

              <div className="space-y-3">
                {filteredSuppliers.map((sup, idx) => {
                  const supItems = items.filter((i) => i.supplierId === sup.id);
                  const activeItems = supItems.filter(
                    (i) => i.status !== 'Sudah Diambil' && i.status !== 'Diganti Baru'
                  );
                  const overdueCount = activeItems.filter((i) => i.status === 'Lewat Tenggat').length;

                  return (
                    <div
                      key={sup.id ? `${sup.id}-${idx}` : `sup-${idx}`}
                      className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 hover:bg-white transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              onFilterBySupplier(sup.id);
                              onClose();
                            }}
                            className="text-xs px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded font-medium transition-colors"
                          >
                            {activeItems.length} Barang Aktif
                            {overdueCount > 0 && (
                              <span className="ml-1 text-rose-600 font-bold">({overdueCount} telat)</span>
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
                                className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                                  sup.phone
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                }`}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Rekap WA</span>
                                <ExternalLink className="w-3 h-3 opacity-75" />
                              </button>

                              <button
                                onClick={() => handleSendConsolidatedGmail(sup)}
                                disabled={!sup.email}
                                className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                                  sup.email
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                }`}
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
                            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSupplierToDelete(sup)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
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
                      {searchTerm ? 'Tidak ada supplier yang sesuai pencarian' : 'Belum ada data supplier'}
                    </div>
                    <button
                      onClick={handleStartCreate}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Input Supplier Baru Manual</span>
                    </button>
                  </div>
                )}
              </div>
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
                    placeholder="Contoh: PT Indofood CBP Sukses Makmur"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
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
    </div>
  );
};
