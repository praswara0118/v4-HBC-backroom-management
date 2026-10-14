import React, { useState, useEffect } from 'react';
import { ReturnItem, WarningLog } from '../types/inventory';
import {
  generateNotificationMessage,
  getWhatsAppUrl,
  getGmailComposeUrl,
  getMailtoUrl,
  formatIndoDate,
  getDaysRemaining,
} from '../utils/notification';
import {
  X,
  MessageSquare,
  Mail,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Calendar,
  User,
  History,
} from 'lucide-react';

interface WarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReturnItem | null;
  onLogWarning: (itemId: string, log: WarningLog) => void;
}

export const WarningModal: React.FC<WarningModalProps> = ({
  isOpen,
  onClose,
  item,
  onLogWarning,
}) => {
  const [tone, setTone] = useState<'gentle' | 'urgent' | 'final'>('urgent');
  const [editableMessage, setEditableMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [copied, setCopied] = useState(false);
  const [customWarehouseName, setCustomWarehouseName] = useState('Logistik Gudang Retur');

  useEffect(() => {
    if (item) {
      const daysLeft = getDaysRemaining(item.dueDate);
      const defaultTone: 'gentle' | 'urgent' | 'final' =
        daysLeft < 0 ? 'final' : daysLeft <= 2 ? 'urgent' : 'gentle';
      setTone(defaultTone);

      const generated = generateNotificationMessage(item, defaultTone, customWarehouseName);
      setSubject(generated.subject);
      setEditableMessage(generated.message);
    }
  }, [item, customWarehouseName]);

  const handleToneChange = (newTone: 'gentle' | 'urgent' | 'final') => {
    setTone(newTone);
    if (item) {
      const generated = generateNotificationMessage(item, newTone, customWarehouseName);
      setSubject(generated.subject);
      setEditableMessage(generated.message);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editableMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    if (!item || !item.supplierPhone) return;

    const waUrl = getWhatsAppUrl(item.supplierPhone, editableMessage);
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    const newLog: WarningLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      channel: 'whatsapp',
      recipient: item.supplierPhone,
      tone: tone,
      message: `Peringatan (${tone}) dikirim via WhatsApp ke ${item.supplierPhone}`,
    };
    onLogWarning(item.id, newLog);
  };

  const handleSendGmail = () => {
    if (!item || !item.supplierEmail) return;

    const gmailUrl = getGmailComposeUrl(item.supplierEmail, subject, editableMessage);
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');

    const newLog: WarningLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      channel: 'gmail',
      recipient: item.supplierEmail,
      tone: tone,
      message: `Pemberitahuan (${tone}) dikirim via Gmail ke ${item.supplierEmail}`,
    };
    onLogWarning(item.id, newLog);
  };

  const handleSendMailto = () => {
    if (!item || !item.supplierEmail) return;

    const mailtoUrl = getMailtoUrl(item.supplierEmail, subject, editableMessage);
    window.location.href = mailtoUrl;

    const newLog: WarningLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      channel: 'gmail',
      recipient: item.supplierEmail,
      tone: tone,
      message: `Pemberitahuan via email klien lokal ke ${item.supplierEmail}`,
    };
    onLogWarning(item.id, newLog);
  };

  if (!isOpen || !item) return null;

  const daysLeft = getDaysRemaining(item.dueDate);
  const waAvailable = Boolean(item.supplierPhone);
  const emailAvailable = Boolean(item.supplierEmail);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-semibold text-base tracking-tight">
                Kirim Peringatan ke Supplier
              </h2>
              <div className="text-xs text-neutral-400">
                Peringatan tenggat waktu pengambilan barang return
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

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Data Barang Return
              </div>
              <div className="text-sm font-bold text-neutral-900">{item.itemName}</div>
              <div className="text-xs text-neutral-600 mt-1 space-y-0.5">
                <div>Barcode: <span className="font-mono font-medium">{item.barcode}</span></div>
                <div>Qty: <span className="font-semibold">{item.quantity} {item.unit}</span> · Alasan: <span className="font-medium">{item.returnReason}</span></div>
                <div>Lokasi: <span className="font-medium text-neutral-800">{item.locationSlot}</span></div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Kontak Supplier
              </div>
              <div className="text-sm font-bold text-neutral-900">{item.supplierName}</div>
              <div className="text-xs text-neutral-600 mt-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-neutral-400" />
                  <span>PIC: {item.supplierPic || 'Logistik / CS'}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WA: {item.supplierPhone || '(Nomor belum diisi)'}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <Mail className="w-3.5 h-3.5 text-rose-600" />
                  <span>Gmail: {item.supplierEmail || '(Email belum diisi)'}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`p-3 rounded-lg border flex items-center justify-between ${
              daysLeft < 0
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : daysLeft <= 2
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold">Tenggat Waktu: </span>
                <span>{formatIndoDate(item.dueDate)}</span>
                <span className="ml-2 font-mono font-bold">
                  ({daysLeft < 0 ? `LEWAT ${Math.abs(daysLeft)} HARI` : daysLeft === 0 ? 'HARI INI' : `${daysLeft} HARI LAGI`})
                </span>
              </div>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                daysLeft < 0
                  ? 'bg-rose-200 text-rose-800'
                  : daysLeft <= 2
                  ? 'bg-amber-200 text-amber-800'
                  : 'bg-emerald-200 text-emerald-800'
              }`}
            >
              {item.status}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Tingkat Urgensi Notifikasi:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleToneChange('gentle')}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                  tone === 'gentle'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                    : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <div className="font-semibold">1. Pengingat Ramah</div>
                <div className="text-[11px] opacity-75 mt-0.5">Barang siap diambil</div>
              </button>

              <button
                type="button"
                onClick={() => handleToneChange('urgent')}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                  tone === 'urgent'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-semibold'
                    : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <div className="font-semibold">2. Peringatan Mendesak</div>
                <div className="text-[11px] opacity-75 mt-0.5">Mendekati batas tenggat</div>
              </button>

              <button
                type="button"
                onClick={() => handleToneChange('final')}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                  tone === 'final'
                    ? 'border-rose-600 bg-rose-50 text-rose-900 font-semibold'
                    : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <div className="font-semibold">3. Peringatan Terakhir</div>
                <div className="text-[11px] opacity-75 mt-0.5">Telah jatuh tempo / lewat</div>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-600">Nama Pengirim/Gudang:</span>
            <input
              type="text"
              value={customWarehouseName}
              onChange={(e) => setCustomWarehouseName(e.target.value)}
              placeholder="Contoh: Logistik Gudang Retur"
              className="text-xs px-2.5 py-1 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 flex-1 max-w-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-700">
                Pratinjau Pesan (Dapat diedit langsung sebelum dikirim):
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-neutral-600 hover:text-neutral-900 flex items-center gap-1 font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
              </button>
            </div>
            <textarea
              rows={8}
              value={editableMessage}
              onChange={(e) => setEditableMessage(e.target.value)}
              className="w-full text-xs font-mono p-3 bg-neutral-900 text-neutral-100 rounded-lg border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
            />
          </div>

          {item.warningHistory && item.warningHistory.length > 0 && (
            <div className="border-t border-neutral-200 pt-3">
              <div className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5 mb-2">
                <History className="w-3.5 h-3.5 text-neutral-500" />
                <span>Riwayat Notifikasi Sebelumnya ({item.warningHistory.length}):</span>
              </div>
              <div className="space-y-1.5 max-h-24 overflow-y-auto text-xs">
                {item.warningHistory.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-neutral-100 border border-neutral-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {log.channel === 'whatsapp' ? (
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Mail className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <span className="text-neutral-800 font-medium">{log.message}</span>
                    </div>
                    <span className="text-[11px] text-neutral-500 font-mono shrink-0">
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-md text-sm font-medium transition-colors"
          >
            Tutup
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSendWhatsApp}
              disabled={!waAvailable}
              className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors ${
                waAvailable
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Kirim via WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>

            <button
              onClick={handleSendGmail}
              disabled={!emailAvailable}
              className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors ${
                emailAvailable
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Kirim via Gmail</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>

            {emailAvailable && (
              <button
                onClick={handleSendMailto}
                className="px-3 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-md text-sm font-medium transition-colors"
              >
                App Email
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
