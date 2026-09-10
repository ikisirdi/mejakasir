import { SimulasiAtkRecord } from '../types';

export interface AtkInventoryUsageItem {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  kategori: string;
  satuan: string;
  hargaSatuan: number;
  totalKuantitas: number;
  totalNominal: number;
  frekuensiDipakai: number;
  daftarPerkara: {
    nomorPerkara: string;
    tanggal: string;
    kuantitas: number;
    nominal: number;
    uraian: string;
  }[];
  keterangan: string;
}

export interface AtkInventorySummary {
  totalJenisBarang: number;
  totalNominal: number;
  totalKuantitasSemua: number;
  items: AtkInventoryUsageItem[];
  kategoriSummary: { [kategori: string]: { totalNominal: number; count: number } };
}

/**
 * Kamus Spesifikasi & Satuan Standar Persediaan Barang Habis Pakai ATK Perkara
 * Berdasarkan Petunjuk Pelaksanaan Administrasi Kepaniteraan Mahkamah Agung RI
 */
export interface MasterItemDef {
  key: string;
  kodeBarang: string;
  namaBarang: string;
  kategori: string;
  satuan: string;
  hargaSatuan: number;
  qtyDefaultPerNominal: (nominal: number) => number;
  keterangan: string;
  keywords: string[];
}

export const MASTER_PERSEDIAAN_ATK: MasterItemDef[] = [
  {
    key: 'kertas-a4',
    kodeBarang: 'BRG-ATK-01',
    namaBarang: 'Kertas HVS A4 80gr / 70gr (Cetak Berkas & Putusan)',
    kategori: 'Kertas',
    satuan: 'Rim',
    hargaSatuan: 50000,
    qtyDefaultPerNominal: (nom) => Number((nom / 50000).toFixed(2)),
    keterangan: 'Pencetakan surat gugatan/permohonan, instrumen berkas, relaas & putusan (1/5 rim per perkara)',
    keywords: ['kertas a4', 'kertas', 'hvs', 'a4', '1/5 rim']
  },
  {
    key: 'stofmap-polio',
    kodeBarang: 'BRG-ATK-02',
    namaBarang: 'Stofmap Folio Berkas Perkara Pendaftaran',
    kategori: 'Map',
    satuan: 'Lembar',
    hargaSatuan: 2000,
    qtyDefaultPerNominal: (nom) => Math.round(nom / 2000) || 3,
    keterangan: 'Pendaftaran awal & pengelompokan berkas perkara saat masuk (standar 3 lembar per perkara)',
    keywords: ['stofmap', 'stofmap polio', 'map folio', 'pendaftaran']
  },
  {
    key: 'map-sampul',
    kodeBarang: 'BRG-ATK-03',
    namaBarang: 'Cetak Map Sampul Muka Perkara Resmi',
    kategori: 'Map',
    satuan: 'Buah',
    hargaSatuan: 8000,
    qtyDefaultPerNominal: (nom) => Math.max(1, Math.round(nom / 8000)),
    keterangan: 'Sampul muka berkas perkara resmi saat pendaftaran teregister',
    keywords: ['sampul perkara', 'map sampul', 'cetak map sampul']
  },
  {
    key: 'amplop-surat',
    kodeBarang: 'BRG-ATK-04',
    namaBarang: 'Amplop Surat Panggilan Sidang Bertutup',
    kategori: 'Amplop',
    satuan: 'Buah',
    hargaSatuan: 500,
    qtyDefaultPerNominal: (nom) => Math.max(2, Math.round(nom / 500)),
    keterangan: 'Amplop pengiriman surat panggilan / pemberitahuan relaas sidang para pihak',
    keywords: ['amplop', 'amplop surat', '1/20']
  },
  {
    key: 'map-bundel-a-gugatan',
    kodeBarang: 'BRG-ATK-05',
    namaBarang: 'Cetak Map Bundel A Gugatan',
    kategori: 'Map',
    satuan: 'Buah',
    hargaSatuan: 10000,
    qtyDefaultPerNominal: (nom) => Math.max(1, Math.round(nom / 10000)),
    keterangan: 'Pemberkasan Bundel A Perkara Gugatan oleh Panitera Pengganti',
    keywords: ['bundel a gugatan', 'map bundel a gugatan']
  },
  {
    key: 'map-bundel-a-permohonan',
    kodeBarang: 'BRG-ATK-06',
    namaBarang: 'Cetak Map Bundel A Permohonan',
    kategori: 'Map',
    satuan: 'Buah',
    hargaSatuan: 10000,
    qtyDefaultPerNominal: (nom) => Math.max(1, Math.round(nom / 10000)),
    keterangan: 'Pemberkasan Bundel A Perkara Permohonan oleh Panitera Pengganti',
    keywords: ['bundel a permohonan', 'map bundel a permohonan']
  },
  {
    key: 'buku-sidang',
    kodeBarang: 'BRG-ATK-07',
    namaBarang: 'Buku Catatan Persidangan & Register Sidang',
    kategori: 'Buku',
    satuan: 'Buku',
    hargaSatuan: 10000,
    qtyDefaultPerNominal: (nom) => Number((nom / 10000).toFixed(2)),
    keterangan: 'Buku instrumen pencatatan agenda persidangan perkara oleh Panitera Pengganti (porsi 0.5 buku)',
    keywords: ['buku catatan', 'register sidang', 'buku sidang']
  },
  {
    key: 'pulpen-sidang',
    kodeBarang: 'BRG-ATK-08',
    namaBarang: 'Pulpen Sidang & Penandatanganan Berita Acara (BAS)',
    kategori: 'Alat Tulis',
    satuan: 'Buah',
    hargaSatuan: 5000,
    qtyDefaultPerNominal: (nom) => Math.max(1, Math.round(nom / 5000)),
    keterangan: 'Pulpen pencatatan sidang Majelis Hakim & Panitera Pengganti',
    keywords: ['pulpen', 'pulpen sidang', 'penandatanganan']
  },
  {
    key: 'tinta-epson',
    kodeBarang: 'BRG-ATK-09',
    namaBarang: 'Tinta Printer Epson Original (Pencetakan BAS & Surat)',
    kategori: 'Tinta',
    satuan: 'Botol',
    hargaSatuan: 100000,
    qtyDefaultPerNominal: (nom) => Number((nom / 100000).toFixed(2)),
    keterangan: 'Porsi pemakaian cetak berkas & instrumen Berita Acara Sidang (BAS) (porsi 1/20 botol)',
    keywords: ['tinta epson', 'epson', 'epson 1/20']
  },
  {
    key: 'materai-leges',
    kodeBarang: 'BRG-ATK-10',
    namaBarang: 'Bea Meterai Leges Bukti Surat Perkara (Rp 10.000)',
    kategori: 'Materai',
    satuan: 'Keping',
    hargaSatuan: 10000,
    qtyDefaultPerNominal: (nom) => Math.max(1, Math.round(nom / 10000)),
    keterangan: 'Bea materai untuk pemeteraian kemudian (leges) alat bukti surat para pihak di persidangan',
    keywords: ['materai', 'meterai', 'leges', 'bukti surat']
  },
  {
    key: 'tinta-canon',
    kodeBarang: 'BRG-ATK-11',
    namaBarang: 'Tinta Refill Canon (Penggandaan Dokumen Pembuktian)',
    kategori: 'Tinta',
    satuan: 'Botol',
    hargaSatuan: 50000,
    qtyDefaultPerNominal: (nom) => Number((nom / 50000).toFixed(2)),
    keterangan: 'Porsi pemakaian cetak penggandaan dokumen pembuktian perkara (porsi 1/10 botol)',
    keywords: ['tinta refill canon', 'canon', 'refill canon']
  },
  {
    key: 'catridge-printer',
    kodeBarang: 'BRG-ATK-12',
    namaBarang: 'Catridge Printer Persidangan & Kepaniteraan',
    kategori: 'Catridge',
    satuan: 'Unit',
    hargaSatuan: 250000,
    qtyDefaultPerNominal: (nom) => Number((nom / 250000).toFixed(2)),
    keterangan: 'Porsi keausan catridge printer operasional persidangan perkara (porsi 1/50 unit)',
    keywords: ['catridge', 'cartridge', 'catridge 1/50']
  },
  {
    key: 'binder-clip',
    kodeBarang: 'BRG-ATK-13',
    namaBarang: 'Binder Clip & Klip Kertas Penjepit Berkas',
    kategori: 'Klip',
    satuan: 'Kotak',
    hargaSatuan: 8000,
    qtyDefaultPerNominal: (nom) => Number((nom / 8000).toFixed(2)),
    keterangan: 'Penjepit berkas pembuktian dan bundel surat perkara (porsi 0.5 kotak / 4 pcs)',
    keywords: ['binder clip', 'klip kertas', 'penjepit']
  },
  {
    key: 'isi-staples',
    kodeBarang: 'BRG-ATK-14',
    namaBarang: 'Isi Staples & Hekter Pemberkasan Putusan',
    kategori: 'Staples',
    satuan: 'Kotak',
    hargaSatuan: 8000,
    qtyDefaultPerNominal: (nom) => Number((nom / 8000).toFixed(2)),
    keterangan: 'Penjilidan naskah putusan/penetapan dan relaas panggilan (porsi 0.5 kotak)',
    keywords: ['staples', 'hekter', 'isi staples']
  },
  {
    key: 'map-putusan',
    kodeBarang: 'BRG-ATK-15',
    namaBarang: 'Cetak Map Naskah Putusan Majelis Hakim',
    kategori: 'Map',
    satuan: 'Buah',
    hargaSatuan: 8000,
    qtyDefaultPerNominal: (nom) => Math.max(1, Math.round(nom / 8000)),
    keterangan: 'Map naskah resmi Putusan Majelis Hakim Perkara Gugatan',
    keywords: ['map putusan', 'cetak map putusan']
  },
  {
    key: 'map-penetapan',
    kodeBarang: 'BRG-ATK-16',
    namaBarang: 'Cetak Map Naskah Penetapan Hakim',
    kategori: 'Map',
    satuan: 'Buah',
    hargaSatuan: 8000,
    qtyDefaultPerNominal: (nom) => Math.max(1, Math.round(nom / 8000)),
    keterangan: 'Map naskah resmi Penetapan Hakim Perkara Permohonan',
    keywords: ['map penetapan', 'cetak map penetapan']
  },
  {
    key: 'map-produk',
    kodeBarang: 'BRG-ATK-17',
    namaBarang: 'Cetak Map Penyerahan Produk Pengadilan (Akta/Salinan)',
    kategori: 'Map',
    satuan: 'Buah',
    hargaSatuan: 10000,
    qtyDefaultPerNominal: (nom) => Math.max(1, Math.round(nom / 10000)),
    keterangan: 'Map penyerahan produk pengadilan (Akta Cerai / Salinan Putusan) kepada para pihak',
    keywords: ['map produk', 'cetak map produk', 'akta cerai']
  },
  {
    key: 'lakban-arsip',
    kodeBarang: 'BRG-ATK-18',
    namaBarang: 'Lakban Hitam & Sampul Arsip Minutasi Perkara',
    kategori: 'Arsip',
    satuan: 'Roll',
    hargaSatuan: 8000,
    qtyDefaultPerNominal: (nom) => Number((nom / 8000).toFixed(2)),
    keterangan: 'Penyegelan lakban & pengarsipan berkas perkara minutasi akhir ke ruang arsip (porsi 0.5 roll)',
    keywords: ['lakban', 'sampul arsip', 'minutasi', 'arsip']
  }
];

/**
 * Mencocokkan uraian transaksi ATK ke master persediaan
 */
export function matchToMasterPersediaan(uraian: string, kategori?: string): MasterItemDef {
  const u = (uraian || '').toLowerCase();
  const k = (kategori || '').toLowerCase();

  for (const item of MASTER_PERSEDIAAN_ATK) {
    for (const kw of item.keywords) {
      if (u.includes(kw)) {
        return item;
      }
    }
  }

  // Jika tidak ditemukan langsung dari keywords, gunakan kategori atau buat entri generik
  if (k.includes('kertas')) {
    return MASTER_PERSEDIAAN_ATK[0]; // kertas a4
  } else if (k.includes('map')) {
    return MASTER_PERSEDIAAN_ATK[1]; // map
  } else if (k.includes('amplop')) {
    return MASTER_PERSEDIAAN_ATK[3]; // amplop
  } else if (k.includes('tinta')) {
    return MASTER_PERSEDIAAN_ATK[8]; // tinta
  } else if (k.includes('materai') || k.includes('meterai')) {
    return MASTER_PERSEDIAAN_ATK[9]; // materai
  } else if (k.includes('catridge')) {
    return MASTER_PERSEDIAAN_ATK[11]; // catridge
  }

  // Default item untuk ATK Lainnya
  return {
    key: `custom-${uraian.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    kodeBarang: 'BRG-ATK-99',
    namaBarang: uraian || 'ATK / Perlengkapan Persidangan Lainnya',
    kategori: kategori || 'ATK Lainnya',
    satuan: 'Pcs / Porsi',
    hargaSatuan: 5000,
    qtyDefaultPerNominal: (nom) => Math.max(1, Math.round(nom / 5000)),
    keterangan: 'Perlengkapan administrasi dan persidangan perkara',
    keywords: []
  };
}

/**
 * Fungsi Utama: Menghitung Kalkulasi Persediaan Barang yang Digunakan
 * Mengelompokkan item jenis ATK yang sama untuk sebuah perkara atau seluruh perkara,
 * menghitung kuantitas (volume fisik barang habis pakai), harga satuan, dan total nominal.
 */
export function calculateAtkInventoryUsage(
  records: SimulasiAtkRecord[],
  filterNomorPerkara?: string
): AtkInventorySummary {
  // 1. Filter hanya transaksi pengeluaran ATK (pengeluaran > 0)
  let validRecords = records.filter(r => (Number(r.pengeluaran) || 0) > 0);

  if (filterNomorPerkara && filterNomorPerkara !== 'all') {
    const targetNorm = filterNomorPerkara.trim().toLowerCase();
    validRecords = validRecords.filter(r => (r.nomorPerkara || '').trim().toLowerCase() === targetNorm);
  }

  // 2. Kelompokkan berdasarkan Master Item Persediaan yang sama
  const groupMap = new Map<string, AtkInventoryUsageItem>();
  const kategoriSummary: { [kategori: string]: { totalNominal: number; count: number } } = {};

  let totalNominal = 0;
  let totalKuantitasSemua = 0;

  validRecords.forEach((rec, idx) => {
    const nominal = Number(rec.pengeluaran) || 0;
    const master = matchToMasterPersediaan(rec.uraian || '', rec.kategori);

    const calculatedQty = master.qtyDefaultPerNominal(nominal);

    totalNominal += nominal;
    totalKuantitasSemua += calculatedQty;

    // Kategori summary
    if (!kategoriSummary[master.kategori]) {
      kategoriSummary[master.kategori] = { totalNominal: 0, count: 0 };
    }
    kategoriSummary[master.kategori].totalNominal += nominal;
    kategoriSummary[master.kategori].count += 1;

    // Grouping
    const existing = groupMap.get(master.key);
    const perkaraEntry = {
      nomorPerkara: rec.nomorPerkara || '-',
      tanggal: rec.tanggal || '-',
      kuantitas: calculatedQty,
      nominal: nominal,
      uraian: rec.uraian || master.namaBarang
    };

    if (existing) {
      existing.totalKuantitas = Number((existing.totalKuantitas + calculatedQty).toFixed(2));
      existing.totalNominal += nominal;
      existing.frekuensiDipakai += 1;
      existing.daftarPerkara.push(perkaraEntry);
    } else {
      groupMap.set(master.key, {
        id: `inv-${master.key}-${idx}`,
        kodeBarang: master.kodeBarang,
        namaBarang: master.namaBarang,
        kategori: master.kategori,
        satuan: master.satuan,
        hargaSatuan: master.hargaSatuan,
        totalKuantitas: calculatedQty,
        totalNominal: nominal,
        frekuensiDipakai: 1,
        daftarPerkara: [perkaraEntry],
        keterangan: master.keterangan
      });
    }
  });

  // Urutkan items berdasarkan total nominal pemakaian tertinggi
  const items = Array.from(groupMap.values()).sort((a, b) => b.totalNominal - a.totalNominal);

  return {
    totalJenisBarang: items.length,
    totalNominal,
    totalKuantitasSemua: Number(totalKuantitasSemua.toFixed(2)),
    items,
    kategoriSummary
  };
}

/**
 * Generate CSV data untuk Rekapitulasi Persediaan Barang
 */
export function exportAtkInventoryToCsv(
  summary: AtkInventorySummary,
  namaPengadilan: string,
  periodeLabel: string
): string {
  const headers = [
    'No',
    'Kode Barang',
    'Nama Barang Persediaan ATK',
    'Kategori',
    'Satuan',
    'Harga Satuan (Rp)',
    'Total Kuantitas Terpakai',
    'Total Nilai Pemakaian (Rp)',
    'Frekuensi Transaksi',
    'Perkara Pengguna',
    'Keterangan'
  ];

  const rows = summary.items.map((it, idx) => [
    idx + 1,
    `"${it.kodeBarang}"`,
    `"${it.namaBarang.replace(/"/g, '""')}"`,
    `"${it.kategori}"`,
    `"${it.satuan}"`,
    it.hargaSatuan,
    it.totalKuantitas,
    it.totalNominal,
    it.frekuensiDipakai,
    `"${it.daftarPerkara.map(p => p.nomorPerkara).filter((v, i, a) => a.indexOf(v) === i).join(', ')}"`,
    `"${(it.keterangan || '').replace(/"/g, '""')}"`
  ]);

  return [
    `"REKAPITULASI PEMAKAIAN & PERSEDIAAN BARANG ATK PERKARA"`,
    `"Satker: ${namaPengadilan}"`,
    `"Periode: ${periodeLabel}"`,
    `"Total Nilai: Rp ${summary.totalNominal.toLocaleString('id-ID')}"`,
    '',
    headers.join(';'),
    ...rows.map(r => r.join(';'))
  ].join('\n');
}

/**
 * Trigger download CSV Rekapitulasi Persediaan di browser
 */
export function downloadAtkInventoryCsv(
  summary: AtkInventorySummary,
  namaPengadilan: string,
  periodeLabel: string
): void {
  const csvContent = exportAtkInventoryToCsv(summary, namaPengadilan, periodeLabel);
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanFilename = `Rekap_Persediaan_ATK_${periodeLabel.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
  a.setAttribute('download', cleanFilename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

