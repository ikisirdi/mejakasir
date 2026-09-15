import { CaseRecord, SimulasiAtkRecord } from '../types';
import { generateAtkSimulationDeterministic } from '../data/atkRubric';

export interface BkuLedgerRow {
  id: string;
  no: number;
  tanggal: string; // Indonesian formatted: "01 Maret 2024"
  rawDate: string;  // YYYY-MM-DD for sorting
  nomorBk?: string; // Opsional
  kodeReferensi?: string; // Opsional
  uraian: string;
  debit: number;
  kredit: number;
  saldo: number;
  tipe: 'saldo-awal' | 'penerimaan' | 'pengeluaran' | 'pengeluaran-rekap' | 'sisa-saldo';
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
  modeDistribusi: 'hari-sama' | 'bertahap';
  modeRincian: 'gabung-kategori' | 'kelompok-perkara' | 'item-detail';
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
 * Helper untuk memformat dan mengurutkan daftar nomor perkara secara rapi
 * Contoh: "Nomor 01/Pdt.G/2026/PA.Bdg dan Nomor 02/Pdt.G/2026/PA.Bdg"
 */
export function formatDaftarNomorPerkara(list: string[]): string {
  if (!list || list.length === 0) return '';
  const unique = Array.from(new Set(list.map(s => s.trim()).filter(Boolean)));
  unique.sort((a, b) => {
    const numA = parseInt(a.replace(/\D+/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D+/g, ''), 10) || 0;
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });

  const formatted = unique.map(n => {
    const lower = n.toLowerCase();
    if (lower.startsWith('nomor ')) return n;
    if (lower.startsWith('no. ')) return `Nomor ${n.substring(4)}`;
    if (lower.startsWith('no ')) return `Nomor ${n.substring(3)}`;
    return `Nomor ${n}`;
  });

  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} dan ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(', ')}, dan ${formatted[formatted.length - 1]}`;
}

/**
 * Menghasilkan uraian deskriptif resmi untuk Buku Kas format Kelompok ATK
 * Disertai rincian nomor perkara yang menggunakan ATK tersebut:
 * Contoh: "Biaya Pembelian ATK Perkara berupa Kertas HVS A4 80gr & Stofmap Folio untuk perkara Nomor 01/Pdt.G/2026/PA.Bdg dan Nomor 02/Pdt.G/2026/PA.Bdg"
 */
export function getDescriptiveUraianKelompok(
  kelompok: string, 
  _count: number, 
  _total: number, 
  nomorPerkaraList: string[] = []
): string {
  const formattedCases = formatDaftarNomorPerkara(nomorPerkaraList);
  const perkaraSuffix = formattedCases ? ` untuk perkara ${formattedCases}` : '';

  switch (kelompok) {
    case 'Kertas':
      return `Biaya Pembelian ATK Perkara berupa Kertas HVS A4 80gr & Stofmap Folio Pendaftaran${perkaraSuffix}`;
    case 'Alat Jahit':
      return `Biaya Pembelian ATK Perkara berupa penyediaan Jarum Jahit & Benang Jahit Bundel Berkas${perkaraSuffix}`;
    case 'Map & Sampul':
      return `Biaya Pembelian ATK Perkara berupa Cetak Map Sampul, Map Bundel A/B & Putusan${perkaraSuffix}`;
    case 'Amplop':
      return `Biaya Pembelian ATK Perkara berupa Amplop Surat Panggilan Sidang & Pos Perkara${perkaraSuffix}`;
    case 'Alat Tulis':
      return `Biaya Pembelian ATK Perkara berupa Pulpen Sidang & Penandatanganan Berita Acara Persidangan${perkaraSuffix}`;
    case 'Tinta Printer':
      return `Biaya Pembelian ATK Perkara berupa Tinta Printer Epson & Refill Canon Berkas Sidang${perkaraSuffix}`;
    case 'Catridge':
      return `Biaya Pembelian ATK Perkara berupa keausan Catridge Printer Persidangan & Kepaniteraan${perkaraSuffix}`;
    case 'Klip & Staples':
      return `Biaya Pembelian ATK Perkara berupa Binder Clip, Klip Kertas Penjepit & Isi Staples Bundel Berkas${perkaraSuffix}`;
    case 'Arsip & Minutasi':
      return `Biaya Pembelian ATK Perkara berupa Lakban Jilid Minutasi & Sampul Putusan Berkas${perkaraSuffix}`;
    default:
      return `Biaya Pembelian ATK Perkara berupa pengeluaran ${kelompok}${perkaraSuffix}`;
  }
}

/**
 * Kalkulator Utama Format Tabel Buku Kas Standar BKU
 * Mengimplementasikan:
 * 1. Logika Debit Masuk Terlebih Dahulu (Saldo Tidak Minus)
 * 2. Pengeluaran dikreditkan pada HARI TERSEBUT JUGA (modeDistribusi = 'hari-sama') 
 *    atau BERTAHAP DALAM BULAN SEBELUM BULAN BERAKHIR (modeDistribusi = 'bertahap')
 * 3. Tidak terlihat sebagai rekapitulasi gelondongan, melainkan rincian per perkara (modeRincian)
 * 4. Kolom tabel standar 6 kolom: No, Tanggal, Uraian, Debit, Kredit, Saldo
 */
export function calculateBkuAtkLedger(
  cases: CaseRecord[],
  simulasiAtkRecords: SimulasiAtkRecord[],
  selectedMonth: string = 'all',
  selectedYear: string = '2026',
  filterNomorPerkara: string = 'all',
  modeDistribusi: 'hari-sama' | 'bertahap' = 'hari-sama',
  modeRincian: 'gabung-kategori' | 'kelompok-perkara' | 'item-detail' = 'gabung-kategori'
): BkuCalculationResult {
  // Label Periode
  const periodeLabel = selectedMonth !== 'all'
    ? `BULAN ${MONTH_NAMES_INDO[selectedMonth]?.toUpperCase() || selectedMonth} ${selectedYear !== 'all' ? selectedYear : ''}`
    : (selectedYear !== 'all' ? `TAHUN ${selectedYear}` : 'SEMUA PERIODE');

  // Menghitung Saldo Awal (sebelum awal periode yang dipilih)
  let startDateStr = '';
  let endDateStr = '';
  if (selectedYear !== 'all' && selectedMonth !== 'all') {
    startDateStr = `${selectedYear}-${selectedMonth}-01`;
    const y = parseInt(selectedYear, 10);
    const m = parseInt(selectedMonth, 10);
    const lastDay = new Date(y, m, 0).getDate();
    endDateStr = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
  } else if (selectedYear !== 'all') {
    startDateStr = `${selectedYear}-01-01`;
    endDateStr = `${selectedYear}-12-31`;
  } else {
    endDateStr = '2026-12-31';
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

  // Struktur Transaksi Intermediet
  interface IntermediateEntry {
    rawDate: string;
    tanggal: string;
    nomorBk: string;
    kodeReferensi: string;
    uraian: string;
    debit: number;
    kredit: number;
    tipe: 'penerimaan' | 'pengeluaran' | 'pengeluaran-rekap';
    kelompok?: string;
    nomorPerkara?: string;
    sortOrder: number; // 1 = Debit (Masuk dulu), 2 = Kredit (Keluar kemudian)
    subIndex: number;
  }

  const intermediateEntries: IntermediateEntry[] = [];

  // Urutan Kelompok ATK resmi kepaniteraan
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

  // 1. Filter perkara yang masuk dalam periode
  const filteredCases = cases.filter(c => {
    if (filterNomorPerkara !== 'all' && c.nomorPerkara !== filterNomorPerkara) return false;
    if (!c.tanggalRegister) return false;
    const parts = c.tanggalRegister.split('-');
    if (selectedYear !== 'all' && parts[0] !== selectedYear) return false;
    if (selectedMonth !== 'all' && parts[1] !== selectedMonth) return false;
    return true;
  }).sort((a, b) => (a.tanggalRegister || '').localeCompare(b.tanggalRegister || ''));

  // 2. Olah Penerimaan (Debit) dan Pengeluaran (Kredit)
  // Step 2A: Catat Semua Penerimaan Panjar ATK (Debit) terlebih dahulu di tanggal perkara masuk
  filteredCases.forEach((c) => {
    const nominal = (c as unknown as { biayaAtk?: number }).biayaAtk || 100000;
    const regDate = c.tanggalRegister || startDateStr || '2026-01-01';

    intermediateEntries.push({
      rawDate: regDate,
      tanggal: formatTanggalIndo(regDate),
      nomorBk: '',
      kodeReferensi: '',
      uraian: `Diterima biaya ATK perkara Nomor ${c.nomorPerkara} dari kasir @Rp ${nominal.toLocaleString('id-ID')}`,
      debit: nominal,
      kredit: 0,
      tipe: 'penerimaan',
      nomorPerkara: c.nomorPerkara,
      sortOrder: 1, // Prioritas 1: Debit diproses duluan di tanggal tersebut
      subIndex: 0
    });
  });

  // Step 2B: Catat Pengeluaran ATK (Kredit)
  if (modeRincian === 'gabung-kategori') {
    // MODE GABUNG URAIAN: "misal kertas untuk perkara nomor sekian dan sekian begitu"
    // Uraian tidak dipisah per perkara, melainkan menggabungkan nomor perkara untuk setiap kategori ATK

    if (modeDistribusi === 'hari-sama') {
      // Kelompokkan perkara berdasarkan tanggal masuk registrasinya
      const casesByDate: { [dateKey: string]: CaseRecord[] } = {};
      filteredCases.forEach(c => {
        const d = c.tanggalRegister || startDateStr || '2026-01-01';
        if (!casesByDate[d]) casesByDate[d] = [];
        casesByDate[d].push(c);
      });

      // Pada setiap tanggal masuk: keluarkan/kreditkan hari tersebut juga untuk perkara-perkara yang masuk pada tanggal tersebut
      Object.keys(casesByDate).sort().forEach(dateKey => {
        const casesOnDate = casesByDate[dateKey];
        const groupMap: { [grp: string]: { total: number; count: number; cases: string[] } } = {};

        casesOnDate.forEach(c => {
          const nominal = (c as unknown as { biayaAtk?: number }).biayaAtk || 100000;
          const caseSim = simulasiAtkRecords.filter(s => 
            (s.nomorPerkara || '').trim().toLowerCase() === (c.nomorPerkara || '').trim().toLowerCase() && 
            (s.pengeluaran || 0) > 0
          );
          const items = caseSim.length > 0
            ? caseSim
            : generateAtkSimulationDeterministic({
                caseRecord: c,
                targetAmount: nominal,
                tanggalMasuk: dateKey,
                tanggalSelesai: c.tanggalPutus || endDateStr
              });

          items.forEach(it => {
            const grp = categorizeAtkExpense(it.uraian, it.kategori);
            if (!groupMap[grp]) {
              groupMap[grp] = { total: 0, count: 0, cases: [] };
            }
            groupMap[grp].total += it.pengeluaran;
            groupMap[grp].count += 1;
            if (!groupMap[grp].cases.includes(c.nomorPerkara)) {
              groupMap[grp].cases.push(c.nomorPerkara);
            }
          });
        });

        const sortedGroupKeys = Object.keys(groupMap).sort((a, b) => {
          const idxA = KELOMPOK_ORDER.indexOf(a);
          const idxB = KELOMPOK_ORDER.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });

        sortedGroupKeys.forEach((grpKey, idx) => {
          const grp = groupMap[grpKey];
          intermediateEntries.push({
            rawDate: dateKey,
            tanggal: formatTanggalIndo(dateKey),
            nomorBk: '',
            kodeReferensi: '',
            uraian: getDescriptiveUraianKelompok(grpKey, grp.count, grp.total, grp.cases),
            debit: 0,
            kredit: grp.total,
            tipe: 'pengeluaran',
            kelompok: grpKey,
            sortOrder: 2, // Prioritas 2: Kredit dicatat setelah debit pada hari yang sama
            subIndex: idx + 1
          });
        });
      });
    } else {
      // Mode 'bertahap': gabungkan seluruh perkara dalam bulan per kelompok ATK,
      // lalu distribusikan tanggalnya selama bulan tersebut belum berakhir
      const casesByMonth: { [monthKey: string]: CaseRecord[] } = {};
      filteredCases.forEach(c => {
        const d = c.tanggalRegister || startDateStr || '2026-01-01';
        const monthKey = d.substring(0, 7);
        if (!casesByMonth[monthKey]) casesByMonth[monthKey] = [];
        casesByMonth[monthKey].push(c);
      });

      Object.keys(casesByMonth).sort().forEach(monthKey => {
        const monthCases = casesByMonth[monthKey];
        const [yStr, mStr] = monthKey.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const daysInMonth = new Date(y, m, 0).getDate();

        const groupMap: { [grp: string]: { total: number; count: number; cases: string[] } } = {};
        monthCases.forEach(c => {
          const nominal = (c as unknown as { biayaAtk?: number }).biayaAtk || 100000;
          const caseSim = simulasiAtkRecords.filter(s => 
            (s.nomorPerkara || '').trim().toLowerCase() === (c.nomorPerkara || '').trim().toLowerCase() && 
            (s.pengeluaran || 0) > 0
          );
          const items = caseSim.length > 0
            ? caseSim
            : generateAtkSimulationDeterministic({
                caseRecord: c,
                targetAmount: nominal,
                tanggalMasuk: c.tanggalRegister || `${monthKey}-01`,
                tanggalSelesai: c.tanggalPutus || `${monthKey}-${daysInMonth}`
              });

          items.forEach(it => {
            const grp = categorizeAtkExpense(it.uraian, it.kategori);
            if (!groupMap[grp]) {
              groupMap[grp] = { total: 0, count: 0, cases: [] };
            }
            groupMap[grp].total += it.pengeluaran;
            groupMap[grp].count += 1;
            if (!groupMap[grp].cases.includes(c.nomorPerkara)) {
              groupMap[grp].cases.push(c.nomorPerkara);
            }
          });
        });

        const sortedGroupKeys = Object.keys(groupMap).sort((a, b) => {
          const idxA = KELOMPOK_ORDER.indexOf(a);
          const idxB = KELOMPOK_ORDER.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });

        const regDays = monthCases
          .map(c => parseInt((c.tanggalRegister || '').split('-')[2], 10) || 1)
          .sort((a, b) => a - b);
        const minDay = regDays[0] || 2;
        const maxDay = Math.min(daysInMonth - 2, Math.max(minDay + 5, 28));

        sortedGroupKeys.forEach((grpKey, idx) => {
          const grp = groupMap[grpKey];
          const ratio = sortedGroupKeys.length > 1 ? idx / (sortedGroupKeys.length - 1) : 0;
          const assignedDay = Math.min(maxDay, Math.max(minDay, Math.round(minDay + ratio * (maxDay - minDay))));
          const assignedDate = `${yStr}-${mStr}-${String(assignedDay).padStart(2, '0')}`;

          intermediateEntries.push({
            rawDate: assignedDate,
            tanggal: formatTanggalIndo(assignedDate),
            nomorBk: '',
            kodeReferensi: '',
            uraian: getDescriptiveUraianKelompok(grpKey, grp.count, grp.total, grp.cases),
            debit: 0,
            kredit: grp.total,
            tipe: 'pengeluaran',
            kelompok: grpKey,
            sortOrder: 2,
            subIndex: idx + 1
          });
        });
      });
    }
  } else {
    // Mode 'kelompok-perkara' atau 'item-detail': Rinci terpisah untuk setiap nomor perkara
    filteredCases.forEach((c) => {
      const nominal = (c as unknown as { biayaAtk?: number }).biayaAtk || 100000;
      const regDate = c.tanggalRegister || startDateStr || '2026-01-01';

      const caseSim = simulasiAtkRecords.filter(s => 
        (s.nomorPerkara || '').trim().toLowerCase() === (c.nomorPerkara || '').trim().toLowerCase() && 
        (s.pengeluaran || 0) > 0
      );

      const itemsForCase = caseSim.length > 0
        ? caseSim
        : generateAtkSimulationDeterministic({
            caseRecord: c,
            targetAmount: nominal,
            tanggalMasuk: regDate,
            tanggalSelesai: c.tanggalPutus || endDateStr
          });

      interface ExpenseItemPayload {
        uraian: string;
        jumlah: number;
        kelompok: string;
        timelineRatio: number;
      }

      let expensesToCredit: ExpenseItemPayload[] = [];

      if (modeRincian === 'item-detail') {
        expensesToCredit = itemsForCase.map((it, idx) => ({
          uraian: `Biaya Pembelian ATK Perkara No. ${c.nomorPerkara} berupa ${it.uraian}`,
          jumlah: it.pengeluaran,
          kelompok: categorizeAtkExpense(it.uraian, it.kategori),
          timelineRatio: idx / Math.max(1, itemsForCase.length - 1)
        }));
      } else {
        const groupMap: { [grp: string]: { total: number; count: number; items: string[] } } = {};
        itemsForCase.forEach(item => {
          const grp = categorizeAtkExpense(item.uraian, item.kategori);
          if (!groupMap[grp]) {
            groupMap[grp] = { total: 0, count: 0, items: [] };
          }
          groupMap[grp].total += item.pengeluaran;
          groupMap[grp].count += 1;
          groupMap[grp].items.push(item.uraian);
        });

        const sortedGroupKeys = Object.keys(groupMap).sort((a, b) => {
          const idxA = KELOMPOK_ORDER.indexOf(a);
          const idxB = KELOMPOK_ORDER.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });

        expensesToCredit = sortedGroupKeys.map((grpKey, idx, arr) => {
          const grp = groupMap[grpKey];
          let desc = '';
          switch (grpKey) {
            case 'Kertas':
              desc = 'Kertas HVS A4 & Stofmap Folio Pendaftaran';
              break;
            case 'Map & Sampul':
              desc = 'Cetak Map Sampul, Map Bundel A/B & Putusan';
              break;
            case 'Amplop':
              desc = 'Amplop Surat Panggilan Sidang & Pos Perkara';
              break;
            case 'Alat Jahit':
              desc = 'Jarum Jahit & Benang Jahit Bundel Berkas';
              break;
            case 'Alat Tulis':
              desc = 'Pulpen Sidang & Berita Acara Persidangan';
              break;
            case 'Tinta Printer':
              desc = 'Tinta Printer Epson & Refill Canon Berkas';
              break;
            case 'Catridge':
              desc = 'Keausan Catridge Printer Persidangan';
              break;
            case 'Klip & Staples':
              desc = 'Binder Clip & Klip Kertas Penjepit Berkas';
              break;
            case 'Arsip & Minutasi':
              desc = 'Lakban Jilid Minutasi & Sampul Putusan';
              break;
            default:
              desc = `Pengeluaran ${grpKey}`;
          }

          return {
            uraian: `Biaya Pembelian ATK Perkara No. ${c.nomorPerkara} berupa ${desc}`,
            jumlah: grp.total,
            kelompok: grpKey,
            timelineRatio: idx / Math.max(1, arr.length - 1)
          };
        });
      }

      expensesToCredit.forEach((exp, idx) => {
        let assignedDate = regDate;

        if (modeDistribusi === 'bertahap') {
          const parts = regDate.split('-');
          if (parts.length >= 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const startDay = parseInt(parts[2], 10) || 1;
            const maxDays = new Date(y, m, 0).getDate();
            let endDay = maxDays;

            if (c.tanggalPutus && c.tanggalPutus.startsWith(`${parts[0]}-${parts[1]}`)) {
              const putusDay = parseInt(c.tanggalPutus.split('-')[2], 10);
              if (putusDay >= startDay) {
                endDay = Math.min(putusDay, maxDays);
              }
            }

            const dayOffset = Math.round(exp.timelineRatio * (endDay - startDay));
            const finalDay = Math.min(endDay, Math.max(startDay, startDay + dayOffset));
            assignedDate = `${parts[0]}-${parts[1]}-${String(finalDay).padStart(2, '0')}`;
          }
        }

        intermediateEntries.push({
          rawDate: assignedDate,
          tanggal: formatTanggalIndo(assignedDate),
          nomorBk: '',
          kodeReferensi: '',
          uraian: exp.uraian,
          debit: 0,
          kredit: exp.jumlah,
          tipe: 'pengeluaran',
          kelompok: exp.kelompok,
          nomorPerkara: c.nomorPerkara,
          sortOrder: 2,
          subIndex: idx + 1
        });
      });
    });
  }

  // 3. Masukkan juga pengeluaran mandiri dalam simulasi yang tidak terikat perkara di atas (bila ada)
  const processedCaseNumbers = new Set(filteredCases.map(c => (c.nomorPerkara || '').trim().toLowerCase()));
  const extraSimulasi = simulasiAtkRecords.filter(s => {
    if (!s.tanggal) return false;
    const parts = s.tanggal.split('-');
    if (selectedYear !== 'all' && parts[0] !== selectedYear) return false;
    if (selectedMonth !== 'all' && parts[1] !== selectedMonth) return false;
    if ((s.pengeluaran || 0) <= 0) return false;
    const norm = (s.nomorPerkara || '').trim().toLowerCase();
    return !processedCaseNumbers.has(norm);
  });

  extraSimulasi.forEach((s, idx) => {
    intermediateEntries.push({
      rawDate: s.tanggal,
      tanggal: formatTanggalIndo(s.tanggal),
      nomorBk: '',
      kodeReferensi: '',
      uraian: s.uraian || `Pengeluaran ATK (${s.kategori})`,
      debit: 0,
      kredit: s.pengeluaran,
      tipe: 'pengeluaran',
      kelompok: categorizeAtkExpense(s.uraian, s.kategori),
      nomorPerkara: s.nomorPerkara,
      sortOrder: 2,
      subIndex: 50 + idx
    });
  });

  // 4. SUSUN URUTAN KRONOLOGIS SEMPURNA:
  // - Tanggal bertambah secara kronologis (YYYY-MM-DD)
  // - Pada tanggal yang sama: DEBIT DULUAN (sortOrder 1), KREDIT KEMUDIAN (sortOrder 2)
  // - Menjamin saldo tidak pernah minus!
  intermediateEntries.sort((a, b) => {
    const dateCmp = a.rawDate.localeCompare(b.rawDate);
    if (dateCmp !== 0) return dateCmp;

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    if (a.nomorPerkara && b.nomorPerkara && a.nomorPerkara !== b.nomorPerkara) {
      return a.nomorPerkara.localeCompare(b.nomorPerkara);
    }

    return (a.subIndex || 0) - (b.subIndex || 0);
  });

  // 5. Susun Baris Tabel Resmi (BkuLedgerRow) dengan Running Balance
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

  // Baris-baris Transaksi
  if (intermediateEntries.length === 0) {
    rows.push({
      id: 'bku-row-nihil',
      no: rowNumber++,
      tanggal: '-',
      rawDate: startDateStr || '2026-01-01',
      nomorBk: '',
      kodeReferensi: '',
      uraian: 'NIHIL',
      debit: 0,
      kredit: 0,
      saldo: runningBalance,
      tipe: 'pengeluaran',
      isBold: true
    });
  } else {
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
  }

  // Tanggal untuk Baris Sisa Saldo (akhir periode atau tanggal transaksi terakhir)
  const lastRawDate = intermediateEntries.length > 0 
    ? intermediateEntries[intermediateEntries.length - 1].rawDate 
    : (startDateStr || '2026-01-31');
  const tanggalSisaSaldo = formatTanggalIndo(lastRawDate);

  // Baris Sisa Saldo Periode
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
  const totalDebitOnly = intermediateEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalPengeluaran = intermediateEntries.reduce((sum, e) => sum + e.kredit, 0);
  const totalDebitWithSaldoAwal = saldoAwal + totalDebitOnly;

  // Rekapitulasi per kelompok ATK untuk ringkasan di atas tabel
  const rekapKelompok: { [kelompok: string]: { total: number; count: number; items: string[] } } = {};
  intermediateEntries.filter(e => e.kredit > 0).forEach(e => {
    const grp = e.kelompok || 'ATK Lainnya';
    if (!rekapKelompok[grp]) {
      rekapKelompok[grp] = { total: 0, count: 0, items: [] };
    }
    rekapKelompok[grp].total += e.kredit;
    rekapKelompok[grp].count += 1;
    rekapKelompok[grp].items.push(e.uraian);
  });

  return {
    rows,
    saldoAwal,
    totalPenerimaan: totalDebitWithSaldoAwal,
    totalPengeluaran,
    saldoAkhir: runningBalance,
    periodeLabel,
    rekapKelompok,
    modeDistribusi,
    modeRincian
  };
}

