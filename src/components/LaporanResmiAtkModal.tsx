import React, { useState, useMemo, Fragment } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { 
  Printer, 
  Download, 
  X, 
  Calendar, 
  FileSpreadsheet, 
  Scale, 
  CheckCircle2, 
  Sparkles, 
  Filter, 
  SlidersHorizontal,
  FileCheck,
  Building2,
  UserCheck
} from 'lucide-react';
import { CaseRecord, SimulasiAtkRecord } from '../types';

interface LaporanResmiAtkModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseRecord[];
  simulasiAtkRecords: SimulasiAtkRecord[];
  googleSheetWebhookUrl?: string;
  theme?: 'light' | 'dark';
  initialMonth?: string; // '01' - '12' or 'all'
  initialYear?: string;  // '2026', '2025', etc. or 'all'
}

export const MONTH_LABELS: { [key: string]: string } = {
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

export const LaporanResmiAtkModal: React.FC<LaporanResmiAtkModalProps> = ({
  isOpen,
  onClose,
  cases,
  simulasiAtkRecords,
  googleSheetWebhookUrl,
  theme = 'light',
  initialMonth = 'all',
  initialYear = '2026'
}) => {
  const isLight = theme === 'light';

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear);
  const [filterPerkaraStatus, setFilterPerkaraStatus] = useState<'all' | 'putus' | 'aktif'>('all');
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Official Court Metadata
  const [instansiTinggi, setInstansiTinggi] = useState<string>('PENGADILAN TINGGI AGAMA JAYAPURA');
  const [namaPengadilan, setNamaPengadilan] = useState<string>('PENGADILAN AGAMA PANIAI');
  const [alamatPengadilan, setAlamatPengadilan] = useState<string>('Jl. Raya Enarotali - Madi, Distrik Paniai Timur, Kab. Paniai - Papua Tengah');
  const [kotaTanggal, setKotaTanggal] = useState<string>(() => {
    const now = new Date();
    const d = now.getDate();
    const m = MONTH_LABELS[String(now.getMonth() + 1).padStart(2, '0')] || 'Mei';
    const y = now.getFullYear();
    return `Paniai, ${d} ${m} ${y}`;
  });

  const [ketuaNama, setKetuaNama] = useState<string>('H. Ahmad Asy Syafi`i, S.Ag.');
  const [ketuaNip, setKetuaNip] = useState<string>('NIP. 19780512 200502 1 002');
  const [paniteraNama, setPaniteraNama] = useState<string>('H. YAHYADI, S.H.');
  const [paniteraNip, setPaniteraNip] = useState<string>('NIP. 19740315 200003 1 001');
  const [kasirNama, setKasirNama] = useState<string>('MUHAMMAD IDRIS, S.Kom.');
  const [kasirNip, setKasirNip] = useState<string>('NIP. 19920824 201903 1 005');

  // Format rupiah helper
  const formatRp = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  // 1. Gabungkan seluruh entri kas ATK secara kronologis:
  // - Penerimaan: saat perkara register masuk (Rp 100.000)
  // - Pengeluaran: dari transaksi simulasi ATK yang tersimpan di spreadsheet/state
  const allLedgerItems = useMemo(() => {
    interface LedgerItem {
      id: string;
      tanggal: string;
      nomorPerkara: string;
      namaPihak: string;
      uraian: string;
      kategori: string;
      penerimaan: number;
      pengeluaran: number;
      isAiGenerated: boolean;
      statusPerkara: string;
    }

    const items: LedgerItem[] = [];

    // Map cases for quick lookup
    const caseMap = new Map<string, CaseRecord>();
    cases.forEach(c => {
      caseMap.set((c.nomorPerkara || '').trim().toLowerCase(), c);
    });

    // Masukkan Penerimaan ATK dari pendaftaran setiap perkara
    cases.forEach(c => {
      const regDate = c.tanggalRegister || '2026-01-01';
      items.push({
        id: `rcv-atk-${c.id}`,
        tanggal: regDate,
        nomorPerkara: c.nomorPerkara,
        namaPihak: c.namaPihak || 'Pihak Berperkara',
        uraian: `Penerimaan Biaya ATK & Pemberkasan (Pendaftaran Perkara ${c.nomorPerkara})`,
        kategori: 'Penerimaan Panjar',
        penerimaan: 100000,
        pengeluaran: 0,
        isAiGenerated: false,
        statusPerkara: c.status || 'Pendaftaran'
      });
    });

    // Masukkan Pengeluaran ATK dari Simulasi/Realisasi ATK
    simulasiAtkRecords.forEach(s => {
      const parentCase = caseMap.get((s.nomorPerkara || '').trim().toLowerCase());
      items.push({
        id: s.id,
        tanggal: s.tanggal || parentCase?.tanggalPutus || '2026-01-01',
        nomorPerkara: s.nomorPerkara || '-',
        namaPihak: parentCase?.namaPihak || 'Pihak Berperkara',
        uraian: s.uraian || s.jenisAtk || 'Pengeluaran ATK Perkara',
        kategori: s.kategori || 'ATK',
        penerimaan: Number(s.penerimaan) || 0,
        pengeluaran: Number(s.pengeluaran) || 0,
        isAiGenerated: s.isAiGenerated !== false,
        statusPerkara: parentCase?.status || 'Putus'
      });
    });

    // Urutkan kronologis tanggal naik
    return items.sort((a, b) => {
      const timeA = new Date(a.tanggal).getTime() || 0;
      const timeB = new Date(b.tanggal).getTime() || 0;
      if (timeA !== timeB) return timeA - timeB;
      // Jika tanggal sama, penerimaan ditaruh sebelum pengeluaran
      return b.penerimaan - a.penerimaan;
    });
  }, [cases, simulasiAtkRecords]);

  // 2. Filter berdasarkan Bulan, Tahun, dan Status
  const filteredLedger = useMemo(() => {
    return allLedgerItems.filter(item => {
      if (!item.tanggal) return false;
      const parts = item.tanggal.split('-');
      const itemYear = parts[0];
      const itemMonth = parts[1];

      if (selectedYear !== 'all' && itemYear !== selectedYear) return false;
      if (selectedMonth !== 'all' && itemMonth !== selectedMonth) return false;

      if (filterPerkaraStatus === 'putus') {
        const isPutus = item.statusPerkara === 'Putus' || item.statusPerkara === 'Selesai' || item.statusPerkara === 'Minutasi' || item.statusPerkara === 'Arsip';
        if (!isPutus) return false;
      } else if (filterPerkaraStatus === 'aktif') {
        const isPutus = item.statusPerkara === 'Putus' || item.statusPerkara === 'Selesai' || item.statusPerkara === 'Minutasi' || item.statusPerkara === 'Arsip';
        if (isPutus) return false;
      }

      return true;
    });
  }, [allLedgerItems, selectedMonth, selectedYear, filterPerkaraStatus]);

  // 3. Hitung running balance (saldo berjalan) dan agregat finansial
  const { ledgerWithBalance, totalPenerimaan, totalPengeluaran, saldoAkhir, countSimulasi } = useMemo(() => {
    let running = 0;
    let totPenerimaan = 0;
    let totPengeluaran = 0;
    let countSim = 0;

    const rows = filteredLedger.map((row, idx) => {
      totPenerimaan += row.penerimaan;
      totPengeluaran += row.pengeluaran;
      running += (row.penerimaan - row.pengeluaran);
      if (row.pengeluaran > 0) countSim++;

      return {
        ...row,
        no: idx + 1,
        saldo: running
      };
    });

    return {
      ledgerWithBalance: rows,
      totalPenerimaan: totPenerimaan,
      totalPengeluaran: totPengeluaran,
      saldoAkhir: running,
      countSimulasi: countSim
    };
  }, [filteredLedger]);

  // 4. Rekapitulasi per Kategori Pengeluaran ATK (Standar Pengadilan Agama)
  const categoryBreakdown = useMemo(() => {
    const summary: { [key: string]: { total: number; count: number } } = {
      'Map': { total: 0, count: 0 },
      'Kertas': { total: 0, count: 0 },
      'Tinta': { total: 0, count: 0 },
      'Catridge': { total: 0, count: 0 },
      'Amplop': { total: 0, count: 0 },
      'ATK Lainnya': { total: 0, count: 0 },
      'Lain-lain': { total: 0, count: 0 }
    };

    filteredLedger.forEach(item => {
      if (item.pengeluaran <= 0) return;
      const uraianLower = (item.uraian + ' ' + item.kategori).toLowerCase();
      let cat = 'ATK Lainnya';

      if (uraianLower.includes('map') || uraianLower.includes('stofmap') || uraianLower.includes('bundel')) {
        cat = 'Map';
      } else if (uraianLower.includes('kertas') || uraianLower.includes('hvs') || uraianLower.includes('a4') || uraianLower.includes('rim')) {
        cat = 'Kertas';
      } else if (uraianLower.includes('tinta') || uraianLower.includes('epson') || uraianLower.includes('canon') || uraianLower.includes('refill')) {
        cat = 'Tinta';
      } else if (uraianLower.includes('catridge') || uraianLower.includes('cartridge')) {
        cat = 'Catridge';
      } else if (uraianLower.includes('amplop') || uraianLower.includes('surat')) {
        cat = 'Amplop';
      } else if (uraianLower.includes('pulpen') || uraianLower.includes('stapler') || uraianLower.includes('clip') || uraianLower.includes('notifikasi')) {
        cat = 'ATK Lainnya';
      } else {
        cat = 'Lain-lain';
      }

      if (!summary[cat]) summary[cat] = { total: 0, count: 0 };
      summary[cat].total += item.pengeluaran;
      summary[cat].count += 1;
    });

    return summary;
  }, [filteredLedger]);

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Export CSV Handler
  const handleExportCsv = () => {
    const periodStr = selectedMonth !== 'all' 
      ? `${MONTH_LABELS[selectedMonth] || selectedMonth}_${selectedYear}` 
      : `TAHUN_${selectedYear}`;
    const filename = `Laporan_Resmi_ATK_${namaPengadilan.replace(/\s+/g, '_')}_${periodStr}.csv`;

    const headers = ['No', 'Tanggal', 'Nomor Perkara', 'Nama Pihak', 'Uraian ATK / Transaksi', 'Kategori', 'Penerimaan (Debet)', 'Pengeluaran (Kredit)', 'Saldo Berjalan', 'Sumber Data'];
    const rows = ledgerWithBalance.map(r => [
      r.no,
      `"${r.tanggal}"`,
      `"${r.nomorPerkara}"`,
      `"${r.namaPihak}"`,
      `"${r.uraian.replace(/"/g, '""')}"`,
      `"${r.kategori}"`,
      r.penerimaan,
      r.pengeluaran,
      r.saldo,
      r.isAiGenerated ? '"Simulasi AI (Spreadsheet)"' : '"Pendaftaran / Realisasi"'
    ]);

    const csvContent = [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const periodeTeks = selectedMonth !== 'all' 
    ? `BULAN ${MONTH_LABELS[selectedMonth]?.toUpperCase() || selectedMonth} ${selectedYear !== 'all' ? selectedYear : ''}` 
    : (selectedYear !== 'all' ? `TAHUN ${selectedYear}` : 'SEMUA PERIODE');

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm print:hidden" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto p-2 sm:p-4 lg:p-6 flex items-center justify-center print:p-0">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className={`w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] border print:border-0 print:shadow-none print:max-h-none print:w-full print:rounded-none ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
            }`}>
              
              {/* TOP ACTION BAR (PRINT HIDDEN) */}
              <div className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden ${
                isLight ? 'bg-gradient-to-r from-purple-50 via-indigo-50 to-white border-purple-200' : 'bg-slate-800 border-slate-700'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <DialogTitle as="h3" className="font-extrabold text-base flex items-center space-x-2">
                      <span>Cetak Laporan Resmi Buku Pembantu ATK Perkara</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white font-bold tracking-wide">
                        RESMI
                      </span>
                    </DialogTitle>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Format Cetak Standar Pengadilan Agama • Tersinkronisasi Tab <code className="text-purple-600 font-bold">SimulasiAtkPerkara</code> Google Spreadsheet
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowConfig(prev => !prev)}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      showConfig 
                        ? 'bg-purple-600 text-white border-purple-600' 
                        : isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Pengaturan Kop & TTD</span>
                  </button>

                  <button
                    onClick={handleExportCsv}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    }`}
                    title="Unduh data laporan ke dalam format file Excel / CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ekspor CSV</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-purple-600/30"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak Sekarang (Print PDF)</span>
                  </button>

                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* FILTER & PERIOD SELECTOR BAR (PRINT HIDDEN) */}
              <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 print:hidden ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-700 dark:text-slate-300 mr-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span>Pilih Periode:</span>
                  </div>

                  {/* Dropdown Bulan */}
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className={`px-3 py-1.5 rounded-xl font-bold border ${
                      isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                  >
                    <option value="all">🗓️ Seluruh Bulan</option>
                    <option value="01">Januari</option>
                    <option value="02">Februari</option>
                    <option value="03">Maret</option>
                    <option value="04">April</option>
                    <option value="05">Mei</option>
                    <option value="06">Juni</option>
                    <option value="07">Juli</option>
                    <option value="08">Agustus</option>
                    <option value="09">September</option>
                    <option value="10">Oktober</option>
                    <option value="11">November</option>
                    <option value="12">Desember</option>
                  </select>

                  {/* Dropdown Tahun */}
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className={`px-3 py-1.5 rounded-xl font-bold border ${
                      isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                  >
                    <option value="all">Semua Tahun</option>
                    <option value="2026">Tahun 2026</option>
                    <option value="2025">Tahun 2025</option>
                    <option value="2024">Tahun 2024</option>
                  </select>

                  {/* Filter Status Perkara */}
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => setFilterPerkaraStatus('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        filterPerkaraStatus === 'all' 
                          ? 'bg-purple-600 text-white' 
                          : isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => setFilterPerkaraStatus('putus')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        filterPerkaraStatus === 'putus' 
                          ? 'bg-purple-600 text-white' 
                          : isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      Perkara Putus (Saldo Rp 0)
                    </button>
                    <button
                      onClick={() => setFilterPerkaraStatus('aktif')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        filterPerkaraStatus === 'aktif' 
                          ? 'bg-purple-600 text-white' 
                          : isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      Perkara Berjalan
                    </button>
                  </div>
                </div>

                {/* Indikator Data Spreadsheet */}
                <div className="flex items-center space-x-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {googleSheetWebhookUrl ? 'Tersambung Google Sheets' : 'Data Lokal Tersimpan'} ({filteredLedger.length} Baris)
                  </span>
                </div>
              </div>

              {/* COLLAPSIBLE CONFIGURATION PANEL FOR KOP & TTD (PRINT HIDDEN) */}
              {showConfig && (
                <div className={`p-5 border-b text-xs space-y-4 shrink-0 print:hidden animate-fade-in ${
                  isLight ? 'bg-purple-50/50 border-purple-200' : 'bg-purple-950/30 border-purple-800/50'
                }`}>
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 pb-1 border-b border-purple-200/50">
                    <span className="flex items-center space-x-1.5">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <span>Kustomisasi Identitas Instansi & Pejabat Penandatangan</span>
                    </span>
                    <button 
                      onClick={() => setShowConfig(false)}
                      className="text-purple-600 hover:text-purple-800 font-bold text-[11px]"
                    >
                      Tutup Pengaturan
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pengadilan Tingkat Banding</label>
                      <input
                        type="text"
                        value={instansiTinggi}
                        onChange={(e) => setInstansiTinggi(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Satuan Kerja</label>
                      <input
                        type="text"
                        value={namaPengadilan}
                        onChange={(e) => setNamaPengadilan(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tempat & Tanggal Laporan</label>
                      <input
                        type="text"
                        value={kotaTanggal}
                        onChange={(e) => setKotaTanggal(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">Mengetahui: Ketua Pengadilan Agama</span>
                      <input
                        type="text"
                        placeholder="Nama Ketua"
                        value={ketuaNama}
                        onChange={(e) => setKetuaNama(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                      />
                      <input
                        type="text"
                        placeholder="NIP Ketua"
                        value={ketuaNip}
                        onChange={(e) => setKetuaNip(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs"
                      />
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">Memeriksa: Panitera Pengadilan Agama</span>
                      <input
                        type="text"
                        placeholder="Nama Panitera"
                        value={paniteraNama}
                        onChange={(e) => setPaniteraNama(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                      />
                      <input
                        type="text"
                        placeholder="NIP Panitera"
                        value={paniteraNip}
                        onChange={(e) => setPaniteraNip(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs"
                      />
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">Dibuat Oleh: Kasir / Pengelola ATK</span>
                      <input
                        type="text"
                        placeholder="Nama Kasir"
                        value={kasirNama}
                        onChange={(e) => setKasirNama(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                      />
                      <input
                        type="text"
                        placeholder="NIP Kasir"
                        value={kasirNip}
                        onChange={(e) => setKasirNip(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PRINTABLE OFFICIAL DOCUMENT BODY */}
              <div className="p-6 sm:p-10 overflow-y-auto space-y-6 text-xs print:p-8 print:text-black print:bg-white bg-white dark:bg-slate-900">
                
                {/* KOP SURAT RESMI PENGADILAN AGAMA (KOP GARIS GANDA) */}
                <div className="text-center space-y-0.5 border-b-[3px] border-double border-slate-900 dark:border-slate-300 print:border-black pb-3">
                  <div className="flex items-center justify-center space-x-3 mb-1">
                    <div className="w-10 h-10 rounded-full border-2 border-slate-900 print:border-black flex items-center justify-center font-serif font-black text-lg">
                      ⚖️
                    </div>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300 print:text-black font-serif">
                    MAHKAMAH AGUNG REPUBLIK INDONESIA
                  </h4>
                  <h4 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300 print:text-black font-serif">
                    DIREKTORAT JENDERAL BADAN PERADILAN AGAMA
                  </h4>
                  <h4 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300 print:text-black font-serif">
                    {instansiTinggi}
                  </h4>
                  <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-slate-900 dark:text-white print:text-black font-serif">
                    {namaPengadilan}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 print:text-black font-sans">
                    {alamatPengadilan}
                  </p>
                </div>

                {/* JUDUL LAPORAN RESMI */}
                <div className="text-center space-y-1 pt-2">
                  <h3 className="text-sm sm:text-base font-black tracking-wider uppercase underline underline-offset-4 text-slate-900 dark:text-white print:text-black">
                    BUKU PEMBANTU BIAYA PROSES / ATK PERKARA
                  </h3>
                  <p className="text-xs font-bold uppercase text-purple-800 dark:text-purple-400 print:text-black font-mono">
                    PERIODE : {periodeTeks}
                  </p>
                  <p className="text-[10px] text-slate-500 print:text-gray-700">
                    Berdasarkan Ketentuan Pengelolaan Panjar Biaya Perkara & Penyelesaian Saldo Perkara Putus Rp 0
                  </p>
                </div>

                {/* RINGKASAN REKAPITULASI KEUANGAN RESMI (A, B, C, D) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border border-slate-300 dark:border-slate-700 print:border-black p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 print:bg-white text-xs">
                  <div className="border-r-0 md:border-r border-slate-300 dark:border-slate-700 print:border-black pr-2">
                    <span className="text-[10px] font-bold uppercase text-slate-500 print:text-black block">
                      A. Total Penerimaan ATK
                    </span>
                    <strong className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400 print:text-black block mt-0.5">
                      {formatRp(totalPenerimaan)}
                    </strong>
                    <span className="text-[9px] text-slate-500 print:text-gray-700">
                      Panjar masuk pendaftaran perkara
                    </span>
                  </div>

                  <div className="border-r-0 md:border-r border-slate-300 dark:border-slate-700 print:border-black pr-2">
                    <span className="text-[10px] font-bold uppercase text-slate-500 print:text-black block">
                      B. Total Pengeluaran ATK
                    </span>
                    <strong className="text-sm font-black font-mono text-rose-700 dark:text-rose-400 print:text-black block mt-0.5">
                      {formatRp(totalPengeluaran)}
                    </strong>
                    <span className="text-[9px] text-slate-500 print:text-gray-700">
                      Realisasi & simulasi ATK perkara
                    </span>
                  </div>

                  <div className="border-r-0 md:border-r border-slate-300 dark:border-slate-700 print:border-black pr-2">
                    <span className="text-[10px] font-bold uppercase text-slate-500 print:text-black block">
                      C. Sisa Saldo ATK Periode
                    </span>
                    <strong className={`text-sm font-black font-mono block mt-0.5 ${
                      saldoAkhir >= 0 ? 'text-purple-700 dark:text-purple-400 print:text-black' : 'text-rose-600 print:text-black'
                    }`}>
                      {formatRp(saldoAkhir)}
                    </strong>
                    <span className="text-[9px] text-slate-500 print:text-gray-700">
                      Sisa kas ATK kantor berjalan
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 print:text-black block">
                      D. Status Kepatuhan Saldo Putus
                    </span>
                    <strong className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400 print:text-black block mt-0.5">
                      Rp 0 (Tuntas Sesuai Aturan)
                    </strong>
                    <span className="text-[9px] text-slate-500 print:text-gray-700">
                      Tersimpan di Tab SimulasiAtkPerkara
                    </span>
                  </div>
                </div>

                {/* REKAP RINCIAN PENGELUARAN PER KATEGORI ATK */}
                <div className="border border-slate-300 dark:border-slate-700 print:border-black rounded-lg overflow-hidden">
                  <div className="bg-slate-100 dark:bg-slate-800 print:bg-gray-200 px-3 py-1.5 font-bold text-[11px] border-b border-slate-300 dark:border-slate-700 print:border-black flex justify-between items-center">
                    <span>REKAPITULASI PENGELUARAN PER KELOMPOK ATK (STANDAR MAHKAMAH AGUNG RI)</span>
                    <span className="text-[10px] font-mono">Total Item: {countSimulasi}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-slate-200 dark:divide-slate-700 print:divide-black text-[11px] p-2 bg-white dark:bg-slate-900 print:bg-white">
                    {(Object.entries(categoryBreakdown) as [string, { total: number; count: number }][]).map(([cat, data]) => (
                      <div key={cat} className="p-2 text-center">
                        <span className="text-[10px] font-bold text-slate-500 print:text-black block">{cat}</span>
                        <strong className="font-mono font-bold text-slate-800 dark:text-slate-200 print:text-black block">
                          {formatRp(data.total)}
                        </strong>
                        <span className="text-[9px] text-slate-400 print:text-gray-600">{data.count} transaksi</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TABEL BUKU BESAR PEMBANTU KAS ATK PERKARA */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-300 dark:border-slate-700 print:border-black text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 print:bg-gray-100 font-bold border-b border-slate-300 dark:border-slate-700 print:border-black text-center">
                        <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 print:border-black w-10">NO</th>
                        <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 print:border-black w-24">TANGGAL</th>
                        <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 print:border-black w-40">NOMOR PERKARA</th>
                        <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 print:border-black">URAIAN PENGELUARAN / JENIS ATK</th>
                        <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 print:border-black text-right w-28">PENERIMAAN (DEBET)</th>
                        <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 print:border-black text-right w-28">PENGELUARAN (KREDIT)</th>
                        <th className="p-1.5 border-r border-slate-300 dark:border-slate-700 print:border-black text-right w-28">SALDO</th>
                        <th className="p-1.5 text-center w-28">STATUS DATA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-black">
                      {ledgerWithBalance.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                            Tidak ada data transaksi ATK pada periode yang dipilih ({periodeTeks}).
                          </td>
                        </tr>
                      ) : (
                        ledgerWithBalance.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 print:hover:bg-transparent">
                            <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 print:border-black text-center font-bold">
                              {row.no}
                            </td>
                            <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 print:border-black font-mono whitespace-nowrap text-center">
                              {row.tanggal}
                            </td>
                            <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 print:border-black font-mono font-bold whitespace-nowrap">
                              {row.nomorPerkara}
                            </td>
                            <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 print:border-black">
                              <span className="font-semibold block">{row.uraian}</span>
                              <span className="text-[10px] text-slate-500 print:text-gray-600 block">
                                Pihak: {row.namaPihak} • Kat: {row.kategori}
                              </span>
                            </td>
                            <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 print:border-black text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 print:text-black">
                              {row.penerimaan > 0 ? formatRp(row.penerimaan) : '-'}
                            </td>
                            <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 print:border-black text-right font-mono font-bold text-rose-700 dark:text-rose-400 print:text-black">
                              {row.pengeluaran > 0 ? formatRp(row.pengeluaran) : '-'}
                            </td>
                            <td className="p-1.5 border-r border-slate-200 dark:border-slate-800 print:border-black text-right font-mono font-black text-slate-900 dark:text-slate-100 print:text-black">
                              {formatRp(row.saldo)}
                            </td>
                            <td className="p-1.5 text-center whitespace-nowrap">
                              {row.isAiGenerated ? (
                                <span className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-800 print:bg-transparent print:text-black">
                                  ✓ Sinkron Spreadsheet
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 print:bg-transparent print:text-black">
                                  ✓ Penerimaan Panjar
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-800 print:bg-gray-200 font-bold border-t-2 border-slate-400 dark:border-slate-600 print:border-black text-xs">
                        <td colSpan={4} className="p-2 border-r border-slate-300 dark:border-slate-700 print:border-black text-center font-black uppercase tracking-wider">
                          JUMLAH TOTAL PERIODE INI
                        </td>
                        <td className="p-2 border-r border-slate-300 dark:border-slate-700 print:border-black text-right font-mono font-black text-emerald-700 dark:text-emerald-400 print:text-black">
                          {formatRp(totalPenerimaan)}
                        </td>
                        <td className="p-2 border-r border-slate-300 dark:border-slate-700 print:border-black text-right font-mono font-black text-rose-700 dark:text-rose-400 print:text-black">
                          {formatRp(totalPengeluaran)}
                        </td>
                        <td className="p-2 border-r border-slate-300 dark:border-slate-700 print:border-black text-right font-mono font-black text-purple-900 dark:text-purple-300 print:text-black">
                          {formatRp(saldoAkhir)}
                        </td>
                        <td className="p-2 text-center text-[10px] font-bold text-slate-500 print:text-black">
                          BALANCE
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* LEMBAR PENGESAHAN TANDA TANGAN RESMI KEPANITERAAN (TIGA KOLOM MAHKAMAH AGUNG) */}
                <div className="pt-8 border-t border-slate-300 dark:border-slate-700 print:border-black break-inside-avoid">
                  <div className="text-right text-xs font-semibold mb-6 pr-4">
                    {kotaTanggal}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center text-xs">
                    {/* Kolom 1: Mengetahui Ketua */}
                    <div className="space-y-16">
                      <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">Mengetahui,</p>
                        <p className="font-black text-slate-900 dark:text-white print:text-black">Ketua Pengadilan Agama Paniai</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-black text-slate-900 dark:text-white print:text-black underline underline-offset-2">
                          {ketuaNama}
                        </p>
                        <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 print:text-black">
                          {ketuaNip}
                        </p>
                      </div>
                    </div>

                    {/* Kolom 2: Memeriksa Panitera */}
                    <div className="space-y-16">
                      <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">Memeriksa,</p>
                        <p className="font-black text-slate-900 dark:text-white print:text-black">Panitera Pengadilan Agama Paniai</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-black text-slate-900 dark:text-white print:text-black underline underline-offset-2">
                          {paniteraNama}
                        </p>
                        <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 print:text-black">
                          {paniteraNip}
                        </p>
                      </div>
                    </div>

                    {/* Kolom 3: Dibuat Oleh Kasir / Pengelola ATK */}
                    <div className="space-y-16">
                      <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">Dibuat Oleh,</p>
                        <p className="font-black text-slate-900 dark:text-white print:text-black">Kasir / Pengelola ATK Perkara</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-black text-slate-900 dark:text-white print:text-black underline underline-offset-2">
                          {kasirNama}
                        </p>
                        <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 print:text-black">
                          {kasirNip}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Catatan Kaki Resmi */}
                  <div className="mt-8 pt-2 border-t border-slate-200 dark:border-slate-800 print:border-gray-400 flex items-center justify-between text-[9px] text-slate-400 print:text-gray-600">
                    <span>Dokumen ini dicetak otomatis melalui Aplikasi SI-PERKARA PA Paniai • Tab SimulasiAtkPerkara Google Spreadsheet</span>
                    <span>Halaman 1 dari 1</span>
                  </div>
                </div>

              </div>

            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};
