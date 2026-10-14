import { ReturnItem, Supplier } from '../types/inventory';

/**
 * Format Indonesian telephone number into WhatsApp international format without leading zero
 * Example: 0812-3456-7890 -> 6281234567890
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

/**
 * Calculate days remaining until due date
 * Positive = remaining days
 * 0 = today
 * Negative = overdue days
 */
export function getDaysRemaining(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);
  
  const diffTime = dueDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format date into readable Indonesian string: e.g. "12 Oktober 2026"
 */
export function formatIndoDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Determine dynamic status based on due date if not marked as completed
 */
export function calculateReturnStatus(item: ReturnItem): ReturnItem['status'] {
  if (item.status === 'Sudah Diambil' || item.status === 'Diganti Baru') {
    return item.status;
  }

  const daysLeft = getDaysRemaining(item.dueDate);
  if (daysLeft < 0) {
    return 'Lewat Tenggat';
  } else if (daysLeft <= 2) {
    return 'Mendekati Tenggat';
  }
  return 'Menunggu Pengambilan';
}

/**
 * Build professional WhatsApp / Email message for a specific return item
 */
export function generateNotificationMessage(
  item: ReturnItem,
  tone: 'gentle' | 'urgent' | 'final' = 'urgent',
  senderWarehouse: string = 'Bagian Gudang & Retur Logistik'
): { subject: string; message: string } {
  const daysLeft = getDaysRemaining(item.dueDate);
  const formattedDueDate = formatIndoDate(item.dueDate);
  const formattedReceivedDate = formatIndoDate(item.receivedDate);

  let statusSentence = '';
  let urgencyNotice = '';
  let subject = '';

  if (daysLeft < 0) {
    const daysOverdue = Math.abs(daysLeft);
    subject = `[PERINGATAN JATUH TEMPO] Pengambilan Barang Return - ${item.itemName} (${item.barcode})`;
    statusSentence = `⚠️ TELAH MELEWATI TENGGAT WAKTU SELAMA ${daysOverdue} HARI (Jatuh tempo pada: ${formattedDueDate})`;
    urgencyNotice = `Mengingat kapasitas gudang yang terbatas dan telah melampaui batas toleransi penyimpanan, kami mohon konfirmasi jadwal pengambilan barang return HARI INI atau selambat-lambatnya 1x24 jam ke depan.`;
  } else if (daysLeft <= 2) {
    subject = `[URGENT / MENDEKATI TENGGAT] Pengambilan Barang Return - ${item.itemName} (${item.barcode})`;
    statusSentence = `⏳ TENGGAT WAKTU TINGGAL ${daysLeft === 0 ? 'HARI INI' : `${daysLeft} HARI LAGI`} (Batas akhir: ${formattedDueDate})`;
    urgencyNotice = `Mohon bantuan rekan ekspedisi / driver supplier untuk segera mengambil barang sebelum melewati batas waktu yang telah disepakati bersama.`;
  } else {
    subject = `[PEMBERITAHUAN] Barang Return Masuk Siap Diambil - ${item.itemName}`;
    statusSentence = `ℹ️ Tenggat waktu pengambilan: ${formattedDueDate} (${daysLeft} hari ke depan)`;
    urgencyNotice = `Mohon dicatat dalam jadwal kunjungan armada/sales rekanan untuk pengambilan barang return saat pengiriman berikutnya.`;
  }

  const recipientGreeting = item.supplierPic
    ? `Yth. Bpk/Ibu ${item.supplierPic} / Tim Logistik ${item.supplierName},`
    : `Yth. Tim Logistik ${item.supplierName},`;

  const message = `Halo, Selamat Siang.
${recipientGreeting}

Kami dari *${senderWarehouse}* menginformasikan mengenai barang return/klaim supplier yang telah terdata di gudang kami:

📦 *RINCIAN BARANG RETURN:*
• *Nama Barang:* ${item.itemName}
• *Kode / Barcode:* ${item.barcode}
• *SKU:* ${item.sku || '-'}
• *Jumlah (Qty):* ${item.quantity} ${item.unit}
• *Alasan Return:* ${item.returnReason}
• *Catatan Kondisi:* ${item.conditionNotes || 'Sesuai fisik barang'}
• *Lokasi Simpan Gudang:* ${item.locationSlot || 'Area Retur'}
• *Tanggal Masuk Gudang:* ${formattedReceivedDate}

📅 *STATUS TENGGAT WAKTU:*
${statusSentence}

${urgencyNotice}

📋 *PETUNJUK PENGAMBILAN:*
1. Harap membawa Surat Jalan / Tanda Terima Pengambilan Retur saat datang ke gudang.
2. Petugas gudang kami dapat langsung memverifikasi fisik barang menggunakan Barcode: *${item.barcode}*.
3. Jam operasional gudang retur: Senin - Sabtu (08.00 - 17.00 WIB).

Konfirmasi jadwal armada penjemputan dapat langsung membalas pesan ini. Terima kasih atas kerja sama dan respon cepatnya.

Salam Hormat,
*${senderWarehouse}*`;

  return { subject, message };
}

/**
 * Generate consolidated summary message for a supplier who has multiple return items
 */
export function generateConsolidatedSupplierMessage(
  supplier: Supplier,
  items: ReturnItem[],
  senderWarehouse: string = 'Bagian Gudang & Retur Logistik'
): { subject: string; message: string } {
  const activeItems = items.filter(
    (i) => i.status !== 'Sudah Diambil' && i.status !== 'Diganti Baru'
  );

  const subject = `[REKAP RETUR GUDANG] ${activeItems.length} Barang Return Siap Diambil - ${supplier.name}`;

  const itemsListText = activeItems
    .map((item, idx) => {
      const daysLeft = getDaysRemaining(item.dueDate);
      const daysStatus =
        daysLeft < 0
          ? `[TERLAMBAT ${Math.abs(daysLeft)} HARI]`
          : daysLeft <= 2
          ? `[SISA ${daysLeft} HARI]`
          : `[Batas: ${formatIndoDate(item.dueDate)}]`;

      return `${idx + 1}. *${item.itemName}* (${item.quantity} ${item.unit})
   • Barcode: ${item.barcode} | Alasan: ${item.returnReason}
   • Tenggat: ${daysStatus} | Lokasi: ${item.locationSlot || 'Rak Retur'}`;
    })
    .join('\n\n');

  const message = `Halo, Selamat Siang.
Yth. Bpk/Ibu ${supplier.picName || 'Tim Rekanan'} (${supplier.name}),

Kami dari *${senderWarehouse}* menyampaikan rekapitulasi data barang return yang saat ini tersimpan di gudang kami dan menunggu pengambilan/penukaran:

📊 *TOTAL BARANG RETURN MENUNGGU:* ${activeItems.length} Item

📦 *DAFTAR RINCIAN BARANG:*
${itemsListText}

Mohon segera dijadwalkan pengambilan atau penjemputan barang-barang tersebut oleh armada/ekspedisi rekanan.

Saat tiba di gudang, petugas kami siap memindai barcode masing-masing kardus/barang untuk serah terima yang cepat dan akurat.

Terima kasih atas kerja samanya.

Salam Hormat,
*${senderWarehouse}*`;

  return { subject, message };
}

/**
 * Build WhatsApp click URL
 */
export function getWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Build Gmail web compose URL
 */
export function getGmailComposeUrl(email: string, subject: string, body: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    email
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Build standard mailto link
 */
export function getMailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
