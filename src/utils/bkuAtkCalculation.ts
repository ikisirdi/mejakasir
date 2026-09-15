import { CaseRecord, SimulasiAtkRecord } from '../types';

export interface BkuLedgerRow {
  id: string;
  no: number;
  tanggal: string; // Indonesian formatted: "01 Maret 2024"
  rawDate: string;  // YYYY-MM-DD for sorting
  nomorBk: string; // "15/K/III/2024" or "01/K/III/2026"
  kodeReferensi: string;
  uraian: string;
  debit: number;
  kredit: number;
  saldo: number;
  tipe: 'saldo-awal' | 'penerimaan' | 'pengeluaran-rekap' | 'sisa-saldo';
  kelompok?: string;
  nomorPerkara?: string;
  isBold?: boolean;
}

export interface BkuCalculationResult {
  rows: BkuLedgerRow[];
  saldoAwal: number;
  totalPenerimaan: number;
  totalPengeluaran: number;
  saldoAkhir: number;
  periodeLabel: string;
  rekapKelompok: { [kelompok: string]: { total: number; count: number; items: string[] } };
}

export const MONTH_NAMES_INDO: { [key: string]: string } = {
  '01': 'Januari',
  '02': 'Februari',
  '03': 'Maret',
  '04': 'April',
  '05': 'Mei',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'Agustus',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Desember'
};

export const ROMAN_MONTHS: { [key: string]: string } = {
  '01': 'I',
  '02': 'II',
  '03': 'III',
  '04': 'IV',
  '05': 'V',
  '06': 'VI',
  '07': 'VII',
  '08': 'VIII',
  '09': 'IX',
  '10': 'X',
  '11': 'XI',
  '12': 'XII'
};

/**
 * Format string tanggal YYYY-MM-DD ke format resmi Indonesia: "18 Maret 2024"
 */
export function formatTanggalIndo(dateStr: string): string {
  if (!dateStr) return '-';
  const clean = dateStr.trim().split('T')[0];
  const parts = clean.split('-');
  if (parts.length < 3) return dateStr;
  const day = parts[2].padStart(2, '0');
  const monthNum = parts[1];
  const year = parts[0];
  const monthName = MONTH_NAMES_INDO[monthNum] || monthNum;
  return `${day} ${monthName} ${year}`;
}

/**
 * Mengelompokkan uraian pengeluaran ATK ke dalam kategori standar
 */
export function categorizeAtkExpense(uraian: string, kategori?: string): string {
  const text = `${uraian} ${kategori || ''}`.toLowerCase();

  if (text.includes('kertas') || text.includes('hvs') || text.includes('a4') || text.includes('rim') || text.includes('stofmap')) {
    return 'Kertas';
  }
  if (text.includes('jarum') || text.includes('benang') || text.includes('jahit') || text.includes('tindik') || text.includes('kasur')) {
    return 'Alat Jahit';
  }
  if (text.includes('map') || text.includes('sampul') || text.includes('bundel')) {
    return 'Map & Sampul';
  }
  if (text.includes('amplop') || text.includes('surat') || text.includes('panggilan')) {
    return 'Amplop';
  }
  if (text.includes('pulpen') || text.includes('pena') || text.includes('alat tulis')) {
    return 'Alat Tulis';
  }
  if (text.includes('tinta') || text.includes('epson') || text.includes('canon') || text.includes('refill')) {
    return 'Tinta Printer';
  }
  if (text.includes('catridge') || text.includes('cartridge')) {
    return 'Catridge';
  }
  if (text.includes('staples') || text.includes('clip') || text.includes('klip') || text.includes('binder') || text.includes('hekter')) {
    return 'Klip & Staples';
  }
  if (text.includes('lakban') || text.includes('arsip') || text.includes('minutasi')) {
    return 'Arsip & Minutasi';
  }
  return kategori || 'ATK Lainnya';
}

/**
 * Menghasilkan uraian deskriptif resmi untuk Buku Kas format Rekapitulasi Kelompok ATK
 */
export function getDescriptiveUraianKelompok(kelompok: string, count: number, total: number): string {
  switch (kelompok) {
    case 'Kertas':
      return `Biaya Pembelian ATK Perkara berupa pembelian Kertas HVS A4 80gr & Stofmap Folio (${count} transaksi berkas perkara)`;
    case 'Alat Jahit':
      return `Biaya Pembelian ATK Perkara berupa penyediaan Jarum Jahit & Benang Jahit Bundel Berkas Perkara (${count} transaksi berkas perkara)`;
    case 'Map & Sampul':
      return `Biaya Pembelian ATK Perkara berupa pengeluaran Cetak Map Sampul, Map Bundel A/B, Putusan & Produk Pengadilan (${count} item)`;
    case 'Amplop':
      return `Biaya Pembelian ATK Perkara berupa pembelian Amplop Surat Panggilan Sidang & Pos Perkara (${count} item)`;
    case 'Alat Tulis':
      return `Biaya Pembelian ATK Perkara berupa pembelian Pulpen Sidang & Penandatanganan Berita Acara Persidangan (${count} item)`;
    case 'Tinta Printer':
      return `Biaya Pembelian ATK Perkara berupa pembelian Tinta Printer Epson & Refill Canon Berkas Sidang (${count} item)`;
    case 'Catridge':
      return `Biaya Pembelian ATK Perkara berupa keausan Catridge Printer Persidangan & Kepaniteraan (${count} item)`;
    case 'Klip & Staples':
      return `Biaya Pembelian ATK Perkara berupa pembelian Binder Clip, Klip Kertas Penjepit & Isi Staples Bundel Berkas (${count} item)`;
    case 'Arsip & Minutasi':
      return `Biaya Pembelian ATK Perkara berupa pengeluaran Lakban Jilid & Sampul Arsip Minutasi Berkas (${count} item)`;
    default:
      return `Biaya Pembelian ATK Perkara berupa pengeluaran kelompok ${kelompok} (${count} transaksi berkas perkara)`;
  }
}

/**
 * Kalkulator Utama Format Tabel Buku Kas Standar BKU (Sesuai Format Gambar Resmi Pengadilan)
 * Menampilkan:
 * 1. Saldo Awal periode
 * 2. Transaksi Penerimaan Panjar ATK Perkara
 * 3. Pengeluaran REKAPITULASI PENGELUARAN PER KELOMPOK ATK dengan kolom Nomor B/K, Kode Ref, Uraian, Debit, Kredit, Saldo
 * 4. Baris Sisa Saldo Kas ATK Perkara Periode
 * 5. Baris Footer Total (Jumlah Debit, Kredit, dan Saldo Akhir)
 */
export function calculateBkuAtkLedger(
  cases: CaseRecord[],
  simulasiAtkRecords: SimulasiAtkRecord[],
  selectedMonth: string = 'all',
  selectedYear: string = '2026',
  filterNomorPerkara: string = 'all'
): BkuCalculationResult {
  // Label Periode
  const periodeLabel = selectedMonth !== 'all'
    ? `BULAN ${MONTH_NAMES_INDO[selectedMonth]?.toUpperCase() || selectedMonth} ${selectedYear !== 'all' ? selectedYear : ''}`
    : (selectedYear !== 'all' ? `TAHUN ${selectedYear}` : 'SEMUA PERIODE');

  // Menghitung Saldo Awal (sebelum awal periode yang dipilih)
  let startDateStr = '';
  if (selectedYear !== 'all' && selectedMonth !== 'all') {
    startDateStr = `${selectedYear}-${selectedMonth}-01`;
  } else if (selectedYear !== 'all') {
    startDateStr = `${selectedYear}-01-01`;
  }

  let saldoAwal = 0;
  if (startDateStr) {
    // Penerimaan sebelum periode
    const penerimaanBefore = cases
      .filter(c => {
        if (filterNomorPerkara !== 'all' && c.nomorPerkara !== filterNomorPerkara) return false;
        if (!c.tanggalRegister) return false;
        return c.tanggalRegister < startDateStr;
      })
      .reduce((sum, c) => sum + ((c as unknown as { biayaAtk?: number }).biayaAtk || 100000), 0);

    // Pengeluaran sebelum periode
    const pengeluaranBefore = simulasiAtkRecords
      .filter(s => {
        if (filterNomorPerkara !== 'all' && s.nomorPerkara !== filterNomorPerkara) return false;
        if (!s.tanggal) return false;
        return s.tanggal < startDateStr;
      })
      .reduce((sum, s) => sum + (s.pengeluaran || 0), 0);

    saldoAwal = Math.max(0, penerimaanBefore - pengeluaranBefore);
  }

  // Tanggal Baris Saldo Awal
  let tanggalSaldoAwal = '01 Januari 2026';
  if (selectedYear !== 'all' && selectedMonth !== 'all') {
    tanggalSaldoAwal = `01 ${MONTH_NAMES_INDO[selectedMonth] || 'Januari'} ${selectedYear}`;
  } else if (selectedYear !== 'all') {
    tanggalSaldoAwal = `01 Januari ${selectedYear}`;
  }

  // 1. Kumpulkan Transaksi Penerimaan dalam Periode Terpilih
  interface IntermediateEntry {
    rawDate: string;
    tanggal: string;
    nomorBk: string;
    kodeReferensi: string;
    uraian: string;
    debit: number;
    kredit: number;
    tipe: 'penerimaan' | 'pengeluaran-rekap';
    kelompok?: string;
    nomorPerkara?: string;
  }

  const intermediateEntries: IntermediateEntry[] = [];

  // Filter perkara yang masuk dalam periode
  const filteredCases = cases.filter(c => {
    if (filterNomorPerkara !== 'all' && c.nomorPerkara !== filterNomorPerkara) return false;
    if (!c.tanggalRegister) return false;
    const parts = c.tanggalRegister.split('-');
    if (selectedYear !== 'all' && parts[0] !== selectedYear) return false;
    if (selectedMonth !== 'all' && parts[1] !== selectedMonth) return false;
    return true;
  });

  filteredCases.forEach(c => {
    const nominal = (c as unknown as { biayaAtk?: number }).biayaAtk || 100000;
    intermediateEntries.push({
      rawDate: c.tanggalRegister,
      tanggal: formatTanggalIndo(c.tanggalRegister),
      nomorBk: '',
      kodeReferensi: '',
      uraian: `Diterima biaya ATK perkara Nomor ${c.nomorPerkara} dari kasir @Rp ${nominal.toLocaleString('id-ID')}`,
      debit: nominal,
      kredit: 0,
      tipe: 'penerimaan',
      nomorPerkara: c.nomorPerkara
    });
  });

  // 2. Kumpulkan Pengeluaran dalam Periode & Kelompokkan (REKAPITULASI PENGELUARAN PER KELOMPOK ATK)
  const filteredSimulasi = simulasiAtkRecords.filter(s => {
    if (filterNomorPerkara !== 'all' && s.nomorPerkara !== filterNomorPerkara) return false;
    if (!s.tanggal) return false;
    const parts = s.tanggal.split('-');
    if (selectedYear !== 'all' && parts[0] !== selectedYear) return false;
    if (selectedMonth !== 'all' && parts[1] !== selectedMonth) return false;
    return (s.pengeluaran || 0) > 0;
  });

  const rekapKelompok: { [kelompok: string]: { total: number; count: number; items: string[]; dates: string[] } } = {};

  filteredSimulasi.forEach(s => {
    const kelompok = categorizeAtkExpense(s.uraian, s.kategori);
    if (!rekapKelompok[kelompok]) {
      rekapKelompok[kelompok] = { total: 0, count: 0, items: [], dates: [] };
    }
    rekapKelompok[kelompok].total += s.pengeluaran;
    rekapKelompok[kelompok].count += 1;
    rekapKelompok[kelompok].items.push(s.uraian);
    if (s.tanggal) {
      rekapKelompok[kelompok].dates.push(s.tanggal);
    }
  });

  // Tentukan urutan kronologis kelompok ATK sesuai standar proses peradilan
  const KELOMPOK_ORDER = [
    'Kertas',
    'Map & Sampul',
    'Amplop',
    'Alat Jahit',
    'Alat Tulis',
    'Tinta Printer',
    'Catridge',
    'Klip & Staples',
    'Arsip & Minutasi'
  ];

  let bkIndex = 1;
  const currentMonthNum = selectedMonth !== 'all' ? selectedMonth : '03';
  const romanMonth = ROMAN_MONTHS[currentMonthNum] || 'III';
  const currentYearStr = selectedYear !== 'all' ? selectedYear : '2026';

  // Sort kelompok keys
  const sortedKelompokKeys = Object.keys(rekapKelompok).sort((a, b) => {
    const idxA = KELOMPOK_ORDER.indexOf(a);
    const idxB = KELOMPOK_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  sortedKelompokKeys.forEach(kelompok => {
    const data = rekapKelompok[kelompok];
    if (data.total <= 0) return;

    // Ambil tanggal perwakilan (tanggal paling awal atau median di periode ini)
    data.dates.sort();
    const repDate = data.dates[Math.floor(data.dates.length / 2)] || `${currentYearStr}-${currentMonthNum}-15`;

    const nomorBk = `${String(bkIndex).padStart(2, '0')}/K/${romanMonth}/${currentYearStr}`;
    bkIndex += 1;

    intermediateEntries.push({
      rawDate: repDate,
      tanggal: formatTanggalIndo(repDate),
      nomorBk,
      kodeReferensi: '',
      uraian: getDescriptiveUraianKelompok(kelompok, data.count, data.total),
      debit: 0,
      kredit: data.total,
      tipe: 'pengeluaran-rekap',
      kelompok
    });
  });

  // 3. Urutkan Seluruh Entri Kronologis berdasarkan tanggal
  intermediateEntries.sort((a, b) => {
    if (a.rawDate !== b.rawDate) {
      return a.rawDate.localeCompare(b.rawDate);
    }
    // Jika pada tanggal yang sama, letakkan penerimaan sebelum pengeluaran
    if (a.debit > 0 && b.kredit > 0) return -1;
    if (a.kredit > 0 && b.debit > 0) return 1;
    return 0;
  });

  // 4. Susun Daftar Baris Tabel Resmi (BkuLedgerRow)
  const rows: BkuLedgerRow[] = [];
  let runningBalance = saldoAwal;
  let rowNumber = 1;

  // Baris 1: Saldo Awal
  rows.push({
    id: 'bku-saldo-awal',
    no: rowNumber++,
    tanggal: tanggalSaldoAwal,
    rawDate: startDateStr || '2026-01-01',
    nomorBk: '',
    kodeReferensi: '',
    uraian: 'Saldo Awal',
    debit: saldoAwal,
    kredit: 0,
    saldo: runningBalance,
    tipe: 'saldo-awal',
    isBold: true
  });

  // Baris-baris Transaksi (Penerimaan & Pengeluaran Rekapitulasi Kelompok ATK)
  intermediateEntries.forEach((entry, idx) => {
    runningBalance = runningBalance + entry.debit - entry.kredit;
    rows.push({
      id: `bku-row-${idx + 1}`,
      no: rowNumber++,
      tanggal: entry.tanggal,
      rawDate: entry.rawDate,
      nomorBk: entry.nomorBk,
      kodeReferensi: entry.kodeReferensi,
      uraian: entry.uraian,
      debit: entry.debit,
      kredit: entry.kredit,
      saldo: runningBalance,
      tipe: entry.tipe,
      kelompok: entry.kelompok,
      nomorPerkara: entry.nomorPerkara
    });
  });

  // Tanggal untuk Baris Sisa Saldo (akhir bulan atau tanggal transaksi terakhir)
  const lastRawDate = intermediateEntries.length > 0 
    ? intermediateEntries[intermediateEntries.length - 1].rawDate 
    : (startDateStr || '2026-01-31');
  const tanggalSisaSaldo = formatTanggalIndo(lastRawDate);

  // Baris Sisa Saldo Periode (Sesuai Permintaan Spesifik User)
  rows.push({
    id: 'bku-sisa-saldo-row',
    no: rowNumber++,
    tanggal: tanggalSisaSaldo,
    rawDate: lastRawDate,
    nomorBk: '',
    kodeReferensi: '',
    uraian: `Sisa Saldo Kas ATK Perkara Periode ${periodeLabel}`,
    debit: 0,
    kredit: 0,
    saldo: runningBalance,
    tipe: 'sisa-saldo',
    isBold: true
  });

  // Hitung Total Debit & Kredit
  const totalPenerimaan = intermediateEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalPengeluaran = intermediateEntries.reduce((sum, e) => sum + e.kredit, 0);
  const totalDebitWithSaldoAwal = saldoAwal + totalPenerimaan;

  return {
    rows,
    saldoAwal,
    totalPenerimaan: totalDebitWithSaldoAwal,
    totalPengeluaran,
    saldoAkhir: runningBalance,
    periodeLabel,
    rekapKelompok: Object.fromEntries(
      Object.entries(rekapKelompok).map(([k, v]) => [k, { total: v.total, count: v.count, items: v.items }])
    )
  };
}
