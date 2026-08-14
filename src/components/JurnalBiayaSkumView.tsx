import React, { useState, useMemo } from 'react';
import { JurnalBiayaSkumRecord, CaseRecord, PinjamanSkumRecord } from '../types';
import { 
  BookOpen, 
  Search, 
  PlusCircle, 
  Printer, 
  Trash2, 
  Edit3,
  Filter, 
  TrendingDown, 
  TrendingUp, 
  Wallet, 
  Calendar,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Calculator,
  FileText,
  HandCoins,
  Clock,
  RotateCcw,
  Receipt
} from 'lucide-react';

interface JurnalBiayaSkumViewProps {
  records: JurnalBiayaSkumRecord[];
  cases: CaseRecord[];
  pinjamanRecords?: PinjamanSkumRecord[];
  onAddRecord: (record: Omit<JurnalBiayaSkumRecord, 'id' | 'createdAt'>) => void;
  onUpdateRecord: (record: JurnalBiayaSkumRecord) => void;
  onDeleteRecord: (id: string) => void;
  onOpenJurnalModal: () => void;
  onAddPinjaman?: (data: { tanggal: string; nomorPerkara: string; peminjam: string; jumlah: number; keterangan: string }) => void;
  onBayarPinjaman?: (pinjamanId: string) => void;
  onDeletePinjaman?: (pinjamanId: string) => void;
  theme?: 'light' | 'dark';
}

export const JurnalBiayaSkumView: React.FC<JurnalBiayaSkumViewProps> = ({
  records,
  cases,
  pinjamanRecords = [],
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  onOpenJurnalModal,
  onAddPinjaman,
  onBayarPinjaman,
  onDeletePinjaman,
  theme = 'light'
}) => {
  const isLight = theme === 'light';

  // Local Filter & Form States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNomorPerkara, setFilterNomorPerkara] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterBulan, setFilterBulan] = useState<string>('ALL');
  const [filterTahun, setFilterTahun] = useState<string>(new Date().getFullYear().toString());
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');

  // Modal Pinjaman Saldo SKUM
  const [isPinjamanModalOpen, setIsPinjamanModalOpen] = useState(false);
  const [isRiwayatPinjamanModalOpen, setIsRiwayatPinjamanModalOpen] = useState(false);
  const [pinjamTanggal, setPinjamTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [pinjamNomorPerkara, setPinjamNomorPerkara] = useState('');
  const [pinjamPeminjam, setPinjamPeminjam] = useState('');
  const [pinjamJumlah, setPinjamJumlah] = useState<number>(0);
  const [pinjamKeterangan, setPinjamKeterangan] = useState('');

  // Unpaid loans calculation
  const unpaidLoans = useMemo(() => {
    return (pinjamanRecords || []).filter(p => p.status === 'BELUM_DIBAYAR');
  }, [pinjamanRecords]);

  const totalUnpaidAmount = useMemo(() => {
    return unpaidLoans.reduce((sum, p) => sum + (p.jumlah || 0), 0);
  }, [unpaidLoans]);

  // Available unique case numbers for dropdown filter
  const availableNomorPerkara = useMemo(() => {
    const setPerkara = new Set<string>();
    records.forEach(r => {
      if (r.nomorPerkara && r.nomorPerkara.trim()) {
        setPerkara.add(r.nomorPerkara.trim());
      }
    });
    cases.forEach(c => {
      if (c.nomorPerkara && c.nomorPerkara.trim()) {
        setPerkara.add(c.nomorPerkara.trim());
      }
    });
    return Array.from(setPerkara).sort();
  }, [records, cases]);

  // Modal Add Manual SKUM
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [formNomorPerkara, setFormNomorPerkara] = useState('');
  const [formUraian, setFormUraian] = useState('');
  const [formJenisTransaksi, setFormJenisTransaksi] = useState<'DEBET' | 'KREDIT'>('KREDIT');
  const [formNominal, setFormNominal] = useState<number>(0);
  const [formKategori, setFormKategori] = useState<JurnalBiayaSkumRecord['kategori']>('Panggilan');
  const [formKeterangan, setFormKeterangan] = useState('');

  // Modal Edit SKUM
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<JurnalBiayaSkumRecord | null>(null);
  const [editTanggal, setEditTanggal] = useState('');
  const [editNomorPerkara, setEditNomorPerkara] = useState('');
  const [editUraian, setEditUraian] = useState('');
  const [editJenisTransaksi, setEditJenisTransaksi] = useState<'DEBET' | 'KREDIT'>('KREDIT');
  const [editNominal, setEditNominal] = useState<number>(0);
  const [editKategori, setEditKategori] = useState<JurnalBiayaSkumRecord['kategori']>('Panggilan');
  const [editKeterangan, setEditKeterangan] = useState('');

  // SKUM Minus Analysis Modal State
  const [isSkumMinusModalOpen, setIsSkumMinusModalOpen] = useState(false);
  const [selectedSkumMonth, setSelectedSkumMonth] = useState<string | null>(null);

  const handleStartEdit = (record: JurnalBiayaSkumRecord) => {
    setEditingRecord(record);
    setEditTanggal(record.tanggal || new Date().toISOString().split('T')[0]);
    setEditNomorPerkara(record.nomorPerkara);
    setEditUraian(record.uraian);
    if ((record.penerimaan || 0) > 0) {
      setEditJenisTransaksi('DEBET');
      setEditNominal(record.penerimaan);
    } else {
      setEditJenisTransaksi('KREDIT');
      setEditNominal(record.pengeluaran || 0);
    }
    setEditKategori(record.kategori || 'Panggilan');
    setEditKeterangan(record.keterangan || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !editNomorPerkara || !editUraian || editNominal <= 0) {
      alert('Mohon isi nomor perkara, uraian, dan nominal transaksi yang valid (> 0).');
      return;
    }

    const isKredit = editJenisTransaksi === 'KREDIT';
    const finalKategori = isKredit && editKategori === 'Panjar' ? 'Panggilan' : editKategori;

    onUpdateRecord({
      ...editingRecord,
      tanggal: editTanggal,
      nomorPerkara: editNomorPerkara,
      uraian: editUraian,
      penerimaan: isKredit ? 0 : editNominal,
      pengeluaran: isKredit ? editNominal : 0,
      kategori: finalKategori,
      keterangan: editKeterangan
    });

    setIsEditModalOpen(false);
    setEditingRecord(null);
  };

  // Monthly SKUM breakdown
  const monthlySkumBreakdown = useMemo(() => {
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
        if (filterTahun !== 'ALL' && yr !== filterTahun) return false;
        if (filterNomorPerkara !== 'ALL' && r.nomorPerkara !== filterNomorPerkara) return false;
        return mo === m.num;
      });

      const debet = monthRecords.reduce((s, r) => s + (r.penerimaan || 0), 0);
      const kredit = monthRecords.reduce((s, r) => s + (r.pengeluaran || 0), 0);
      const netMonth = debet - kredit;
      runningCumulative += netMonth;

      return {
        monthNum: m.num,
        monthName: m.name,
        debet,
        kredit,
        netMonth,
        runningCumulative,
        isMinus: netMonth < 0 || runningCumulative < 0,
        records: monthRecords
      };
    });
  }, [records, filterTahun, filterNomorPerkara]);

  // Filter & Sort logic
  const filteredRecords = useMemo(() => {
    return records
      .filter(r => {
        const matchQuery = 
          r.nomorPerkara.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.uraian.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.keterangan.toLowerCase().includes(searchQuery.toLowerCase());

        const matchNomorPerkara = filterNomorPerkara === 'ALL' || r.nomorPerkara === filterNomorPerkara;
        const matchCategory = filterCategory === 'ALL' || r.kategori === filterCategory;

        let matchMonthYear = true;
        if (r.tanggal) {
          const d = new Date(r.tanggal);
          if (!isNaN(d.getTime())) {
            if (filterTahun !== 'ALL' && d.getFullYear().toString() !== filterTahun) {
              matchMonthYear = false;
            }
            if (filterBulan !== 'ALL' && (d.getMonth() + 1).toString().padStart(2, '0') !== filterBulan) {
              matchMonthYear = false;
            }
          }
        }

        return matchQuery && matchNomorPerkara && matchCategory && matchMonthYear;
      })
      .sort((a, b) => {
        const dateA = a.tanggal || '';
        const dateB = b.tanggal || '';
        if (dateA !== dateB) {
          return sortDirection === 'ASC' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
        }
        const createdA = a.createdAt || '';
        const createdB = b.createdAt || '';
        return sortDirection === 'ASC' ? createdA.localeCompare(createdB) : createdB.localeCompare(createdA);
      });
  }, [records, searchQuery, filterNomorPerkara, filterCategory, filterBulan, filterTahun, sortDirection]);

  // Calculate totals
  const totalDebet = filteredRecords.reduce((acc, r) => acc + (r.penerimaan || 0), 0);
  const totalKredit = filteredRecords.reduce((acc, r) => acc + (r.pengeluaran || 0), 0);
  const saldoSkum = totalDebet - totalKredit;

  // Detect records with dual posting (both penerimaan > 0 AND pengeluaran > 0)
  const doublePostingRecords = useMemo(() => {
    return records.filter(r => (r.penerimaan || 0) > 0 && (r.pengeluaran || 0) > 0);
  }, [records]);

  const handleFixDoublePosting = () => {
    if (doublePostingRecords.length === 0) return;
    doublePostingRecords.forEach(r => {
      const isDebet = (r.kategori === 'Panjar' && !r.uraian.toLowerCase().includes('sisa panjar')) || 
                      (r.uraian && r.uraian.toLowerCase().includes('panjar awal'));
      onUpdateRecord({
        ...r,
        penerimaan: isDebet ? (r.penerimaan || r.pengeluaran) : 0,
        pengeluaran: isDebet ? 0 : (r.pengeluaran || r.penerimaan)
      });
    });
    alert(`Berhasil memperbarui ${doublePostingRecords.length} transaksi agar posting Debet dan Kredit tidak ganda/terisi bersamaan.`);
  };

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNomorPerkara || !formUraian || formNominal <= 0) {
      alert('Mohon lengkapi nomor perkara, uraian, dan nominal transaksi yang valid (> 0).');
      return;
    }

    const isKredit = formJenisTransaksi === 'KREDIT';
    const finalKategori = isKredit && formKategori === 'Panjar' ? 'Panggilan' : formKategori;

    onAddRecord({
      tanggal: formTanggal,
      nomorPerkara: formNomorPerkara,
      uraian: formUraian,
      penerimaan: isKredit ? 0 : formNominal,
      pengeluaran: isKredit ? formNominal : 0,
      kategori: finalKategori,
      keterangan: formKeterangan || 'Log Transaksi Manual Jurnal SKUM'
    });

    setIsAddModalOpen(false);
    setFormUraian('');
    setFormNominal(0);
    setFormKeterangan('');
  };

  const handleFormSubmitPinjaman = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinjamPeminjam.trim() || pinjamJumlah <= 0) {
      alert('Mohon lengkapi peminjam / keperluan kepaniteraan dan nominal pinjaman yang valid.');
      return;
    }

    onAddPinjaman?.({
      tanggal: pinjamTanggal,
      nomorPerkara: pinjamNomorPerkara || 'Kepaniteraan Umum',
      peminjam: pinjamPeminjam.trim(),
      jumlah: pinjamJumlah,
      keterangan: pinjamKeterangan.trim()
    });

    setIsPinjamanModalOpen(false);
    setPinjamPeminjam('');
    setPinjamJumlah(0);
    setPinjamKeterangan('');
  };

  const handlePrintJurnalReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const bulanName = filterBulan === 'ALL' ? 'Semua Bulan' : `Bulan Ke-${filterBulan}`;
    const tahunName = filterTahun === 'ALL' ? 'Semua Tahun' : filterTahun;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Laporan Jurnal Biaya SKUM Perkara</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 30px; color: #111; font-size: 11px; }
          .title { text-align: center; margin-bottom: 20px; text-transform: uppercase; }
          .title h2 { margin: 0; font-size: 16px; }
          .title h3 { margin: 4px 0 0 0; font-size: 13px; font-weight: normal; }
          .period { text-align: center; font-style: italic; margin-bottom: 20px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #333; padding: 6px 8px; font-size: 10px; }
          th { background-color: #f2f2f2; font-weight: bold; text-align: center; text-transform: uppercase; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 230px; }
        </style>
      </head>
      <body>
        <div class="title">
          <h2>BUKU JURNAL BIAYA PERKARA (SKUM)</h2>
          <h3>PENGADILAN AGAMA</h3>
        </div>
        <div class="period">
          Periode: ${bulanName} ${tahunName}
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">No</th>
              <th style="width: 80px;">Tanggal</th>
              <th style="width: 140px;">Nomor Perkara</th>
              <th>Uraian Transaksi Jurnal</th>
              <th style="width: 110px;">Debet / Panjar (Rp)</th>
              <th style="width: 110px;">Kredit / Biaya (Rp)</th>
              <th style="width: 90px;">Kategori</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRecords.length === 0 ? `
              <tr><td colspan="7" class="text-center" style="padding: 20px;">Belum ada data jurnal SKUM perkara.</td></tr>
            ` : filteredRecords.map((r, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td class="text-center">${r.tanggal || '-'}</td>
                <td class="font-bold">${r.nomorPerkara}</td>
                <td>${r.uraian}</td>
                <td class="text-right">${r.penerimaan > 0 ? 'Rp ' + r.penerimaan.toLocaleString('id-ID') : '-'}</td>
                <td class="text-right">${r.pengeluaran > 0 ? 'Rp ' + r.pengeluaran.toLocaleString('id-ID') : '-'}</td>
                <td class="text-center">${r.kategori}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #f9f9f9; font-weight: bold;">
              <td colspan="4" class="text-right">TOTAL (Rp):</td>
              <td class="text-right">Rp ${totalDebet.toLocaleString('id-ID')}</td>
              <td class="text-right">Rp ${totalKredit.toLocaleString('id-ID')}</td>
              <td></td>
            </tr>
            <tr style="background-color: #e0f2fe; font-weight: bold;">
              <td colspan="4" class="text-right">SALDO TERSISA SKUM PERKARA:</td>
              <td colspan="3" class="text-center" style="font-size: 11px;">Rp ${saldoSkum.toLocaleString('id-ID')}</td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">
          <div class="sig-box">
            Mengetahui,<br/>Panitera<br/><br/><br/><br/>
            ( _______________________ )
          </div>
          <div class="sig-box">
            Kasir / Pengelola SKUM,<br/><br/><br/><br/>
            ( _______________________ )
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border transition-all shadow-sm ${
        isLight ? 'bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-900 text-white border-sky-700' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-sky-500/20 rounded-2xl border border-sky-400/30 text-sky-200 backdrop-blur-md">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black tracking-tight text-white">📖 Buku Jurnal Biaya SKUM Perkara</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/30 text-sky-200 border border-sky-400/30 uppercase tracking-wider">
                  Log Panjar Perkara
                </span>
              </div>
              <p className="text-xs text-sky-100/80 mt-1 max-w-2xl leading-relaxed">
                Pencatatan resmi penerimaan panjar (SKUM) & seluruh rincian komponen biaya perkara (Panggilan, Meterai, Redaksi, ATK, Sisa Panjar).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="open-pinjam-skum-btn"
              onClick={() => setIsPinjamanModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md active:scale-95"
              title="Pinjam Uang Saldo SKUM untuk Keperluan Kepaniteraan"
            >
              <HandCoins className="w-4 h-4" />
              <span>📌 Pinjam Saldo SKUM</span>
            </button>

            <button
              id="open-autojurnal-btn"
              onClick={onOpenJurnalModal}
              className="flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md active:scale-95"
            >
              <Calculator className="w-4 h-4" />
              <span>Pencatatan Jurnal Otomatis</span>
            </button>

            <button
              id="open-add-skum-manual-btn"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Log SKUM Manual</span>
            </button>

            <button
              id="print-jurnal-skum-btn"
              onClick={handlePrintJurnalReport}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition-all border border-white/20"
              title="Cetak Laporan Jurnal SKUM"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Cetak</span>
            </button>
          </div>
        </div>
      </div>

      {/* BOX INFORMASI KHUSUS PERINGATAN PEMINJAMAN SALDO SKUM */}
      {unpaidLoans.length > 0 ? (
        <div className={`p-4 sm:p-5 rounded-2xl border-2 shadow-lg transition-all ${
          isLight 
            ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/80 border-amber-400 text-slate-900 shadow-amber-100' 
            : 'bg-gradient-to-r from-amber-950/90 via-orange-950/70 to-slate-900 border-amber-500/80 text-amber-100 shadow-amber-950/50'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-amber-200/80 dark:border-amber-800/60">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-md animate-pulse shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-base sm:text-lg tracking-tight text-amber-900 dark:text-amber-200">
                    PERINGATAN: TERDAPAT PEMINJAMAN SALDO SKUM KEPANITERAAN
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-600 text-white shadow-sm flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                    <span>{unpaidLoans.length} BELUM DIBAYAR</span>
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                  Saldo SKUM sementara terpotong untuk keperluan kepaniteraan (tidak masuk Buku Bantu Biaya Proses). Tekan tombol <span className="font-extrabold underline">Sudah Dibayar</span> setelah dana dikembalikan agar saldo SKUM utuh kembali.
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 self-end md:self-auto shrink-0">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400 block">Total Dipinjam</span>
                <span className="text-lg sm:text-xl font-black font-mono text-red-600 dark:text-red-400">
                  Rp {totalUnpaidAmount.toLocaleString('id-ID')}
                </span>
              </div>
              <button
                onClick={() => setIsRiwayatPinjamanModalOpen(true)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 shadow-sm ${
                  isLight 
                    ? 'bg-white hover:bg-amber-100 text-amber-900 border-amber-300' 
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-200 border-amber-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Riwayat Pinjaman ({pinjamanRecords.length})</span>
              </button>
            </div>
          </div>

          {/* Cards list of active unpaid loans as evidence */}
          <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unpaidLoans.map((p) => (
              <div key={p.id} className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                isLight 
                  ? 'bg-white/95 border-amber-300/90 shadow-sm hover:shadow-md' 
                  : 'bg-slate-900/95 border-amber-800/90 shadow-md'
              }`}>
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      {p.nomorPerkara}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      📅 {p.tanggal}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                    👤 {p.peminjam}
                  </h4>
                  {p.keterangan && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 italic bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      "{p.keterangan}"
                    </p>
                  )}
                  <div className="mt-2 text-right">
                    <span className="text-[10px] text-slate-400 block">Nominal Dipinjam</span>
                    <span className="text-base font-black font-mono text-amber-600 dark:text-amber-400">
                      Rp {p.jumlah.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                    <span>Belum Dibayar</span>
                  </span>
                  <button
                    onClick={() => {
                      if (window.confirm(`Konfirmasi Pelunasan Pinjaman:\n\nApakah uang saldo SKUM sebesar Rp ${p.jumlah.toLocaleString('id-ID')} dari peminjam "${p.peminjam}" (${p.nomorPerkara}) telah DIBAYAR & DIKEMBALIKAN ke Saldo SKUM?`)) {
                        onBayarPinjaman?.(p.id);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow transition-all flex items-center space-x-1.5 active:scale-95"
                    title="Tekan jika uang sudah dikembalikan ke kas SKUM"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sudah Dibayar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
          isLight ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-emerald-950/30 border-emerald-900/60 text-emerald-300'
        }`}>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>Status Saldo SKUM Kepaniteraan:</strong> Tidak ada peminjam saldo SKUM yang tertunggak. Semua saldo SKUM berada dalam kondisi utuh.
            </span>
          </div>
          {pinjamanRecords.length > 0 && (
            <button
              onClick={() => setIsRiwayatPinjamanModalOpen(true)}
              className="text-xs font-bold underline hover:no-underline text-emerald-700 dark:text-emerald-400 shrink-0 ml-2"
            >
              Lihat Riwayat ({pinjamanRecords.length})
            </button>
          )}
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Debet (Penerimaan Panjar) */}
        <div className={`p-4 rounded-2xl border shadow-sm ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Debet SKUM</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            Rp {totalDebet.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Penerimaan Panjar Awal & Tambahan</span>
        </div>

        {/* Total Kredit (Pengeluaran Biaya SKUM) */}
        <div className={`p-4 rounded-2xl border shadow-sm ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Kredit SKUM</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-xl font-extrabold text-rose-600 dark:text-rose-400">
            Rp {totalKredit.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Potongan Biaya Jurnal SKUM</span>
        </div>

        {/* Saldo SKUM Perkara */}
        <div 
          onClick={() => {
            setIsSkumMinusModalOpen(true);
            const firstMinus = monthlySkumBreakdown.find(m => m.isMinus);
            if (firstMinus) {
              setSelectedSkumMonth(firstMinus.monthNum);
            } else {
              setSelectedSkumMonth('01');
            }
          }}
          className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition-all hover:border-sky-500 hover:shadow-md active:scale-98 ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}
          title="Klik untuk melihat rincian & analisis saldo SKUM per bulan"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Saldo Perkara SKUM</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
              saldoSkum < 0 
                ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse' 
                : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
            }`}>
              {saldoSkum < 0 ? '⚠️ MINUS - Klik Rincian' : '🔍 Rincian Bulanan'}
            </span>
          </div>
          <div className={`font-mono text-xl font-extrabold ${
            saldoSkum < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'
          }`}>
            Rp {saldoSkum.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Debet Ditambah Kredit Berjalan</span>
        </div>

        {/* Total Item Log */}
        <div className={`p-4 rounded-2xl border shadow-sm ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Transaksi SKUM</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
            {filteredRecords.length} <span className="text-xs font-normal text-slate-400">Baris</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Sesuai Filter Kriteria</span>
        </div>

      </div>

      {/* Warning Banners for Discrepancies & Deficit */}
      {doublePostingRecords.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5">
                <span>⚠️ PERINGATAN POSTING GANDA: TERDETEKSI {doublePostingRecords.length} TRANSAKSI SELISIH</span>
              </h4>
              <p className="text-xs mt-1 opacity-90 leading-relaxed">
                Terdapat data log SKUM yang terisi di kolom <strong>Debet (Penerimaan)</strong> dan <strong>Kredit (Pengeluaran)</strong> secara bersamaan. Hal ini menyebabkan total di akhir berbeda/tidak seimbang.
              </p>
            </div>
          </div>
          <button
            onClick={handleFixDoublePosting}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs whitespace-nowrap shadow-sm transition-all active:scale-95"
          >
            ⚡ Perbaiki Otomatis ({doublePostingRecords.length} Data)
          </button>
        </div>
      )}

      {saldoSkum < 0 && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-900 dark:text-rose-200 flex items-center space-x-3 shadow-md">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <div>
            <h4 className="font-extrabold text-xs uppercase tracking-wide">⚠️ PERINGATAN DEFISIT SALDO JURNAL SKUM</h4>
            <p className="text-xs mt-0.5 opacity-90">
              Total pengeluaran (Rp {totalKredit.toLocaleString('id-ID')}) melebihi total penerimaan (Rp {totalDebet.toLocaleString('id-ID')}). Terdapat defisit saldo sebesar <strong className="font-black underline">Rp {Math.abs(saldoSkum).toLocaleString('id-ID')}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-3 ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nomor perkara, uraian SKUM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-sky-500 ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-white'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Nomor Perkara Filter */}
          <select
            value={filterNomorPerkara}
            onChange={(e) => setFilterNomorPerkara(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border font-semibold ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <option value="ALL">Semua Nomor Perkara</option>
            {availableNomorPerkara.map((nomor) => (
              <option key={nomor} value={nomor}>
                {nomor}
              </option>
            ))}
          </select>

          {/* Kategori Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border font-semibold ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <option value="ALL">Semua Kategori</option>
            <option value="Panjar">Panjar Awal / Tambah</option>
            <option value="Panggilan">Panggilan</option>
            <option value="Meterai">Meterai</option>
            <option value="Redaksi">Redaksi</option>
            <option value="ATK">Pemberkasan / ATK</option>
            <option value="Proses">Proses / PNBP</option>
            <option value="Sisa Panjar">Pengembalian Sisa Panjar</option>
          </select>

          {/* Bulan Filter */}
          <select
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border font-semibold ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <option value="ALL">Semua Bulan</option>
            {Array.from({ length: 12 }, (_, i) => {
              const monthNum = (i + 1).toString().padStart(2, '0');
              const monthName = new Date(2026, i, 1).toLocaleString('id-ID', { month: 'long' });
              return <option key={monthNum} value={monthNum}>{monthName}</option>;
            })}
          </select>

          {/* Tahun Filter */}
          <select
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border font-semibold ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <option value="ALL">Semua Tahun</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>

          {/* Urutan Filter */}
          <select
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value as 'ASC' | 'DESC')}
            className={`px-3 py-2 rounded-xl text-xs border font-semibold ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <option value="ASC">Urutan: Tanggal (Terlama ke Terbaru)</option>
            <option value="DESC">Urutan: Tanggal (Terbaru ke Terlama)</option>
          </select>
        </div>
      </div>

      {/* Main Journal Data Table */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b font-extrabold uppercase text-[10px] tracking-wider ${
                isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
              }`}>
                <th className="p-3 text-center w-10">No</th>
                <th className="p-3 w-28">Tanggal</th>
                <th className="p-3 w-48">Nomor Perkara</th>
                <th className="p-3">Uraian Transaksi SKUM</th>
                <th className="p-3 text-right w-32">Debet (Panjar)</th>
                <th className="p-3 text-right w-32">Kredit (Pengeluaran)</th>
                <th className="p-3 text-center w-28">Kategori</th>
                <th className="p-3 text-center w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                      <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Belum Ada Data Jurnal SKUM</p>
                      <p className="text-xs text-slate-400">
                        Pilih menu "Pencatatan Jurnal Otomatis" atau "+ Log SKUM Manual" untuk menambahkan rincian.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr 
                    key={`${r.id}-${idx}`} 
                    className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      r.kategori === 'ATK' ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
                    }`}
                  >
                    <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{r.tanggal || '-'}</td>
                    <td className="p-3 font-mono font-bold text-sky-700 dark:text-sky-400">
                      {r.nomorPerkara}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{r.uraian}</div>
                      {r.keterangan && (
                        <div className="text-[10px] text-slate-400 mt-0.5">{r.keterangan}</div>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {r.penerimaan > 0 ? `Rp ${r.penerimaan.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {r.pengeluaran > 0 ? `Rp ${r.pengeluaran.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        r.kategori === 'Panjar' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                          : r.kategori === 'ATK'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {r.kategori}
                      </span>
                    </td>
                    <td className="p-3 text-center space-x-1">
                      <button
                        onClick={() => handleStartEdit(r)}
                        className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
                        title="Edit data log SKUM ini"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteRecord(r.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Hapus baris log ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className={`border-t font-black text-xs ${
                isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-800 text-white'
              }`}>
                <td colSpan={4} className="p-3 text-right uppercase tracking-wider">TOTAL KESELURUHAN SKUM:</td>
                <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                  Rp {totalDebet.toLocaleString('id-ID')}
                </td>
                <td className="p-3 text-right font-mono text-rose-600 dark:text-rose-400">
                  Rp {totalKredit.toLocaleString('id-ID')}
                </td>
                <td colSpan={2} className="p-3 text-center font-mono text-sky-600 dark:text-sky-400">
                  Saldo: Rp {saldoSkum.toLocaleString('id-ID')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal Add SKUM Manual */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isLight ? 'bg-sky-50 border-sky-100 text-sky-900' : 'bg-slate-800 border-slate-700'
            }`}>
              <div className="flex items-center space-x-2 font-bold text-sm">
                <BookOpen className="w-5 h-5 text-sky-600" />
                <span>+ Input Log Transaksi SKUM Manual</span>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitManual} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1">Pilih / Ketik Nomor Perkara:</label>
                <input
                  type="text"
                  list="case-numbers-list"
                  placeholder="e.g. 1/Pdt.G/2026/PA.Pan"
                  value={formNomorPerkara}
                  onChange={(e) => setFormNomorPerkara(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-mono font-bold ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                  }`}
                  required
                />
                <datalist id="case-numbers-list">
                  {cases.map((c, idx) => (
                    <option key={`c-opt-1-${c.id}-${idx}`} value={c.nomorPerkara}>{c.namaPihak}</option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Tanggal Transaksi:</label>
                  <input
                    type="date"
                    value={formTanggal}
                    onChange={(e) => setFormTanggal(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-mono ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Jenis Transaksi SKUM:</label>
                  <select
                    value={formJenisTransaksi}
                    onChange={(e) => {
                      const val = e.target.value as 'DEBET' | 'KREDIT';
                      setFormJenisTransaksi(val);
                      if (val === 'KREDIT' && formKategori === 'Panjar') {
                        setFormKategori('Panggilan');
                      } else if (val === 'DEBET') {
                        setFormKategori('Panjar');
                      }
                    }}
                    className={`w-full p-2.5 rounded-xl border font-bold ${
                      formJenisTransaksi === 'KREDIT'
                        ? 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-200'
                    }`}
                  >
                    <option value="KREDIT">🔴 KREDIT (Pengeluaran / Potong Saldo)</option>
                    <option value="DEBET">🟢 DEBET (Penerimaan / Tambah Panjar)</option>
                  </select>
                </div>
              </div>

              {/* Status Helper Banner */}
              <div className={`p-2.5 rounded-xl text-[11px] font-semibold border flex items-center space-x-2 ${
                formJenisTransaksi === 'KREDIT'
                  ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              }`}>
                <span>
                  {formJenisTransaksi === 'KREDIT'
                    ? '🔴 Pengeluaran / Potongan Biaya: Saldo perkara akan BERKURANG sebesar nominal yang diinput.'
                    : '🟢 Penerimaan Panjar Awal / Tambahan: Saldo perkara akan BERTAMBAH sebesar nominal yang diinput.'}
                </span>
              </div>

              <div>
                <label className="block font-bold mb-1">Uraian Transaksi SKUM:</label>
                <input
                  type="text"
                  placeholder="e.g. Biaya Panggilan I Tergugat"
                  value={formUraian}
                  onChange={(e) => setFormUraian(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-semibold ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                  }`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Nominal (Rp):</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="0"
                    value={formNominal !== undefined && formNominal !== null && formNominal > 0 ? formNominal : ''}
                    onChange={(e) => setFormNominal(Number(e.target.value))}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Kategori:</label>
                  <select
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value as any)}
                    className={`w-full p-2.5 rounded-xl border font-semibold ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    {formJenisTransaksi === 'DEBET' ? (
                      <option value="Panjar">Panjar Awal / Tambah Panjar</option>
                    ) : (
                      <>
                        <option value="Panggilan">Panggilan</option>
                        <option value="Meterai">Meterai</option>
                        <option value="Redaksi">Redaksi</option>
                        <option value="ATK">Pemberkasan / ATK</option>
                        <option value="Proses">Proses / PNBP</option>
                        <option value="Sisa Panjar">Pengembalian Sisa Panjar</option>
                        <option value="Lainnya">Lainnya</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Keterangan / Catatan:</label>
                <input
                  type="text"
                  placeholder="Opsional catatan"
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                  }`}
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-md"
                >
                  Simpan Log SKUM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Log SKUM */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isLight ? 'bg-sky-50 border-sky-100 text-sky-900' : 'bg-slate-800 border-slate-700'
            }`}>
              <div className="flex items-center space-x-2 font-bold text-sm">
                <Edit3 className="w-5 h-5 text-sky-600" />
                <span>Edit Data Log Transaksi SKUM</span>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1">Nomor Perkara:</label>
                <input
                  type="text"
                  list="edit-case-numbers-list"
                  placeholder="e.g. 1/Pdt.G/2026/PA.Pan"
                  value={editNomorPerkara}
                  onChange={(e) => setEditNomorPerkara(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-mono font-bold ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                  }`}
                  required
                />
                <datalist id="edit-case-numbers-list">
                  {cases.map((c, idx) => (
                    <option key={`c-opt-2-${c.id}-${idx}`} value={c.nomorPerkara}>{c.namaPihak}</option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Tanggal Transaksi:</label>
                  <input
                    type="date"
                    value={editTanggal}
                    onChange={(e) => setEditTanggal(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-mono ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Jenis Transaksi SKUM:</label>
                  <select
                    value={editJenisTransaksi}
                    onChange={(e) => {
                      const val = e.target.value as 'DEBET' | 'KREDIT';
                      setEditJenisTransaksi(val);
                      if (val === 'KREDIT' && editKategori === 'Panjar') {
                        setEditKategori('Panggilan');
                      } else if (val === 'DEBET') {
                        setEditKategori('Panjar');
                      }
                    }}
                    className={`w-full p-2.5 rounded-xl border font-bold ${
                      editJenisTransaksi === 'KREDIT'
                        ? 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-200'
                    }`}
                  >
                    <option value="KREDIT">🔴 KREDIT (Pengeluaran / Potong Saldo)</option>
                    <option value="DEBET">🟢 DEBET (Penerimaan / Tambah Panjar)</option>
                  </select>
                </div>
              </div>

              {/* Status Helper Banner */}
              <div className={`p-2.5 rounded-xl text-[11px] font-semibold border flex items-center space-x-2 ${
                editJenisTransaksi === 'KREDIT'
                  ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              }`}>
                <span>
                  {editJenisTransaksi === 'KREDIT'
                    ? '🔴 Pengeluaran / Potongan Biaya: Saldo perkara akan BERKURANG sebesar nominal yang diinput.'
                    : '🟢 Penerimaan Panjar Awal / Tambahan: Saldo perkara akan BERTAMBAH sebesar nominal yang diinput.'}
                </span>
              </div>

              <div>
                <label className="block font-bold mb-1">Uraian Transaksi SKUM:</label>
                <input
                  type="text"
                  placeholder="e.g. Biaya Panggilan I Tergugat"
                  value={editUraian}
                  onChange={(e) => setEditUraian(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-semibold ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                  }`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Nominal (Rp):</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="0"
                    value={editNominal !== undefined && editNominal !== null && editNominal > 0 ? editNominal : ''}
                    onChange={(e) => setEditNominal(Number(e.target.value))}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Kategori:</label>
                  <select
                    value={editKategori}
                    onChange={(e) => setEditKategori(e.target.value as any)}
                    className={`w-full p-2.5 rounded-xl border font-semibold ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    {editJenisTransaksi === 'DEBET' ? (
                      <option value="Panjar">Panjar Awal / Tambah Panjar</option>
                    ) : (
                      <>
                        <option value="Panggilan">Panggilan</option>
                        <option value="Meterai">Meterai</option>
                        <option value="Redaksi">Redaksi</option>
                        <option value="ATK">Pemberkasan / ATK</option>
                        <option value="Proses">Proses / PNBP</option>
                        <option value="Sisa Panjar">Pengembalian Sisa Panjar</option>
                        <option value="Lainnya">Lainnya</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Keterangan / Catatan:</label>
                <input
                  type="text"
                  placeholder="Opsional catatan"
                  value={editKeterangan}
                  onChange={(e) => setEditKeterangan(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                  }`}
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-md"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ANALISIS PENYEBAB MINUS SALDO PERKARA SKUM */}
      {isSkumMinusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            
            {/* Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
              saldoSkum < 0 ? 'bg-rose-950/80 text-rose-100 border-rose-800' : 'bg-sky-950/80 text-sky-100 border-sky-800'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-xl ${saldoSkum < 0 ? 'bg-rose-500/30 text-rose-300' : 'bg-sky-500/30 text-sky-300'}`}>
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    Analisis Breakdown & Penyebab Saldo Perkara SKUM ({filterTahun})
                  </h3>
                  <p className="text-xs opacity-80">
                    Menampilkan rincian Debet (Panjar Masuk) vs Kredit (Biaya Keluar) per bulan & daftar perkara yang kehabisan/minus panjar.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSkumMinusModalOpen(false)} className="p-1 rounded-lg hover:bg-white/10 text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              
              {/* Top Alert Banner */}
              <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
                saldoSkum < 0 
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200' 
                  : 'bg-sky-50 dark:bg-sky-950/50 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200'
              }`}>
                <FileText className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-sm block">
                    {saldoSkum < 0 ? '⚠️ Peringatan: Saldo Total SKUM Perkara Minus!' : 'ℹ️ Ringkasan Posisi Saldo SKUM Perkara'}
                  </span>
                  <p className="mt-1 leading-relaxed">
                    Total Saldo Perkara SKUM saat ini adalah <strong className="font-mono">Rp {saldoSkum.toLocaleString('id-ID')}</strong> (Debet: Rp {totalDebet.toLocaleString('id-ID')} | Kredit: Rp {totalKredit.toLocaleString('id-ID')}). 
                    {monthlySkumBreakdown.filter(m => m.isMinus).length > 0 ? (
                      <> Terdeteksi <strong className="text-rose-600 dark:text-rose-400 font-bold">{monthlySkumBreakdown.filter(m => m.isMinus).length} bulan</strong> memiliki kredit pengeluaran biaya SKUM melebihi debet panjar masuk.</>
                    ) : (
                      <> Saldo SKUM dalam posisi aman dan tercatat dengan seimbang.</>
                    )}
                  </p>
                </div>
              </div>

              {/* Monthly SKUM Breakdown Table */}
              <div>
                <h4 className="font-bold text-sm mb-2 text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>📊 Tabel Transaksi SKUM Per Bulan ({filterTahun}):</span>
                  <span className="text-[11px] text-slate-400 font-normal">Klik baris bulan untuk melihat detail transaksi</span>
                </h4>

                <div className="border rounded-xl overflow-hidden shadow-xs border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b font-extrabold uppercase text-[10px] ${
                        isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
                      }`}>
                        <th className="p-2.5">Bulan</th>
                        <th className="p-2.5 text-right">Debet / Panjar (Rp)</th>
                        <th className="p-2.5 text-right">Kredit / Biaya (Rp)</th>
                        <th className="p-2.5 text-right">Net Bulan Ini</th>
                        <th className="p-2.5 text-right">Saldo SKUM Akumulasi</th>
                        <th className="p-2.5 text-center">Status</th>
                        <th className="p-2.5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {monthlySkumBreakdown.map(m => {
                        const isSelected = selectedSkumMonth === m.monthNum;
                        return (
                          <tr 
                            key={m.monthNum}
                            onClick={() => setSelectedSkumMonth(m.monthNum)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-sky-50 dark:bg-sky-950/60 font-bold'
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
                              {m.debet > 0 ? `Rp ${m.debet.toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono text-rose-600 dark:text-rose-400">
                              {m.kredit > 0 ? `Rp ${m.kredit.toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className={`p-2.5 text-right font-mono font-bold ${
                              m.netMonth < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              Rp {m.netMonth.toLocaleString('id-ID')}
                            </td>
                            <td className={`p-2.5 text-right font-mono font-extrabold ${
                              m.runningCumulative < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'
                            }`}>
                              Rp {m.runningCumulative.toLocaleString('id-ID')}
                            </td>
                            <td className="p-2.5 text-center">
                              {m.netMonth < 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                  ⚠️ MINUS (Rp {m.netMonth.toLocaleString('id-ID')})
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
                                  setSelectedSkumMonth(m.monthNum);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                  isSelected 
                                    ? 'bg-sky-600 text-white' 
                                    : 'bg-slate-200 dark:bg-slate-800 hover:bg-sky-500 hover:text-white'
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
              {selectedSkumMonth && (() => {
                const selMonthData = monthlySkumBreakdown.find(m => m.monthNum === selectedSkumMonth);
                if (!selMonthData) return null;

                return (
                  <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2 border-slate-300 dark:border-slate-700">
                      <h5 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                        <span>🔍 Detail Transaksi SKUM Bulan {selMonthData.monthName} ({selMonthData.records.length} Transaksi)</span>
                        {selMonthData.netMonth < 0 && (
                          <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-bold text-[10px]">
                            Penyebab SKUM Minus Bulan Ini
                          </span>
                        )}
                      </h5>
                      <span className="font-mono font-bold text-xs text-slate-600 dark:text-slate-300">
                        Net: Rp {selMonthData.netMonth.toLocaleString('id-ID')}
                      </span>
                    </div>

                    {selMonthData.records.length === 0 ? (
                      <p className="text-slate-400 italic py-3 text-center">Tidak ada transaksi SKUM pada bulan {selMonthData.monthName}.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="font-bold border-b border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                              <th className="p-2">Tanggal</th>
                              <th className="p-2">Nomor Perkara</th>
                              <th className="p-2">Uraian Transaksi</th>
                              <th className="p-2">Kategori</th>
                              <th className="p-2 text-right">Debet (Panjar)</th>
                              <th className="p-2 text-right">Kredit (Pengeluaran)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {selMonthData.records.map((r, idx) => (
                              <tr key={`${r.id}-${idx}`} className={r.pengeluaran > 0 ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}>
                                <td className="p-2 font-mono text-slate-600 dark:text-slate-400">{r.tanggal}</td>
                                <td className="p-2 font-mono font-bold text-sky-700 dark:text-sky-400">{r.nomorPerkara || '-'}</td>
                                <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">
                                  {r.uraian}
                                  {r.keterangan && <span className="block text-[10px] text-slate-400 mt-0.5 font-normal">{r.keterangan}</span>}
                                </td>
                                <td className="p-2">
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    {r.kategori}
                                  </span>
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {r.penerimaan > 0 ? `Rp ${r.penerimaan.toLocaleString('id-ID')}` : '-'}
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                                  {r.pengeluaran > 0 ? `Rp ${r.pengeluaran.toLocaleString('id-ID')}` : '-'}
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

              {/* Cases with zero or negative balance */}
              <div>
                <h4 className="font-bold text-sm mb-2 text-slate-800 dark:text-slate-200">
                  ⚠️ Daftar Perkara Dengan Saldo SKUM Habis / Minus ({cases.filter(c => (c.saldoPerkara || 0) <= 0).length} Perkara):
                </h4>
                {cases.filter(c => (c.saldoPerkara || 0) <= 0).length === 0 ? (
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium italic">
                    Semua perkara terdaftar memiliki saldo panjar tersisa dalam batas aman.
                  </p>
                ) : (
                  <div className="border rounded-xl overflow-hidden border-slate-300 dark:border-slate-800">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold uppercase text-[10px]">
                          <th className="p-2">Nomor Perkara</th>
                          <th className="p-2">Pihak Utama</th>
                          <th className="p-2">Jenis Perkara</th>
                          <th className="p-2">Tgl Register</th>
                          <th className="p-2">Status</th>
                          <th className="p-2 text-right">Saldo Tersisa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {cases.filter(c => (c.saldoPerkara || 0) <= 0).map((c, idx) => (
                          <tr key={`${c.id}-${idx}`} className="bg-rose-50/50 dark:bg-rose-950/30">
                            <td className="p-2 font-mono font-bold text-rose-700 dark:text-rose-400">{c.nomorPerkara}</td>
                            <td className="p-2 font-medium">{c.namaPihak}</td>
                            <td className="p-2">{c.jenisPerkara}</td>
                            <td className="p-2 font-mono">{c.tanggalRegister || '-'}</td>
                            <td className="p-2">
                              <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-rose-200 text-rose-900">
                                {c.status}
                              </span>
                            </td>
                            <td className="p-2 text-right font-mono font-extrabold text-rose-600 dark:text-rose-400">
                              Rp {(c.saldoPerkara || 0).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t flex justify-end shrink-0 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800 border-slate-800'
            }`}>
              <button
                type="button"
                onClick={() => setIsSkumMinusModalOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                Tutup Analisis
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal Form Pinjam Saldo SKUM */}
      {isPinjamanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg p-6 rounded-2xl shadow-2xl border transition-all ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-md">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                    Pinjam Uang Saldo SKUM Perkara
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Peminjaman sementara saldo SKUM untuk Keperluan Kepaniteraan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPinjamanModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmitPinjaman} className="mt-4 space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Penting:</strong> Transaksi ini <u>TIDAK masuk ke menu Buku Bantu Biaya Proses</u>. Dana memotong sementara Saldo SKUM & memicu kotak peringatan khusus hingga ditekan tombol <strong>"Sudah Dibayar"</strong>.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
                  Tanggal Peminjaman
                </label>
                <input
                  type="date"
                  value={pinjamTanggal}
                  onChange={(e) => setPinjamTanggal(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-amber-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
                  Nomor Perkara / Sumber SKUM
                </label>
                <select
                  value={pinjamNomorPerkara}
                  onChange={(e) => setPinjamNomorPerkara(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-amber-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                  required
                >
                  <option value="">-- Pilih Nomor Perkara --</option>
                  {availableNomorPerkara.map(no => (
                    <option key={no} value={no}>{no}</option>
                  ))}
                  <option value="Kepaniteraan Umum">Kepaniteraan Umum (Kas General)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
                  Peminjam / Keperluan Kepaniteraan
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pembelian Map ATK Kepaniteraan / Panitera Muda Hukum"
                  value={pinjamPeminjam}
                  onChange={(e) => setPinjamPeminjam(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-amber-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
                  Jumlah Uang Dipinjam (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    placeholder="0"
                    value={pinjamJumlah || ''}
                    onChange={(e) => setPinjamJumlah(Math.max(0, Number(e.target.value) || 0))}
                    className={`w-full pl-10 pr-3 py-2 text-sm rounded-xl border font-mono font-bold focus:ring-2 focus:ring-amber-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                    }`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
                  Catatan / Keterangan Bukti Peminjaman
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Pinjam sementara menunggu pencairan anggaran operasional"
                  value={pinjamKeterangan}
                  onChange={(e) => setPinjamKeterangan(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-amber-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPinjamanModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-md flex items-center space-x-1.5 transition-all"
                >
                  <HandCoins className="w-4 h-4" />
                  <span>Simpan & Potong Saldo SKUM</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Riwayat Peminjaman Saldo SKUM */}
      {isRiwayatPinjamanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl border transition-all ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0 border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                    Riwayat Peminjaman & Pelunasan Saldo SKUM
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bukti transaksi peminjaman sementara untuk keperluan kepaniteraan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRiwayatPinjamanModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total {pinjamanRecords.length} Catatan Transaksi Peminjaman
                </span>
                <button
                  onClick={() => {
                    setIsRiwayatPinjamanModalOpen(false);
                    setIsPinjamanModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Tambah Pinjaman</span>
                </button>
              </div>

              {pinjamanRecords.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800">
                  <HandCoins className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Belum ada riwayat peminjaman saldo SKUM kepaniteraan.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-xl border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className={`font-bold border-b text-[11px] uppercase tracking-wider ${
                        isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-800 border-slate-800 text-slate-300'
                      }`}>
                        <th className="p-3">No</th>
                        <th className="p-3">Tgl Pinjam</th>
                        <th className="p-3">Nomor Perkara</th>
                        <th className="p-3">Peminjam / Keperluan</th>
                        <th className="p-3">Keterangan</th>
                        <th className="p-3 text-right">Jumlah (Rp)</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {pinjamanRecords.map((p, idx) => (
                        <tr key={p.id} className={p.status === 'BELUM_DIBAYAR' ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                          <td className="p-3 text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono font-medium">{p.tanggal}</td>
                          <td className="p-3 font-mono font-bold text-sky-600 dark:text-sky-400">{p.nomorPerkara}</td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{p.peminjam}</td>
                          <td className="p-3 text-slate-500 italic max-w-xs">{p.keterangan || '-'}</td>
                          <td className="p-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            Rp {p.jumlah.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-center">
                            {p.status === 'SUDAH_DIBAYAR' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                ✓ LUNAS ({p.tanggalBayar || 'Selesai'})
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-700 animate-pulse">
                                ⚡ BELUM DIBAYAR
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              {p.status === 'BELUM_DIBAYAR' && (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Konfirmasi: Kembalikan uang pinjaman Rp ${p.jumlah.toLocaleString('id-ID')} (${p.peminjam}) ke Saldo SKUM?`)) {
                                      onBayarPinjaman?.(p.id);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-extrabold shadow-sm"
                                  title="Tandai Sudah Dibayar"
                                >
                                  Sudah Dibayar
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (window.confirm(`Hapus catatan peminjaman SKUM dari "${p.peminjam}"?`)) {
                                    onDeletePinjaman?.(p.id);
                                  }
                                }}
                                className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50"
                                title="Hapus Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end shrink-0 border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsRiwayatPinjamanModalOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-xl font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
