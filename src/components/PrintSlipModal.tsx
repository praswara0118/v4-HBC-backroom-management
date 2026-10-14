import React from 'react';
import { ReturnItem } from '../types/inventory';
import { BarcodeBadge } from './BarcodeBadge';
import { formatIndoDate } from '../utils/notification';
import { Printer, X } from 'lucide-react';

interface PrintSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReturnItem | null;
}

export const PrintSlipModal: React.FC<PrintSlipModalProps> = ({ isOpen, onClose, item }) => {
  if (!isOpen || !item) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-300 flex flex-col my-auto max-h-[95vh]">
        <div className="no-print px-6 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm">Pratinjau Cetak Surat Serah Terima Retur</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Sekarang</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-8 overflow-y-auto bg-white text-neutral-900 font-sans printable-area text-xs space-y-5">
          <div className="border-b-2 border-neutral-900 pb-3 flex justify-between items-start">
            <div>
              <h1 className="text-base font-extrabold uppercase tracking-tight text-neutral-900">
                SURAT TANDA TERIMA & KLAIM BARANG RETURN
              </h1>
              <div className="text-[11px] text-neutral-600 font-medium">
                Departemen Manajemen Retur Logistik & Pergudangan
              </div>
            </div>
            <div className="text-right font-mono text-[11px]">
              <div className="font-bold text-neutral-900">NO: RET/{item.barcode}</div>
              <div className="text-neutral-500">Tgl Cetak: {formatIndoDate(new Date().toISOString())}</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border border-neutral-300 rounded bg-neutral-50">
            <div>
              <div className="text-[10px] uppercase font-bold text-neutral-500">
                Kode Verifikasi Barcode Fisik:
              </div>
              <BarcodeBadge value={item.barcode} height={50} />
            </div>
            <div className="text-right space-y-1">
              <div className="text-[10px] uppercase font-bold text-neutral-500">Status Tenggat:</div>
              <div className="font-bold text-xs text-neutral-900">{item.status}</div>
              <div className="text-[11px] text-neutral-600">
                Batas Pengambilan: <strong>{formatIndoDate(item.dueDate)}</strong>
              </div>
            </div>
          </div>

          <table className="w-full border-collapse border border-neutral-300 text-xs">
            <tbody>
              <tr className="border-b border-neutral-300 bg-neutral-100">
                <td colSpan={2} className="p-2 font-bold uppercase text-neutral-700">
                  I. INFORMASI SUPPLIER / REKANAN
                </td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="p-2 font-medium text-neutral-600 w-1/3">Nama Supplier</td>
                <td className="p-2 font-bold text-neutral-900">{item.supplierName}</td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="p-2 font-medium text-neutral-600">PIC / Contact Person</td>
                <td className="p-2">{item.supplierPic || '-'}</td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="p-2 font-medium text-neutral-600">No. WhatsApp / Telepon</td>
                <td className="p-2 font-mono">{item.supplierPhone || '-'}</td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="p-2 font-medium text-neutral-600">Email / Gmail</td>
                <td className="p-2 font-mono">{item.supplierEmail || '-'}</td>
              </tr>

              <tr className="border-b border-neutral-300 bg-neutral-100">
                <td colSpan={2} className="p-2 font-bold uppercase text-neutral-700">
                  II. SPESIFIKASI BARANG RETURN
                </td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="p-2 font-medium text-neutral-600">Nama Barang</td>
                <td className="p-2 font-bold text-neutral-900">{item.itemName}</td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="p-2 font-medium text-neutral-600">Barcode / SKU</td>
                <td className="p-2 font-mono">{item.barcode} / {item.sku || '-'}</td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="p-2 font-medium text-neutral-600">Kuantitas / Satuan</td>
                <td className="p-2 font-bold font-mono text-neutral-900">{item.quantity} {item.unit}</td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="p-2 font-medium text-neutral-600">Alasan Return</td>
                <td className="p-2 font-semibold text-rose-700">{item.returnReason}</td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="p-2 font-medium text-neutral-600">Catatan Kerusakan Fisik</td>
                <td className="p-2">{item.conditionNotes || 'Sesuai fisik yang tercantum'}</td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="p-2 font-medium text-neutral-600">Lokasi Simpan Gudang</td>
                <td className="p-2 font-semibold">{item.locationSlot}</td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="p-2 font-medium text-neutral-600">Tanggal Masuk Retur</td>
                <td className="p-2">{formatIndoDate(item.receivedDate)}</td>
              </tr>
              <tr>
                <td className="p-2 font-medium text-neutral-600">Tenggat Waktu Pengambilan</td>
                <td className="p-2 font-bold text-neutral-900">{formatIndoDate(item.dueDate)}</td>
              </tr>
            </tbody>
          </table>

          {item.photoUrl && (
            <div className="border border-neutral-300 p-2 rounded bg-neutral-50">
              <div className="text-[10px] font-bold uppercase text-neutral-600 mb-1">
                Lampiran Bukti Foto Fisik Barang:
              </div>
              <img
                src={item.photoUrl}
                alt="Foto Bukti Fisik"
                className="max-h-36 object-contain rounded border border-neutral-200"
              />
            </div>
          )}

          <div className="pt-6 grid grid-cols-3 gap-4 text-center text-xs">
            <div className="space-y-12">
              <div className="font-semibold text-neutral-700">Petugas Gudang (Pemeriksa)</div>
              <div className="border-t border-neutral-400 mx-4 pt-1 font-medium">
                ( .................................... )
              </div>
            </div>
            <div className="space-y-12">
              <div className="font-semibold text-neutral-700">Driver / Perwakilan Supplier</div>
              <div className="border-t border-neutral-400 mx-4 pt-1 font-medium">
                ( .................................... )
              </div>
            </div>
            <div className="space-y-12">
              <div className="font-semibold text-neutral-700">Kepala Bagian Logistik</div>
              <div className="border-t border-neutral-400 mx-4 pt-1 font-medium">
                ( .................................... )
              </div>
            </div>
          </div>

          <div className="text-[10px] text-neutral-400 text-center pt-2">
            Dokumen ini sah sebagai bukti verifikasi dan serah terima pengembalian barang rusak/cacat.
          </div>
        </div>

        <div className="no-print px-6 py-3 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-neutral-300 rounded text-xs font-medium text-neutral-700 hover:bg-white"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-semibold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
