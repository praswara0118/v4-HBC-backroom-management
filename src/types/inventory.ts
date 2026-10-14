export type ReturnReason = 
  | 'Kemasan Rusak / Bocor'
  | 'Cacat Produksi / Malfungsi'
  | 'Mendekati / Lewat Expired'
  | 'Salah Kirim / Tidak Sesuai PO'
  | 'Barang Pecah / Penyok'
  | 'Komplain Pelanggan'
  | 'Lainnya';

export type ReturnStatus =
  | 'Menunggu Pengambilan'
  | 'Mendekati Tenggat'
  | 'Lewat Tenggat'
  | 'Sudah Diambil'
  | 'Diganti Baru';

export interface WarningLog {
  id: string;
  timestamp: string;
  channel: 'whatsapp' | 'gmail';
  recipient: string;
  tone: 'gentle' | 'urgent' | 'final';
  message: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  picName: string;
  phone: string; // WhatsApp number
  email: string; // Gmail / Email
  address?: string;
  defaultDueDays: number;
  notes?: string;
  createdAt: string;
}

export type ProcurementType = 'OUTRIGHT' | 'CONSIGNMENT';

export type AppNavigationMode = 'RETURN' | 'STORAGE' | 'DATABASE';

export interface MasterProduct {
  id: string;
  barcode: string;
  itemName: string;
  department: string; // Departement / Kategori
  sku: string; // Nomor SKU
  supplierName: string; // Nama Suplier
  supplierPhone?: string; // No WA jika ada
  supplierEmail?: string; // Gmail jika ada
  unit?: string;
  procurementType?: ProcurementType | string; // 'OUTRIGHT' (Beli Putus) | 'CONSIGNMENT' (Konsinyasi)
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StorageLocation {
  id: string;
  barcode: string;
  sku?: string;
  itemName: string;
  department?: string;
  supplierName?: string;
  procurementType?: ProcurementType | string;
  storageZone: string; // e.g. "Gudang Utama", "Area Display Toko", "Chiller HBC", "Lantai 2"
  aisleRack: string; // e.g. "Aisle 03 - Rak B-02", "Blok A-12", "Bin 04"
  shelfLevel?: string; // e.g. "Tingkat 2 (Eye Level)", "Pallet Bawah", "Gantungan Atas"
  notes?: string; // Petunjuk cara menemukan barang atau kapasitas
  photoUrl?: string; // Foto tempat penyimpanan barang / rak fisik
  updatedBy?: string; // Staff / PIC pencatat
  createdAt: string;
  updatedAt: string;
}

export interface ReturnItem {
  id: string;
  barcode: string;
  itemName: string;
  sku: string;
  supplierId: string;
  supplierName: string;
  supplierPic?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  quantity: number;
  unit: string; // Pcs, Karton, Dus, Pack, Lusin, Box, Kg
  category: string;
  returnReason: ReturnReason;
  conditionNotes: string;
  receivedDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: ReturnStatus;
  locationSlot: string; // e.g. "Rak Retur A-02"
  estimatedValue?: number; // Nilai taksiran barang (Rp)
  pickedUpDate?: string;
  pickedUpBy?: string;
  warningHistory: WarningLog[];
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type FilterStatus = 'ALL' | 'ACTIVE' | 'WARNING' | 'OVERDUE' | 'COMPLETED';

export type DeviceViewMode = 'mobile' | 'tablet' | 'desktop' | 'auto';
