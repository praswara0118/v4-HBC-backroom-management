import React, { useState } from 'react';
import { ReturnItem } from '../types/inventory';
import { BarcodeBadge } from './BarcodeBadge';
import { formatIndoDate, getDaysRemaining } from '../utils/notification';
import {
  X,
  Printer,
  Edit,
  Trash2,
  CheckCircle2,
  MessageSquare,
  Mail,
  Calendar,
  Building2,
  MapPin,
  Clock,
  History,
  AlertTriangle,
  UserCheck,
  Image as ImageIcon,
} from 'lucide-react';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReturnItem | null;
  onOpenWarningModal: (item: ReturnItem) => void;
  onOpenEditModal: (item: ReturnItem) => void;
  onOpenPrintSlip: (item: ReturnItem) => void;
  onMarkAsPickedUp: (itemId: string, pickedUpBy: string) => void;
  onDeleteItem: (itemId: string) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  onOpenWarningModal,
  onOpenEditModal,
  onOpenPrintSlip,
  onMarkAsPickedUp,
  onDeleteItem,
}) => {
  const [showPickupInput, setShowPickupInput] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen || !item) return null;

  const daysLeft = getDaysRemaining(item.dueDate);
  const isCompleted = item.status === 'Sudah Diambil' || item.status === 'Diganti Baru';

  const handleConfirmPickup = () => {
    if (!driverName.trim()) {
      onMarkAsPickedUp(item.id, 'Petugas / Driver Rekanan');
    } else {
      onMarkAsPickedUp(item.id, driverName.trim());
    }
    setShowPickupInput(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
              SKU: {item.sku || item.barcode}
            </span>
            <h2 className="font-semibold text-base tracking-tight truncate max-w-sm">
              {item.itemName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
            <div>
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Label Barcode Scan Fisik:
              </div>
              <BarcodeBadge value={item.barcode} height={48} />
            </div>

            <div className="text-right sm:text-right w-full sm:w-auto">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Status Saat Ini:
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold ${
                  item.status === 'Sudah Diambil'
                    ? 'bg-emerald-100 text-emerald-800'
                    : item.status === 'Lewat Tenggat'
                    ? 'bg-rose-100 text-rose-800 animate-pulse'
                    : item.status === 'Mendekati Tenggat'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-sky-100 text-sky-800'
                }`}
              >
                {item.status}
              </span>

              {!isCompleted && (
                <div className="mt-1 text-xs text-neutral-600 font-medium">
                  {daysLeft < 0 ? (
                    <span className="text-rose-600 font-bold">Terlambat {Math.abs(daysLeft)} hari!</span>
                  ) : daysLeft === 0 ? (
                    <span className="text-amber-600 font-bold">Jatuh tempo HARI INI!</span>
                  ) : (
                    <span>Sisa {daysLeft} hari lagi</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-neutral-700" />
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                  Data Supplier / Rekanan
                </span>
              </div>
              <span className="text-xs text-neutral-500 font-mono">ID: {item.supplierId}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-neutral-500">Nama Supplier:</div>
                <div className="font-semibold text-neutral-900">{item.supplierName}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">PIC / Kontak:</div>
                <div className="font-medium text-neutral-800">{item.supplierPic || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Nomor WhatsApp:</div>
                <div className="font-mono text-neutral-800 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  {item.supplierPhone || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Gmail / Email:</div>
                <div className="font-mono text-neutral-800 flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-rose-600" />
                  {item.supplierEmail || '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white border border-neutral-200 rounded-lg">
              <div className="text-[11px] text-neutral-500">Kuantitas</div>
              <div className="text-base font-bold text-neutral-900 font-mono">
                {item.quantity} {item.unit}
              </div>
            </div>

            <div className="p-3 bg-white border border-neutral-200 rounded-lg">
              <div className="text-[11px] text-neutral-500">Kategori</div>
              <div className="text-xs font-semibold text-neutral-800 mt-0.5 truncate">
                {item.category}
              </div>
            </div>

            <div className="p-3 bg-white border border-neutral-200 rounded-lg">
              <div className="text-[11px] text-neutral-500">Lokasi Simpan</div>
              <div className="text-xs font-semibold text-neutral-800 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                <span className="truncate">{item.locationSlot}</span>
              </div>
            </div>

            <div className="p-3 bg-white border border-neutral-200 rounded-lg">
              <div className="text-[11px] text-neutral-500">Taksiran Nilai</div>
              <div className="text-xs font-bold text-neutral-800 mt-0.5 font-mono">
                {item.estimatedValue ? `Rp ${item.estimatedValue.toLocaleString('id-ID')}` : '-'}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-neutral-200 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-neutral-500" />
                <div>
                  <span className="text-neutral-500">Tanggal Masuk: </span>
                  <span className="font-semibold text-neutral-800">{formatIndoDate(item.receivedDate)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500" />
                <div>
                  <span className="text-neutral-500">Tenggat Waktu: </span>
                  <span className="font-semibold text-neutral-800">{formatIndoDate(item.dueDate)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-100">
              <div className="text-xs text-neutral-500 mb-0.5">Alasan Retur:</div>
              <div className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded inline-block">
                {item.returnReason}
              </div>
            </div>

            {item.conditionNotes && (
              <div>
                <div className="text-xs text-neutral-500 mb-0.5">Catatan Kondisi Fisik:</div>
                <div className="text-xs text-neutral-800 bg-neutral-50 p-2.5 rounded border border-neutral-200 leading-relaxed">
                  {item.conditionNotes}
                </div>
              </div>
            )}

            {item.photoUrl && (
              <div className="pt-2 border-t border-neutral-100">
                <div className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5 mb-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>Bukti Foto Fisik Barang Retur:</span>
                </div>
                <div className="bg-neutral-900 rounded-lg p-2 max-w-xs overflow-hidden border border-neutral-800 shadow-xs">
                  <img
                    src={item.photoUrl}
                    alt={item.itemName}
                    className="w-full h-48 object-cover rounded hover:scale-105 transition-transform cursor-pointer"
                    onClick={() => {
                      const w = window.open('');
                      w?.document.write(`<img src="${item.photoUrl}" style="max-width:100%;height:auto;margin:auto;display:block;" />`);
                    }}
                    title="Klik untuk melihat foto ukuran penuh"
                  />
                  <div className="text-[10px] text-neutral-400 text-center mt-1">
                    Klik foto untuk memperbesar
                  </div>
                </div>
              </div>
            )}

            {isCompleted && item.pickedUpDate && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Barang Telah Diserahkan / Selesai</span>
                </div>
                <div className="text-neutral-700">
                  Tanggal Pengambilan: <span className="font-medium">{formatIndoDate(item.pickedUpDate)}</span>
                </div>
                {item.pickedUpBy && (
                  <div className="text-neutral-700">
                    Diserahkan Kepada: <span className="font-medium">{item.pickedUpBy}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isCompleted && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-900">
                    Proses Serah Terima Barang ke Supplier
                  </span>
                </div>
                {!showPickupInput && (
                  <button
                    onClick={() => setShowPickupInput(true)}
                    className="text-xs font-semibold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
                  >
                    Tandai Sudah Diambil
                  </button>
                )}
              </div>

              {showPickupInput && (
                <div className="space-y-2 pt-2 border-t border-emerald-200/60">
                  <label className="block text-xs font-medium text-emerald-900">
                    Nama Driver / Armada Pengambil & Catatan Serah Terima:
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Pak Joko (Armada Truk B 1234 CD) / Ditukar Barang Baru"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-emerald-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowPickupInput(false)}
                      className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-emerald-100 rounded"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleConfirmPickup}
                      className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                    >
                      Konfirmasi Barang Sudah Diambil
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {item.warningHistory && item.warningHistory.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-neutral-500" />
                <span>Riwayat Peringatan yang Dikirim ({item.warningHistory.length})</span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {item.warningHistory.map((hist) => (
                  <div
                    key={hist.id}
                    className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {hist.channel === 'whatsapp' ? (
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Mail className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-neutral-900">{hist.message}</div>
                        <div className="text-[11px] text-neutral-500 font-mono">Ke: {hist.recipient}</div>
                      </div>
                    </div>
                    <span className="text-[11px] text-neutral-500 font-mono shrink-0">
                      {new Date(hist.timestamp).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {confirmDelete && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-800 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Yakin ingin menghapus data barang return ini?</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 text-xs border border-neutral-300 rounded bg-white hover:bg-neutral-50 text-neutral-700"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    onDeleteItem(item.id);
                    onClose();
                  }}
                  className="px-2.5 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenPrintSlip(item)}
              className="px-3 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Bukti Retur</span>
            </button>

            <button
              onClick={() => onOpenEditModal(item)}
              className="px-3 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            {!confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                title="Hapus Data Barang"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isCompleted && (
              <button
                onClick={() => onOpenWarningModal(item)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Kirim Peringatan WA / Gmail</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-md text-xs font-medium transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
