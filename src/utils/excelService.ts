import * as XLSX from 'xlsx';
import { ReturnItem, MasterProduct, Supplier, StorageLocation, ProcurementType } from '../types/inventory';
import { formatIndoDate } from './notification';

/**
 * Format currency to IDR
 */
const formatRupiah = (val?: number): string => {
  if (!val) return 'Rp 0';
  return `Rp ${val.toLocaleString('id-ID')}`;
};

/**
 * Ekspor seluruh data retur, master produk, supplier, dan lokasi penyimpanan ke file Excel (.xlsx)
 */
export function exportAllToExcel(
  items: ReturnItem[],
  masterProducts: MasterProduct[],
  suppliers: Supplier[],
  storageLocations: StorageLocation[] = []
) {
  // 1. Sheet: Data Barang Retur
  const returnRows = items.map((item, index) => ({
    'No': index + 1,
    'Kode Barcode': item.barcode,
    'Nama Produk': item.itemName,
    'Nomor SKU': item.sku || '-',
    'Departemen / Kategori': item.category,
    'Nama Supplier': item.supplierName,
    'Kontak WhatsApp': item.supplierPhone || '-',
    'Gmail / Email': item.supplierEmail || '-',
    'Jumlah Retur': item.quantity,
    'Satuan': item.unit,
    'Alasan Retur': item.returnReason,
    'Kondisi Fisik / Kerusakan': item.conditionNotes || '-',
    'Tanggal Masuk': formatIndoDate(item.receivedDate),
    'Batas Tenggat Penjemputan': formatIndoDate(item.dueDate),
    'Status Saat Ini': item.status,
    'Lokasi Rak Retur': item.locationSlot,
    'Taksiran Nilai': item.estimatedValue ? formatRupiah(item.estimatedValue) : '-',
    'Bukti Foto Fisik': item.photoUrl ? 'Ada Foto (Tersimpan)' : 'Tanpa Foto',
    'Tanggal Diambil': item.pickedUpDate ? formatIndoDate(item.pickedUpDate) : '-',
    'Diambil Oleh / Driver': item.pickedUpBy || '-',
    'Jumlah Peringatan Terkirim': (item.warningHistory || []).length,
  }));

  // 2. Sheet: Database Master Produk (XLSX)
  const masterRows = masterProducts.map((p, index) => ({
    'No': index + 1,
    'Barcode': p.barcode,
    'Nama Produk': p.itemName,
    'Departement': p.department,
    'Nomor SKU': p.sku,
    'Kriteria Produk': p.procurementType === 'CONSIGNMENT' ? 'CONSIGNMENT (Konsinyasi)' : 'OUTRIGHT (Beli Putus)',
    'Nama Suplier': p.supplierName,
    'No WA Suplier': p.supplierPhone || '-',
    'Gmail Suplier': p.supplierEmail || '-',
    'Satuan Standar': p.unit || 'Pcs',
    'Catatan': p.notes || '-',
  }));

  // 3. Sheet: Rekanan Supplier
  const supplierRows = suppliers.map((s, index) => {
    const activeCount = items.filter((i) => i.supplierId === s.id && i.status !== 'Sudah Diambil').length;
    return {
      'No': index + 1,
      'Kode Supplier': s.code,
      'Nama Supplier / Rekanan': s.name,
      'Nama PIC Rekanan': s.picName,
      'Nomor WhatsApp': s.phone,
      'Gmail / Email': s.email,
      'Tenggat Standar (Hari)': s.defaultDueDays || 7,
      'Barang Aktif di Gudang': activeCount,
      'Alamat Kantor / Gudang': s.address || '-',
      'Catatan': s.notes || '-',
    };
  });

  // 4. Sheet: Tempat Penyimpanan Barang
  const storageRows = storageLocations.map((loc, index) => ({
    'No': index + 1,
    'Barcode': loc.barcode,
    'Nama Barang': loc.itemName,
    'Nomor SKU': loc.sku || '-',
    'Departemen': loc.department || '-',
    'Kriteria Produk': loc.procurementType === 'CONSIGNMENT' ? 'CONSIGNMENT (Konsinyasi)' : 'OUTRIGHT (Beli Putus)',
    'Nama Supplier': loc.supplierName || '-',
    'Zona / Area Simpan': loc.storageZone,
    'Aisle & Nomor Rak': loc.aisleRack,
    'Tingkat / Level Rak': loc.shelfLevel || '-',
    'Catatan / Petunjuk Simpan': loc.notes || '-',
    'Foto Tempat Simpan': loc.photoUrl ? 'Ada Foto Rak' : 'Tanpa Foto',
    'Petugas PIC': loc.updatedBy || '-',
    'Terakhir Diperbarui': formatIndoDate(loc.updatedAt),
  }));

  const workbook = XLSX.utils.book_new();

  const wsItems = XLSX.utils.json_to_sheet(returnRows);
  const wsMaster = XLSX.utils.json_to_sheet(masterRows);
  const wsStorage = XLSX.utils.json_to_sheet(storageRows);
  const wsSuppliers = XLSX.utils.json_to_sheet(supplierRows);

  // Set column widths for better readability
  wsItems['!cols'] = [
    { wch: 5 },  // No
    { wch: 18 }, // Barcode
    { wch: 35 }, // Nama Produk
    { wch: 16 }, // SKU
    { wch: 22 }, // Dept
    { wch: 30 }, // Supplier
    { wch: 16 }, // WA
    { wch: 28 }, // Gmail
    { wch: 12 }, // Qty
    { wch: 10 }, // Satuan
    { wch: 26 }, // Alasan
    { wch: 35 }, // Kerusakan
    { wch: 16 }, // Tgl Masuk
    { wch: 16 }, // Tenggat
    { wch: 20 }, // Status
    { wch: 18 }, // Rak
    { wch: 18 }, // Taksiran
    { wch: 18 }, // Bukti Foto
    { wch: 16 }, // Tgl Ambil
    { wch: 22 }, // Diambil Oleh
    { wch: 14 }, // Notif
  ];

  wsMaster['!cols'] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 35 },
    { wch: 22 },
    { wch: 16 },
    { wch: 26 }, // Kriteria
    { wch: 30 },
    { wch: 16 },
    { wch: 28 },
    { wch: 12 },
    { wch: 25 },
  ];

  wsStorage['!cols'] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 35 },
    { wch: 16 },
    { wch: 22 },
    { wch: 24 },
    { wch: 28 },
    { wch: 24 },
    { wch: 24 },
    { wch: 20 },
    { wch: 30 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
  ];

  wsSuppliers['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 32 },
    { wch: 25 },
    { wch: 16 },
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
    { wch: 35 },
    { wch: 25 },
  ];

  XLSX.utils.book_append_sheet(workbook, wsItems, 'Data Barang Retur');
  XLSX.utils.book_append_sheet(workbook, wsMaster, 'Database Master Produk');
  XLSX.utils.book_append_sheet(workbook, wsStorage, 'Tempat Penyimpanan Barang');
  XLSX.utils.book_append_sheet(workbook, wsSuppliers, 'Daftar Supplier');

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `HBC_Laporan_Lengkap_${todayStr}.xlsx`);
}

/**
 * Ekspor khusus data tempat penyimpanan barang ke file Excel (.xlsx)
 */
export function exportStorageLocationsToExcel(
  storageLocations: StorageLocation[],
  masterProducts: MasterProduct[] = []
) {
  const masterMap = new Map<string, MasterProduct>();
  for (const m of masterProducts) {
    masterMap.set(m.barcode.toLowerCase(), m);
  }

  const rows = storageLocations.map((loc, index) => {
    const mp = masterMap.get(loc.barcode.toLowerCase());
    return {
      'No': index + 1,
      'Kode Barcode': loc.barcode,
      'Nama Barang': loc.itemName,
      'Nomor SKU': loc.sku || mp?.sku || '-',
      'Departemen': loc.department || mp?.department || '-',
      'Kriteria Produk': (loc.procurementType || mp?.procurementType) === 'CONSIGNMENT' ? 'CONSIGNMENT (Konsinyasi)' : 'OUTRIGHT (Beli Putus)',
      'Nama Suplier': loc.supplierName || mp?.supplierName || '-',
      'Zona / Area Simpan': loc.storageZone,
      'Nomor Rak & Aisle': loc.aisleRack,
      'Tingkat / Level Rak': loc.shelfLevel || '-',
      'Catatan / Petunjuk Simpan': loc.notes || '-',
      'Foto Rak': loc.photoUrl ? 'Ada Foto' : 'Belum Ada',
      'Petugas PIC': loc.updatedBy || '-',
      'Terakhir Diperbarui': formatIndoDate(loc.updatedAt),
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 35 },
    { wch: 16 },
    { wch: 22 },
    { wch: 26 },
    { wch: 28 },
    { wch: 24 },
    { wch: 24 },
    { wch: 20 },
    { wch: 30 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lokasi Penyimpanan Barang');
  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `HBC_Lokasi_Penyimpanan_${todayStr}.xlsx`);
}

/**
 * Unduh template Excel untuk Database Master Produk (Bisa spesifik Consignment atau Outright)
 */
export function downloadMasterTemplateExcel(targetType?: ProcurementType) {
  let templateData = [];
  let fileName = 'Template_Database_Master_Produk_HBC.xlsx';

  if (targetType === 'CONSIGNMENT') {
    fileName = 'Template_Database_Produk_Consignment_HBC.xlsx';
    templateData = [
      {
        'Barcode': '8999999014234',
        'Nama Produk': 'Lifebuoy Sabun Cair Total 10 450ml',
        'Departement': 'Personal Care & Kosmetik',
        'Nomor SKU': 'LFB-TOT10-450',
        'Kriteria': 'CONSIGNMENT',
        'Nama Suplier': 'PT Unilever Indonesia Tbk',
        'No WA': '081389012345',
        'Gmail': 'unilever.claims.id@gmail.com',
        'Satuan': 'Pcs',
      },
      {
        'Barcode': '8992759114007',
        'Nama Produk': 'Wardah Lightening Day Cream 30g',
        'Departement': 'Health & Beauty Care',
        'Nomor SKU': 'WRD-LGT-DAY30',
        'Kriteria': 'CONSIGNMENT',
        'Nama Suplier': 'PT Paragon Technology and Innovation',
        'No WA': '081299887766',
        'Gmail': 'paragon.retur@gmail.com',
        'Satuan': 'Pcs',
      },
      {
        'Barcode': '8992388123456',
        'Nama Produk': 'Sensodyne Repair & Protect 100g',
        'Departement': 'Oral Care',
        'Nomor SKU': 'SNS-RP-100G',
        'Kriteria': 'CONSIGNMENT',
        'Nama Suplier': 'PT Haleon Indonesia',
        'No WA': '081122334455',
        'Gmail': 'haleon.care@gmail.com',
        'Satuan': 'Pcs',
      },
    ];
  } else if (targetType === 'OUTRIGHT') {
    fileName = 'Template_Database_Produk_Outright_HBC.xlsx';
    templateData = [
      {
        'Barcode': '8992753210118',
        'Nama Produk': 'Indomie Goreng Spesial 85g',
        'Departement': 'Makanan & Minuman',
        'Nomor SKU': 'IDM-GOR-85G',
        'Kriteria': 'OUTRIGHT',
        'Nama Suplier': 'PT Indofood CBP Sukses Makmur',
        'No WA': '081234567890',
        'Gmail': 'indofood.retur.logistik@gmail.com',
        'Satuan': 'Karton',
      },
      {
        'Barcode': '8996001301221',
        'Nama Produk': 'Roma Kelapa Biskuit 300g',
        'Departement': 'Makanan & Minuman',
        'Nomor SKU': 'RMA-KLP-300G',
        'Kriteria': 'OUTRIGHT',
        'Nama Suplier': 'PT Mayora Indah Tbk',
        'No WA': '085712345678',
        'Gmail': 'mayora.retur.dc@gmail.com',
        'Satuan': 'Karton',
      },
      {
        'Barcode': '8886008101053',
        'Nama Produk': 'Pocari Sweat Pet 500ml',
        'Departement': 'Minuman Ringan',
        'Nomor SKU': 'PCR-500ML-PET',
        'Kriteria': 'OUTRIGHT',
        'Nama Suplier': 'PT Amerta Indah Otsuka',
        'No WA': '081298765432',
        'Gmail': 'otsuka.logistik@gmail.com',
        'Satuan': 'Karton',
      },
    ];
  } else {
    templateData = [
      {
        'Barcode': '8992753210118',
        'Nama Produk': 'Indomie Goreng Spesial 85g',
        'Departement': 'Makanan & Minuman',
        'Nomor SKU': 'IDM-GOR-85G',
        'Kriteria': 'OUTRIGHT',
        'Nama Suplier': 'PT Indofood CBP Sukses Makmur',
        'No WA': '081234567890',
        'Gmail': 'indofood.retur.logistik@gmail.com',
        'Satuan': 'Karton',
      },
      {
        'Barcode': '8999999014234',
        'Nama Produk': 'Lifebuoy Sabun Cair Total 10 450ml',
        'Departement': 'Personal Care & Kosmetik',
        'Nomor SKU': 'LFB-TOT10-450',
        'Kriteria': 'CONSIGNMENT',
        'Nama Suplier': 'PT Unilever Indonesia Tbk',
        'No WA': '081389012345',
        'Gmail': 'unilever.claims.id@gmail.com',
        'Satuan': 'Pcs',
      },
      {
        'Barcode': 'CONTOH_BARCODE_123',
        'Nama Produk': 'Isi nama produk Anda di sini',
        'Departement': 'Departemen / Kategori',
        'Nomor SKU': 'SKU-CONTOH-01',
        'Kriteria': 'OUTRIGHT atau CONSIGNMENT',
        'Nama Suplier': 'Nama PT / CV Rekanan',
        'No WA': '08xxxxxxxxxx',
        'Gmail': 'rekanan@gmail.com',
        'Satuan': 'Pcs',
      },
    ];
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  worksheet['!cols'] = [
    { wch: 20 }, // Barcode
    { wch: 35 }, // Nama Produk
    { wch: 24 }, // Departement
    { wch: 18 }, // Nomor SKU
    { wch: 18 }, // Kriteria
    { wch: 30 }, // Nama Suplier
    { wch: 16 }, // No WA
    { wch: 28 }, // Gmail
    { wch: 12 }, // Satuan
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, targetType ? `Produk ${targetType}` : 'Master Produk');
  XLSX.writeFile(workbook, fileName);
}

/**
 * Parsing file Excel (.xlsx / .xls / .csv) yang diunggah pengguna menjadi array MasterProduct
 */
export async function parseMasterProductsFromExcel(
  file: File,
  forcedProcurementType?: ProcurementType
): Promise<{ products: MasterProduct[]; totalRows: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          return resolve({ products: [], totalRows: 0, errors: ['File Excel kosong atau tidak memiliki sheet.'] });
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        const products: MasterProduct[] = [];
        const errors: string[] = [];

        rawRows.forEach((row, idx) => {
          // Flexible key lookup
          const findKey = (candidates: string[]): string => {
            const keys = Object.keys(row);
            for (const cand of candidates) {
              const matched = keys.find((k) => k.trim().toLowerCase() === cand.toLowerCase());
              if (matched && String(row[matched]).trim()) {
                return String(row[matched]).trim();
              }
            }
            return '';
          };

          const barcode = findKey(['Barcode', 'barcode', 'Kode Barcode', 'BARCODE', 'Item Barcode', 'Kode Barang']);
          const itemName = findKey(['Nama Produk', 'nama produk', 'Nama Barang', 'Product Name', 'Item Name', 'Description', 'Deskripsi']);
          const department = findKey(['Departement', 'Departemen', 'departement', 'Department', 'Kategori', 'Category', 'Dept']) || 'Umum';
          const sku = findKey(['Nomor SKU', 'Nomor Sku', 'SKU', 'sku', 'No SKU', 'Item Code']) || (barcode ? `SKU-${barcode.slice(-6)}` : `SKU-${idx + 1}`);
          const supplierName = findKey(['Nama Suplier', 'Nama Supplier', 'Suplier', 'Supplier', 'Vendor', 'Rekanan', 'Principal']) || 'Supplier Umum';
          const supplierPhone = findKey(['No WA', 'No. WA', 'WhatsApp', 'No Telepon', 'Telepon', 'Phone', 'HP', 'Kontak WA']);
          const supplierEmail = findKey(['Gmail', 'Email', 'gmail', 'email', 'E-mail', 'Google Mail']);
          const unit = findKey(['Satuan', 'Unit', 'UOM']) || 'Pcs';
          
          let procurementType: ProcurementType = forcedProcurementType || 'OUTRIGHT';
          if (!forcedProcurementType) {
            const rawKriteria = findKey(['Kriteria', 'Jenis Kriteria', 'Tipe Barang', 'Kriteria Produk', 'Procurement', 'Type', 'Jenis Pengadaan', 'Sistem', 'Status']);
            if (rawKriteria) {
              const lower = rawKriteria.toLowerCase();
              if (lower.includes('consign') || lower.includes('konsinyasi') || lower.includes('titip')) {
                procurementType = 'CONSIGNMENT';
              } else {
                procurementType = 'OUTRIGHT';
              }
            }
          }

          if (!barcode && !itemName) {
            // Empty row, skip silently
            return;
          }

          if (!barcode) {
            errors.push(`Baris ${idx + 2}: Barcode tidak ditemukan untuk barang "${itemName}".`);
            return;
          }

          if (!itemName) {
            errors.push(`Baris ${idx + 2}: Nama Produk tidak ditemukan untuk barcode "${barcode}".`);
            return;
          }

          products.push({
            id: `prod-${barcode.replace(/[^a-zA-Z0-9_-]/g, '')}`,
            barcode: barcode.trim(),
            itemName: itemName.trim(),
            department: department.trim(),
            sku: sku.trim(),
            supplierName: supplierName.trim(),
            procurementType,
            ...(supplierPhone ? { supplierPhone: supplierPhone.trim() } : {}),
            ...(supplierEmail ? { supplierEmail: supplierEmail.trim() } : {}),
            unit: unit.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });

        resolve({
          products,
          totalRows: rawRows.length,
          errors,
        });
      } catch (err: any) {
        reject(new Error(`Gagal membaca file Excel: ${err.message || 'Format tidak valid'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file dari perangkat Anda.'));
    };

    reader.readAsArrayBuffer(file);
  });
}
