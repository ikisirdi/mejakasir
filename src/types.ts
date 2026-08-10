export type JenisPerkara =
  | 'Cerai Talak'
  | 'Cerai Gugat'
  | 'Penetapan Ahli Waris'
  | 'Harta Bersama'
  | 'Hibah'
  | 'Wasiat'
  | 'Hak Asuh Anak'
  | 'Nafkah Anak'
  | 'Dispensasi Nikah'
  | 'Wali Adhal'
  | 'Lainnya';

export type KategoriPerkara = 'Gugatan' | 'Permohonan';

export type StatusPerkara = 'Pendaftaran' | 'Diperiksa' | 'Putus' | 'Minutasi' | 'Selesai' | 'Arsip';

export type TingkatPerkara = 'Tingkat Pertama' | 'Tingkat Banding' | 'Kasasi / PK';

export interface CaseRecord {
  id: string;
  nomorPerkara: string;      // e.g. "1/Pdt.G/2026/PA.Pan"
  namaPihak: string;         // e.g. "Muhammad Zakaria"
  jenisPerkara: JenisPerkara; // e.g. "Cerai Talak"
  kategoriPerkara: KategoriPerkara; // "Gugatan" | "Permohonan"
  saldoPerkara: number;      // e.g. 0
  panjarAwal: number;        // e.g. 1500000
  pengeluaran: number;       // e.g. 1500000
  tanggalRegister: string;   // YYYY-MM-DD
  tanggalTerimaKasasiPk?: string; // YYYY-MM-DD (tanggal diterima Ketua Majelis Kasasi/PK)
  tanggalPutus?: string;      // YYYY-MM-DD
  tingkatPerkara?: TingkatPerkara; // 'Tingkat Pertama' | 'Tingkat Banding' | 'Kasasi / PK'
  status: StatusPerkara;
  hakimKetua?: string;
  panitera?: string;
  ruangSidang?: string;
  catatan?: string;
  updatedAt: string;         // ISO timestamp
}

export interface FilterState {
  searchQuery: string;
  jenisPerkara: string;      // 'ALL' or specific
  kategoriPerkara: string;   // 'ALL' or specific
  status: string;            // 'ALL' or specific
  tahun: string;             // 'ALL' or specific year like '2026'
  saldoMin?: number;
  saldoMax?: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  timestamp: string;
  read: boolean;
  caseId?: string;
  nomorPerkara?: string;
}

export interface SyncSettings {
  autoSyncEnabled: boolean;
  googleSheetUrl: string;
  googleSheetWebhookUrl?: string;
  syncIntervalMinutes: number;
  lastSyncedAt?: string;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

export interface CacheMetadata {
  lastUpdated: string;
  recordCount: number;
  sizeBytes: number;
  ttlMinutes: number;
  cacheHitCount: number;
}

export interface BiayaProsesRecord {
  id: string;
  tanggal: string;        // YYYY-MM-DD
  nomorPerkara: string;   // e.g. "1/Pdt.G/2026/PA.Pan"
  uraian: string;         // e.g. "Penerimaan Biaya Proses / ATK Pendaftaran"
  penerimaan: number;     // Rp Penerimaan (Hak ATK Kantor)
  pengeluaran: number;    // Rp Pengeluaran (Pembelian ATK Kantor/Biaya Proses)
  keterangan: string;     // KET
  kategori: 'ATK' | 'Proses' | 'Meterai' | 'Redaksi' | 'Panggilan' | 'Lainnya';
  createdAt: string;
}

export interface JurnalBiayaSkumRecord {
  id: string;
  tanggal: string;        // YYYY-MM-DD
  nomorPerkara: string;   // e.g. "1/Pdt.G/2026/PA.Pan"
  uraian: string;         // e.g. "Penerimaan Panjar Awal" / "Biaya Panggilan I" / "Meterai"
  penerimaan: number;     // Debet SKUM (Panjar Awal / Tambah Panjar)
  pengeluaran: number;    // Kredit SKUM (Panggilan, Meterai, Redaksi, Pemberkasan ATK, Sisa Panjar)
  keterangan: string;     // Catatan tambahan SKUM
  kategori: 'Panjar' | 'Panggilan' | 'Meterai' | 'Redaksi' | 'ATK' | 'Proses' | 'Sisa Panjar' | 'Pinjaman' | 'Lainnya';
  createdAt: string;
}

export interface PinjamanSkumRecord {
  id: string;
  tanggal: string;          // YYYY-MM-DD (tanggal pinjam)
  nomorPerkara: string;     // Nomor Perkara or "Kepaniteraan Umum"
  peminjam: string;         // Nama peminjam / Keperluan kepaniteraan
  jumlah: number;           // Nominal dipinjam (Rp)
  keterangan: string;       // Catatan / alasan pinjaman
  status: 'BELUM_DIBAYAR' | 'SUDAH_DIBAYAR';
  tanggalBayar?: string;    // YYYY-MM-DD
  createdAt: string;        // ISO timestamp
  skumPengeluaranId?: string;  // ID of pengeluaran in Jurnal SKUM
  skumPengembalianId?: string; // ID of pengembalian in Jurnal SKUM
}

export type ActiveTabType = 'jurnal-skum' | 'buku-biaya-proses' | 'table';

