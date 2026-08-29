import React, { useState, useMemo } from 'react';
import { BiayaProsesRecord, CaseRecord } from '../types';
import { Lipa7aReportModal } from './Lipa7aReportModal';
import { 
  Printer, 
  PlusCircle, 
  Scissors, 
  Search, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  BookOpen, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar,
  FileText,
  AlertTriangle,
  Zap,
  Table,
  Smartphone,
  Download,
  Copy,
  CheckCircle,
  Clock,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { SyncSettings } from '../types';

interface BukuBiayaProsesProps {
  records: BiayaProsesRecord[];
  cases: CaseRecord[];
  onAddRecord: (record: Omit<BiayaProsesRecord, 'id' | 'createdAt'>) => void;
  onUpdateRecord: (record: BiayaProsesRecord) => void;
  onDeleteRecord: (id: string) => void;
  onPotongAtkPerkara: (caseNumber: string, amount: number, uraian: string, tanggal: string) => void;
  onZeroOutCaseBalance?: (caseNumber: string, generatedItems: { uraian: string; amount: number; kategori: 'ATK' | 'Proses' | 'Meterai' | 'Redaksi' | 'Panggilan' | 'Lainnya' }[]) => void;
  onSyncSpreadsheet?: () => void;
  syncSettings?: SyncSettings;
  theme?: 'light' | 'dark';
}

export const MONTH_NAMES = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

export const STANDARD_URAIAN_OPTIONS = [
  { label: 'Pemotongan Panjar ATK Pendaftaran Perkara', jenis: 'penerimaan', kategori: 'ATK' },
  { label: 'Pemotongan Biaya Proses / Pengelolaan ATK Perkara', jenis: 'penerimaan', kategori: 'Proses' },
  { label: 'Pengadaan Kertas HVS A4/F4 Berkas Perkara', jenis: 'pengeluaran', kategori: 'ATK' },
  { label: 'Pengadaan Stopmap & Map Perkara', jenis: 'pengeluaran', kategori: 'ATK' },
  { label: 'Pengadaan Tinta Printer Berkas Perkara', jenis: 'pengeluaran', kategori: 'ATK' },
  { label: 'Pengadaan Ballpoint, Pensil & Tipe-X', jenis: 'pengeluaran', kategori: 'ATK' },
  { label: 'Pengadaan Stapler, Isi Staples & Paper Clip', jenis: 'pengeluaran', kategori: 'ATK' },
  { label: 'Biaya Panggilan / Relaas Sidang Pertama (e-Summons / Pos)', jenis: 'pengeluaran', kategori: 'Panggilan' },
  { label: 'Biaya Pemberitahuan Isi Putusan / Penetapan', jenis: 'pengeluaran', kategori: 'Panggilan' },
  { label: 'Pembelian Meterai Tempel Putusan & Penetapan', jenis: 'pengeluaran', kategori: 'Meterai' },
  { label: 'Biaya Redaksi Putusan / Penetapan Perkara', jenis: 'pengeluaran', kategori: 'Redaksi' },
  { label: 'Biaya Pengiriman Surat / Dokumen Perkara via PT Pos', jenis: 'pengeluaran', kategori: 'Proses' },
  { label: 'Pengembalian Sisa Panjar Perkara ke Pihak', jenis: 'pengeluaran', kategori: 'Proses' },
  { label: 'Setoran PNBP Biaya Pendaftaran & Redaksi ke Kas Negara', jenis: 'pengeluaran', kategori: 'Proses' },
];

export const BukuBiayaProses: React.FC<BukuBiayaProsesProps> = ({
  records,
  cases,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  onPotongAtkPerkara,
  onZeroOutCaseBalance,
  onSyncSpreadsheet,
  syncSettings,
  theme = 'light'
}) => {
  const isLight = theme === 'light';

  // Dynamic Current Month & Year
  const currentMonthIdx = new Date().getMonth();
  const currentMonthName = MONTH_NAMES[currentMonthIdx] || 'JANUARI';
  const currentYearStr = new Date().getFullYear().toString();

  // Initialize selectedMonth with saved preference or default to Current Month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('buku_biaya_default_filter_mode');
      if (saved === 'ALL') return 'ALL';
      if (saved && MONTH_NAMES.includes(saved)) return saved;
    } catch (e) {
      // ignore
    }
    return currentMonthName;
  });

  const [selectedYear, setSelectedYear] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('buku_biaya_default_year');
      if (saved) return saved;
    } catch (e) {
      // ignore
    }
    return currentYearStr;
  });

  const handleSelectMonth = (month: string) => {
    setSelectedMonth(month);
    try {
      localStorage.setItem('buku_biaya_default_filter_mode', month);
    } catch (e) {
      // ignore
    }
  };

  const handleSelectYear = (year: string) => {
    setSelectedYear(year);
    try {
      localStorage.setItem('buku_biaya_default_year', year);
    } catch (e) {
      // ignore
    }
  };

  const [searchQuery, setSearchQuery] = useState<string>('');

  // View Mode: otomatis 'mobile' pada layar HP (< 768px), atau switchable 'table'
  const [viewMode, setViewMode] = useState<'mobile' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'mobile' : 'table';
    }
    return 'table';
  });
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isPrintJurnalModalOpen, setIsPrintJurnalModalOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isAtkModalOpen, setIsAtkModalOpen] = useState<boolean>(false);
  const [isLipa7aOpen, setIsLipa7aOpen] = useState<boolean>(false);

  // States for Auto-Zeroing Saldo Perkara Modal
  const [isZeroingModalOpen, setIsZeroingModalOpen] = useState<boolean>(false);
  const [selectedZeroingCase, setSelectedZeroingCase] = useState<CaseRecord | null>(null);
  const [zeroingItems, setZeroingItems] = useState<{ uraian: string; amount: number; kategori: 'ATK' | 'Proses' | 'Meterai' | 'Redaksi' | 'Panggilan' | 'Lainnya' }[]>([]);

  // Form states for manual entry
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTanggal, setFormTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formNomorPerkara, setFormNomorPerkara] = useState<string>('');
  const [formUraian, setFormUraian] = useState<string>('');
  const [formJenis, setFormJenis] = useState<'penerimaan' | 'pengeluaran'>('penerimaan');
  const [formJumlah, setFormJumlah] = useState<number>(100000);
  const [formKeterangan, setFormKeterangan] = useState<string>('-');
  const [formKategori, setFormKategori] = useState<'ATK' | 'Proses' | 'Meterai' | 'Redaksi' | 'Panggilan' | 'Lainnya'>('ATK');

  // Kas Minus Modal State
  const [isKasMinusModalOpen, setIsKasMinusModalOpen] = useState(false);
  const [selectedKasMonth, setSelectedKasMonth] = useState<string | null>(null);

  // Monthly breakdown calculation for Kas Akumulasi
  const monthlyKasBreakdown = useMemo(() => {
    const months = [
      { num: '01', name: 'Januari' },
      { num: '02', name: 'Februari' },
      { num: '03', name: 'Maret' },
      { num: '04', name: 'April' },
      { num: '05', name: 'Mei' },
      { num: '06', name: 'Juni' },
      { num: '07', name: 'Juli' },
      { num: '08', name: 'Agustus' },
      { num: '09', name: 'September' },
      { num: '10', name: 'Oktober' },
      { num: '11', name: 'November' },
      { num: '12', name: 'Desember' }
    ];

    let runningCumulative = 0;
    return months.map(m => {
      const monthRecords = records.filter(r => {
        if (!r.tanggal) return false;
        const [yr, mo] = r.tanggal.split('-');
        if (selectedYear !== 'ALL' && yr !== selectedYear) return false;
        return mo === m.num;
      });

      const penerimaan = monthRecords.reduce((s, r) => s + (r.penerimaan || 0), 0);
      const pengeluaran = monthRecords.reduce((s, r) => s + (r.pengeluaran || 0), 0);
      const netMonth = penerimaan - pengeluaran;
      runningCumulative += netMonth;

      return {
        monthNum: m.num,
        monthName: m.name,
        penerimaan,
        pengeluaran,
        netMonth,
        runningCumulative,
        isMinus: netMonth < 0 || runningCumulative < 0,
        records: monthRecords
      };
    });
  }, [records, selectedYear]);

  // Form states for ATK deduction
  const [atkCaseNumber, setAtkCaseNumber] = useState<string>(cases[0]?.nomorPerkara || '');
  const [atkAmount, setAtkAmount] = useState<number>(100000);
  const [atkTanggal, setAtkTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [atkUraian, setAtkUraian] = useState<string>('Pemotongan Panjar ATK Pendaftaran Perkara');

  // Calculation for cases with non-zero balance & deadline check
  const pendingCasesWithBalance = useMemo(() => {
    const now = new Date();
    return cases.map(c => {
      if (!c.saldoPerkara || c.saldoPerkara <= 0) return null;
      
      const regDate = new Date(c.tanggalRegister || now);
      const isPutus = ['Putus', 'Minutasi', 'Selesai', 'Arsip'].includes(c.status);
      
      let maxMonths = 5; // Default Tingkat Pertama (5 bulan)
      let refDate = regDate;

      if (c.tingkatPerkara === 'Tingkat Banding') {
        maxMonths = 3; // Banding (3 bulan)
      } else if (c.tingkatPerkara === 'Kasasi / PK') {
        maxMonths = 3; // Kasasi / PK (3 bulan dari tanggal terima kasasi)
        if (c.tanggalTerimaKasasiPk) {
          refDate = new Date(c.tanggalTerimaKasasiPk);
        }
      }

      const monthsElapsed = (now.getFullYear() - refDate.getFullYear()) * 12 + (now.getMonth() - refDate.getMonth());
      const isOverdue = monthsElapsed >= maxMonths || isPutus;

      return {
        ...c,
        monthsElapsed,
        maxMonths,
        isOverdue,
        isPutus
      };
    }).filter((c): c is NonNullable<typeof c> => c !== null);
  }, [cases]);

  // Open Zeroing Generator Modal
  const handleOpenZeroingModal = (c: CaseRecord) => {
    setSelectedZeroingCase(c);
    const S = c.saldoPerkara;
    
    // Auto-generate realistic case needs items summing exactly to S
    if (S <= 0) return;

    if (S >= 100000) {
      const kertasAmt = 45000;
      const tintaAmt = 35000;
      const posAmt = S - kertasAmt - tintaAmt;

      setZeroingItems([
        { uraian: `Pembelian Kertas HVS A4 80gr & Stopmap Snelhecter (${c.nomorPerkara})`, amount: kertasAmt, kategori: 'ATK' },
        { uraian: `Pengadaan Tinta Printer & Alat Tulis Pemberkasan Putusan`, amount: tintaAmt, kategori: 'ATK' },
        { uraian: `Biaya Pengiriman Surat Relaas / Dokumen Putusan via PT Pos`, amount: posAmt > 0 ? posAmt : 20000, kategori: 'Proses' }
      ]);
    } else if (S >= 50000) {
      const kertasAmt = 30000;
      const posAmt = S - kertasAmt;

      setZeroingItems([
        { uraian: `Pembelian Kertas HVS F4 & Map Snelhecter Berkas Perkara`, amount: kertasAmt, kategori: 'ATK' },
        { uraian: `Biaya Pengiriman Dokumen / PBT Putusan via PT Pos`, amount: posAmt, kategori: 'Proses' }
      ]);
    } else {
      setZeroingItems([
        { uraian: `Pembelian ATK & Pembungkus Berkas Putusan (${c.nomorPerkara})`, amount: S, kategori: 'ATK' }
      ]);
    }

    setIsZeroingModalOpen(true);
  };

  // Submit Zeroing
  const handleConfirmZeroing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZeroingCase || zeroingItems.length === 0) return;

    if (onZeroOutCaseBalance) {
      onZeroOutCaseBalance(selectedZeroingCase.nomorPerkara, zeroingItems);
    } else {
      // Fallback manual records creation
      const today = new Date().toISOString().split('T')[0];
      zeroingItems.forEach(item => {
        onAddRecord({
          tanggal: today,
          nomorPerkara: selectedZeroingCase.nomorPerkara,
          uraian: item.uraian,
          penerimaan: 0,
          pengeluaran: item.amount,
          keterangan: 'Auto-Zeroing Saldo Putus',
          kategori: item.kategori
        });
      });
    }

    setIsZeroingModalOpen(false);
  };

  // Filter records by Month & Year & Search
  const filteredRecords = useMemo(() => {
    return records.filter(item => {
      const [yr, mo] = item.tanggal.split('-');
      const monthIdx = parseInt(mo, 10) - 1;
      const monthName = MONTH_NAMES[monthIdx];

      if (selectedYear !== 'ALL' && yr !== selectedYear) return false;
      if (selectedMonth !== 'ALL' && monthName !== selectedMonth) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNo = item.nomorPerkara.toLowerCase().includes(q);
        const matchUraian = item.uraian.toLowerCase().includes(q);
        const matchKet = (item.keterangan || '').toLowerCase().includes(q);
        if (!matchNo && !matchUraian && !matchKet) return false;
      }

      return true;
    }).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  }, [records, selectedMonth, selectedYear, searchQuery]);

  // Summaries
  const totalPenerimaan = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (r.penerimaan || 0), 0);
  }, [filteredRecords]);

  const totalPengeluaran = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (r.pengeluaran || 0), 0);
  }, [filteredRecords]);

  const saldoBiayaProses = totalPenerimaan - totalPengeluaran;

  // Check whether there is ATK income entering Buku Bantu for the selected month/period
  const hasAtkIncomeForMonth = useMemo(() => {
    const activeRecords = selectedMonth === 'ALL' ? records : filteredRecords;
    return activeRecords.some(r => (r.penerimaan || 0) > 0);
  }, [records, filteredRecords, selectedMonth]);

  // Cumulative all-time balance up to selected month
  const totalAllTimePenerimaan = useMemo(() => records.reduce((s, r) => s + (r.penerimaan || 0), 0), [records]);
  const totalAllTimePengeluaran = useMemo(() => records.reduce((s, r) => s + (r.pengeluaran || 0), 0), [records]);
  const saldoAkumulasi = totalAllTimePenerimaan - totalAllTimePengeluaran;

  // Calculate ATK process balance per case number (Nomor Perkara)
  const atkBalanceByCase = useMemo(() => {
    const map: Record<string, { penerimaan: number; pengeluaran: number; saldo: number }> = {};
    records.forEach(r => {
      const no = (r.nomorPerkara || '').trim();
      if (!no || no === '-') return;
      if (!map[no]) {
        map[no] = { penerimaan: 0, pengeluaran: 0, saldo: 0 };
      }
      map[no].penerimaan += r.penerimaan || 0;
      map[no].pengeluaran += r.pengeluaran || 0;
      map[no].saldo = map[no].penerimaan - map[no].pengeluaran;
    });
    return map;
  }, [records]);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handleOpenAddModal = (existingRecord?: BiayaProsesRecord) => {
    if (existingRecord) {
      setEditingId(existingRecord.id);
      setFormTanggal(existingRecord.tanggal);
      setFormNomorPerkara(existingRecord.nomorPerkara);
      setFormUraian(existingRecord.uraian);
      if (existingRecord.penerimaan > 0) {
        setFormJenis('penerimaan');
        setFormJumlah(existingRecord.penerimaan);
      } else {
        setFormJenis('pengeluaran');
        setFormJumlah(existingRecord.pengeluaran);
      }
      setFormKeterangan(existingRecord.keterangan || '-');
      setFormKategori(existingRecord.kategori || 'ATK');
    } else {
      setEditingId(null);
      setFormTanggal(new Date().toISOString().split('T')[0]);
      setFormNomorPerkara('');
      setFormUraian('');
      setFormJenis('penerimaan');
      setFormJumlah(100000);
      setFormKeterangan('-');
      setFormKategori('ATK');
    }
    setIsAddModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUraian) return;

    if (editingId) {
      onUpdateRecord({
        id: editingId,
        tanggal: formTanggal,
        nomorPerkara: formNomorPerkara || '-',
        uraian: formUraian,
        penerimaan: formJenis === 'penerimaan' ? formJumlah : 0,
        pengeluaran: formJenis === 'pengeluaran' ? formJumlah : 0,
        keterangan: formKeterangan,
        kategori: formKategori,
        createdAt: new Date().toISOString()
      });
    } else {
      onAddRecord({
        tanggal: formTanggal,
        nomorPerkara: formNomorPerkara || '-',
        uraian: formUraian,
        penerimaan: formJenis === 'penerimaan' ? formJumlah : 0,
        pengeluaran: formJenis === 'pengeluaran' ? formJumlah : 0,
        keterangan: formKeterangan,
        kategori: formKategori
      });
    }

    setIsAddModalOpen(false);
  };

  const handleConfirmAtkDeduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!atkCaseNumber) return;

    onPotongAtkPerkara(
      atkCaseNumber,
      atkAmount,
      atkUraian || `Pemotongan Panjar ATK Perkara ${atkCaseNumber}`,
      atkTanggal
    );

    setIsAtkModalOpen(false);
  };

  const handlePrintTrigger = () => {
    setIsPrintModalOpen(true);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Pad printable table rows to at least 13 rows for standard register appearance
  const printRows = useMemo(() => {
    const rows = [...filteredRecords];
    const minRows = 13;
    const missing = minRows - rows.length;
    return { rows, missingCount: missing > 0 ? missing : 0 };
  }, [filteredRecords]);

  return (
    <div className="space-y-6 w-full">
      
      {/* HEADER TITLE & QUICK TOOLS */}
      <div className={`border rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 shadow-xl'
      }`}>
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-500/30">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className={`text-lg font-extrabold tracking-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                Buku Bantu Biaya Proses
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-950 text-amber-400 border-amber-800'
              }`}>
                PA Paniai 2026
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Pencatatan log transaksi penerimaan pemotongan ATK perkara dan pengeluaran biaya proses serta rekap bulanan cetak resmi.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Sync / Force Reload Button */}
          {onSyncSpreadsheet && (
            <button
              id="sync-spreadsheet-buku-btn"
              onClick={onSyncSpreadsheet}
              className={`flex items-center space-x-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all ${
                isLight
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-emerald-800/60'
              }`}
              title="Muat ulang dan sinkronkan data langsung dari Google Spreadsheet"
            >
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              <span>Muat dari Spreadsheet</span>
            </button>
          )}

          {/* Add Manual Transaction */}
          <button
            id="add-biaya-proses-btn"
            onClick={() => handleOpenAddModal()}
            className={`flex items-center space-x-1.5 px-3.5 py-2 border rounded-xl text-xs font-bold transition-all ${
              isLight 
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200' 
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-800/60'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Log Transaksi</span>
          </button>

          {/* Print Jurnal Biaya Button */}
          <button
            id="print-jurnal-biaya-btn"
            onClick={() => setIsPrintJurnalModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 border border-indigo-500/40"
            title="Cetak Tabel Log Jurnal Biaya SKUM Perkara"
          >
            <Printer className="w-4 h-4 text-indigo-200" />
            <span>Cetak Tabel Jurnal Biaya</span>
          </button>

          {/* Print Button */}
          <button
            id="print-buku-bantu-btn"
            onClick={handlePrintTrigger}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekap Bulanan</span>
          </button>
        </div>
      </div>

      {/* SYNC STATUS BANNER */}
      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
        isLight ? 'bg-blue-50/80 border-blue-200 text-blue-900' : 'bg-slate-900/90 border-slate-800 text-slate-300'
      }`}>
        <div className="flex items-center space-x-2.5">
          <RefreshCw className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <p className="font-semibold text-xs">
              Mekanisme Sinkronisasi Google Sheets & Memori Aplikasi:
            </p>
            <p className="text-[11px] opacity-80 mt-0.5">
              1) <strong>Membaca Data:</strong> Tombol <span className="font-bold">"Muat dari Spreadsheet"</span> akan langsung memperbarui tabel di aplikasi dari Google Sheets publik (tab LogTransaksi / CSV).
              <br />
              2) <strong>Menulis Data:</strong> Agar perubahan nilai (misal penerimaan Februari) di aplikasi otomatis terkirim kembali ke Google Sheets, pastikan <span className="font-bold">Webhook Apps Script</span> telah terpasang di menu Sinkronisasi.
            </p>
          </div>
        </div>
        {onSyncSpreadsheet && (
          <button
            onClick={onSyncSpreadsheet}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-xs"
          >
            Muat Ulang Sekarang
          </button>
        )}
      </div>

      {/* ALERT BANNER: PENGINGAT PERKARA PUTUS/KADALUARSA DENGAN SALDO SISA */}
      {pendingCasesWithBalance.length > 0 && (
        <div className={`border rounded-2xl p-4 sm:p-5 shadow-sm transition-colors ${
          hasAtkIncomeForMonth 
            ? (isLight ? 'bg-rose-50/90 border-rose-200 text-slate-800' : 'bg-rose-950/40 border-rose-800/80 text-slate-100')
            : (isLight ? 'bg-slate-100/90 border-slate-300 text-slate-700' : 'bg-slate-900/60 border-slate-800 text-slate-400')
        }`}>
          <div className="flex items-start space-x-3">
            <div className={`p-2.5 rounded-xl text-white shadow-md flex-shrink-0 mt-0.5 ${
              hasAtkIncomeForMonth ? 'bg-rose-600 shadow-rose-600/30' : 'bg-slate-500 shadow-slate-500/20'
            }`}>
              <AlertTriangle className={`w-5 h-5 ${hasAtkIncomeForMonth ? 'animate-pulse' : 'opacity-70'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={`font-extrabold text-sm sm:text-base ${
                    hasAtkIncomeForMonth ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    Pengingat Saldo Mengendap ({pendingCasesWithBalance.length} Perkara)
                  </h3>
                  {hasAtkIncomeForMonth ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>FITUR AKTIF ({selectedMonth})</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      FITUR NONAKTIF (Pemasukan ATK {selectedMonth}: Rp0)
                    </span>
                  )}
                </div>
              </div>

              {hasAtkIncomeForMonth ? (
                <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Perkara yang sudah <strong>Putus</strong> atau berjalan melebihi batas waktu <strong>(Tingkat Pertama: 5 bulan, Banding: 3 bulan, Kasasi/PK: 3 bulan)</strong> tidak boleh menyisakan saldo biaya proses. Gunakan fitur <strong>⚡ Auto-Zeroing (Saldo Rp0)</strong> untuk langsung mengalokasikan pengeluaran resmi hingga saldo menjadi Rp0.
                </p>
              ) : (
                <p className={`text-xs mt-1 leading-relaxed italic ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  📌 <strong>Fitur Auto-Zeroing Belum Aktif:</strong> Belum ada pemasukan Biaya Pemberkasan / ATK yang masuk ke Saldo Kas Buku Bantu pada bulan <strong>{selectedMonth}</strong>. Fitur ini akan aktif secara otomatis setelah terdapat pencatatan jurnal atau pemotongan panjar ATK perkara yang masuk ke Buku Bantu.
                </p>
              )}

              {/* Table of overdue cases with non-zero balance */}
              <div className="mt-3 overflow-x-auto rounded-xl border border-rose-200 dark:border-rose-800/60 bg-white dark:bg-slate-900 shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-100/60 dark:bg-rose-950/80 font-bold text-rose-900 dark:text-rose-200 border-b border-rose-200 dark:border-rose-800">
                    <tr>
                      <th className="px-3 py-2">NOMOR PERKARA</th>
                      <th className="px-3 py-2">TINGKAT / STATUS</th>
                      <th className="px-3 py-2">REGISTER</th>
                      <th className="px-3 py-2 text-right">SISA SALDO</th>
                      <th className="px-3 py-2 text-center">AKSI HABISKAN SALDO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 dark:divide-rose-900/40">
                    {pendingCasesWithBalance.map((c, idx) => (
                      <tr key={`pending-${c.id}-${idx}`} className="hover:bg-rose-50/50 dark:hover:bg-rose-900/20">
                        <td className="px-3 py-2 font-mono font-bold text-rose-700 dark:text-rose-300">
                          {c.nomorPerkara}
                          <p className="text-[10px] font-normal text-slate-500">{c.namaPihak}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                            {c.tingkatPerkara || 'Tingkat Pertama'}
                          </span>
                          <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            c.isPutus ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {c.status} ({c.monthsElapsed} Bulan)
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">
                          {formatShortDate(c.tanggalRegister)}
                        </td>
                        <td className="px-3 py-2 text-right font-black text-rose-600 dark:text-rose-400">
                          {formatRupiah(c.saldoPerkara)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {hasAtkIncomeForMonth ? (
                            <button
                              onClick={() => handleOpenZeroingModal(c)}
                              className="px-3 py-1 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg font-bold text-[11px] shadow-xs flex items-center space-x-1 mx-auto transition-transform active:scale-95"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>Auto-Zeroing (Rp0)</span>
                            </button>
                          ) : (
                            <button
                              disabled
                              className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg font-bold text-[11px] cursor-not-allowed flex items-center space-x-1 mx-auto opacity-70"
                              title={`Fitur nonaktif: Belum ada pemasukan ATK pada bulan ${selectedMonth}`}
                            >
                              <Zap className="w-3.5 h-3.5 opacity-50" />
                              <span>Auto-Zeroing (Nonaktif)</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* FILTER BAR & SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Card 1: Penerimaan */}
        <div className={`border rounded-2xl p-4 flex items-center justify-between shadow-xs transition-colors ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 shadow-lg'
        }`}>
          <div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Total Penerimaan ({selectedMonth})
            </span>
            <p className="text-lg font-black text-emerald-600 mt-0.5">{formatRupiah(totalPenerimaan)}</p>
          </div>
          <div className={`p-2.5 rounded-xl border ${
            isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400'
          }`}>
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Pengeluaran */}
        <div className={`border rounded-2xl p-4 flex items-center justify-between shadow-xs transition-colors ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 shadow-lg'
        }`}>
          <div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Total Pengeluaran ({selectedMonth})
            </span>
            <p className="text-lg font-black text-rose-600 mt-0.5">{formatRupiah(totalPengeluaran)}</p>
          </div>
          <div className={`p-2.5 rounded-xl border ${
            isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-950/60 border-rose-800/80 text-rose-400'
          }`}>
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Saldo Buku Bantu */}
        <div className={`border rounded-2xl p-4 flex items-center justify-between shadow-xs transition-colors ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 shadow-lg'
        }`}>
          <div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Saldo Kas Buku Bantu ({selectedMonth})
            </span>
            <p className="text-lg font-black text-amber-600 mt-0.5">{formatRupiah(saldoBiayaProses)}</p>
          </div>
          <div className={`p-2.5 rounded-xl border ${
            isLight ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-950/60 border-amber-800/80 text-amber-400'
          }`}>
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Akumulasi Kas Tahun 2026 */}
        <div 
          onClick={() => {
            setIsKasMinusModalOpen(true);
            const firstMinus = monthlyKasBreakdown.find(m => m.isMinus);
            if (firstMinus) {
              setSelectedKasMonth(firstMinus.monthNum);
            } else {
              setSelectedKasMonth('01');
            }
          }}
          className={`border rounded-2xl p-4 flex items-center justify-between shadow-xs transition-all cursor-pointer hover:border-cyan-500 hover:shadow-md active:scale-98 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 shadow-lg'
          }`}
          title="Klik untuk melihat rincian & analisis saldo kas per bulan"
        >
          <div>
            <div className="flex items-center space-x-1.5">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Saldo Kas Akumulasi {selectedYear}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                saldoAkumulasi < 0 
                  ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse' 
                  : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
              }`}>
                {saldoAkumulasi < 0 ? '⚠️ MINUS - Klik Rincian' : '🔍 Rincian Bulanan'}
              </span>
            </div>
            <p className={`text-lg font-black mt-0.5 ${saldoAkumulasi < 0 ? 'text-rose-600' : 'text-cyan-600'}`}>
              {formatRupiah(saldoAkumulasi)}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl border ${
            saldoAkumulasi < 0 
              ? 'bg-rose-50 border-rose-200 text-rose-700' 
              : isLight ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'bg-cyan-950/60 border-cyan-800/80 text-cyan-400'
          }`}>
            <FileText className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* BREAKDOWN SALDO ATK BIAYA PROSES PER NOMOR PERKARA (REQUIREMENT #4) */}
      <details className={`border rounded-2xl p-4 transition-colors group ${
        isLight ? 'bg-amber-50/50 border-amber-200 text-slate-800' : 'bg-slate-900/90 border-amber-900/50 text-slate-100'
      }`}>
        <summary className="cursor-pointer font-bold text-xs uppercase tracking-wide flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span className="text-amber-800 dark:text-amber-400 font-extrabold">
              📊 Rincian Saldo ATK & Biaya Proses Per Nomor Perkara ({Object.keys(atkBalanceByCase).length} Perkara Terkumpul)
            </span>
          </div>
          <span className="text-amber-600 text-[10px] group-open:rotate-180 transition-transform">▼ Klik untuk Buka/Tutup</span>
        </summary>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b font-bold text-[11px] ${isLight ? 'bg-amber-100/70 text-amber-900' : 'bg-slate-800 text-amber-300'}`}>
                <th className="p-2">Nomor Perkara</th>
                <th className="p-2 text-right">Potongan ATK Masuk</th>
                <th className="p-2 text-right">Pengeluaran / Belanja</th>
                <th className="p-2 text-right">Sisa Saldo ATK Perkara</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/60 dark:divide-slate-800 text-[11px]">
              {Object.keys(atkBalanceByCase).length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-slate-500 italic">
                    Belum ada potongan ATK atau biaya proses per nomor perkara.
                  </td>
                </tr>
              ) : (
                (Object.entries(atkBalanceByCase) as [string, { penerimaan: number; pengeluaran: number; saldo: number }][]).map(([noCase, data]) => (
                  <tr key={noCase} className="hover:bg-amber-100/30 dark:hover:bg-slate-800/50">
                    <td className="p-2 font-mono font-bold text-amber-800 dark:text-amber-300">{noCase}</td>
                    <td className="p-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(data.penerimaan)}
                    </td>
                    <td className="p-2 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                      {formatRupiah(data.pengeluaran)}
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-amber-600 dark:text-amber-300">
                      {formatRupiah(data.saldo)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 italic">
            💡 Setiap potongan panjar ATK saat register perkara atau Jurnal SKUM otomatis menambah saldo ATK per nomor perkara. Ketika log transaksi belanja diinput untuk nomor perkara tersebut, saldo ATK per perkara otomatis terpotong secara transparan.
          </p>
        </div>
      </details>

      {/* MONTHLY REKAP SELECTOR & SEARCH BAR */}
      <div className={`border rounded-2xl p-4 flex flex-col gap-3 transition-colors ${
        isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900 border-slate-800 shadow-lg'
      }`}>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Quick Buttons & Year Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Toggle: Bulan Sekarang */}
            <button
              onClick={() => handleSelectMonth(currentMonthName)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all shadow-xs ${
                selectedMonth === currentMonthName
                  ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                  : isLight
                    ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                    : 'bg-amber-950/50 text-amber-300 border border-amber-800 hover:bg-amber-900/60'
              }`}
              title="Tampilkan data transaksi bulan berjalan saat ini"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Bulan Sekarang ({currentMonthName})</span>
              {selectedMonth === currentMonthName && (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              )}
            </button>

            {/* Quick Toggle: Semua Bulan */}
            <button
              onClick={() => handleSelectMonth('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all ${
                selectedMonth === 'ALL'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Tampilkan seluruh transaksi sepanjang tahun"
            >
              <span>Semua Bulan</span>
            </button>

            {/* Year Selector */}
            <div className="flex items-center space-x-1.5 ml-1">
              <span className={`text-[11px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => handleSelectYear(e.target.value)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <option value="ALL">Semua Tahun</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isLight ? 'text-slate-400' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Cari uraian, nomor perkara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors ${
                isLight 
                  ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' 
                  : 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
              }`}
            />
          </div>
        </div>

        {/* Month Pills Row */}
        <div className="flex items-center space-x-1 overflow-x-auto w-full pt-1 pb-1 scrollbar-thin">
          {MONTH_NAMES.map(m => {
            const isCurrent = m === currentMonthName;
            const isSelected = selectedMonth === m;
            return (
              <button
                key={m}
                onClick={() => handleSelectMonth(m)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1 ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-sm font-bold ring-1 ring-amber-400'
                    : isCurrent
                      ? isLight
                        ? 'bg-amber-100/70 text-amber-900 border border-amber-300 hover:bg-amber-200/70'
                        : 'bg-amber-950/40 text-amber-300 border border-amber-800/80 hover:bg-amber-900/60'
                      : isLight 
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>{m}</span>
                {isCurrent && !isSelected && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500 text-white font-black">INI</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* LOG TRANSAKSI TABLE (DISPLAY VIEW) */}
      <div className={`border rounded-2xl shadow-sm overflow-hidden transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        
        <div className={`px-4 sm:px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/50 border-slate-800'
        }`}>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <h3 className={`text-xs font-extrabold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
              Log Transaksi Buku Bantu Biaya Proses ({selectedMonth === 'ALL' ? 'Tahun 2026' : `Bulan ${selectedMonth} 2026`})
            </h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {filteredRecords.length} Transaksi
            </span>

            {/* View Mode Toggle: Kartu HP vs Tabel */}
            <div className="flex items-center space-x-1 p-1 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('mobile')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                  viewMode === 'mobile'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Tampilan Khusus Mobile / HP (Bebas Geser, Mudah Dibaca)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>📱 Kartu HP</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                  viewMode === 'table'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Tampilan Tabel Standar Lebar"
              >
                <Table className="w-3.5 h-3.5" />
                <span>🖥️ Tabel</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Mode: Mobile Cards vs Standard Table */}
        {viewMode === 'mobile' ? (
          <div className="p-3 sm:p-4 space-y-3">
            {filteredRecords.length === 0 ? (
              <div className={`text-center py-10 px-4 rounded-xl border ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-800/40 border-slate-800 text-slate-400'
              }`}>
                <BookOpen className="w-8 h-8 mx-auto text-amber-500/60 mb-2" />
                <p className="font-bold text-sm">Belum ada log transaksi untuk bulan {selectedMonth}</p>
                <p className="text-xs mt-1">Gunakan tombol "+ Log Transaksi" atau "Potong ATK Perkara" untuk menambah data.</p>
              </div>
            ) : (
              filteredRecords.map((item, idx) => (
                <div
                  key={`mobile-proses-${item.id}-${idx}`}
                  className={`p-4 rounded-2xl border transition-all shadow-xs space-y-3 ${
                    isLight 
                      ? 'bg-white border-slate-200 hover:border-amber-300' 
                      : 'bg-slate-900 border-slate-800 hover:border-amber-800'
                  }`}
                >
                  {/* Top Row: No, Tanggal & Nomor Perkara */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        #{idx + 1} • {formatShortDate(item.tanggal)}
                      </span>
                      <div className="font-mono text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 mt-0.5">
                        {item.nomorPerkara}
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${
                      item.penerimaan > 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                    }`}>
                      {item.penerimaan > 0 ? 'Penerimaan' : 'Pengeluaran'}
                    </span>
                  </div>

                  {/* Uraian Transaksi */}
                  <div>
                    <div className="font-bold text-sm leading-snug text-slate-900 dark:text-slate-100">
                      {item.uraian}
                    </div>
                    {item.keterangan && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                        "{item.keterangan}"
                      </div>
                    )}
                  </div>

                  {/* Nominal Box */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700'
                  }`}>
                    {item.penerimaan > 0 ? (
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Penerimaan (Potongan ATK)
                        </div>
                        <div className="font-mono text-base font-black text-emerald-700 dark:text-emerald-400">
                          + {formatRupiah(item.penerimaan)}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Pengeluaran (Biaya / Belanja)
                        </div>
                        <div className="font-mono text-base font-black text-rose-600 dark:text-rose-400">
                          - {formatRupiah(item.pengeluaran)}
                        </div>
                      </div>
                    )}

                    {item.kategori && (
                      <div className="text-right">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Kategori
                        </div>
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          {item.kategori}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(item)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all ${
                        isLight 
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200' 
                          : 'bg-slate-800 hover:bg-amber-950/40 text-amber-300 border-slate-700'
                      }`}
                      title="Edit Log Transaksi"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Transaksi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Hapus log transaksi ini dari Buku Bantu Biaya Proses?')) {
                          onDeleteRecord(item.id);
                        }
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center space-x-1"
                      title="Hapus Log Transaksi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">Hapus</span>
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Mobile Total Biaya Proses Summary Card */}
            <div className={`p-4 rounded-2xl border shadow-sm ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                Total Akumulasi Bulan {selectedMonth}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                  <div className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold">Total Penerimaan</div>
                  <div className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-300">
                    {formatRupiah(totalPenerimaan)}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                  <div className="text-[10px] text-rose-800 dark:text-rose-400 font-bold">Total Pengeluaran</div>
                  <div className="font-mono text-sm font-black text-rose-700 dark:text-rose-300">
                    {formatRupiah(totalPengeluaran)}
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <span className="font-bold text-xs text-amber-900 dark:text-amber-200">Saldo Biaya Proses:</span>
                <span className="font-mono font-black text-base text-amber-800 dark:text-amber-300">
                  {formatRupiah(saldoBiayaProses)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b font-extrabold uppercase tracking-wider ${
                isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800/80 text-slate-300 border-slate-700'
              }`}>
                <tr>
                  <th className="px-3 py-3 text-center w-12">NO</th>
                  <th className="px-3 py-3 w-28">TANGGAL</th>
                  <th className="px-3 py-3 w-44">NOMOR PERKARA</th>
                  <th className="px-4 py-3">URAIAN</th>
                  <th className="px-4 py-3 text-right w-36">PENERIMAAN (RP)</th>
                  <th className="px-4 py-3 text-right w-36">PENGELUARAN (RP)</th>
                  <th className="px-3 py-3 w-32">KET</th>
                  <th className="px-3 py-3 text-center w-20">AKSI</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-200 bg-white' : 'divide-slate-800 bg-slate-900/40'}`}>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={`text-center py-12 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Belum ada log transaksi untuk bulan {selectedMonth}. Gunakan tombol "+ Log Transaksi" atau "Potong ATK Perkara" untuk menambah data.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((item, idx) => (
                    <tr key={`${item.id}-${idx}`} className={`transition-colors ${isLight ? 'hover:bg-amber-50/40' : 'hover:bg-slate-800/60'}`}>
                      <td className={`px-3 py-2.5 text-center font-bold ${isLight ? 'text-slate-400' : 'text-slate-400'}`}>{idx + 1}</td>
                      <td className={`px-3 py-2.5 font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{formatShortDate(item.tanggal)}</td>
                      <td className="px-3 py-2.5 font-mono font-extrabold text-amber-700">{item.nomorPerkara}</td>
                      <td className={`px-4 py-2.5 font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{item.uraian}</td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-emerald-700">
                        {item.penerimaan > 0 ? formatRupiah(item.penerimaan) : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-rose-700">
                        {item.pengeluaran > 0 ? formatRupiah(item.pengeluaran) : '-'}
                      </td>
                      <td className={`px-3 py-2.5 text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{item.keterangan || '-'}</td>
                      <td className="px-3 py-2.5 text-center space-x-1">
                        <button
                          onClick={() => handleOpenAddModal(item)}
                          className={`p-1 rounded transition-colors ${
                            isLight ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-slate-800 hover:bg-slate-700 text-amber-400'
                          }`}
                          title="Edit Log Transaksi"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Hapus log transaksi ini dari Buku Bantu Biaya Proses?')) {
                              onDeleteRecord(item.id);
                            }
                          }}
                          className={`p-1 rounded transition-colors ${
                            isLight ? 'bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700' : 'bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400'
                          }`}
                          title="Hapus Log Transaksi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* Table Footer Totals */}
              <tfoot className={`font-bold border-t-2 ${
                isLight ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-slate-800/90 border-slate-700 text-slate-100'
              }`}>
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right uppercase tracking-wider">
                    JUMLAH TOTAL BULAN {selectedMonth}:
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-black">{formatRupiah(totalPenerimaan)}</td>
                  <td className="px-4 py-3 text-right text-rose-700 font-black">{formatRupiah(totalPengeluaran)}</td>
                  <td colSpan={2} className="px-3 py-3 text-amber-700 text-center font-black">
                    SALDO: {formatRupiah(saldoBiayaProses)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

      </div>

      {/* MODAL 1: DEDUCT ATK FROM CASE */}
      {isAtkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0 bg-slate-900">
              <div className="flex items-center space-x-2 text-emerald-400">
                <Scissors className="w-5 h-5" />
                <h3 className="font-bold text-slate-100 text-base">Potong Biaya ATK Masuk Buku Bantu</h3>
              </div>
              <button onClick={() => setIsAtkModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAtkDeduction} className="flex flex-col flex-1 overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Pilih Nomor Perkara</label>
                  <select
                    value={atkCaseNumber}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      setAtkCaseNumber(selectedVal);
                      const matchingCase = cases.find(c => c.nomorPerkara === selectedVal || c.id === selectedVal);
                      if (matchingCase?.tanggalRegister) {
                        setAtkTanggal(matchingCase.tanggalRegister);
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs font-mono font-bold"
                  >
                    {cases.map((c, idx) => (
                      <option key={`bp-opt-1-${c.id}-${idx}`} value={c.nomorPerkara}>
                        {c.nomorPerkara} - {c.namaPihak} ({c.jenisPerkara})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nominal Pemotongan ATK (Rp)</label>
                  <input
                    type="number"
                    min="10000"
                    step="10000"
                    required
                    value={atkAmount}
                    onChange={(e) => setAtkAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tanggal Transaksi</label>
                  <input
                    type="date"
                    required
                    value={atkTanggal}
                    onChange={(e) => setAtkTanggal(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Pilih Uraian Standar (Atau Ketik Kustom)</label>
                  <select
                    value={STANDARD_URAIAN_OPTIONS.some(o => o.label === atkUraian) ? atkUraian : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setAtkUraian(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 mb-2 text-xs"
                  >
                    {STANDARD_URAIAN_OPTIONS.map((opt, i) => (
                      <option key={i} value={opt.label}>{opt.label}</option>
                    ))}
                    <option value="custom">-- Tulis Uraian Kustom Lainnya --</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Deskripsi uraian transaksi..."
                    value={atkUraian}
                    onChange={(e) => setAtkUraian(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-medium"
                  />
                </div>
              </div>

              <div className="p-4 flex justify-end space-x-2 border-t border-slate-800 shrink-0 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setIsAtkModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-md shadow-emerald-900/40 transition-colors"
                >
                  Masuk ke Buku Bantu Biaya Proses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT TRANSACTION MANUAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0 bg-slate-900">
              <div className="flex items-center space-x-2 text-amber-400">
                <PlusCircle className="w-5 h-5" />
                <h3 className="font-bold text-slate-100 text-base">
                  {editingId ? 'Edit Log Transaksi' : 'Input Log Transaksi Baru'}
                </h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="flex flex-col flex-1 overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* QUICK PRESET BUTTONS */}
                <div className="bg-slate-800/70 border border-slate-700/80 p-2.5 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                    ⚡ Tombol Cepat Preset Detail ATK & Transaksi:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFormJenis('penerimaan');
                        setFormUraian('Pemotongan Panjar ATK Pendaftaran Perkara');
                        setFormJumlah(100000);
                        setFormKategori('ATK');
                        setFormKeterangan('Pengelolaan ATK Pendaftaran');
                      }}
                      className="px-2.5 py-1 bg-emerald-950/90 border border-emerald-700 text-emerald-300 rounded font-bold hover:bg-emerald-900 transition-colors"
                    >
                      📥 Pemasukan ATK Pendaftaran (Rp 100.000)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormJenis('pengeluaran');
                        setFormUraian('Pengadaan Kertas HVS A4/F4 Berkas Perkara');
                        setFormJumlah(45000);
                        setFormKategori('ATK');
                        setFormKeterangan('Beli Kertas HVS');
                      }}
                      className="px-2.5 py-1 bg-amber-950/80 border border-amber-700 text-amber-300 rounded font-semibold hover:bg-amber-900 transition-colors"
                    >
                      📄 Kertas HVS (Rp 45.000)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormJenis('pengeluaran');
                        setFormUraian('Pengadaan Stopmap & Map Perkara');
                        setFormJumlah(15000);
                        setFormKategori('ATK');
                        setFormKeterangan('Stopmap Berkas');
                      }}
                      className="px-2.5 py-1 bg-amber-950/80 border border-amber-700 text-amber-200 rounded font-semibold hover:bg-amber-900 transition-colors"
                    >
                      📁 Stopmap Perkara (Rp 15.000)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormJenis('pengeluaran');
                        setFormUraian('Pengadaan Tinta Printer Berkas Perkara');
                        setFormJumlah(35000);
                        setFormKategori('ATK');
                        setFormKeterangan('Tinta Printer');
                      }}
                      className="px-2.5 py-1 bg-blue-950/80 border border-blue-700 text-blue-300 rounded font-semibold hover:bg-blue-900 transition-colors"
                    >
                      🖨️ Tinta Printer (Rp 35.000)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormJenis('pengeluaran');
                        setFormUraian('Pengadaan Ballpoint, Pensil & Tipe-X');
                        setFormJumlah(15000);
                        setFormKategori('ATK');
                        setFormKeterangan('Ballpoint & Alat Tulis');
                      }}
                      className="px-2.5 py-1 bg-indigo-950/80 border border-indigo-700 text-indigo-300 rounded font-semibold hover:bg-indigo-900 transition-colors"
                    >
                      ✏️ Ballpoint & Alat Tulis (Rp 15.000)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormJenis('pengeluaran');
                        setFormUraian('Pengadaan Stapler, Isi Staples & Paper Clip');
                        setFormJumlah(10000);
                        setFormKategori('ATK');
                        setFormKeterangan('Staples & Klip');
                      }}
                      className="px-2.5 py-1 bg-slate-800 border border-slate-600 text-slate-200 rounded font-semibold hover:bg-slate-700 transition-colors"
                    >
                      📎 Stapler & Klip (Rp 10.000)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormJenis('pengeluaran');
                        setFormUraian('Pembelian Meterai Tempel Putusan & Penetapan');
                        setFormJumlah(10000);
                        setFormKategori('Meterai');
                        setFormKeterangan('Meterai Tempel 10000');
                      }}
                      className="px-2.5 py-1 bg-purple-950/80 border border-purple-700 text-purple-300 rounded font-semibold hover:bg-purple-900 transition-colors"
                    >
                      🏷️ Meterai (Rp 10.000)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormJenis('pengeluaran');
                        setFormUraian('Biaya Pengiriman Surat Relaas / Dokumen Putusan via PT Pos');
                        setFormJumlah(20000);
                        setFormKategori('Proses');
                        setFormKeterangan('PT Pos Indonesia');
                      }}
                      className="px-2.5 py-1 bg-cyan-950/80 border border-cyan-700 text-cyan-300 rounded font-semibold hover:bg-cyan-900 transition-colors"
                    >
                      📮 Pos / Relaas (Rp 20.000)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Tanggal Transaksi (Kolom 2)</label>
                    <input
                      type="date"
                      required
                      value={formTanggal}
                      onChange={(e) => setFormTanggal(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Jenis Transaksi</label>
                    <select
                      value={formJenis}
                      onChange={(e) => setFormJenis(e.target.value as 'penerimaan' | 'pengeluaran')}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-bold"
                    >
                      <option value="penerimaan">Penerimaan / Masuk (Kolom 5)</option>
                      <option value="pengeluaran">Pengeluaran / Beli ATK (Kolom 6)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nomor Perkara (Kolom 3 - Opsional)
                  </label>
                  
                  {/* Select dropdown auto-populated from DataPerkara sheet */}
                  <select
                    value={cases.some(c => c.nomorPerkara === formNomorPerkara) ? formNomorPerkara : (formNomorPerkara === '-' ? '-' : 'custom')}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setFormNomorPerkara(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs font-mono font-bold mb-1.5"
                  >
                    <option value="custom">-- 🔍 Pilihan Otomatis / Ketik Manual --</option>
                    <option value="-">- (Non-Perkara / Transaksi Umum)</option>
                    {cases.length > 0 && (
                      <optgroup label="📋 Dipanggil Otomatis dari Sheet DataPerkara:">
                        {cases.map((c, idx) => (
                          <option key={`bp-opt-2-${c.id}-${idx}`} value={c.nomorPerkara}>
                            {c.nomorPerkara} — {c.namaPihak} ({c.jenisPerkara})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {/* Input field with datalist autocomplete */}
                  <div className="relative">
                    <input
                      type="text"
                      list="data-perkara-list"
                      placeholder="Contoh: 14/Pdt.G/2026/PA.Pan atau -"
                      value={formNomorPerkara}
                      onChange={(e) => setFormNomorPerkara(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs"
                    />
                    <datalist id="data-perkara-list">
                      <option value="-" />
                      {cases.map((c, idx) => (
                        <option key={`bp-opt-3-${c.id}-${idx}`} value={c.nomorPerkara}>
                          {c.namaPihak} ({c.jenisPerkara})
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    💡 Terhubung otomatis dengan sheet <strong>DataPerkara</strong> ({cases.length} perkara tersedia). Anda juga dapat memilih langsung dari dropdown atau mengetik manual.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Uraian Keperluan ATK / Transaksi * (Kolom 4)</label>
                  <select
                    value={STANDARD_URAIAN_OPTIONS.some(o => o.label === formUraian) ? formUraian : 'custom'}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      if (selectedVal !== 'custom') {
                        setFormUraian(selectedVal);
                        const matched = STANDARD_URAIAN_OPTIONS.find(o => o.label === selectedVal);
                        if (matched) {
                          setFormJenis(matched.jenis as 'penerimaan' | 'pengeluaran');
                          setFormKategori(matched.kategori as any);
                        }
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 mb-2 text-xs"
                  >
                    <option value="custom">-- Pilih Template / Ketik Sendiri --</option>
                    {STANDARD_URAIAN_OPTIONS.map((opt, i) => (
                      <option key={i} value={opt.label}>
                        [{opt.jenis === 'penerimaan' ? 'PENERIMAAN' : 'PENGELUARAN'}] {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Deskripsi transaksi..."
                    value={formUraian}
                    onChange={(e) => setFormUraian(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Jumlah Nominal (Rp) *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="Contoh: 100000"
                      value={formJumlah === 0 ? '' : formJumlah}
                      onChange={(e) => setFormJumlah(e.target.value === '' ? 0 : Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Kategori</label>
                    <select
                      value={formKategori}
                      onChange={(e) => setFormKategori(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                    >
                      <option value="ATK">Pemotongan ATK</option>
                      <option value="Proses">Biaya Proses</option>
                      <option value="Meterai">Meterai</option>
                      <option value="Redaksi">Redaksi</option>
                      <option value="Panggilan">Panggilan</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Keterangan / Penerima / PT Pos (Kolom 7)</label>
                  <input
                    type="text"
                    value={formKeterangan}
                    onChange={(e) => setFormKeterangan(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="p-4 flex justify-end space-x-2 border-t border-slate-800 shrink-0 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold shadow-md shadow-amber-900/40 transition-colors"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CETAK / PRINT PREVIEW EXACT TO USER SPECIFICATIONS */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
          <div className="bg-white text-black w-full max-w-4xl rounded-xl shadow-2xl p-6 sm:p-10 space-y-6 my-auto print:p-0 print:shadow-none print:w-full print:max-w-none">
            
            {/* Print Modal Header Action Bar (Hidden when printing) */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-300 print:hidden">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-gray-800 text-sm sm:text-base">
                  Pratinjau Cetak Resmi - BUKU BANTU BIAYA PROSES
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center space-x-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Sekarang</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-gray-500 hover:text-black rounded-lg hover:bg-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE DOCUMENT CONTENT (STRICT USER SPECIFICATION FORMAT) */}
            <div id="printable-buku-bantu" className="space-y-6 font-serif text-black leading-tight">
              
              {/* Document Header */}
              <div className="text-center font-bold space-y-1">
                <h1 className="text-base sm:text-lg tracking-wide uppercase">BUKU BANTU BIAYA PROSES</h1>
                <h2 className="text-sm sm:text-base tracking-wider uppercase">PENGADILAN AGAMA PANIAI</h2>
                <h3 className="text-xs sm:text-sm tracking-widest">TAHUN 2026</h3>
                <p className="text-xs sm:text-sm pt-2">
                  BULAN : <span className="border-b border-dotted border-black px-4 font-mono uppercase">{selectedMonth === 'ALL' ? '...................................' : selectedMonth}</span>
                </p>
              </div>

              {/* Document Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-black text-center">
                  <thead>
                    <tr className="font-bold uppercase bg-gray-100 border-b border-black">
                      <th className="border border-black p-2 w-8" rowSpan={2}>NO</th>
                      <th className="border border-black p-2 w-24" rowSpan={2}>TANGGAL</th>
                      <th className="border border-black p-2 w-36" rowSpan={2}>NOMOR PERKARA</th>
                      <th className="border border-black p-2" rowSpan={2}>URAIAN</th>
                      <th className="border border-black p-2" colSpan={2}>JUMLAH</th>
                      <th className="border border-black p-2 w-24" rowSpan={2}>KET</th>
                    </tr>
                    <tr className="font-bold uppercase bg-gray-100 border-b border-black">
                      <th className="border border-black p-1.5 w-28">PENERIMAAN</th>
                      <th className="border border-black p-1.5 w-28">PENGELUARAN</th>
                    </tr>
                    {/* Column index indicator row (1..7) */}
                    <tr className="bg-gray-200 font-bold border-b border-black text-[10px]">
                      <td className="border border-black py-0.5">1</td>
                      <td className="border border-black py-0.5">2</td>
                      <td className="border border-black py-0.5">3</td>
                      <td className="border border-black py-0.5">4</td>
                      <td className="border border-black py-0.5">5</td>
                      <td className="border border-black py-0.5">6</td>
                      <td className="border border-black py-0.5">7</td>
                    </tr>
                  </thead>

                  <tbody>
                    {/* Actual Rows */}
                    {printRows.rows.map((r, i) => (
                      <tr key={r.id} className="border-b border-black text-[11px]">
                        <td className="border border-black py-1 px-1 font-bold">{i + 1}</td>
                        <td className="border border-black py-1 px-1">{formatShortDate(r.tanggal)}</td>
                        <td className="border border-black py-1 px-1 font-mono font-semibold">{r.nomorPerkara}</td>
                        <td className="border border-black py-1 px-2 text-left">{r.uraian}</td>
                        <td className="border border-black py-1 px-2 text-right">
                          {r.penerimaan > 0 ? r.penerimaan.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="border border-black py-1 px-2 text-right">
                          {r.pengeluaran > 0 ? r.pengeluaran.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="border border-black py-1 px-1 text-left">{r.keterangan || '-'}</td>
                      </tr>
                    ))}

                    {/* Empty Padding Rows to guarantee clean register look */}
                    {Array.from({ length: printRows.missingCount }).map((_, idx) => {
                      const rowNum = printRows.rows.length + idx + 1;
                      return (
                        <tr key={`empty-${idx}`} className="border-b border-black text-[11px] h-7">
                          <td className="border border-black py-1 px-1 font-bold">{rowNum}</td>
                          <td className="border border-black py-1 px-1"></td>
                          <td className="border border-black py-1 px-1"></td>
                          <td className="border border-black py-1 px-2"></td>
                          <td className="border border-black py-1 px-2"></td>
                          <td className="border border-black py-1 px-2"></td>
                          <td className="border border-black py-1 px-1"></td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="font-bold bg-gray-100 border-t-2 border-black text-xs">
                      <td colSpan={4} className="border border-black p-2 text-right uppercase">JUMLAH TOTAL</td>
                      <td className="border border-black p-2 text-right font-mono">
                        Rp {totalPenerimaan.toLocaleString('id-ID')}
                      </td>
                      <td className="border border-black p-2 text-right font-mono">
                        Rp {totalPengeluaran.toLocaleString('id-ID')}
                      </td>
                      <td className="border border-black p-2"></td>
                    </tr>
                    <tr className="font-bold bg-gray-100 border-t border-black text-xs">
                      <td colSpan={4} className="border border-black p-2 text-right uppercase">SALDO KAS BUKU BANTU BIAYA PROSES</td>
                      <td colSpan={3} className="border border-black p-2 text-center font-mono font-extrabold">
                        Rp {saldoBiayaProses.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Document Signatures (Exact to user prompt template) */}
              <div className="pt-8 grid grid-cols-2 text-xs font-serif leading-relaxed">
                
                {/* Left Signature: Panitera */}
                <div className="text-left space-y-16">
                  <div>
                    <p className="font-bold">Mengetahui,</p>
                    <p>Panitera</p>
                  </div>
                  <div className="pt-12">
                    <p className="font-bold underline uppercase tracking-wide">ACHMAD HABIBUL ALIM MAPPIASSE, S.H.I., M.H.</p>
                    <p>NIP. 199210182019031003</p>
                  </div>
                </div>

                {/* Right Signature: Petugas Biaya Proses */}
                <div className="text-right space-y-16">
                  <div>
                    <p>
                      Paniai, <span className="border-b border-dotted border-black px-2">{new Date().getDate()} {selectedMonth === 'ALL' ? MONTH_NAMES[new Date().getMonth()] : selectedMonth} 2026</span>
                    </p>
                    <p>Petugas Biaya Proses</p>
                  </div>
                  <div className="pt-12">
                    <p className="font-bold underline uppercase tracking-wide">IDRIS AL BASYIR, A.Md.</p>
                    <p>NIP. 199601112025061004</p>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL 4: GENERATE AUTO-ZEROING SALDO PERKARA */}
      {isZeroingModalOpen && selectedZeroingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-amber-400">
                <Zap className="w-5 h-5" />
                <h3 className="font-bold text-slate-100 text-base">
                  ⚡ Auto-Zeroing Biaya Proses (Saldo Rp0)
                </h3>
              </div>
              <button onClick={() => setIsZeroingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-800/80 border border-slate-700/80 p-3.5 rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-amber-400 text-sm">{selectedZeroingCase.nomorPerkara}</span>
                  <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-bold">
                    {selectedZeroingCase.status}
                  </span>
                </div>
                <p className="text-slate-300 font-semibold">{selectedZeroingCase.namaPihak} ({selectedZeroingCase.jenisPerkara})</p>
                <div className="flex justify-between pt-1 border-t border-slate-700 text-[11px]">
                  <span className="text-slate-400">Target Sisa Saldo yang Harus Dihabiskan:</span>
                  <span className="font-black text-rose-400 text-sm">{formatRupiah(selectedZeroingCase.saldoPerkara)}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-semibold">
                    Draft Rincian Pengeluaran Keperluan Perkara (Total: {formatRupiah(zeroingItems.reduce((a, b) => a + b.amount, 0))}):
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setZeroingItems([
                        ...zeroingItems,
                        { uraian: `Pengadaan Kertas & ATK Tambahan (${selectedZeroingCase.nomorPerkara})`, amount: 0, kategori: 'ATK' }
                      ]);
                    }}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded px-2 py-0.5 font-bold"
                  >
                    + Tambah Baris
                  </button>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {zeroingItems.map((item, idx) => (
                    <div key={idx} className="bg-slate-800 border border-slate-700 p-2.5 rounded-lg space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-400 w-5">{idx + 1}.</span>
                        <input
                          type="text"
                          value={item.uraian}
                          onChange={(e) => {
                            const copy = [...zeroingItems];
                            copy[idx].uraian = e.target.value;
                            setZeroingItems(copy);
                          }}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs"
                        />
                        {zeroingItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setZeroingItems(zeroingItems.filter((_, i) => i !== idx));
                            }}
                            className="text-rose-400 hover:text-rose-300 p-1 text-xs"
                            title="Hapus baris"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 pl-7">
                        <div className="flex-1 flex items-center space-x-1">
                          <span className="text-slate-400 text-[11px]">Nominal (Rp):</span>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={item.amount}
                            onChange={(e) => {
                              const copy = [...zeroingItems];
                              copy[idx].amount = Number(e.target.value);
                              setZeroingItems(copy);
                            }}
                            className="w-28 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-slate-100 text-xs font-bold font-mono text-right"
                          />
                        </div>
                        <select
                          value={item.kategori}
                          onChange={(e) => {
                            const copy = [...zeroingItems];
                            copy[idx].kategori = e.target.value as any;
                            setZeroingItems(copy);
                          }}
                          className="bg-slate-900 border border-slate-700 text-slate-200 text-[10px] rounded px-2 py-0.5"
                        >
                          <option value="ATK">ATK</option>
                          <option value="Proses">Proses</option>
                          <option value="Meterai">Meterai</option>
                          <option value="Redaksi">Redaksi</option>
                          <option value="Panggilan">Panggilan</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Match indicator */}
                {zeroingItems.reduce((a, b) => a + b.amount, 0) === selectedZeroingCase.saldoPerkara ? (
                  <p className="text-[11px] text-emerald-400 font-bold mt-2 flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Total pengeluaran Pas! Saldo akhir perkara akan menjadi persis Rp 0.</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-400 font-bold mt-2">
                    ⚠️ Total pengeluaran ({formatRupiah(zeroingItems.reduce((a, b) => a + b.amount, 0))}) berbeda dari target saldo ({formatRupiah(selectedZeroingCase.saldoPerkara)}).
                  </p>
                )}
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsZeroingModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmZeroing}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg font-bold shadow-lg shadow-amber-900/50 flex items-center space-x-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Eksekusi & Habiskan Saldo (Rp0)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CETAK TABEL LOG JURNAL BIAYA SKUM */}
      {isPrintJurnalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
          <div className="bg-white text-black w-full max-w-4xl rounded-xl shadow-2xl p-6 sm:p-10 space-y-6 my-auto print:p-0 print:shadow-none print:w-full print:max-w-none">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-300 print:hidden">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-800 text-sm sm:text-base">
                  Pratinjau Cetak - TABEL BUKU JURNAL BIAYA SKUM PERKARA
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center space-x-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Jurnal</span>
                </button>
                <button
                  onClick={() => setIsPrintJurnalModalOpen(false)}
                  className="p-1.5 text-gray-500 hover:text-black rounded-lg hover:bg-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Content */}
            <div id="printable-jurnal-biaya" className="space-y-6 font-serif text-black leading-tight">
              <div className="text-center font-bold space-y-1">
                <h1 className="text-base sm:text-lg tracking-wide uppercase">TABEL BUKU JURNAL BIAYA SKUM PERKARA</h1>
                <h2 className="text-sm sm:text-base tracking-wider uppercase">PENGADILAN AGAMA</h2>
                <h3 className="text-xs sm:text-sm tracking-widest">TAHUN 2026</h3>
                <p className="text-xs sm:text-sm pt-2">
                  PERIODE / BULAN : <span className="border-b border-dotted border-black px-4 font-mono uppercase">{selectedMonth === 'ALL' ? 'SEMUA BULAN 2026' : selectedMonth}</span>
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-black text-center">
                  <thead>
                    <tr className="font-bold uppercase bg-gray-100 border-b border-black">
                      <th className="border border-black p-2 w-8">NO</th>
                      <th className="border border-black p-2 w-24">TANGGAL</th>
                      <th className="border border-black p-2 w-36">NOMOR PERKARA</th>
                      <th className="border border-black p-2">URAIAN JURNAL BIAYA</th>
                      <th className="border border-black p-2 w-24">KATEGORI</th>
                      <th className="border border-black p-2 w-28">DEBET (PENERIMAAN)</th>
                      <th className="border border-black p-2 w-28">KREDIT (PENGELUARAN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="border border-black p-4 text-center italic text-gray-500">
                          Belum ada catatan log jurnal biaya untuk periode {selectedMonth}.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r, i) => (
                        <tr key={r.id} className="border-b border-black text-[11px]">
                          <td className="border border-black py-1 px-1 font-bold">{i + 1}</td>
                          <td className="border border-black py-1 px-1 font-mono">{formatShortDate(r.tanggal)}</td>
                          <td className="border border-black py-1 px-1 font-mono font-bold text-left">{r.nomorPerkara}</td>
                          <td className="border border-black py-1 px-2 text-left">{r.uraian}</td>
                          <td className="border border-black py-1 px-1 text-center font-bold">{r.kategori}</td>
                          <td className="border border-black py-1 px-2 text-right font-mono">
                            {r.penerimaan > 0 ? formatRupiah(r.penerimaan) : '-'}
                          </td>
                          <td className="border border-black py-1 px-2 text-right font-mono">
                            {r.pengeluaran > 0 ? formatRupiah(r.pengeluaran) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold bg-gray-100 uppercase border-t border-black text-xs">
                      <th colSpan={5} className="border border-black p-2 text-right">TOTAL JURNAL :</th>
                      <th className="border border-black p-2 text-right font-mono">{formatRupiah(totalPenerimaan)}</th>
                      <th className="border border-black p-2 text-right font-mono">{formatRupiah(totalPengeluaran)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signature Block */}
              <div className="pt-8 grid grid-cols-2 text-xs font-serif text-center">
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Panitera Pengadilan Agama</p>
                  <div className="h-16"></div>
                  <p className="font-bold border-b border-black inline-block px-6">( _______________________ )</p>
                </div>
                <div>
                  <p>Kasir / Petugas Jurnal,</p>
                  <p className="font-bold">Pengadilan Agama</p>
                  <div className="h-16"></div>
                  <p className="font-bold border-b border-black inline-block px-6">( _______________________ )</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL ANALISIS PENYEBAB MINUS SALDO KAS AKUMULASI */}
      {isKasMinusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            
            {/* Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
              saldoAkumulasi < 0 ? 'bg-rose-950/80 text-rose-100 border-rose-800' : 'bg-cyan-950/80 text-cyan-100 border-cyan-800'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-xl ${saldoAkumulasi < 0 ? 'bg-rose-500/30 text-rose-300' : 'bg-cyan-500/30 text-cyan-300'}`}>
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    Analisis Breakdown & Penyebab Saldo Kas Akumulasi ({selectedYear})
                  </h3>
                  <p className="text-xs opacity-80">
                    Menampilkan rincian saldo masuk/keluar per bulan & transaksi yang menyebabkan posisi kas minus.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsKasMinusModalOpen(false)} className="p-1 rounded-lg hover:bg-white/10 text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              
              {/* Top Alert Banner */}
              <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
                saldoAkumulasi < 0 
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200' 
                  : 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-300 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200'
              }`}>
                <FileText className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-sm block">
                    {saldoAkumulasi < 0 ? '⚠️ Peringatan: Saldo Kas Akumulasi Minus!' : 'ℹ️ Ringkasan Posisi Kas Akumulasi'}
                  </span>
                  <p className="mt-1 leading-relaxed">
                    Total Saldo Kas Akumulasi saat ini adalah <strong className="font-mono">{formatRupiah(saldoAkumulasi)}</strong>. 
                    {monthlyKasBreakdown.filter(m => m.isMinus).length > 0 ? (
                      <> Terdeteksi <strong className="text-rose-600 dark:text-rose-400 font-bold">{monthlyKasBreakdown.filter(m => m.isMinus).length} bulan</strong> memiliki pengeluaran melebihi penerimaan atau membuat akumulasi menjadi minus.</>
                    ) : (
                      <> Arus kas berjalan normal dan saldo akumulasi dalam keadaan positif.</>
                    )}
                  </p>
                </div>
              </div>

              {/* Table of Monthly Breakdown */}
              <div>
                <h4 className="font-bold text-sm mb-2 text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>📊 Tabel Arus Kas Per Bulan ({selectedYear}):</span>
                  <span className="text-[11px] text-slate-400 font-normal">Klik baris bulan untuk melihat detail transaksi</span>
                </h4>

                <div className="border rounded-xl overflow-hidden shadow-xs border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b font-extrabold uppercase text-[10px] ${
                        isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
                      }`}>
                        <th className="p-2.5">Bulan</th>
                        <th className="p-2.5 text-right">Penerimaan (Rp)</th>
                        <th className="p-2.5 text-right">Pengeluaran (Rp)</th>
                        <th className="p-2.5 text-right">Net Bulan Ini</th>
                        <th className="p-2.5 text-right">Saldo Akumulasi</th>
                        <th className="p-2.5 text-center">Status</th>
                        <th className="p-2.5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {monthlyKasBreakdown.map(m => {
                        const isSelected = selectedKasMonth === m.monthNum;
                        return (
                          <tr 
                            key={m.monthNum}
                            onClick={() => setSelectedKasMonth(m.monthNum)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-cyan-50 dark:bg-cyan-950/60 font-bold'
                                : m.isMinus
                                ? 'bg-rose-50/70 dark:bg-rose-950/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="p-2.5 font-bold flex items-center space-x-2">
                              <span>{m.monthName}</span>
                              {m.records.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {m.records.length} trx
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                              {m.penerimaan > 0 ? formatRupiah(m.penerimaan) : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono text-rose-600 dark:text-rose-400">
                              {m.pengeluaran > 0 ? formatRupiah(m.pengeluaran) : '-'}
                            </td>
                            <td className={`p-2.5 text-right font-mono font-bold ${
                              m.netMonth < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {formatRupiah(m.netMonth)}
                            </td>
                            <td className={`p-2.5 text-right font-mono font-extrabold ${
                              m.runningCumulative < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-cyan-600 dark:text-cyan-400'
                            }`}>
                              {formatRupiah(m.runningCumulative)}
                            </td>
                            <td className="p-2.5 text-center">
                              {m.netMonth < 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                  ⚠️ MINUS ({formatRupiah(m.netMonth)})
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  🟢 Positif
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedKasMonth(m.monthNum);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                  isSelected 
                                    ? 'bg-cyan-600 text-white' 
                                    : 'bg-slate-200 dark:bg-slate-800 hover:bg-cyan-500 hover:text-white'
                                }`}
                              >
                                {isSelected ? 'Dipilih' : 'Detail'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transactions Detail for Selected Month */}
              {selectedKasMonth && (() => {
                const selMonthData = monthlyKasBreakdown.find(m => m.monthNum === selectedKasMonth);
                if (!selMonthData) return null;

                return (
                  <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2 border-slate-300 dark:border-slate-700">
                      <h5 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                        <span>🔍 Detail Transaksi Kas Bulan {selMonthData.monthName} ({selMonthData.records.length} Transaksi)</span>
                        {selMonthData.netMonth < 0 && (
                          <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-bold text-[10px]">
                            Penyebab Minus Bulan Ini
                          </span>
                        )}
                      </h5>
                      <span className="font-mono font-bold text-xs text-slate-600 dark:text-slate-300">
                        Net: {formatRupiah(selMonthData.netMonth)}
                      </span>
                    </div>

                    {selMonthData.records.length === 0 ? (
                      <p className="text-slate-400 italic py-3 text-center">Tidak ada catatan transaksi pada bulan {selMonthData.monthName}.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="font-bold border-b border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                              <th className="p-2">Tanggal</th>
                              <th className="p-2">Nomor Perkara</th>
                              <th className="p-2">Uraian Transaksi</th>
                              <th className="p-2">Kategori</th>
                              <th className="p-2 text-right">Penerimaan</th>
                              <th className="p-2 text-right">Pengeluaran</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {selMonthData.records.map(r => (
                              <tr key={r.id} className={r.pengeluaran > 0 ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}>
                                <td className="p-2 font-mono text-slate-600 dark:text-slate-400">{r.tanggal}</td>
                                <td className="p-2 font-mono font-bold text-amber-700 dark:text-amber-400">{r.nomorPerkara || '-'}</td>
                                <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">
                                  {r.uraian}
                                  {r.keterangan && <span className="block text-[10px] text-slate-400 font-normal">{r.keterangan}</span>}
                                </td>
                                <td className="p-2">
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    {r.kategori}
                                  </span>
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {r.penerimaan > 0 ? formatRupiah(r.penerimaan) : '-'}
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                                  {r.pengeluaran > 0 ? formatRupiah(r.pengeluaran) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t flex justify-end shrink-0 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800 border-slate-800'
            }`}>
              <button
                type="button"
                onClick={() => setIsKasMinusModalOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                Tutup Analisis
              </button>
            </div>

          </div>
        </div>
      )}

      {/* LIPA.7a Official Report Printable Modal */}
      <Lipa7aReportModal
        isOpen={isLipa7aOpen}
        onClose={() => setIsLipa7aOpen(false)}
        biayaProsesRecords={records}
        cases={cases}
        theme={theme}
      />

    </div>
  );
};
