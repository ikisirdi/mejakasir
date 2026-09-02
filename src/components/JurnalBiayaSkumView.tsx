import React, { useState, useMemo, useEffect } from 'react';
import { JurnalBiayaSkumRecord, CaseRecord, PinjamanSkumRecord, KasOpnameData } from '../types';
import { StorageService } from '../services/storage';
import { SyncService } from '../services/syncService';
import { 
  BookOpen, 
  Search, 
  PlusCircle, 
  Plus,
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
  Receipt,
  Palette,
  Check,
  RefreshCw,
  ArrowRight,
  Scale,
  SlidersHorizontal,
  HelpCircle,
  Smartphone,
  Table,
  Coins,
  Banknote,
  Zap,
  Lightbulb,
  CloudUpload
} from 'lucide-react';

export const getEffectiveWarnaBaris = (r: { warnaBaris?: string; keterangan?: string }): 'hijau' | 'kuning' | 'merah' | 'oranye' | 'default' => {
  if (r.warnaBaris && r.warnaBaris !== 'default') {
    return r.warnaBaris as any;
  }
  if (r.keterangan) {
    const match = r.keterangan.match(/\[WARNA:(hijau|kuning|merah|oranye|default)\]/i);
    if (match) return match[1].toLowerCase() as any;
  }
  return 'default';
};

export const stripWarnaTag = (keterangan?: string): string => {
  if (!keterangan) return '';
  return keterangan.replace(/\[WARNA:(hijau|kuning|merah|oranye|default)\]/gi, '').trim();
};

interface JurnalBiayaSkumViewProps {
  records: JurnalBiayaSkumRecord[];
  cases: CaseRecord[];
  pinjamanRecords?: PinjamanSkumRecord[];
  onAddRecord: (record: Omit<JurnalBiayaSkumRecord, 'id' | 'createdAt'>) => void;
  onUpdateRecord: (record: JurnalBiayaSkumRecord) => void;
  onDeleteRecord: (id: string) => void;
  onOpenJurnalModal: () => void;
  onAddPinjaman?: (data: { tanggal: string; nomorPerkara: string; peminjam: string; jumlah: number; keterangan: string }) => void;
  onUpdatePinjaman?: (pinjaman: PinjamanSkumRecord) => void;
  onBayarPinjaman?: (pinjamanId: string) => void;
  onDeletePinjaman?: (pinjamanId: string) => void;
  onSyncAllColorsToCloud?: () => Promise<{ success: boolean; total: number; synced: number }>;
  onNavigateToKasKuning?: () => void;
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
  onUpdatePinjaman,
  onBayarPinjaman,
  onDeletePinjaman,
  onSyncAllColorsToCloud,
  onNavigateToKasKuning,
  theme = 'light'
}) => {
  const isLight = theme === 'light';

  // Local Filter & Form States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNomorPerkara, setFilterNomorPerkara] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterBulan, setFilterBulan] = useState<string>('ALL');
  const [filterTahun, setFilterTahun] = useState<string>(new Date().getFullYear().toString());
  const [filterWarna, setFilterWarna] = useState<string>('ALL');
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');

  // View Mode: otomatis 'mobile' pada layar HP (< 768px), atau switchable 'table'
  const [viewMode, setViewMode] = useState<'mobile' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'mobile' : 'table';
    }
    return 'table';
  });

  // Modal Pinjaman Saldo SKUM
  const [isPinjamanModalOpen, setIsPinjamanModalOpen] = useState(false);
  const [isRiwayatPinjamanModalOpen, setIsRiwayatPinjamanModalOpen] = useState(false);
  const [isRekonsiliasiModalOpen, setIsRekonsiliasiModalOpen] = useState(false);
  const [isDebetBreakdownModalOpen, setIsDebetBreakdownModalOpen] = useState(false);
  const [modeKasBelumSetor, setModeKasBelumSetor] = useState<'auto' | 'kuning' | 'all-unsettled' | 'custom'>('auto');
  const [customKasBelumSetor, setCustomKasBelumSetor] = useState<number>(0);
  const [pinjamTanggal, setPinjamTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [pinjamNomorPerkara, setPinjamNomorPerkara] = useState('');
  const [pinjamPeminjam, setPinjamPeminjam] = useState('');
  const [pinjamJumlah, setPinjamJumlah] = useState<number>(0);
  const [pinjamKeterangan, setPinjamKeterangan] = useState('');

  // State Edit Pinjaman Modal
  const [editingPinjaman, setEditingPinjaman] = useState<PinjamanSkumRecord | null>(null);
  const [isEditPinjamanModalOpen, setIsEditPinjamanModalOpen] = useState(false);
  const [editPinjamTanggal, setEditPinjamTanggal] = useState('');
  const [editPinjamNomorPerkara, setEditPinjamNomorPerkara] = useState('');
  const [editPinjamPeminjam, setEditPinjamPeminjam] = useState('');
  const [editPinjamJumlah, setEditPinjamJumlah] = useState<number>(0);
  const [editPinjamKeterangan, setEditPinjamKeterangan] = useState('');
  const [editPinjamStatus, setEditPinjamStatus] = useState<'BELUM_DIBAYAR' | 'SUDAH_DIBAYAR'>('BELUM_DIBAYAR');
  const [editPinjamTanggalBayar, setEditPinjamTanggalBayar] = useState('');

  // Kas Opname & Pemeriksaan Selisih Kasir (Disimpan ke LocalStorage & Cloud agar tetap persisten antar device)
  const [auditKasFisikInput, setAuditKasFisikInput] = useState<number>(() => {
    const savedOpname = StorageService.getKasOpname();
    if (savedOpname && typeof savedOpname.saldoFisikKasir === 'number') {
      return savedOpname.saldoFisikKasir;
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jurnal_skum_aktual_kasir');
      if (saved !== null && !isNaN(Number(saved))) {
        return Number(saved);
      }
    }
    return 0;
  });
  const [isSyncingKasOpname, setIsSyncingKasOpname] = useState(false);
  const [kasOpnameSyncSuccess, setKasOpnameSyncSuccess] = useState(false);

  // Kalkulator Denominasi Pecahan Fisik Kasir (Kertas & Logam)
  const [denominations, setDenominations] = useState<{ [key: number]: number }>(() => {
    const savedOpname = StorageService.getKasOpname();
    if (savedOpname && savedOpname.denominations) {
      return savedOpname.denominations;
    }
    return {
      100000: 0,
      50000: 0,
      20000: 0,
      10000: 0,
      5000: 0,
      2000: 0,
      1000: 0,
      500: 0,
      200: 0,
      100: 0
    };
  });
  const [isDenominationOpen, setIsDenominationOpen] = useState(false);

  // Fungsi update Kas Fisik Aktual dengan auto-save lokal
  const handleUpdateAuditKasFisik = (val: number) => {
    const cleanVal = Math.max(0, val);
    setAuditKasFisikInput(cleanVal);
    StorageService.saveKasOpname({
      id: 'kas-opname-latest',
      tanggal: new Date().toISOString().split('T')[0],
      saldoFisikKasir: cleanVal,
      saldoStandarBuku: saldoFisikStandarBuku,
      selisih: cleanVal - saldoFisikStandarBuku,
      statusSelisih: cleanVal === saldoFisikStandarBuku ? 'PAS' : cleanVal > saldoFisikStandarBuku ? 'SURPLUS' : 'DEFISIT',
      modeKasBelumSetor: modeKasBelumSetor,
      customKasBelumSetor: customKasBelumSetor,
      denominations: denominations,
      updatedAt: new Date().toISOString()
    });
  };

  const handleSyncKasOpnameToCloud = async () => {
    const syncSettings = StorageService.getSyncSettings();
    if (!syncSettings.googleSheetUrl) {
      alert('URL Google Apps Script belum dikonfigurasi di menu Sinkronisasi Spreadsheet.');
      return;
    }
    setIsSyncingKasOpname(true);
    try {
      const dataToSave: KasOpnameData = {
        id: 'kas-opname-latest',
        tanggal: new Date().toISOString().split('T')[0],
        saldoFisikKasir: auditKasFisikInput,
        saldoStandarBuku: saldoFisikStandarBuku,
        selisih: selisihAuditKasir,
        statusSelisih: selisihAuditKasir === 0 ? 'PAS' : selisihAuditKasir > 0 ? 'SURPLUS' : 'DEFISIT',
        modeKasBelumSetor: modeKasBelumSetor,
        customKasBelumSetor: customKasBelumSetor,
        denominations: denominations,
        catatan: `Kas Opname Kasir per ${new Date().toLocaleDateString('id-ID')}`,
        updatedAt: new Date().toISOString()
      };
      StorageService.saveKasOpname(dataToSave);
      const ok = await SyncService.saveKasOpnameToCloud(syncSettings.googleSheetUrl, dataToSave);
      if (ok) {
        setKasOpnameSyncSuccess(true);
        setTimeout(() => setKasOpnameSyncSuccess(false), 4000);
      } else {
        alert('Data tersimpan secara lokal di browser. Untuk sinkron ke Google Sheet, pastikan kode.gs terbaru sudah dipaste di Apps Script Spreadsheet Anda.');
      }
    } catch (err) {
      console.error('Error syncing kas opname to cloud:', err);
    } finally {
      setIsSyncingKasOpname(false);
    }
  };

  const totalCalculatedFromDenominations = useMemo(() => {
    return Object.entries(denominations).reduce((sum, [denom, count]) => {
      return sum + (Number(denom) * (Number(count) || 0));
    }, 0);
  }, [denominations]);

  const handleApplyDenominations = () => {
    handleUpdateAuditKasFisik(totalCalculatedFromDenominations);
    setIsDenominationOpen(false);
  };

  // State sinkronisasi pinjaman ke sheet
  const [isSyncingPinjamanToCloud, setIsSyncingPinjamanToCloud] = useState(false);
  const [pinjamanSyncSuccessMessage, setPinjamanSyncSuccessMessage] = useState<string | null>(null);

  const handlePushPinjamanToCloud = async () => {
    const syncSettings = StorageService.getSyncSettings();
    const url = syncSettings.googleSheetUrl;
    if (!url) {
      alert('Google Sheet Apps Script Webhook URL belum dikonfigurasi. Buka menu Sinkronisasi Spreadsheet.');
      return;
    }
    if (pinjamanRecords.length === 0) {
      alert('Tidak ada data pinjaman untuk disinkronkan.');
      return;
    }
    setIsSyncingPinjamanToCloud(true);
    try {
      const res = await SyncService.pushPinjamanToSheet(url, pinjamanRecords);
      if (res.success || res.synced > 0) {
        setPinjamanSyncSuccessMessage(`Berhasil menyinkronkan ${res.synced} data pinjaman ke tab PinjamanSaldo!`);
        setTimeout(() => setPinjamanSyncSuccessMessage(null), 4000);
      } else {
        alert('Gagal mengirim ke Google Sheet. Pastikan Google Apps Script kode.gs terbaru sudah dideploy sebagai Web App.');
      }
    } catch (err) {
      console.error('Error pushing pinjaman:', err);
      alert('Terjadi kesalahan saat menyinkronkan data pinjaman.');
    } finally {
      setIsSyncingPinjamanToCloud(false);
    }
  };

  // Pinjaman & Piutang state and calculation
  const [pinjamanFilterTab, setPinjamanFilterTab] = useState<'ALL' | 'BELUM_DIBAYAR' | 'SUDAH_DIBAYAR'>('ALL');

  const unpaidLoans = useMemo(() => {
    return (pinjamanRecords || []).filter(p => p.status === 'BELUM_DIBAYAR');
  }, [pinjamanRecords]);

  const paidLoans = useMemo(() => {
    return (pinjamanRecords || []).filter(p => p.status === 'SUDAH_DIBAYAR');
  }, [pinjamanRecords]);

  const totalUnpaidAmount = useMemo(() => {
    return unpaidLoans.reduce((sum, p) => sum + (p.jumlah || 0), 0);
  }, [unpaidLoans]);

  const totalPaidAmount = useMemo(() => {
    return paidLoans.reduce((sum, p) => sum + (p.jumlah || 0), 0);
  }, [paidLoans]);

  const displayedPinjamanList = useMemo(() => {
    if (pinjamanFilterTab === 'BELUM_DIBAYAR') return unpaidLoans;
    if (pinjamanFilterTab === 'SUDAH_DIBAYAR') return paidLoans;
    return pinjamanRecords || [];
  }, [pinjamanFilterTab, unpaidLoans, paidLoans, pinjamanRecords]);

  const displayedTotalLoanAmount = useMemo(() => {
    return displayedPinjamanList.reduce((sum, p) => sum + (p.jumlah || 0), 0);
  }, [displayedPinjamanList]);

  // Deteksi rincian pinjaman: pinjaman kantor riil (sidkel) vs piutang kekurangan panjar pihak
  const loanBreakdown = useMemo(() => {
    let officeLoans = 0;
    let panjarKurangLoans = 0;
    const officeDetails: { id: string; uraian: string; perkara: string; jumlah: number }[] = [];
    const panjarKurangDetails: { id: string; uraian: string; perkara: string; jumlah: number }[] = [];

    unpaidLoans.forEach(p => {
      const desc = ((p.keterangan || '') + ' ' + (p.peminjam || '') + ' ' + (p.nomorPerkara || '')).toLowerCase();
      const isKurang = desc.includes('panjar tidak lengkap') || 
                       desc.includes('skul panjar') || 
                       desc.includes('panjar belum full') ||
                       desc.includes('uang panjar');
      if (isKurang) {
        panjarKurangLoans += (p.jumlah || 0);
        panjarKurangDetails.push({
          id: p.id,
          uraian: p.keterangan || 'Kekurangan Panjar Pihak',
          perkara: p.nomorPerkara || '-',
          jumlah: p.jumlah || 0
        });
      } else {
        officeLoans += (p.jumlah || 0);
        officeDetails.push({
          id: p.id,
          uraian: p.keterangan || 'Pinjaman Operasional Kantor / Sidkel',
          perkara: p.nomorPerkara || 'Kepaniteraan Umum',
          jumlah: p.jumlah || 0
        });
      }
    });

    return {
      officeLoans,
      panjarKurangLoans,
      officeDetails,
      panjarKurangDetails
    };
  }, [unpaidLoans]);

  // Color Counts for Statistics & Quick Filters (Using getEffectiveWarnaBaris to support cross-device sync)
  const countHijau = useMemo(() => records.filter(r => getEffectiveWarnaBaris(r) === 'hijau').length, [records]);
  const countKuning = useMemo(() => records.filter(r => getEffectiveWarnaBaris(r) === 'kuning').length, [records]);
  const countMerah = useMemo(() => records.filter(r => getEffectiveWarnaBaris(r) === 'merah').length, [records]);
  const countOranye = useMemo(() => records.filter(r => getEffectiveWarnaBaris(r) === 'oranye').length, [records]);
  const countDefault = useMemo(() => records.filter(r => getEffectiveWarnaBaris(r) === 'default').length, [records]);

  // Sync colors cross-device state
  const [isSyncingColors, setIsSyncingColors] = useState(false);
  const [syncColorsSuccess, setSyncColorsSuccess] = useState(false);

  const handleSyncAllColors = async () => {
    if (!onSyncAllColorsToCloud) return;
    setIsSyncingColors(true);
    try {
      const res = await onSyncAllColorsToCloud();
      if (res.success) {
        setSyncColorsSuccess(true);
        setTimeout(() => setSyncColorsSuccess(false), 4000);
      }
    } finally {
      setIsSyncingColors(false);
    }
  };

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
    // Pastikan Kepaniteraan Umum selalu tersedia secara standar dan unik
    setPerkara.add('Kepaniteraan Umum');
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
  const [formWarnaBaris, setFormWarnaBaris] = useState<'hijau' | 'kuning' | 'merah' | 'oranye' | 'default'>('default');

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
  const [editWarnaBaris, setEditWarnaBaris] = useState<'hijau' | 'kuning' | 'merah' | 'oranye' | 'default'>('default');

  // Quick set row color with dual cross-device persistence
  const handleQuickSetColor = (record: JurnalBiayaSkumRecord, color: 'hijau' | 'kuning' | 'merah' | 'oranye' | 'default') => {
    const currentWarna = getEffectiveWarnaBaris(record);
    const nextColor = currentWarna === color && color !== 'default' ? 'default' : color;
    const cleanKet = stripWarnaTag(record.keterangan);
    const updatedKeterangan = nextColor !== 'default'
      ? (cleanKet ? `${cleanKet} [WARNA:${nextColor}]` : `[WARNA:${nextColor}]`)
      : cleanKet;

    onUpdateRecord({
      ...record,
      keterangan: updatedKeterangan,
      warnaBaris: nextColor
    });
  };

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
    setEditKeterangan(stripWarnaTag(record.keterangan));
    setEditWarnaBaris(getEffectiveWarnaBaris(record));
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
    const cleanKet = stripWarnaTag(editKeterangan);
    const updatedKeterangan = editWarnaBaris !== 'default'
      ? (cleanKet ? `${cleanKet} [WARNA:${editWarnaBaris}]` : `[WARNA:${editWarnaBaris}]`)
      : cleanKet;

    onUpdateRecord({
      ...editingRecord,
      tanggal: editTanggal,
      nomorPerkara: editNomorPerkara,
      uraian: editUraian,
      penerimaan: isKredit ? 0 : editNominal,
      pengeluaran: isKredit ? editNominal : 0,
      kategori: finalKategori,
      keterangan: updatedKeterangan,
      warnaBaris: editWarnaBaris
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
        const cleanKet = stripWarnaTag(r.keterangan);
        const matchQuery = 
          r.nomorPerkara.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.uraian.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cleanKet.toLowerCase().includes(searchQuery.toLowerCase());

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

        const effWarna = getEffectiveWarnaBaris(r);
        const matchWarna = 
          filterWarna === 'ALL' ||
          (filterWarna === 'default' ? effWarna === 'default' : effWarna === filterWarna);

        return matchQuery && matchNomorPerkara && matchCategory && matchMonthYear && matchWarna;
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
  }, [records, searchQuery, filterNomorPerkara, filterCategory, filterBulan, filterTahun, filterWarna, sortDirection]);

  // Calculate totals
  const totalDebet = filteredRecords.reduce((acc, r) => acc + (r.penerimaan || 0), 0);
  const totalKredit = filteredRecords.reduce((acc, r) => acc + (r.pengeluaran || 0), 0);
  const saldoSkum = totalDebet - totalKredit;

  // Analisis Logika Penerimaan Debet SKUM:
  // Memisahkan Panjar Awal Murni dari Perkara Masuk vs Pengembalian/Pelunasan Pinjaman Kasir
  const debetBreakdown = useMemo(() => {
    const casePanjars: { nomorPerkara: string; nominal: number; tanggal: string; uraian: string; jenisPerkara: string; namaPihak: string }[] = [];
    const nonCaseDebets: { nomorPerkara: string; nominal: number; tanggal: string; uraian: string; kategori: string }[] = [];

    let totalPanjarMurni = 0;
    let totalNonPanjarDebet = 0;

    filteredRecords.forEach(r => {
      const pen = Number(r.penerimaan) || 0;
      if (pen <= 0) return;

      const isLoanRepayment = r.kategori === 'Pinjaman' || 
        (r.uraian && (
          r.uraian.toLowerCase().includes('pengembalian pinjaman') || 
          r.uraian.toLowerCase().includes('pelunasan pinjaman') ||
          r.uraian.toLowerCase().includes('pengembalian saldo') ||
          r.uraian.toLowerCase().includes('titipan')
        )) || (r.nomorPerkara && r.nomorPerkara.toLowerCase().includes('kepaniteraan'));

      if (isLoanRepayment) {
        totalNonPanjarDebet += pen;
        nonCaseDebets.push({
          nomorPerkara: r.nomorPerkara || 'Kepaniteraan Umum',
          nominal: pen,
          tanggal: r.tanggal || '-',
          uraian: r.uraian || 'Pengembalian Pinjaman Saldo SKUM',
          kategori: r.kategori || 'Pinjaman'
        });
      } else {
        totalPanjarMurni += pen;
        const matchingCase = cases.find(c => c.nomorPerkara && r.nomorPerkara && c.nomorPerkara.trim().toLowerCase() === r.nomorPerkara.trim().toLowerCase());
        casePanjars.push({
          nomorPerkara: r.nomorPerkara || '-',
          nominal: pen,
          tanggal: r.tanggal || '-',
          uraian: r.uraian || 'Penerimaan Panjar Awal',
          jenisPerkara: matchingCase?.jenisPerkara || (r.nomorPerkara?.includes('Pdt.G') ? 'Gugatan' : r.nomorPerkara?.includes('Pdt.P') ? 'Permohonan' : 'Perkara'),
          namaPihak: matchingCase?.namaPihak || '-'
        });
      }
    });

    const gugatanPanjars = casePanjars.filter(c => c.nomorPerkara.includes('Pdt.G'));
    const permohonanPanjars = casePanjars.filter(c => c.nomorPerkara.includes('Pdt.P'));
    const totalGugatan = gugatanPanjars.reduce((s, c) => s + c.nominal, 0);
    const totalPermohonan = permohonanPanjars.reduce((s, c) => s + c.nominal, 0);

    return {
      casePanjars,
      nonCaseDebets,
      totalPanjarMurni,
      totalNonPanjarDebet,
      gugatanPanjars,
      permohonanPanjars,
      totalGugatan,
      totalPermohonan,
      totalDebetMutasi: totalPanjarMurni + totalNonPanjarDebet
    };
  }, [filteredRecords, cases]);

  // Analisis Rincian Biaya Kas berdasarkan Status Setor:
  // 1. Biaya yang SUDAH DISETOR ke Bendahara Penerimaan / Kas Negara (Hijau)
  const totalBiayaSudahDisetor = useMemo(() => {
    return filteredRecords
      .filter(r => getEffectiveWarnaBaris(r) === 'hijau')
      .reduce((sum, r) => sum + (r.pengeluaran || 0), 0);
  }, [filteredRecords]);

  // 2. Biaya Kas yang BELUM DISETOR (Kuning - Kas Fisik masih dipegang Kasir / akan disetor)
  const totalKasKuningBelumSetor = useMemo(() => {
    return filteredRecords
      .filter(r => getEffectiveWarnaBaris(r) === 'kuning')
      .reduce((sum, r) => sum + ((r.pengeluaran || 0) > 0 ? r.pengeluaran : (r.penerimaan || 0)), 0);
  }, [filteredRecords]);

  // 3. Seluruh Biaya Pengeluaran yang BELUM Berstatus Disetor / Non-Hijau
  const totalKreditNonHijau = useMemo(() => {
    return filteredRecords
      .filter(r => getEffectiveWarnaBaris(r) !== 'hijau')
      .reduce((sum, r) => sum + (r.pengeluaran || 0), 0);
  }, [filteredRecords]);

  // Pinjaman saldo SKUM kepaniteraan yang belum lunas/kembali
  const effectiveUnpaidLoanAmount = useMemo(() => {
    // Jika filtering perkara spesifik, cari pinjaman perkara tersebut
    if (filterNomorPerkara !== 'ALL') {
      const caseLoans = unpaidLoans.filter(p => p.nomorPerkara && p.nomorPerkara.trim().toLowerCase() === filterNomorPerkara.trim().toLowerCase());
      if (caseLoans.length > 0) {
        return caseLoans.reduce((sum, p) => sum + (p.jumlah || 0), 0);
      }
      const pinjamPengeluaran = filteredRecords
        .filter(r => (r.kategori === 'Pinjaman' || (r.uraian || '').toLowerCase().includes('pinjam')) && (r.pengeluaran || 0) > 0)
        .reduce((sum, r) => sum + (r.pengeluaran || 0), 0);
      const pinjamPenerimaan = filteredRecords
        .filter(r => (r.kategori === 'Pinjaman' || (r.uraian || '').toLowerCase().includes('pinjam') || (r.uraian || '').toLowerCase().includes('pengembalian')) && (r.penerimaan || 0) > 0)
        .reduce((sum, r) => sum + (r.penerimaan || 0), 0);
      const net = pinjamPengeluaran - pinjamPenerimaan;
      return net > 0 ? net : 0;
    }

    if (totalUnpaidAmount > 0) {
      return totalUnpaidAmount;
    }

    const pinjamPengeluaran = filteredRecords
      .filter(r => (r.kategori === 'Pinjaman' || (r.uraian || '').toLowerCase().includes('pinjam')) && (r.pengeluaran || 0) > 0)
      .reduce((sum, r) => sum + (r.pengeluaran || 0), 0);
    const pinjamPenerimaan = filteredRecords
      .filter(r => (r.kategori === 'Pinjaman' || (r.uraian || '').toLowerCase().includes('pinjam') || (r.uraian || '').toLowerCase().includes('pengembalian')) && (r.penerimaan || 0) > 0)
      .reduce((sum, r) => sum + (r.penerimaan || 0), 0);
    const net = pinjamPengeluaran - pinjamPenerimaan;
    return net > 0 ? net : 0;
  }, [totalUnpaidAmount, unpaidLoans, filterNomorPerkara, filteredRecords]);

  // Biaya Kas yang Belum Disetor (Akan Disetor) yang efektif digunakan untuk menyesuaikan Saldo Sesungguhnya
  const effectiveBiayaKasBelumDisetor = useMemo(() => {
    if (modeKasBelumSetor === 'custom') {
      return Math.max(0, customKasBelumSetor);
    }
    if (modeKasBelumSetor === 'kuning') {
      return totalKasKuningBelumSetor;
    }
    if (modeKasBelumSetor === 'all-unsettled') {
      return totalKreditNonHijau;
    }
    // Mode 'auto':
    // 1. Jika ada transaksi bertanda Kuning (belum setor cash), prioritaskan nominal kas kuning
    if (totalKasKuningBelumSetor > 0) {
      return totalKasKuningBelumSetor;
    }
    // 2. Jika belum ada yang ditandai kuning, seluruh pengeluaran yang belum disetor (non-hijau)
    // dianggap sebagai biaya kas yang belum disetor ke bendahara (kas fisik masih di kasir)
    return totalKreditNonHijau;
  }, [modeKasBelumSetor, customKasBelumSetor, totalKasKuningBelumSetor, totalKreditNonHijau]);

  // Perhitungan Kas Standar & Sisa Panjar Murni Perkara untuk Kas Opname Kasir
  const { totalSisaPanjarMurniPerkara, saldoFisikStandarBuku, uangTunaiSeharusnyaDiLaci, selisihAuditKasir } = useMemo(() => {
    // Sisa panjar murni seluruh perkara aktif (tanpa kepaniteraan)
    const perkaraMap = new Map<string, number>();
    records.forEach(r => {
      const no = r.nomorPerkara ? r.nomorPerkara.trim() : '';
      if (no && !no.toLowerCase().includes('kepaniteraan')) {
        const cur = perkaraMap.get(no) || 0;
        perkaraMap.set(no, cur + (Number(r.penerimaan) || 0) - (Number(r.pengeluaran) || 0));
      }
    });

    let sisaPanjar = 0;
    perkaraMap.forEach((bal) => {
      sisaPanjar += bal;
    });

    // 1. Total Standar Pertanggungjawaban Buku Kasir = Sisa panjar perkara + Titipan biaya belum disetor (kuning)
    const standarFisik = sisaPanjar + effectiveBiayaKasBelumDisetor;

    // 2. Uang Tunai Murni yang Wajib Ada di Laci Meja Kasir (Standar dikurangi uang yang sedang dipinjam kasir/bon)
    const uangTunaiWajib = Math.max(0, standarFisik - effectiveUnpaidLoanAmount);

    // 3. Selisih Kas Opname terhadap uang tunai yang seharusnya di laci
    const selisih = (auditKasFisikInput || 0) - uangTunaiWajib;

    return {
      totalSisaPanjarMurniPerkara: sisaPanjar,
      saldoFisikStandarBuku: standarFisik,
      uangTunaiSeharusnyaDiLaci: uangTunaiWajib,
      selisihAuditKasir: selisih
    };
  }, [records, effectiveBiayaKasBelumDisetor, effectiveUnpaidLoanAmount, auditKasFisikInput]);

  // Saldo Sesungguhnya (Kas Riil Fisik di Kasir):
  // Rumus: Saldo Perkara SKUM + Biaya Kas Belum Disetor + Pinjaman/Bon Saldo SKUM Kepaniteraan
  // Logika: Kas fisik riil adalah sisa panjar perkara ditambah biaya kas yang belum disetor keluar kasir + bon/pinjaman yang dipegang dalam bentuk bukti kwitansi.
  const saldoSesungguhnya = saldoSkum + effectiveBiayaKasBelumDisetor + effectiveUnpaidLoanAmount;

  // Saldo Kasir Riil Murni di Laci / Tanpa Bon (Uang fisik tunai kasir saat bon masih dipinjam/belum kembali)
  const saldoKasirTanpaBon = uangTunaiSeharusnyaDiLaci;

  // Posisi Saldo Kasir Setelah Bayar Bon (Ketika seluruh bon/pinjaman dilunasi & dikembalikan ke kas):
  // - Piutang bon menjadi 0 (Lunas)
  // - Uang kas fisik di laci bertambah utuh menjadi saldoFisikStandarBuku (+Rp effectiveUnpaidLoanAmount)
  // - Saldo buku SKUM kembali naik normal (+Rp effectiveUnpaidLoanAmount)
  const saldoSetelahBayarBon = saldoFisikStandarBuku;
  const saldoBukuSetelahBayarBon = saldoSkum + effectiveUnpaidLoanAmount;

  // Biaya yang telah keluar/disetorkan secara riil dari kasir
  const biayaKasKeluarDisetor = Math.max(0, totalKredit - effectiveBiayaKasBelumDisetor);

  // Total Rekonsiliasi Kas:
  // Saldo Sesungguhnya + Biaya yang Sudah Disetor = Total Debet SKUM (+ Pinjaman jika belum kembali)
  const totalRekonsiliasiDebet = saldoSesungguhnya + biayaKasKeluarDisetor - effectiveUnpaidLoanAmount;
  const isMatchDebetSkum = Math.abs(totalRekonsiliasiDebet - totalDebet) < 1;

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

  // Terapkan Aktual Kasir ke Logika Sistem (Sync Kas Belum Setor ke Nilai Riil Kasir)
  const handleApplyCashierActualToSystem = () => {
    // Menghitung berapa nilai kas belum setor yang dibutuhkan agar Saldo Fisik Seharusnya = Aktual Kasir
    const targetKasBelumSetor = Math.max(0, auditKasFisikInput - totalSisaPanjarMurniPerkara);
    setCustomKasBelumSetor(targetKasBelumSetor);
    setModeKasBelumSetor('custom');
  };

  // Reset ke Perhitungan Standar Buku Otomatis
  const handleResetToStandardBook = () => {
    setModeKasBelumSetor('auto');
    handleUpdateAuditKasFisik(saldoFisikStandarBuku);
  };

  // Cetak Berita Acara Kas Opname & Rekonsiliasi Kasir Resmi
  const handlePrintKasOpnameReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const todayStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const hasDenom = Object.values(denominations).some((v: number) => Number(v) > 0);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Berita Acara Pemeriksaan Kas Opname Kasir</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 30px; color: #111; font-size: 11pt; line-height: 1.4; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
          .header h3 { margin: 0; font-size: 14pt; text-transform: uppercase; font-weight: bold; }
          .header h4 { margin: 2px 0 0 0; font-size: 12pt; text-transform: uppercase; }
          .header p { margin: 2px 0 0 0; font-size: 9pt; font-style: italic; }
          .doc-title { text-align: center; margin: 16px 0; }
          .doc-title h2 { margin: 0; font-size: 13pt; text-decoration: underline; text-transform: uppercase; }
          .doc-title p { margin: 2px 0 0 0; font-size: 10pt; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border: 1px solid #333; padding: 5px 8px; font-size: 10pt; }
          th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .summary-box { border: 1px solid #333; padding: 10px; margin: 12px 0; background: #fafafa; }
          .signatures { margin-top: 30px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .sig-block { width: 220px; text-align: center; font-size: 10pt; }
          .sig-space { height: 65px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>MAHKAMAH AGUNG REPUBLIK INDONESIA</h3>
          <h4>PENGADILAN AGAMA</h4>
          <p>Kepaniteraan - Kasir Biaya Perkara SKUM</p>
        </div>

        <div class="doc-title">
          <h2>BERITA ACARA PEMERIKSAAN KAS OPNAME KASIR</h2>
          <p>Tanggal Pemeriksaan: ${todayStr}</p>
        </div>

        <p>Pada hari ini, <strong>${todayStr}</strong>, telah dilakukan pemeriksaan fisik kas tunai (Kas Opname) pada Kasir Pengadilan Agama dengan hasil rekonsiliasi sebagai berikut:</p>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">NO</th>
              <th>URAIAN REKONSILIASI KAS</th>
              <th style="width: 170px;">JUMLAH NOMINAL (RP)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center">1</td>
              <td>Total Sisa Panjar Murni Perkara Berjalan (Sistem Register)</td>
              <td class="text-right font-bold">Rp ${totalSisaPanjarMurniPerkara.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td class="text-center">2</td>
              <td>Biaya Kas Panjar Belum Disetor ke Bendahara (Titipan Kas Kuning)</td>
              <td class="text-right font-bold">Rp ${effectiveBiayaKasBelumDisetor.toLocaleString('id-ID')}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td class="text-center font-bold">A</td>
              <td class="font-bold">TOTAL KAS FISIK SEHARUSNYA (STANDAR PEMBUKUAN)</td>
              <td class="text-right font-bold" style="font-size: 11pt;">Rp ${saldoFisikStandarBuku.toLocaleString('id-ID')}</td>
            </tr>
            ${effectiveUnpaidLoanAmount > 0 ? `
              <tr style="background-color: #fff1f2;">
                <td class="text-center font-bold">B</td>
                <td>Bon / Pinjaman Operasional Belum Lunas (Kwitansi Sementara)</td>
                <td class="text-right font-bold text-rose-700">- Rp ${effectiveUnpaidLoanAmount.toLocaleString('id-ID')}</td>
              </tr>
              <tr style="background-color: #ecfdf5;">
                <td class="text-center font-bold">C</td>
                <td class="font-bold">UANG TUNAI WAJIB ADA DI LACI KASIR (POSISI TANPA BON = A - B)</td>
                <td class="text-right font-bold" style="font-size: 11pt;">Rp ${uangTunaiSeharusnyaDiLaci.toLocaleString('id-ID')}</td>
              </tr>
            ` : ''}
            <tr style="background-color: #eef2ff;">
              <td class="text-center font-bold">${effectiveUnpaidLoanAmount > 0 ? 'D' : 'B'}</td>
              <td class="font-bold">HASIL PERHITUNGAN FISIK UANG DI KASIR (AKTUAL KAS OPNAME)</td>
              <td class="text-right font-bold" style="font-size: 11pt;">Rp ${auditKasFisikInput.toLocaleString('id-ID')}</td>
            </tr>
            <tr style="background-color: ${selisihAuditKasir === 0 ? '#ecfdf5' : '#fef2f2'};">
              <td class="text-center font-bold">${effectiveUnpaidLoanAmount > 0 ? 'E' : 'C'}</td>
              <td class="font-bold">SELISIH KAS OPNAME (${effectiveUnpaidLoanAmount > 0 ? 'D - C' : 'B - A'})</td>
              <td class="text-right font-bold" style="font-size: 11pt;">
                ${selisihAuditKasir >= 0 ? `+ Rp ${selisihAuditKasir.toLocaleString('id-ID')}` : `- Rp ${Math.abs(selisihAuditKasir).toLocaleString('id-ID')}`}
                (${selisihAuditKasir === 0 ? 'SEIMBANG / PAS' : selisihAuditKasir > 0 ? 'SURPLUS FISIK' : 'DEFISIT FISIK'})
              </td>
            </tr>
          </tbody>
        </table>

        ${effectiveUnpaidLoanAmount > 0 ? `
          <div style="border: 1px solid #f59e0b; background: #fffbeb; padding: 8px 12px; margin: 10px 0; font-size: 9.5pt; border-radius: 4px;">
            <strong>Informasi Komparasi Bon / Pinjaman Operasional:</strong><br/>
            • Posisi Saat Ini (Tanpa Bon Lunas): Uang kas fisik di laci = Rp ${uangTunaiSeharusnyaDiLaci.toLocaleString('id-ID')} + Kwitansi Bon Rp ${effectiveUnpaidLoanAmount.toLocaleString('id-ID')} = Total Saldo Sesungguhnya Rp ${saldoSesungguhnya.toLocaleString('id-ID')}.<br/>
            • Posisi Setelah Bayar Bon (Kas Utuh): Seluruh uang kembali ke laci kasir menjadi Rp ${saldoSetelahBayarBon.toLocaleString('id-ID')} dan saldo buku SKUM pulih normal menjadi Rp ${saldoBukuSetelahBayarBon.toLocaleString('id-ID')}.
          </div>
        ` : ''}

        ${hasDenom ? `
          <h4 style="margin: 12px 0 4px 0; font-size: 10pt;">Rincian Pecahan Fisik Uang Kasir (Denominasi):</h4>
          <table>
            <thead>
              <tr>
                <th>Pecahan Uang</th>
                <th style="width: 120px;">Jumlah Lembar / Keping</th>
                <th style="width: 150px;">Total (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(denominations).filter(([_, count]) => Number(count) > 0).map(([denom, count]) => `
                <tr>
                  <td>Pecahan Rp ${Number(denom).toLocaleString('id-ID')}</td>
                  <td class="text-center">${Number(count)} ${Number(denom) >= 1000 ? 'Lembar' : 'Keping'}</td>
                  <td class="text-right">Rp ${(Number(denom) * Number(count)).toLocaleString('id-ID')}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; background: #f9f9f9;">
                <td colspan="2" class="text-right">TOTAL DARI DENOMINASI:</td>
                <td class="text-right">Rp ${totalCalculatedFromDenominations.toLocaleString('id-ID')}</td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        <div class="summary-box">
          <strong>Catatan & Analisis Pemeriksa Kas:</strong>
          <p style="margin: 4px 0 0 0; font-size: 9.5pt;">
            ${selisihAuditKasir === 0 
              ? 'Fisik kas tunai di tangan kasir telah sesuai 100% dengan catatan pembukuan register SKUM perkara.' 
              : `Terdapat selisih ${selisihAuditKasir > 0 ? 'surplus' : 'defisit'} sebesar Rp ${Math.abs(selisihAuditKasir).toLocaleString('id-ID')}. Saldo ini telah disinkronkan dan direkonsiliasikan dengan sistem jurnal perkara SKUM.`}
          </p>
        </div>

        <div class="signatures">
          <div class="sig-block">
            <p>Mengetahui,<br/><strong>Panitera / KPA</strong></p>
            <div class="sig-space"></div>
            <p><strong>(.......................................)</strong><br/>NIP. </p>
          </div>
          <div class="sig-block">
            <p>Yang Memeriksa / Menyerahkan,<br/><strong>Kasir Biaya Perkara</strong></p>
            <div class="sig-space"></div>
            <p><strong>(.......................................)</strong><br/>NIP. </p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNomorPerkara || !formUraian || formNominal <= 0) {
      alert('Mohon lengkapi nomor perkara, uraian, dan nominal transaksi yang valid (> 0).');
      return;
    }

    const isKredit = formJenisTransaksi === 'KREDIT';
    const finalKategori = isKredit && formKategori === 'Panjar' ? 'Panggilan' : formKategori;
    const cleanKet = stripWarnaTag(formKeterangan || 'Log Transaksi Manual Jurnal SKUM');
    const finalKeterangan = formWarnaBaris !== 'default'
      ? `${cleanKet} [WARNA:${formWarnaBaris}]`
      : cleanKet;

    onAddRecord({
      tanggal: formTanggal,
      nomorPerkara: formNomorPerkara,
      uraian: formUraian,
      penerimaan: isKredit ? 0 : formNominal,
      pengeluaran: isKredit ? formNominal : 0,
      kategori: finalKategori,
      keterangan: finalKeterangan,
      warnaBaris: formWarnaBaris
    });

    setIsAddModalOpen(false);
    setFormUraian('');
    setFormNominal(0);
    setFormKeterangan('');
    setFormWarnaBaris('default');
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

  const handleOpenEditPinjaman = (p: PinjamanSkumRecord) => {
    setEditingPinjaman(p);
    setEditPinjamTanggal(p.tanggal || new Date().toISOString().split('T')[0]);
    setEditPinjamNomorPerkara(p.nomorPerkara || 'Kepaniteraan Umum');
    setEditPinjamPeminjam(p.peminjam || '');
    setEditPinjamJumlah(p.jumlah || 0);
    setEditPinjamKeterangan(p.keterangan || '');
    setEditPinjamStatus(p.status || 'BELUM_DIBAYAR');
    setEditPinjamTanggalBayar(p.tanggalBayar || new Date().toISOString().split('T')[0]);
    setIsEditPinjamanModalOpen(true);
  };

  const handleFormSubmitEditPinjaman = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPinjaman) return;
    if (!editPinjamPeminjam.trim() || editPinjamJumlah <= 0) {
      alert('Mohon lengkapi peminjam / keperluan kepaniteraan dan nominal pinjaman yang valid (> 0).');
      return;
    }

    const updated: PinjamanSkumRecord = {
      ...editingPinjaman,
      tanggal: editPinjamTanggal,
      nomorPerkara: editPinjamNomorPerkara.trim() || 'Kepaniteraan Umum',
      peminjam: editPinjamPeminjam.trim(),
      jumlah: editPinjamJumlah,
      keterangan: editPinjamKeterangan.trim(),
      status: editPinjamStatus,
      tanggalBayar: editPinjamStatus === 'SUDAH_DIBAYAR' ? (editPinjamTanggalBayar || new Date().toISOString().split('T')[0]) : undefined
    };

    onUpdatePinjaman?.(updated);
    setIsEditPinjamanModalOpen(false);
    setEditingPinjaman(null);
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
          .row-hijau { background-color: #ecfdf5 !important; }
          .row-kuning { background-color: #fef9c3 !important; }
          .row-merah { background-color: #fff1f2 !important; }
          .row-oranye { background-color: #fffbeb !important; }
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
              <th style="width: 80px;">Status Setor</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRecords.length === 0 ? `
              <tr><td colspan="8" class="text-center" style="padding: 20px;">Belum ada data jurnal SKUM perkara.</td></tr>
            ` : filteredRecords.map((r, i) => {
              const effW = getEffectiveWarnaBaris(r);
              const rowClass = effW === 'hijau' ? 'row-hijau' : effW === 'kuning' ? 'row-kuning' : effW === 'merah' ? 'row-merah' : effW === 'oranye' ? 'row-oranye' : '';
              const statusText = effW === 'hijau' ? 'Disetor (Hijau)' : effW === 'kuning' ? 'Belum Setor Cash (Kuning)' : effW === 'merah' ? 'Pinjaman (Merah)' : effW === 'oranye' ? 'Proses (Oranye)' : '-';
              return `
              <tr class="${rowClass}">
                <td class="text-center">${i + 1}</td>
                <td class="text-center">${r.tanggal || '-'}</td>
                <td class="font-bold">${r.nomorPerkara}</td>
                <td>${r.uraian}</td>
                <td class="text-right">${r.penerimaan > 0 ? 'Rp ' + r.penerimaan.toLocaleString('id-ID') : '-'}</td>
                <td class="text-right">${r.pengeluaran > 0 ? 'Rp ' + r.pengeluaran.toLocaleString('id-ID') : '-'}</td>
                <td class="text-center">${r.kategori}</td>
                <td class="text-center" style="font-weight: bold;">${statusText}</td>
              </tr>
            `;}).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #f9f9f9; font-weight: bold;">
              <td colspan="4" class="text-right">TOTAL (Rp):</td>
              <td class="text-right">Rp ${totalDebet.toLocaleString('id-ID')}</td>
              <td class="text-right">Rp ${totalKredit.toLocaleString('id-ID')}</td>
              <td colspan="2"></td>
            </tr>
            <tr style="background-color: #e0f2fe; font-weight: bold;">
              <td colspan="4" class="text-right">SALDO BUKU SKUM PERKARA:</td>
              <td colspan="4" class="text-center" style="font-size: 11px; ${saldoSkum < 0 ? 'color: #dc2626;' : ''}">Rp ${saldoSkum.toLocaleString('id-ID')}</td>
            </tr>
            ${effectiveBiayaKasBelumDisetor > 0 ? `
            <tr style="background-color: #fef9c3; font-weight: bold;">
              <td colspan="4" class="text-right">BIAYA KAS BELUM DISETOR (AKAN DISETOR):</td>
              <td colspan="4" class="text-center" style="font-size: 11px; color: #854d0e;">+ Rp ${effectiveBiayaKasBelumDisetor.toLocaleString('id-ID')}</td>
            </tr>
            ` : ''}
            ${effectiveUnpaidLoanAmount > 0 ? `
            <tr style="background-color: #fef3c7; font-weight: bold;">
              <td colspan="4" class="text-right">PINJAMAN SALDO SKUM KEPANITERAAN (BELUM KEMBALI):</td>
              <td colspan="4" class="text-center" style="font-size: 11px; color: #b45309;">+ Rp ${effectiveUnpaidLoanAmount.toLocaleString('id-ID')}</td>
            </tr>
            ` : ''}
            <tr style="background-color: #d1fae5; font-weight: bold;">
              <td colspan="4" class="text-right">SALDO SESUNGGUHNYA (KAS RIIL FISIK):</td>
              <td colspan="4" class="text-center" style="font-size: 12px; color: #047857;">Rp ${saldoSesungguhnya.toLocaleString('id-ID')}</td>
            </tr>
            <tr style="background-color: #f0fdf4; font-weight: bold; border-top: 2px solid #059669;">
              <td colspan="4" class="text-right">REKONSILIASI KAS (SALDO SESUNGGUHNYA + BIAYA TELAH DISETOR):</td>
              <td colspan="4" class="text-center" style="font-size: 11px; color: #166534;">
                Rp ${(saldoSesungguhnya + biayaKasKeluarDisetor - effectiveUnpaidLoanAmount).toLocaleString('id-ID')} 
                (100% SESUAI TOTAL DEBET SKUM: Rp ${totalDebet.toLocaleString('id-ID')})
              </td>
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

      {/* PANEL VIEWCARD: PINJAMAN SALDO & PIUTANG SKUM KEPANITERAAN */}
      <div className={`p-4 sm:p-5 rounded-2xl border-2 shadow-lg transition-all ${
        unpaidLoans.length > 0
          ? isLight 
            ? 'bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-100/70 border-amber-400 text-slate-900 shadow-amber-100/50' 
            : 'bg-gradient-to-r from-amber-950/80 via-orange-950/60 to-slate-900 border-amber-500/80 text-amber-100 shadow-amber-950/50'
          : isLight
            ? 'bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-100/70 border-slate-300 text-slate-900 shadow-slate-100'
            : 'bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-slate-700 text-slate-100'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-amber-200/80 dark:border-amber-800/60">
          <div className="flex items-start sm:items-center space-x-3">
            <div className={`p-2.5 rounded-xl text-white shadow-md shrink-0 ${
              unpaidLoans.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-indigo-600'
            }`}>
              <HandCoins className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight text-slate-900 dark:text-amber-200">
                  PANEL PINJAMAN SALDO & PIUTANG PANJAR SKUM
                </h3>
                {unpaidLoans.length > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-600 text-white shadow-sm flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                    <span>{unpaidLoans.length} BELUM LUNAS</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white shadow-sm flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>SEMUA LUNAS</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-amber-300/90 mt-0.5">
                Monitoring transaksi pinjaman operasional kantor (Sidkel), bon materai, dan piutang panjar perkara kepaniteraan.
              </p>
            </div>
          </div>
          
          <div className="flex items-center flex-wrap gap-2.5 self-start md:self-auto shrink-0">
            <div className="text-right mr-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-amber-400 block">Belum Dibayar</span>
              <span className={`text-base sm:text-lg font-black font-mono ${
                totalUnpaidAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                Rp {totalUnpaidAmount.toLocaleString('id-ID')}
              </span>
            </div>
            <button
              onClick={() => setIsPinjamanModalOpen(true)}
              className="px-3 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              title="Tambah Catatan Pinjaman Saldo SKUM Baru"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Pinjam Saldo</span>
            </button>
            <button
              onClick={() => setIsRiwayatPinjamanModalOpen(true)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer ${
                isLight 
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300' 
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-200 border-amber-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Riwayat ({pinjamanRecords.length})</span>
            </button>
            {pinjamanRecords.length > 0 && (
              <button
                onClick={handlePushPinjamanToCloud}
                disabled={isSyncingPinjamanToCloud}
                className="px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
                title="Kirim dan Sinkronkan semua data pinjaman ini ke tab PinjamanSaldo di Google Spreadsheet"
              >
                <CloudUpload className="w-3.5 h-3.5" />
                <span>{isSyncingPinjamanToCloud ? 'Mengirim...' : 'Kirim ke Spreadsheet'}</span>
              </button>
            )}
          </div>
        </div>

        {pinjamanSyncSuccessMessage && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{pinjamanSyncSuccessMessage}</span>
          </div>
        )}

        {/* Filter Tabs for Pinjaman */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setPinjamanFilterTab('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                pinjamanFilterTab === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Semua ({pinjamanRecords.length})
            </button>
            <button
              onClick={() => setPinjamanFilterTab('BELUM_DIBAYAR')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 ${
                pinjamanFilterTab === 'BELUM_DIBAYAR'
                  ? 'bg-red-600 text-white shadow-xs font-extrabold'
                  : 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
              }`}
            >
              <span>Belum Lunas ({unpaidLoans.length})</span>
            </button>
            <button
              onClick={() => setPinjamanFilterTab('SUDAH_DIBAYAR')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 ${
                pinjamanFilterTab === 'SUDAH_DIBAYAR'
                  ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              <span>Sudah Lunas ({paidLoans.length})</span>
            </button>
          </div>

          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Total Nilai Filter ({displayedPinjamanList.length} Transaksi): <strong className="font-mono text-slate-800 dark:text-slate-200">Rp {displayedTotalLoanAmount.toLocaleString('id-ID')}</strong>
          </div>
        </div>

        {/* Cards list of loans */}
        {displayedPinjamanList.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedPinjamanList.map((p) => {
              const isPiutang = ((p.keterangan || '') + ' ' + (p.peminjam || '')).toLowerCase().includes('panjar tidak lengkap') ||
                                ((p.keterangan || '') + ' ' + (p.peminjam || '')).toLowerCase().includes('skul panjar');
              const isSidkel = ((p.keterangan || '') + ' ' + (p.peminjam || '')).toLowerCase().includes('sidkel') ||
                               ((p.keterangan || '') + ' ' + (p.peminjam || '')).toLowerCase().includes('sidang keliling');
              return (
                <div key={p.id} className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  p.status === 'BELUM_DIBAYAR'
                    ? isLight 
                      ? 'bg-white/95 border-amber-300/90 shadow-sm hover:shadow-md' 
                      : 'bg-slate-900/95 border-amber-800/90 shadow-md'
                    : isLight
                      ? 'bg-slate-50/90 border-slate-200 opacity-90'
                      : 'bg-slate-900/60 border-slate-800 opacity-80'
                }`}>
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center space-x-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                          {p.nomorPerkara}
                        </span>
                        {isPiutang && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200">
                            Piutang Panjar
                          </span>
                        )}
                        {isSidkel && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200">
                            Operasional Sidkel
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        📅 {p.tanggal}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                      👤 {p.peminjam}
                    </h4>
                    {p.keterangan && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 italic bg-slate-100/70 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        "{p.keterangan}"
                      </p>
                    )}
                    <div className="mt-2 text-right">
                      <span className="text-[10px] text-slate-400 block">Nominal Transaksi</span>
                      <span className="text-base font-black font-mono text-amber-600 dark:text-amber-400">
                        Rp {p.jumlah.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center space-x-1">
                      {p.status === 'BELUM_DIBAYAR' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 flex items-center space-x-1 border border-red-300 dark:border-red-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                          <span>Belum Lunas</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center space-x-1 border border-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Sudah Lunas</span>
                        </span>
                      )}
                      {p.tanggalBayar && p.status === 'SUDAH_DIBAYAR' && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({p.tanggalBayar})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditPinjaman(p)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 shadow-2xs transition-all flex items-center space-x-1 active:scale-95 cursor-pointer"
                        title="Edit data peminjam, nominal, tanggal, atau status pinjaman ini"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      {p.status === 'BELUM_DIBAYAR' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Konfirmasi Pelunasan Pinjaman:\n\nApakah uang saldo SKUM sebesar Rp ${p.jumlah.toLocaleString('id-ID')} dari peminjam "${p.peminjam}" (${p.nomorPerkara}) telah DIBAYAR & DIKEMBALIKAN ke Saldo SKUM?\n\n(Tindakan ini akan otomatis mencatat Pengembalian Pinjaman Debet di Jurnal SKUM sehingga saldo kembali normal)`)) {
                              onBayarPinjaman?.(p.id);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow transition-all flex items-center space-x-1 active:scale-95 cursor-pointer"
                          title="Tandai Sudah Dibayar / Dikembalikan ke Kas SKUM"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Bayar / Lunas</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Ubah status pinjaman "${p.peminjam}" (${p.nomorPerkara}) kembali menjadi BELUM LUNAS?`)) {
                              onUpdatePinjaman?.({
                                ...p,
                                status: 'BELUM_DIBAYAR',
                                tanggalBayar: undefined
                              });
                            }
                          }}
                          className="px-2 py-1.5 rounded-xl text-[11px] font-bold bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 transition-all cursor-pointer flex items-center space-x-1"
                          title="Kembalikan status menjadi Belum Lunas"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Set Belum Lunas</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Hapus catatan peminjaman SKUM dari "${p.peminjam}" (${p.nomorPerkara})?`)) {
                            onDeletePinjaman?.(p.id);
                          }
                        }}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Hapus data pinjaman ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
            Tidak ada catatan pinjaman pada kategori filter ini.
          </div>
        )}
      </div>

      {/* Summary Stat Cards (5 Cards Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* Card 1: Total Debet (Penerimaan Panjar Awal Perkara Masuk) */}
        <div 
          onClick={() => setIsDebetBreakdownModalOpen(true)}
          className={`p-3.5 rounded-2xl border shadow-sm cursor-pointer transition-all hover:border-emerald-500 hover:shadow-md active:scale-98 relative group flex flex-col justify-between ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}
          title="Klik untuk melihat bedah rincian Panjar Awal per perkara masuk vs Pengembalian Pinjaman"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Panjar Awal (Debet)</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black">
                  {debetBreakdown.casePanjars.length} Perkara
                </span>
              </div>
              <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="font-mono text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
              Rp {debetBreakdown.totalPanjarMurni.toLocaleString('id-ID')}
            </div>
            <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9px]">
              <span className="text-slate-500 dark:text-slate-400">
                {debetBreakdown.totalNonPanjarDebet > 0 
                  ? `+ Rp ${debetBreakdown.totalNonPanjarDebet.toLocaleString('id-ID')} Bon` 
                  : 'Panjar Murni'}
              </span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                Mutasi: Rp {totalDebet.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline">
            <span>🔍 {debetBreakdown.casePanjars.length} Panjar Masuk</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* Card 2: Total Kredit (Pengeluaran Biaya SKUM) */}
        <div className={`p-3.5 rounded-2xl border shadow-sm flex flex-col justify-between ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Kredit SKUM</span>
              <div className="p-1 rounded-lg bg-rose-500/10 text-rose-600">
                <TrendingDown className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="font-mono text-lg font-extrabold text-rose-600 dark:text-rose-400">
              Rp {totalKredit.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center justify-between mt-1 text-[9px]">
              <span className="text-slate-400">Potongan Jurnal SKUM</span>
              {effectiveBiayaKasBelumDisetor > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">
                  🟡 Belum: Rp {effectiveBiayaKasBelumDisetor.toLocaleString('id-ID')}
                </span>
              )}
            </div>
          </div>
          <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            {records.length} Transaksi Biaya
          </div>
        </div>

        {/* Card 3: Saldo Perkara SKUM */}
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
          className={`p-3.5 rounded-2xl border shadow-sm cursor-pointer transition-all hover:border-sky-500 hover:shadow-md active:scale-98 flex flex-col justify-between ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}
          title="Klik untuk melihat rincian & analisis saldo SKUM per bulan"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Saldo Buku SKUM</span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                saldoSkum < 0 
                  ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse' 
                  : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
              }`}>
                {saldoSkum < 0 ? '⚠️ MINUS' : '🔍 Bulanan'}
              </span>
            </div>
            <div className={`font-mono text-lg font-extrabold ${
              saldoSkum < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'
            }`}>
              Rp {saldoSkum.toLocaleString('id-ID')}
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Debet - Kredit Berjalan</span>
          </div>
          <div className="text-[9px] text-sky-600 dark:text-sky-400 font-semibold pt-1 border-t border-slate-100 dark:border-slate-800/80">
            Klik Bedah Rincian
          </div>
        </div>

        {/* Card 4: Pinjaman & Piutang SKUM */}
        <div 
          onClick={() => setIsRiwayatPinjamanModalOpen(true)}
          className={`p-3.5 rounded-2xl border shadow-sm cursor-pointer transition-all hover:border-amber-500 hover:shadow-md active:scale-98 flex flex-col justify-between ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}
          title="Klik untuk membuka Riwayat Pinjaman & Pelunasan Saldo SKUM"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pinjaman & Piutang</span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                unpaidLoans.length > 0
                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}>
                {unpaidLoans.length > 0 ? `${unpaidLoans.length} Belum Lunas` : 'Lunas'}
              </span>
            </div>
            <div className="font-mono text-lg font-extrabold text-amber-600 dark:text-amber-400">
              Rp {totalUnpaidAmount.toLocaleString('id-ID')}
            </div>
            <div className="mt-1 text-[9px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>{loanBreakdown.officeLoans > 0 ? `Pinjaman: Rp ${loanBreakdown.officeLoans.toLocaleString('id-ID')}` : 'Semua Lunas'}</span>
              <span>{pinjamanRecords.length} Riwayat</span>
            </div>
          </div>
          <div className="mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[9px] text-amber-600 dark:text-amber-400 font-semibold">
            <span>⚙️ Kelola Pinjaman</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* Card 5: Saldo Sesungguhnya / Saldo Sebenarnya di Kasir */}
        <div 
          onClick={() => setIsRekonsiliasiModalOpen(true)}
          className={`p-3.5 rounded-2xl border shadow-sm cursor-pointer transition-all hover:border-emerald-500 hover:shadow-md active:scale-98 relative group flex flex-col justify-between ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}
          title="Klik untuk membuka Rekonsiliasi Saldo Sesungguhnya & Debet SKUM beserta komparasi Bon Pinjaman"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Saldo Sebenarnya</span>
                <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black">
                  Kasir Riil
                </span>
              </div>
              <div className={`p-1 rounded-lg ${
                auditKasFisikInput < 0 
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-1">
              <div className={`font-mono text-lg font-extrabold ${
                saldoSesungguhnya < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                Rp {saldoSesungguhnya.toLocaleString('id-ID')}
              </div>
            </div>

            {/* Perbandingan Tanpa Bon vs Setelah Bayar Bon */}
            <div className="mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5 text-[9px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Kas Laci (Tanpa Bon):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  Rp {uangTunaiSeharusnyaDiLaci.toLocaleString('id-ID')}
                </span>
              </div>
              {effectiveUnpaidLoanAmount > 0 ? (
                <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                  <span>+ Bon Belum Lunas:</span>
                  <span className="font-mono font-bold">Rp {effectiveUnpaidLoanAmount.toLocaleString('id-ID')}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Status Bon:</span>
                  <span className="font-bold">✓ Semua Lunas</span>
                </div>
              )}
            </div>

            {/* Sub-info: Fisik Kasir & Selisih */}
            <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[9px]">
              <span className="text-slate-500 dark:text-slate-400">
                Fisik: <strong className="font-mono text-slate-800 dark:text-slate-200">Rp {auditKasFisikInput.toLocaleString('id-ID')}</strong>
              </span>
              <span className={`font-black px-1 py-0.5 rounded ${
                selisihAuditKasir === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800'
              }`}>
                {selisihAuditKasir === 0 ? '✓ Pas' : selisihAuditKasir > 0 ? `+Rp ${selisihAuditKasir.toLocaleString('id-ID')}` : `-Rp ${Math.abs(selisihAuditKasir).toLocaleString('id-ID')}`}
              </span>
            </div>
          </div>

          <div className="mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline">
            <span>🔍 Rekonsiliasi & Komparasi Bon</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </div>
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
        <div className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md ${
          saldoSesungguhnya >= 0 
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="flex items-start space-x-3">
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${saldoSesungguhnya >= 0 ? 'text-amber-500' : 'text-rose-500'}`} />
            <div>
              <h4 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-2">
                <span>
                  {saldoSesungguhnya >= 0 
                    ? '⚠️ SALDO BUKU SKUM TERCATAT MINUS KARENA PINJAMAN KEPANITERAAN' 
                    : '⚠️ PERINGATAN DEFISIT SALDO JURNAL SKUM'
                  }
                </span>
                {effectiveUnpaidLoanAmount > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                    Ada Pinjaman Belum Kembali
                  </span>
                )}
              </h4>
              <p className="text-xs mt-1 opacity-90 leading-relaxed">
                {saldoSesungguhnya >= 0 ? (
                  <>
                    Saldo buku SKUM saat ini tercatat minus <strong>Rp {Math.abs(saldoSkum).toLocaleString('id-ID')}</strong> akibat adanya pemotongan pinjaman saldo SKUM kepaniteraan sebesar <strong>Rp {effectiveUnpaidLoanAmount.toLocaleString('id-ID')}</strong>. Namun <strong className="underline">Saldo Sesungguhnya (kas riil fisik) adalah Rp {saldoSesungguhnya.toLocaleString('id-ID')} (Surplus / Kas Utuh)</strong>.
                  </>
                ) : (
                  <>
                    Total pengeluaran (Rp {totalKredit.toLocaleString('id-ID')}) melebihi total penerimaan (Rp {totalDebet.toLocaleString('id-ID')}). Terdapat defisit buku sebesar <strong className="font-black underline">Rp {Math.abs(saldoSkum).toLocaleString('id-ID')}</strong>.
                    {effectiveUnpaidLoanAmount > 0 && (
                      <> Setelah memperhitungkan pinjaman kepaniteraan (Rp {effectiveUnpaidLoanAmount.toLocaleString('id-ID')}), saldo sesungguhnya masih minus Rp {Math.abs(saldoSesungguhnya).toLocaleString('id-ID')}.</>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
          {effectiveUnpaidLoanAmount > 0 && (
            <button
              onClick={() => setIsRiwayatPinjamanModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shrink-0 shadow-xs transition-all active:scale-95 flex items-center space-x-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Cek Pinjaman ({unpaidLoans.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col gap-3 ${
        isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900 border-slate-800 shadow-md'
      }`}>
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
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

          {/* Quick Color Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
            <button
              onClick={() => setFilterWarna('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                filterWarna === 'ALL'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>Semua</span>
              <span className="text-[10px] opacity-80 font-mono">({records.length})</span>
            </button>

            <button
              onClick={() => setFilterWarna(filterWarna === 'hijau' ? 'ALL' : 'hijau')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 border ${
                filterWarna === 'hijau'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300'
                  : isLight
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/50'
              }`}
              title="Tampilkan transaksi yang sudah disetor (Warna Hijau)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Sudah Disetor</span>
              <span className="text-[10px] font-mono font-black">({countHijau})</span>
            </button>

            <button
              onClick={() => setFilterWarna(filterWarna === 'kuning' ? 'ALL' : 'kuning')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 border ${
                filterWarna === 'kuning'
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs ring-2 ring-amber-300 font-black'
                  : isLight
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                    : 'bg-amber-950/40 text-amber-300 border-amber-800 hover:bg-amber-900/50'
              }`}
              title="Tampilkan transaksi belum setor cash ke bendahara (Warna Kuning - Kuitansi)"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 border border-amber-600"></span>
              <span>Belum Setor Cash</span>
              <span className="text-[10px] font-mono font-black">({countKuning})</span>
            </button>

            <button
              onClick={() => setFilterWarna(filterWarna === 'merah' ? 'ALL' : 'merah')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 border ${
                filterWarna === 'merah'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-300'
                  : isLight
                    ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                    : 'bg-rose-950/40 text-rose-300 border-rose-800 hover:bg-rose-900/50'
              }`}
              title="Tampilkan transaksi pinjaman SKUM (Warna Merah)"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Pinjaman SKUM</span>
              <span className="text-[10px] font-mono font-black">({countMerah})</span>
            </button>

            <button
              onClick={() => setFilterWarna(filterWarna === 'oranye' ? 'ALL' : 'oranye')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 border ${
                filterWarna === 'oranye'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-300'
                  : isLight
                    ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                    : 'bg-amber-950/40 text-amber-300 border-amber-800 hover:bg-amber-900/50'
              }`}
              title="Tampilkan transaksi dalam proses (Warna Oranye)"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Proses</span>
              <span className="text-[10px] font-mono font-black">({countOranye})</span>
            </button>

            {/* Shortcut button to open Menu Khusus Kas Kuning */}
            {onNavigateToKasKuning && (
              <button
                type="button"
                onClick={onNavigateToKasKuning}
                className="px-3 py-1.5 rounded-lg text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center space-x-1.5 shadow-sm ring-1 ring-amber-400 active:scale-95"
                title="Buka Menu Khusus Cetak Kuitansi & Rekapitulasi Kas Kuning"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Menu Kas Kuning {countKuning > 0 ? `(${countKuning})` : ''}</span>
              </button>
            )}

            {/* Sync Colors across devices button */}
            {onSyncAllColorsToCloud && (
              <button
                type="button"
                onClick={handleSyncAllColors}
                disabled={isSyncingColors}
                className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 border shadow-xs ${
                  syncColorsSuccess
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : isLight
                      ? 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100'
                      : 'bg-sky-950/60 text-sky-300 border-sky-700 hover:bg-sky-900/60'
                }`}
                title="Simpan & Sinkronkan semua warna baris ke Google Sheets agar terbaca di HP dan perangkat lain"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingColors ? 'animate-spin' : ''}`} />
                <span>{isSyncingColors ? 'Menyimpan...' : syncColorsSuccess ? '✓ Tersinkron Lintas Device!' : '🔄 Sinkronkan Warna ke Cloud'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full pt-1 border-t border-slate-100 dark:border-slate-800/80">
          {/* Nomor Perkara Filter */}
          <select
            value={filterNomorPerkara}
            onChange={(e) => setFilterNomorPerkara(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-xs border font-semibold ${
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
            className={`px-3 py-1.5 rounded-xl text-xs border font-semibold ${
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

          {/* Filter Status Setor / Warna */}
          <select
            value={filterWarna}
            onChange={(e) => setFilterWarna(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-xs border font-bold ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <option value="ALL">🎨 Semua Warna & Status</option>
            <option value="hijau">🟢 Hijau (Sudah Disetor ke Bendahara)</option>
            <option value="kuning">🟡 Kuning (Belum Setor Cash / Kuitansi)</option>
            <option value="merah">🔴 Merah (Pinjaman Saldo SKUM)</option>
            <option value="oranye">🟠 Oranye (Dalam Proses)</option>
            <option value="default">⚪ Standar (Tanpa Warna)</option>
          </select>

          {/* Bulan Filter */}
          <select
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-xs border font-semibold ${
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
            className={`px-3 py-1.5 rounded-xl text-xs border font-semibold ${
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
            className={`px-3 py-1.5 rounded-xl text-xs border font-semibold ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <option value="ASC">Urutan: Tanggal (Terlama ke Terbaru)</option>
            <option value="DESC">Urutan: Tanggal (Terbaru ke Terlama)</option>
          </select>

          {/* View Mode Toggle: Kartu HP vs Tabel */}
          <div className="flex items-center space-x-1 p-1 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('mobile')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                viewMode === 'mobile'
                  ? 'bg-sky-600 text-white shadow-xs'
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
                  ? 'bg-sky-600 text-white shadow-xs'
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

      {/* Main Journal Display: Mobile Cards or Wide Table */}
      {viewMode === 'mobile' ? (
        <div className="space-y-3">
          {filteredRecords.length === 0 ? (
            <div className={`p-8 rounded-2xl border text-center ${
              isLight ? 'bg-white border-slate-200 text-slate-400' : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}>
              <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Belum Ada Data Jurnal SKUM</p>
              <p className="text-xs text-slate-400 mt-1">
                Pilih menu "Pencatatan Jurnal Otomatis" atau "+ Log SKUM Manual" untuk menambahkan rincian.
              </p>
            </div>
          ) : (
            filteredRecords.map((r, idx) => {
              const warna = getEffectiveWarnaBaris(r);
              let cardColorClass = '';
              if (warna === 'hijau') {
                cardColorClass = isLight 
                  ? 'bg-emerald-50/80 border-emerald-300 dark:border-emerald-700' 
                  : 'bg-emerald-950/30 border-emerald-700/80';
              } else if (warna === 'kuning') {
                cardColorClass = isLight 
                  ? 'bg-amber-50/90 border-amber-300 dark:border-amber-700' 
                  : 'bg-amber-950/35 border-amber-600/80';
              } else if (warna === 'merah') {
                cardColorClass = isLight 
                  ? 'bg-rose-50/80 border-rose-300 dark:border-rose-700' 
                  : 'bg-rose-950/30 border-rose-700/80';
              } else if (warna === 'oranye') {
                cardColorClass = isLight 
                  ? 'bg-amber-50/80 border-amber-300 dark:border-amber-700' 
                  : 'bg-amber-950/30 border-amber-600/80';
              } else {
                cardColorClass = isLight
                  ? 'bg-white border-slate-200 hover:border-slate-300'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700';
              }

              const cleanKet = stripWarnaTag(r.keterangan);

              return (
                <div 
                  key={`mobile-skum-${r.id}-${idx}`}
                  className={`p-4 rounded-2xl border transition-all shadow-xs space-y-3 ${cardColorClass}`}
                >
                  {/* Top Row: No, Tanggal & Nomor Perkara */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
                    <div>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        #{idx + 1} • {r.tanggal || '-'}
                      </span>
                      <div className="font-mono text-sm sm:text-base font-black text-sky-800 dark:text-sky-300 mt-0.5">
                        {r.nomorPerkara}
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                      r.kategori === 'Panjar' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                        : r.kategori === 'ATK'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                    }`}>
                      {r.kategori}
                    </span>
                  </div>

                  {/* Status Banner */}
                  {warna === 'hijau' && (
                    <div className="flex items-center space-x-1 text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 px-2.5 py-1 rounded-xl border border-emerald-300/80 dark:border-emerald-800">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>🟢 Sudah Disetor ke Bendahara</span>
                    </div>
                  )}
                  {warna === 'kuning' && (
                    <div className="flex items-center justify-between gap-1 text-xs font-black text-amber-900 dark:text-amber-200 bg-amber-200/80 dark:bg-amber-950/60 px-2.5 py-1 rounded-xl border border-amber-400 dark:border-amber-700">
                      <div className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
                        <span>🟡 Belum Setor Cash (Uang Masih di Kasir)</span>
                      </div>
                      {onNavigateToKasKuning && (
                        <button
                          type="button"
                          onClick={onNavigateToKasKuning}
                          className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] shadow-2xs"
                        >
                          Cetak Kuitansi
                        </button>
                      )}
                    </div>
                  )}
                  {warna === 'merah' && (
                    <div className="flex items-center space-x-1 text-xs font-black text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-950/60 px-2.5 py-1 rounded-xl border border-rose-300 dark:border-rose-800">
                      <span>🔴 Pinjaman Saldo SKUM</span>
                    </div>
                  )}
                  {warna === 'oranye' && (
                    <div className="flex items-center space-x-1 text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 px-2.5 py-1 rounded-xl border border-amber-300 dark:border-amber-800">
                      <span>🟠 Dalam Proses</span>
                    </div>
                  )}

                  {/* Uraian Transaksi */}
                  <div>
                    <div className="font-bold text-sm leading-snug text-slate-900 dark:text-slate-100">
                      {r.uraian}
                    </div>
                    {cleanKet && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                        "{cleanKet}"
                      </div>
                    )}
                  </div>

                  {/* Nominal Strip (Debet / Kredit) */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-800/60 border-slate-700'
                  }`}>
                    {r.penerimaan > 0 ? (
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Penerimaan (Debet)
                        </div>
                        <div className="font-mono text-base font-black text-emerald-700 dark:text-emerald-400">
                          + Rp {r.penerimaan.toLocaleString('id-ID')}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Pengeluaran (Kredit)
                        </div>
                        <div className="font-mono text-base font-black text-rose-600 dark:text-rose-400">
                          - Rp {r.pengeluaran.toLocaleString('id-ID')}
                        </div>
                      </div>
                    )}

                    <div className="text-right">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Kategori
                      </div>
                      <div className="font-bold text-xs text-slate-700 dark:text-slate-300">
                        {r.kategori}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Color Status Selector (Touch Friendly) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {/* Interactive Color Status Dots */}
                    <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleQuickSetColor(r, 'hijau')}
                        className={`w-6 h-6 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center justify-center ${
                          warna === 'hijau' ? 'ring-2 ring-emerald-700 ring-offset-1 scale-110 shadow-xs' : 'opacity-60 hover:opacity-100'
                        }`}
                        title="Tandai Hijau (Sudah Disetor ke Bendahara)"
                      >
                        {warna === 'hijau' && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickSetColor(r, 'kuning')}
                        className={`w-6 h-6 rounded-full bg-amber-400 hover:bg-amber-500 border border-amber-600 transition-all flex items-center justify-center ${
                          warna === 'kuning' ? 'ring-2 ring-amber-600 ring-offset-1 scale-110 shadow-xs' : 'opacity-60 hover:opacity-100'
                        }`}
                        title="Tandai Kuning (Belum Setor Cash / Uang di Kasir)"
                      >
                        {warna === 'kuning' && <span className="w-2 h-2 rounded-full bg-slate-950"></span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickSetColor(r, 'merah')}
                        className={`w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 transition-all flex items-center justify-center ${
                          warna === 'merah' ? 'ring-2 ring-rose-700 ring-offset-1 scale-110 shadow-xs' : 'opacity-60 hover:opacity-100'
                        }`}
                        title="Tandai Merah (Pinjaman Saldo)"
                      >
                        {warna === 'merah' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickSetColor(r, 'oranye')}
                        className={`w-6 h-6 rounded-full bg-amber-500 hover:bg-amber-600 transition-all flex items-center justify-center ${
                          warna === 'oranye' ? 'ring-2 ring-amber-700 ring-offset-1 scale-110 shadow-xs' : 'opacity-60 hover:opacity-100'
                        }`}
                        title="Tandai Oranye (Proses)"
                      >
                        {warna === 'oranye' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickSetColor(r, 'default')}
                        className={`w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 transition-all flex items-center justify-center ${
                          warna === 'default' ? 'ring-2 ring-slate-400' : 'opacity-50 hover:opacity-100'
                        }`}
                        title="Reset warna ke normal"
                      >
                        <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300">✕</span>
                      </button>
                    </div>

                    {/* Edit & Delete Action Buttons */}
                    <div className="flex items-center space-x-1">
                      {warna === 'kuning' && onNavigateToKasKuning && (
                        <button
                          type="button"
                          onClick={onNavigateToKasKuning}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center space-x-1 shadow-xs hover:bg-amber-600 active:scale-95 transition-all"
                          title="Cetak Kuitansi Tanda Terima Kas Kuning"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Kuitansi</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(r)}
                        className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1 transition-all ${
                          isLight 
                            ? 'bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border-slate-200 hover:border-sky-300' 
                            : 'bg-slate-800 hover:bg-sky-950/40 text-slate-300 hover:text-sky-300 border-slate-700'
                        }`}
                        title="Edit log SKUM ini"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRecord(r.id)}
                        className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center"
                        title="Hapus baris ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })
          )}

          {/* Mobile Total SKUM Summary Card */}
          <div className={`p-4 rounded-2xl border shadow-sm ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
              Ringkasan Akumulasi SKUM
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                <div className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold">Total Debet (Panjar)</div>
                <div className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-300">
                  Rp {totalDebet.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                <div className="text-[10px] text-rose-800 dark:text-rose-400 font-bold">Total Kredit (Biaya)</div>
                <div className="font-mono text-sm font-black text-rose-700 dark:text-rose-300">
                  Rp {totalKredit.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-between">
              <span className="font-bold text-xs text-sky-900 dark:text-sky-200">Saldo Akhir SKUM:</span>
              <span className="font-mono font-black text-base text-sky-800 dark:text-sky-300">
                Rp {saldoSkum.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Main Journal Data Table (Standar Lebar) */
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
                  <th className="p-3 w-44">Nomor Perkara</th>
                  <th className="p-3">Uraian Transaksi SKUM</th>
                  <th className="p-3 text-right w-32">Debet (Panjar)</th>
                  <th className="p-3 text-right w-32">Kredit (Pengeluaran)</th>
                  <th className="p-3 text-center w-36">Kategori & Status</th>
                  <th className="p-3 text-center w-36">Pilih Warna Baris</th>
                  <th className="p-3 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
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
                  filteredRecords.map((r, idx) => {
                    const warna = getEffectiveWarnaBaris(r);
                    let rowColorClass = '';
                    if (warna === 'hijau') {
                      rowColorClass = isLight 
                        ? 'bg-emerald-50/80 hover:bg-emerald-100/90 border-l-4 border-l-emerald-600' 
                        : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-l-4 border-l-emerald-500';
                    } else if (warna === 'kuning') {
                      rowColorClass = isLight 
                        ? 'bg-amber-50/80 hover:bg-amber-100/90 border-l-4 border-l-amber-500' 
                        : 'bg-amber-950/35 hover:bg-amber-900/45 border-l-4 border-l-amber-400';
                    } else if (warna === 'merah') {
                      rowColorClass = isLight 
                        ? 'bg-rose-50/80 hover:bg-rose-100/90 border-l-4 border-l-rose-600' 
                        : 'bg-rose-950/40 hover:bg-rose-900/50 border-l-4 border-l-rose-500';
                    } else if (warna === 'oranye') {
                      rowColorClass = isLight 
                        ? 'bg-amber-50/80 hover:bg-amber-100/90 border-l-4 border-l-amber-600' 
                        : 'bg-amber-950/40 hover:bg-amber-900/50 border-l-4 border-l-amber-500';
                    } else {
                      rowColorClass = isLight
                        ? 'hover:bg-slate-50 border-l-4 border-l-transparent'
                        : 'hover:bg-slate-800/50 border-l-4 border-l-transparent';
                    }

                    const cleanKet = stripWarnaTag(r.keterangan);

                    return (
                      <tr 
                        key={`${r.id}-${idx}`} 
                        className={`transition-colors ${rowColorClass}`}
                      >
                        <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-medium text-slate-700 dark:text-slate-300">{r.tanggal || '-'}</td>
                        <td className="p-3 font-mono font-extrabold text-sky-800 dark:text-sky-300">
                          {r.nomorPerkara}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">{r.uraian}</div>
                          {cleanKet && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{cleanKet}</div>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-300">
                          {r.penerimaan > 0 ? `Rp ${r.penerimaan.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-rose-700 dark:text-rose-300">
                          {r.pengeluaran > 0 ? `Rp ${r.pengeluaran.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              r.kategori === 'Panjar' 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                                : r.kategori === 'ATK'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                            }`}>
                              {r.kategori}
                            </span>
                            {warna === 'hijau' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white flex items-center gap-0.5 shadow-xs">
                                <Check className="w-2.5 h-2.5" /> Sudah Disetor
                              </span>
                            )}
                            {warna === 'kuning' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-400 text-slate-950 flex items-center gap-0.5 shadow-xs border border-amber-500">
                                🟡 Belum Setor Cash
                              </span>
                            )}
                            {warna === 'merah' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white flex items-center gap-0.5 shadow-xs">
                                🔴 Pinjaman
                              </span>
                            )}
                            {warna === 'oranye' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-600 text-white flex items-center gap-0.5 shadow-xs">
                                🟠 Proses
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {/* Interactive Row Color Palette */}
                          <div className="inline-flex items-center p-1 rounded-xl border bg-white/80 dark:bg-slate-800/80 shadow-xs space-x-1">
                            {/* Hijau / Sudah Disetor */}
                            <button
                              type="button"
                              onClick={() => handleQuickSetColor(r, 'hijau')}
                              className={`w-5 h-5 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center justify-center ${
                                warna === 'hijau' ? 'ring-2 ring-emerald-700 ring-offset-1 scale-110 shadow-xs' : 'opacity-70 hover:opacity-100'
                              }`}
                              title="Tandai baris Hijau (Sudah Disetor ke Bendahara)"
                            >
                              {warna === 'hijau' && <Check className="w-3 h-3 text-white stroke-[3]" />}
                            </button>

                            {/* Kuning / Belum Setor Cash (Bisa Cetak Kuitansi) */}
                            <button
                              type="button"
                              onClick={() => handleQuickSetColor(r, 'kuning')}
                              className={`w-5 h-5 rounded-full bg-amber-400 hover:bg-amber-500 border border-amber-600 transition-all flex items-center justify-center ${
                                warna === 'kuning' ? 'ring-2 ring-amber-600 ring-offset-1 scale-110 shadow-xs' : 'opacity-70 hover:opacity-100'
                              }`}
                              title="Tandai baris Kuning (Belum Setor Uang Cash ke Bendahara - Kuitansi)"
                            >
                              {warna === 'kuning' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>}
                            </button>

                            {/* Merah / Pinjaman */}
                            <button
                              type="button"
                              onClick={() => handleQuickSetColor(r, 'merah')}
                              className={`w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 transition-all flex items-center justify-center ${
                                warna === 'merah' ? 'ring-2 ring-rose-700 ring-offset-1 scale-110 shadow-xs' : 'opacity-70 hover:opacity-100'
                              }`}
                              title="Tandai baris Merah (Pinjaman Saldo SKUM)"
                            >
                              {warna === 'merah' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                            </button>

                            {/* Oranye / Proses */}
                            <button
                              type="button"
                              onClick={() => handleQuickSetColor(r, 'oranye')}
                              className={`w-5 h-5 rounded-full bg-amber-500 hover:bg-amber-600 transition-all flex items-center justify-center ${
                                warna === 'oranye' ? 'ring-2 ring-amber-700 ring-offset-1 scale-110 shadow-xs' : 'opacity-70 hover:opacity-100'
                              }`}
                              title="Tandai baris Oranye (Dalam Proses)"
                            >
                              {warna === 'oranye' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                            </button>

                            {/* Reset / Default */}
                            <button
                              type="button"
                              onClick={() => handleQuickSetColor(r, 'default')}
                              className={`w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 transition-all flex items-center justify-center ${
                                warna === 'default' ? 'ring-2 ring-slate-400 scale-110' : 'opacity-60 hover:opacity-100'
                              }`}
                              title="Reset warna baris ke standar"
                            >
                              <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300">✕</span>
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-center space-x-1">
                          {/* Quick receipt button for Yellow rows */}
                          {warna === 'kuning' && onNavigateToKasKuning && (
                            <button
                              onClick={onNavigateToKasKuning}
                              className="p-1.5 text-amber-700 dark:text-amber-300 hover:text-amber-900 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors inline-flex items-center"
                              title="Buka menu kuitansi kas kuning untuk cetak tanda terima"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                          )}
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
                    );
                  })
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
                  <td colSpan={3} className="p-3 text-center font-mono text-sky-600 dark:text-sky-400">
                    Saldo: Rp {saldoSkum.toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

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
                <label className="block font-bold mb-1">Pilih Warna & Status Baris SKUM:</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormWarnaBaris('default')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      formWarnaBaris === 'default'
                        ? 'bg-slate-200 dark:bg-slate-700 border-slate-400 ring-2 ring-slate-400 text-slate-800 dark:text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-70'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mb-1"></div>
                    <span className="text-[10px] block">⚪ Standar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormWarnaBaris('hijau')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      formWarnaBaris === 'hijau'
                        ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-500 ring-2 ring-emerald-500 text-emerald-900 dark:text-emerald-200'
                        : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 opacity-70'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 mx-auto mb-1"></div>
                    <span className="text-[10px] block">🟢 Disetor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormWarnaBaris('kuning')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      formWarnaBaris === 'kuning'
                        ? 'bg-amber-100 dark:bg-amber-950 border-amber-500 ring-2 ring-amber-500 text-amber-950 dark:text-amber-200'
                        : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 opacity-70'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-600 mx-auto mb-1"></div>
                    <span className="text-[10px] block">🟡 Kas Kuning</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormWarnaBaris('merah')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      formWarnaBaris === 'merah'
                        ? 'bg-rose-100 dark:bg-rose-950 border-rose-500 ring-2 ring-rose-500 text-rose-900 dark:text-rose-200'
                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 opacity-70'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500 mx-auto mb-1"></div>
                    <span className="text-[10px] block">🔴 Pinjaman</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormWarnaBaris('oranye')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      formWarnaBaris === 'oranye'
                        ? 'bg-amber-100 dark:bg-amber-950 border-amber-500 ring-2 ring-amber-500 text-amber-900 dark:text-amber-200'
                        : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 opacity-70'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500 mx-auto mb-1"></div>
                    <span className="text-[10px] block">🟠 Proses</span>
                  </button>
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
                <label className="block font-bold mb-1">Pilih Warna & Status Baris SKUM:</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditWarnaBaris('default')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      editWarnaBaris === 'default'
                        ? 'bg-slate-200 dark:bg-slate-700 border-slate-400 ring-2 ring-slate-400 text-slate-800 dark:text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-70'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mb-1"></div>
                    <span className="text-[10px] block">⚪ Standar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditWarnaBaris('hijau')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      editWarnaBaris === 'hijau'
                        ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-500 ring-2 ring-emerald-500 text-emerald-900 dark:text-emerald-200'
                        : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 opacity-70'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 mx-auto mb-1"></div>
                    <span className="text-[10px] block">🟢 Disetor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditWarnaBaris('kuning')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      editWarnaBaris === 'kuning'
                        ? 'bg-amber-100 dark:bg-amber-950 border-amber-500 ring-2 ring-amber-500 text-amber-950 dark:text-amber-200'
                        : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 opacity-70'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-600 mx-auto mb-1"></div>
                    <span className="text-[10px] block">🟡 Kas Kuning</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditWarnaBaris('merah')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      editWarnaBaris === 'merah'
                        ? 'bg-rose-100 dark:bg-rose-950 border-rose-500 ring-2 ring-rose-500 text-rose-900 dark:text-rose-200'
                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 opacity-70'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500 mx-auto mb-1"></div>
                    <span className="text-[10px] block">🔴 Pinjaman</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditWarnaBaris('oranye')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      editWarnaBaris === 'oranye'
                        ? 'bg-amber-100 dark:bg-amber-950 border-amber-500 ring-2 ring-amber-500 text-amber-900 dark:text-amber-200'
                        : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 opacity-70'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500 mx-auto mb-1"></div>
                    <span className="text-[10px] block">🟠 Proses</span>
                  </button>
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
                    {effectiveUnpaidLoanAmount > 0 && (
                      <span className="block mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200">
                        📌 <strong>Catatan Pinjaman Kepaniteraan:</strong> Terdapat pinjaman saldo SKUM yang belum kembali sebesar <strong className="font-bold text-amber-700 dark:text-amber-300">Rp {effectiveUnpaidLoanAmount.toLocaleString('id-ID')}</strong>. 
                        Dengan demikian, <strong className="underline font-bold text-emerald-700 dark:text-emerald-300">Saldo Sesungguhnya adalah Rp {saldoSesungguhnya.toLocaleString('id-ID')}</strong>.
                      </span>
                    )}
                    {monthlySkumBreakdown.filter(m => m.isMinus).length > 0 ? (
                      <span className="block mt-1"> Terdeteksi <strong className="text-rose-600 dark:text-rose-400 font-bold">{monthlySkumBreakdown.filter(m => m.isMinus).length} bulan</strong> memiliki kredit pengeluaran biaya SKUM melebihi debet panjar masuk.</span>
                    ) : (
                      <span className="block mt-1"> Saldo SKUM dalam posisi aman dan tercatat dengan seimbang.</span>
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
                  <option value="">-- Pilih Nomor Perkara / Sumber SKUM --</option>
                  {availableNomorPerkara.map(no => (
                    <option key={no} value={no}>{no}</option>
                  ))}
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

      {/* Modal Edit Pinjaman Saldo SKUM */}
      {isEditPinjamanModalOpen && editingPinjaman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl border transition-all ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            <div className="px-6 py-4 border-b flex items-center justify-between border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-sky-500 text-white rounded-xl shadow-xs">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base">Edit Pinjaman / Piutang Saldo SKUM</h3>
                  <p className="text-xs text-slate-500">Perbarui data, nominal, atau status pelunasan pinjaman</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditPinjamanModalOpen(false);
                  setEditingPinjaman(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmitEditPinjaman} className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-sky-800 dark:text-sky-300">
                  <Lightbulb className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Informasi Logika Saldo SKUM:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Pinjaman yang statusnya <strong>"Belum Lunas"</strong> mengurangi saldo kas buku SKUM (Kredit). Mengubah status menjadi <strong>"Sudah Dibayar (Lunas)"</strong> akan otomatis mencatatkan transaksi <em>Pengembalian Pinjaman (Debet)</em> di Jurnal SKUM sehingga Saldo SKUM kembali normal dan tidak minus.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
                    Tanggal Peminjaman
                  </label>
                  <input
                    type="date"
                    value={editPinjamTanggal}
                    onChange={(e) => setEditPinjamTanggal(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-sky-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
                    Nomor Perkara / Sumber
                  </label>
                  <input
                    type="text"
                    value={editPinjamNomorPerkara}
                    onChange={(e) => setEditPinjamNomorPerkara(e.target.value)}
                    placeholder="e.g. Kepaniteraan Umum / 2/Pdt.G/2026/PA.Pan"
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-sky-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                    }`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
                  Peminjam / Keperluan Kepaniteraan
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pembelian Map ATK / Uang Skum Panjar tidak lengkap"
                  value={editPinjamPeminjam}
                  onChange={(e) => setEditPinjamPeminjam(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-sky-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
                  Jumlah Nominal (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="1"
                    value={editPinjamJumlah || ''}
                    onChange={(e) => setEditPinjamJumlah(Number(e.target.value))}
                    className={`w-full pl-10 pr-3 py-2 text-sm font-mono font-bold rounded-xl border focus:ring-2 focus:ring-sky-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Status Pelunasan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600 dark:text-slate-400">
                  Status Pelunasan Pinjaman
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPinjamStatus('BELUM_DIBAYAR')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      editPinjamStatus === 'BELUM_DIBAYAR'
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : isLight 
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>Belum Lunas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPinjamStatus('SUDAH_DIBAYAR')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      editPinjamStatus === 'SUDAH_DIBAYAR'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : isLight 
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sudah Lunas</span>
                  </button>
                </div>
              </div>

              {editPinjamStatus === 'SUDAH_DIBAYAR' && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-emerald-700 dark:text-emerald-400">
                    Tanggal Pelunasan / Pengembalian
                  </label>
                  <input
                    type="date"
                    value={editPinjamTanggalBayar}
                    onChange={(e) => setEditPinjamTanggalBayar(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-emerald-500 ${
                      isLight ? 'bg-emerald-50/50 border-emerald-300 text-slate-900' : 'bg-emerald-950/30 border-emerald-700 text-white'
                    }`}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
                  Catatan / Keterangan Tambahan
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan pelunasan atau keterangan bukti pinjaman"
                  value={editPinjamKeterangan}
                  onChange={(e) => setEditPinjamKeterangan(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:ring-2 focus:ring-sky-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditPinjamanModalOpen(false);
                    setEditingPinjaman(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rekonsiliasi Saldo Sesungguhnya vs Debet SKUM */}
      {isRekonsiliasiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border transition-all ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0 border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-xs">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Rekonsiliasi Saldo Sesungguhnya & Debet SKUM</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      Kas Riil Fisik
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Penyesuaian saldo riil fisik di kasir dengan biaya kas yang belum disetor dan pinjaman saldo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRekonsiliasiModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              
              {/* Formula & Calculation Visual Flow */}
              <div className={`p-4 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700'
              }`}>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Alur Logika Perhitungan Kas Fisik (Saldo Sesungguhnya)</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">
                    {isMatchDebetSkum ? '✓ SEIMBANG DENGAN DEBET SKUM' : 'REKONSILIASI BERJALAN'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] text-slate-400 block mb-0.5">1. Saldo Buku SKUM</span>
                    <span className={`font-mono text-xs font-black ${saldoSkum < 0 ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
                      Rp {saldoSkum.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 shadow-xs">
                    <span className="text-[10px] text-amber-700 dark:text-amber-300 block mb-0.5">2. Kas Belum Disetor</span>
                    <span className="font-mono text-xs font-black text-amber-700 dark:text-amber-300">
                      + Rp {effectiveBiayaKasBelumDisetor.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 shadow-xs">
                    <span className="text-[10px] text-rose-700 dark:text-rose-300 block mb-0.5">3. Pinjaman SKUM</span>
                    <span className="font-mono text-xs font-black text-rose-700 dark:text-rose-300">
                      + Rp {effectiveUnpaidLoanAmount.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-500 shadow-xs">
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold block mb-0.5">
                      = Saldo Sesungguhnya
                    </span>
                    <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-300">
                      Rp {saldoSesungguhnya.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Second Row: Total Reconciliation to Debet SKUM */}
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Saldo Sesungguhnya (Rp {saldoSesungguhnya.toLocaleString('id-ID')})</span>
                    <span>+</span>
                    <span>Biaya Disetor (Rp {biayaKasKeluarDisetor.toLocaleString('id-ID')})</span>
                    {effectiveUnpaidLoanAmount > 0 && (
                      <>
                        <span>-</span>
                        <span>Pinjaman (Rp {effectiveUnpaidLoanAmount.toLocaleString('id-ID')})</span>
                      </>
                    )}
                    <span>=</span>
                    <strong className="font-mono text-slate-900 dark:text-white font-extrabold">
                      Rp {totalRekonsiliasiDebet.toLocaleString('id-ID')}
                    </strong>
                  </div>
                  <div className="flex items-center space-x-1.5 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800">
                    <Check className="w-3.5 h-3.5" />
                    <span>Tepat Sesuai Total Debet SKUM: Rp {totalDebet.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Key Accounting Rules Callout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60">
                  <h4 className="font-extrabold text-amber-900 dark:text-amber-200 mb-1 flex items-center gap-1.5">
                    <span>💡 Nilai Lebih Besar Dari Yang Akan Disetor</span>
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                    Uang kas yang akan disetor ke bendahara adalah <strong>Rp {effectiveBiayaKasBelumDisetor.toLocaleString('id-ID')}</strong>. 
                    Saldo Sesungguhnya bernilai <strong>Rp {saldoSesungguhnya.toLocaleString('id-ID')}</strong>, yang otomatis 
                    <strong> lebih besar</strong> karena mencakup sisa panjar perkara SKUM (+Rp {saldoSkum.toLocaleString('id-ID')}) di kasir.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60">
                  <h4 className="font-extrabold text-emerald-900 dark:text-emerald-200 mb-1 flex items-center gap-1.5">
                    <span>🎯 Akumulasi Tepat Sesuai Debet SKUM</span>
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                    Jika seluruh biaya kas belum disetor ke bendahara, Saldo Sesungguhnya <strong>persis sama dengan Total Debet SKUM</strong>. 
                    Dan jika sebagian telah disetor resmi (Rp {biayaKasKeluarDisetor.toLocaleString('id-ID')}), 
                    total saldo sesungguhnya ditambah yang telah disetor tepat sama dengan total penerimaan panjar SKUM.
                  </p>
                </div>
              </div>

              {/* Komparasi Logika Rekonsiliasi: Posisi Tanpa/Sebelum Bayar Bon vs Posisi Setelah Bayar Bon */}
              <div className="p-4 rounded-2xl border bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-emerald-50/60 dark:from-amber-950/30 dark:via-slate-900/60 dark:to-emerald-950/30 border-amber-300 dark:border-amber-800 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-200 dark:border-amber-800/80">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow-xs">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-amber-950 dark:text-amber-200 text-xs sm:text-sm flex items-center gap-1.5">
                        <span>Komparasi Logika Rekonsiliasi: Bon / Pinjaman Operasional</span>
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Perbandingan kas riil di laci saat bon belum lunas vs saat bon telah dibayar / dikembalikan
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                      Total Bon: Rp {(totalUnpaidAmount + totalPaidAmount).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Dua Kotak Komparasi Berdampingan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Kotak A: Sebelum Bayar Bon / Posisi Ada Bon Berjalan */}
                  <div className="p-3.5 rounded-xl border bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800/80 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-amber-100 dark:border-amber-900/40">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span className="font-extrabold text-amber-950 dark:text-amber-200 text-xs">
                          1. Posisi Tanpa / Sebelum Bayar Bon
                        </span>
                      </div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                        {unpaidLoans.length > 0 ? `${unpaidLoans.length} Bon Belum Lunas` : '0 Bon Aktif'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Uang Tunai Murni di Laci (Tanpa Bon):</span>
                        <span className="font-mono font-black text-slate-900 dark:text-white">
                          Rp {uangTunaiSeharusnyaDiLaci.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                        <span>+ Piutang Kwitansi Bon Belum Lunas:</span>
                        <span className="font-mono font-bold">
                          + Rp {effectiveUnpaidLoanAmount.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300">
                        <span>= Total Saldo Sesungguhnya:</span>
                        <span className="font-mono font-black">
                          Rp {saldoSesungguhnya.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                        <span>Saldo Buku SKUM Tercatat:</span>
                        <span className={`font-mono font-bold ${saldoSkum < 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>
                          Rp {saldoSkum.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <p className="text-[9.5px] text-slate-500 dark:text-slate-400 leading-normal bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/50 dark:border-amber-800/40">
                      💡 <strong>Logika:</strong> Uang kas di laci kasir berkurang <strong>Rp {effectiveUnpaidLoanAmount.toLocaleString('id-ID')}</strong> karena dipinjam sementara untuk operasional. Nilai ini dipertanggungjawabkan dalam bentuk kwitansi bon.
                    </p>
                  </div>

                  {/* Kotak B: Setelah Bayar Bon / Pelunasan Kasir */}
                  <div className="p-3.5 rounded-xl border bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800/80 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-emerald-100 dark:border-emerald-900/40">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span className="font-extrabold text-emerald-950 dark:text-emerald-200 text-xs">
                          2. Posisi Setelah Bayar Bon (Kas Utuh)
                        </span>
                      </div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        ✓ Kasir 100% Pulih
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                        <span className="font-semibold">Uang Tunai di Laci Kasir (Pulih Utuh):</span>
                        <span className="font-mono font-black text-sm">
                          Rp {saldoSetelahBayarBon.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Sisa Piutang Bon (Lunas 100%):</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          Rp 0 (Lunas)
                        </span>
                      </div>

                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300">
                        <span>= Total Saldo Sesungguhnya:</span>
                        <span className="font-mono font-black">
                          Rp {saldoSesungguhnya.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                        <span>Saldo Buku SKUM Pulih Normal:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          Rp {saldoBukuSetelahBayarBon.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <p className="text-[9.5px] text-emerald-800 dark:text-emerald-300 leading-normal bg-emerald-50/50 dark:bg-emerald-950/20 p-2 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40">
                      ✓ <strong>Hasil Pelunasan:</strong> Setelah bon dilunasi, uang tunai kasir bertambah kembali (+Rp {effectiveUnpaidLoanAmount.toLocaleString('id-ID')}) dan dicatat sebagai Debet Pengembalian Pinjaman, sehingga saldo buku kembali normal.
                    </p>
                  </div>
                </div>

                {/* Panel Status Riwayat Pembayaran Bon */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                      <HandCoins className="w-3.5 h-3.5 text-amber-500" />
                      <span>Status Rincian Bon / Pinjaman Operasional:</span>
                    </span>
                    <div className="flex items-center space-x-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                        Sudah Lunas: Rp {totalPaidAmount.toLocaleString('id-ID')} ({paidLoans.length})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold">
                        Belum Lunas: Rp {totalUnpaidAmount.toLocaleString('id-ID')} ({unpaidLoans.length})
                      </span>
                    </div>
                  </div>

                  {unpaidLoans.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                        Daftar Bon Yang Masih Berjalan (Belum Dilunasi):
                      </div>
                      <div className="divide-y divide-slate-200 dark:divide-slate-700/60 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                        {unpaidLoans.map(p => (
                          <div key={p.id} className="p-2 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span>{p.peminjam || 'Peminjam'}</span>
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {p.nomorPerkara || '-'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">{p.keterangan || 'Pinjaman Operasional'}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                                Rp {(p.jumlah || 0).toLocaleString('id-ID')}
                              </span>
                              {onBayarPinjaman && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Lunaskan bon pinjaman Rp ${(p.jumlah || 0).toLocaleString('id-ID')} untuk ${p.peminjam}? Ini akan mengembalikan uang tunai ke kasir.`)) {
                                      onBayarPinjaman(p.id);
                                    }
                                  }}
                                  className="px-2 py-1 rounded-md text-[10px] font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center space-x-1"
                                  title="Klik untuk melunasi bon ini sekarang"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Lunaskan</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Semua bon operasional telah lunas dibayar. Kas kasir saat ini berada pada kondisi kas utuh tanpa piutang berjalan.</span>
                    </div>
                  )}

                  {paidLoans.length > 0 && (
                    <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span>Riwayat Bon Lunas: <strong>{paidLoans.length} transaksi</strong> telah dikembalikan ke kasir.</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Total Lunas: Rp {totalPaidAmount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Setting Mode Penyesuaian Kas Belum Disetor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-sky-500" />
                    <span>Mode Sumber Data Biaya Kas Belum Disetor:</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Pilih metode yang sesuai dengan administrasi kasir</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Mode Otomatis / Cerdas */}
                  <button
                    type="button"
                    onClick={() => setModeKasBelumSetor('auto')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      modeKasBelumSetor === 'auto'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold">Otomatis (Cerdas)</span>
                      {modeKasBelumSetor === 'auto' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                      Prioritaskan transaksi Kuning; jika belum ada, pakai seluruh biaya non-hijau.
                    </p>
                    <div className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-300">
                      Rp {effectiveBiayaKasBelumDisetor.toLocaleString('id-ID')}
                    </div>
                  </button>

                  {/* Mode Transaksi Kuning */}
                  <button
                    type="button"
                    onClick={() => setModeKasBelumSetor('kuning')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      modeKasBelumSetor === 'kuning'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold">🟡 Khusus Kas Kuning</span>
                      {modeKasBelumSetor === 'kuning' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                      Hanya transaksi yang ditandai warna Kuning (belum setor cash).
                    </p>
                    <div className="font-mono font-bold text-xs text-amber-700 dark:text-amber-300">
                      Rp {totalKasKuningBelumSetor.toLocaleString('id-ID')}
                    </div>
                  </button>

                  {/* Mode Seluruh Non-Hijau */}
                  <button
                    type="button"
                    onClick={() => setModeKasBelumSetor('all-unsettled')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      modeKasBelumSetor === 'all-unsettled'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-200 ring-2 ring-sky-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold">📋 Seluruh Non-Hijau</span>
                      {modeKasBelumSetor === 'all-unsettled' && <Check className="w-3.5 h-3.5 text-sky-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                      Semua pengeluaran yang belum ditandai Hijau dianggap kas belum setor.
                    </p>
                    <div className="font-mono font-bold text-xs text-sky-700 dark:text-sky-300">
                      Rp {totalKreditNonHijau.toLocaleString('id-ID')}
                    </div>
                  </button>
                </div>
              </div>

              {/* Panel Audit & Investigasi Kas Opname Kasir */}
              <div className="p-4 rounded-2xl border bg-gradient-to-br from-indigo-50/70 via-sky-50/50 to-emerald-50/50 dark:from-indigo-950/30 dark:via-slate-900/60 dark:to-emerald-950/30 border-indigo-200 dark:border-indigo-800/60 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-indigo-950 dark:text-indigo-200 text-sm flex items-center gap-1.5">
                        <span>Diagnostik & Investigasi Kas Opname Kasir</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700">
                          Interaktif & Real-Time
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Input uang fisik kasir, hitung pecahan denominasi, dan terapkan logika perhitungan ke sistem yang berjalan
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleResetToStandardBook}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 transition-all active:scale-95 cursor-pointer flex items-center space-x-1"
                      title="Set input kas fisik sama dengan nilai standar pembukuan saat ini"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Set Standar Buku (Rp {saldoFisikStandarBuku.toLocaleString('id-ID')})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateAuditKasFisik(0)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:text-slate-200 transition-all active:scale-95 cursor-pointer flex items-center space-x-1"
                      title="Kosongkan input kas fisik"
                    >
                      <X className="w-3 h-3" />
                      <span>Reset / Kosongkan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDenominationOpen(!isDenominationOpen)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center space-x-1"
                    >
                      <Coins className="w-3 h-3" />
                      <span>{isDenominationOpen ? 'Tutup Pecahan' : '💵 Kalkulator Pecahan Fisik'}</span>
                    </button>
                  </div>
                </div>

                {/* 3 Main Opname Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Input Kas Fisik Kasir */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-indigo-400/80 dark:border-indigo-600 shadow-xs focus-within:ring-2 focus-within:ring-indigo-500">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">
                        1. Uang Fisik Aktual di Kasir
                      </label>
                      {auditKasFisikInput > 0 && (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                          Terisi
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono text-sm text-slate-400 font-black">Rp</span>
                      <input
                        type="number"
                        value={auditKasFisikInput === 0 ? '' : auditKasFisikInput}
                        onChange={(e) => handleUpdateAuditKasFisik(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full font-mono text-base font-black text-indigo-700 dark:text-indigo-300 bg-transparent focus:outline-hidden"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 block mt-1">Uang riil tunai di laci meja kasir saat ini</span>
                  </div>

                  {/* Kas Fisik Standar Menurut Pembukuan */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      2. Kas Seharusnya (Buku Standar)
                    </div>
                    <div className="font-mono text-base font-black text-slate-800 dark:text-slate-200">
                      Rp {saldoFisikStandarBuku.toLocaleString('id-ID')}
                    </div>
                    <span className="text-[9px] text-slate-400 block mt-1">
                      Sisa Panjar (Rp {totalSisaPanjarMurniPerkara.toLocaleString('id-ID')}) + Kas Belum Setor (Rp {effectiveBiayaKasBelumDisetor.toLocaleString('id-ID')})
                    </span>
                  </div>

                  {/* Hasil Selisih */}
                  <div className={`p-3 rounded-xl border shadow-xs ${
                    selisihAuditKasir === 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                      : selisihAuditKasir > 0
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
                  }`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>3. Selisih Kas Opname</span>
                      {selisihAuditKasir === 0 && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <div className="font-mono text-base font-black">
                      {selisihAuditKasir >= 0 ? `+ Rp ${selisihAuditKasir.toLocaleString('id-ID')}` : `- Rp ${Math.abs(selisihAuditKasir).toLocaleString('id-ID')}`}
                    </div>
                    <span className="text-[9px] font-bold block mt-1">
                      {auditKasFisikInput === 0
                        ? '⚠️ Silakan input uang fisik kasir'
                        : selisihAuditKasir === 0 
                        ? '✓ Tepat seimbang (Cocok 100%)' 
                        : selisihAuditKasir > 0 
                        ? `Surplus Kas Fisik (+Rp ${selisihAuditKasir.toLocaleString('id-ID')})`
                        : `Defisit Kas Fisik (-Rp ${Math.abs(selisihAuditKasir).toLocaleString('id-ID')})`}
                    </span>
                  </div>
                </div>

                {/* Kalkulator Denominasi Pecahan Fisik Kasir (Expandable) */}
                {isDenominationOpen && (
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <Coins className="w-4 h-4 text-emerald-600" />
                        <span className="font-black text-slate-800 dark:text-slate-200 text-xs">
                          Kalkulator Pecahan Fisik Uang di Laci Kasir:
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500">Total Hitungan:</span>
                        <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                          Rp {totalCalculatedFromDenominations.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      {[100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100].map((denom) => {
                        const count = denominations[denom] || 0;
                        const subtotal = denom * count;
                        return (
                          <div key={denom} className="p-2 rounded-lg border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              <span>Rp {denom.toLocaleString('id-ID')}</span>
                              <span className="text-[9px] text-slate-400">{denom >= 1000 ? 'Lembar' : 'Keping'}</span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={count === 0 ? '' : count}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setDenominations(prev => ({ ...prev, [denom]: val }));
                              }}
                              placeholder="0"
                              className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-mono text-center font-bold text-xs"
                            />
                            <div className="text-[9px] font-mono text-slate-500 dark:text-slate-400 text-right mt-1">
                              = Rp {subtotal.toLocaleString('id-ID')}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setDenominations({
                          100000: 0, 50000: 0, 20000: 0, 10000: 0, 5000: 0, 2000: 0, 1000: 0, 500: 0, 200: 0, 100: 0
                        })}
                        className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        Reset Jumlah Pecahan
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setIsDenominationOpen(false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Tutup
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyDenominations}
                          className="px-4 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Terapkan Rp {totalCalculatedFromDenominations.toLocaleString('id-ID')} ke Kasir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* System Integration Actions */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="font-black text-slate-800 dark:text-slate-200 block text-xs">
                        Penerapan Logika ke Sistem Jurnal SKUM Berjalan:
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {modeKasBelumSetor === 'custom'
                          ? `⚡ Sistem aktif menggunakan kas belum setor custom (Rp ${customKasBelumSetor.toLocaleString('id-ID')}) sesuai aktual kasir.`
                          : `🔄 Sistem menggunakan mode standar otomatis (Rp ${effectiveBiayaKasBelumDisetor.toLocaleString('id-ID')}).`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSyncKasOpnameToCloud}
                      disabled={isSyncingKasOpname}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black shadow-xs transition-all active:scale-95 flex items-center space-x-1 cursor-pointer ${
                        kasOpnameSyncSuccess
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
                      }`}
                      title="Sinkronkan data kas opname ini ke Google Spreadsheet (Sheet KasOpnameKasir) agar sinkron otomatis antar device"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingKasOpname ? 'animate-spin' : ''}`} />
                      <span>{kasOpnameSyncSuccess ? '✓ Tersinkron ke Sheet!' : isSyncingKasOpname ? 'Menyinkronkan...' : '☁️ Sinkron ke Spreadsheet'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyCashierActualToSystem}
                      className="px-3 py-1.5 rounded-lg text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-all active:scale-95 flex items-center space-x-1"
                      title="Sinkronkan nilai kas belum setor pada sistem agar Saldo Sesungguhnya persis sama dengan uang fisik kasir"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>⚡ Terapkan Aktual Kasir ke Sistem</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintKasOpnameReport}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs transition-all active:scale-95 flex items-center space-x-1"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>🖨️ Cetak Berita Acara</span>
                    </button>
                  </div>
                </div>

                {/* Audit Explanation Breakdown (Analisis Kasir & Rekonsiliasi) */}
                <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3 text-[11px]">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex flex-wrap items-center justify-between gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-2">
                      <Search className="w-4 h-4 text-indigo-600" />
                      <span className="font-black text-xs text-indigo-950 dark:text-indigo-200">
                        Analisis Rekonsiliasi Kasir (Uang Fisik di Laci: Rp {auditKasFisikInput.toLocaleString('id-ID')} vs Target Kas: Rp {uangTunaiSeharusnyaDiLaci.toLocaleString('id-ID')}):
                      </span>
                    </div>
                  </div>

                  {/* Penjelasan Ringkas & Mudah Dipahami Awam */}
                  <ul className="space-y-2 list-disc pl-4 text-slate-600 dark:text-slate-300">
                    <li>
                      <strong>1. Status Kesesuaian Kas Opname:</strong>{' '}
                      {auditKasFisikInput === 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          Belum ada nominal uang fisik kasir yang diinput. Uang tunai yang wajib ada di laci meja kasir saat ini adalah <strong>Rp {uangTunaiSeharusnyaDiLaci.toLocaleString('id-ID')}</strong>.
                        </span>
                      ) : selisihAuditKasir === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓ Kas Opname 100% Cocok & Seimbang (Pas). Uang fisik tunai kasir sebesar Rp {auditKasFisikInput.toLocaleString('id-ID')} persis seimbang dengan kewajiban kasir.
                        </span>
                      ) : selisihAuditKasir > 0 ? (
                        <span className="text-amber-700 dark:text-amber-300 font-bold">
                          Terdapat Surplus Uang Fisik Kasir sebesar +Rp {selisihAuditKasir.toLocaleString('id-ID')} (Uang tunai di laci kasir lebih banyak daripada kewajiban tunai Rp {uangTunaiSeharusnyaDiLaci.toLocaleString('id-ID')}).
                        </span>
                      ) : (
                        <span className="text-rose-700 dark:text-rose-300 font-bold">
                          Terdapat Defisit Uang Fisik Kasir sebesar -Rp {Math.abs(selisihAuditKasir).toLocaleString('id-ID')} (Uang tunai di laci kasir kurang Rp {Math.abs(selisihAuditKasir).toLocaleString('id-ID')} dari kewajiban tunai Rp {uangTunaiSeharusnyaDiLaci.toLocaleString('id-ID')}).
                        </span>
                      )}
                    </li>

                    <li>
                      <strong>2. Sisa Panjar Murni Para Pihak:</strong> Total sisa uang panjar perkara aktif milik pihak yang belum terpakai adalah <strong>Rp {totalSisaPanjarMurniPerkara.toLocaleString('id-ID')}</strong>.
                    </li>

                    {effectiveBiayaKasBelumDisetor > 0 && (
                      <li>
                        <strong>3. Titipan Biaya Belum Disetor ke Bendahara:</strong> Uang tunai biaya proses/PNBP yang sudah ditarik dari panjar namun fisiknya masih tersimpan di laci kasir (belum disetor) sebesar <strong>Rp {effectiveBiayaKasBelumDisetor.toLocaleString('id-ID')}</strong>.
                      </li>
                    )}

                    {effectiveUnpaidLoanAmount > 0 && (
                      <li className="text-rose-700 dark:text-rose-300">
                        <strong>4. Bon / Pinjaman Operasional Kasir (Belum Lunas):</strong> Terdapat uang kasir sebesar <strong>Rp {effectiveUnpaidLoanAmount.toLocaleString('id-ID')}</strong> yang sedang dipinjam sementara untuk kegiatan dinas/operasional kantor (dipegang dalam bentuk kwitansi bon sementara, bukan uang fisik di laci).
                      </li>
                    )}

                    {selisihAuditKasir !== 0 && auditKasFisikInput > 0 && (
                      <li>
                        <strong>5. Sumber Potensi Selisih Rp {Math.abs(selisihAuditKasir).toLocaleString('id-ID')}:</strong>
                        <ul className="list-circle pl-4 mt-1 space-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          {selisihAuditKasir === 9000 && (
                            <li className="text-indigo-600 dark:text-indigo-300 font-medium">
                              • Terdeteksi selisih Rp 9.000: Kemungkinan berasal dari pembulatan resi kurir/Pos atau perbedaan pencatatan komponen meterai/PNBP/redaksi.
                            </li>
                          )}
                          <li>• Resi pengiriman Pos/ekspedisi berakhiran ganjil yang dibulatkan saat pembayaran.</li>
                          <li>• Sisa belanja panggilan/sidang keliling yang belum disetorkan kembali ke kasir.</li>
                          <li>• Kwitansi pengeluaran atau penerimaan tunai hari ini yang belum sempat terinput di sistem.</li>
                        </ul>
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Tabel Rincian Rekonsiliasi Kas (Format Bersih & Mudah Dibaca Awam) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Tabel Rincian Rekonsiliasi Kasir:</span>
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    Format Standar Kas Opname
                  </span>
                </div>

                <div className="border rounded-2xl overflow-hidden border-slate-200 dark:border-slate-800 shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 text-[11px] font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3">Pos Aliran Dana / Keterangan</th>
                        <th className="p-3 text-center w-24">Sifat</th>
                        <th className="p-3 text-right">Nominal (Rp)</th>
                        <th className="p-3 text-slate-500 text-[10px]">Penjelasan Ringkas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {/* Baris 1: Penerimaan Panjar Awal */}
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          1. Penerimaan Panjar Awal Perkara Masuk
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Debet (+)
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          Rp {debetBreakdown.totalPanjarMurni.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px]">
                          Total panjar awal dari {debetBreakdown.casePanjars.length} perkara masuk.
                        </td>
                      </tr>

                      {/* Baris 2: Pengembalian Pinjaman jika ada */}
                      {debetBreakdown.totalNonPanjarDebet > 0 && (
                        <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 bg-amber-50/30 dark:bg-amber-950/20">
                          <td className="p-3 font-semibold text-amber-900 dark:text-amber-200">
                            2. Pengembalian Pinjaman / Pelunasan Bon SKUM
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Debet (+)
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            + Rp {debetBreakdown.totalNonPanjarDebet.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px]">
                            Uang pinjaman kasir yang sudah lunas dikembalikan ke kas.
                          </td>
                        </tr>
                      )}

                      {/* Baris 3: Total Pengeluaran Biaya SKUM */}
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          3. Pengeluaran Biaya Perkara Tercatat di Buku
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            Kredit (-)
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          - Rp {totalKredit.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px]">
                          Biaya panggilan pos/relaas, ATK, meterai, dan redaksi.
                        </td>
                      </tr>

                      {/* Baris 4: Sisa Saldo Panjar Buku */}
                      <tr className="bg-sky-50/60 dark:bg-sky-950/40 font-bold border-t border-sky-200 dark:border-sky-800">
                        <td className="p-3 text-sky-950 dark:text-sky-100">
                          4. Saldo Buku SKUM (Sisa Hak Pihak Berperkara)
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-200">
                            Sisa Kas
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-sky-700 dark:text-sky-300 font-extrabold">
                          Rp {saldoSkum.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-sky-800 dark:text-sky-300 text-[11px]">
                          Total penerimaan dikurangi total pengeluaran buku.
                        </td>
                      </tr>

                      {/* Baris 5: Biaya Kas Belum Disetor */}
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 bg-amber-50/40 dark:bg-amber-950/30">
                        <td className="p-3 font-semibold text-amber-950 dark:text-amber-200">
                          5. Biaya Kas Belum Disetor ke Bendahara (Akan Disetor)
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                            Titipan (+)
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-700 dark:text-amber-300">
                          + Rp {effectiveBiayaKasBelumDisetor.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px]">
                          Uang tunai biaya yang ditarik dari panjar dan masih disimpan di laci kasir (belum disetor ke bendahara).
                        </td>
                      </tr>

                      {/* Baris 6: Total Standar Pertanggungjawaban Buku */}
                      <tr className="bg-indigo-50/70 dark:bg-indigo-950/60 font-black border-t-2 border-indigo-300 dark:border-indigo-700">
                        <td className="p-3.5 text-indigo-950 dark:text-indigo-100">
                          6. Total Standar Pertanggungjawaban Kasir (4 + 5)
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                            Standar
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono text-base text-indigo-700 dark:text-indigo-300">
                          Rp {saldoFisikStandarBuku.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3.5 text-indigo-900 dark:text-indigo-200 text-[11px] font-semibold">
                          Total nilai yang wajib dipertanggungjawabkan kasir.
                        </td>
                      </tr>

                      {/* Baris 7: Pinjaman / Bon Sementara jika ada */}
                      {effectiveUnpaidLoanAmount > 0 && (
                        <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 bg-rose-50/40 dark:bg-rose-950/30">
                          <td className="p-3 font-semibold text-rose-950 dark:text-rose-200">
                            7. Pinjaman Kasir / Bon Sementara (Sidkel / Bon Belum Kembali)
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200">
                              Bon (-)
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-rose-700 dark:text-rose-300">
                            - Rp {effectiveUnpaidLoanAmount.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px]">
                            Uang yang sedang dipinjam sementara dan dipegang berupa bukti bon/kwitansi (bukan uang fisik di laci).
                          </td>
                        </tr>
                      )}

                      {/* Baris 8: Uang Tunai Murni yang Wajib Ada di Laci */}
                      <tr className="bg-emerald-100/70 dark:bg-emerald-950/80 font-black border-t-2 border-emerald-500">
                        <td className="p-3.5 text-emerald-950 dark:text-emerald-100 text-sm">
                          8. Uang Tunai yang Seharusnya Ada di Laci Kasir (6 - 7)
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                            Target Kas
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono text-base text-emerald-700 dark:text-emerald-300">
                          Rp {uangTunaiSeharusnyaDiLaci.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3.5 text-emerald-900 dark:text-emerald-200 text-[11px] font-bold">
                          Uang fisik tunai yang wajib ada di laci meja kasir saat dihitung.
                        </td>
                      </tr>

                      {/* Baris 9: Uang Fisik Aktual di Kasir */}
                      <tr className="bg-white dark:bg-slate-900 font-bold border-t border-slate-200 dark:border-slate-800">
                        <td className="p-3 text-slate-900 dark:text-white">
                          9. Uang Fisik Aktual di Laci Kasir (Hasil Kas Opname)
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                            Fisik Riil
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                          Rp {auditKasFisikInput.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px]">
                          Nominal uang tunai fisik yang benar-benar ada di meja kasir.
                        </td>
                      </tr>

                      {/* Baris 10: Selisih Kas Opname */}
                      <tr className={`font-black border-t-2 ${
                        selisihAuditKasir === 0 
                          ? 'bg-emerald-500 text-white' 
                          : selisihAuditKasir > 0 
                            ? 'bg-amber-500 text-slate-950' 
                            : 'bg-rose-600 text-white'
                      }`}>
                        <td className="p-3.5 text-sm">
                          10. KESIMPULAN REKONSILIASI KAS OPNAME (9 - 8)
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-black/20 text-inherit">
                            {selisihAuditKasir === 0 ? 'COCOK / PAS' : selisihAuditKasir > 0 ? 'SURPLUS' : 'DEFISIT'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono text-base">
                          {selisihAuditKasir === 0 ? 'Rp 0 (SEIMBANG)' : `${selisihAuditKasir > 0 ? '+' : ''}Rp ${selisihAuditKasir.toLocaleString('id-ID')}`}
                        </td>
                        <td className="p-3.5 text-[11px] font-semibold">
                          {selisihAuditKasir === 0 
                            ? 'Uang fisik tunai kasir 100% cocok sempurna dengan kewajiban pembukuan.' 
                            : selisihAuditKasir > 0 
                              ? `Uang tunai di laci kasir lebih banyak Rp ${selisihAuditKasir.toLocaleString('id-ID')}.` 
                              : `Uang tunai di laci kasir kurang Rp ${Math.abs(selisihAuditKasir).toLocaleString('id-ID')}.`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer & Actions */}
            <div className="px-6 py-4 border-t flex flex-wrap items-center justify-between gap-2 shrink-0 border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                {onNavigateToKasKuning && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsRekonsiliasiModalOpen(false);
                      onNavigateToKasKuning();
                    }}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center space-x-1.5 transition-all shadow-xs"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Buka Titipan Kas Kuning</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsRekonsiliasiModalOpen(false);
                    setIsRiwayatPinjamanModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center space-x-1.5 transition-all"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Riwayat Pinjaman SKUM</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintJurnalReport}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl flex items-center space-x-1.5 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Laporan Rekonsiliasi</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsRekonsiliasiModalOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-xl font-bold"
              >
                Tutup
              </button>
            </div>
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
              {pinjamanSyncSuccessMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{pinjamanSyncSuccessMessage}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total {pinjamanRecords.length} Catatan Transaksi Peminjaman
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePushPinjamanToCloud}
                    disabled={isSyncingPinjamanToCloud || pinjamanRecords.length === 0}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors"
                    title="Kirim dan tuliskan seluruh data pinjaman ke tab PinjamanSaldo di Google Spreadsheet"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPinjamanToCloud ? 'animate-spin' : ''}`} />
                    <span>{isSyncingPinjamanToCloud ? 'Menyinkronkan...' : 'Kirim ke Spreadsheet'}</span>
                  </button>
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
                              <button
                                onClick={() => {
                                  setIsRiwayatPinjamanModalOpen(false);
                                  handleOpenEditPinjaman(p);
                                }}
                                className="p-1.5 text-sky-600 hover:text-sky-800 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-950/50 transition-colors"
                                title="Edit Data & Status Pinjaman"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {p.status === 'BELUM_DIBAYAR' ? (
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
                              ) : (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Ubah status pinjaman "${p.peminjam}" kembali menjadi BELUM LUNAS?`)) {
                                      onUpdatePinjaman?.({
                                        ...p,
                                        status: 'BELUM_DIBAYAR',
                                        tanggalBayar: undefined
                                      });
                                    }
                                  }}
                                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-300 rounded-lg text-[10px] font-bold"
                                  title="Set Belum Lunas"
                                >
                                  Set Belum Lunas
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (window.confirm(`Hapus catatan peminjaman SKUM dari "${p.peminjam}"?`)) {
                                    onDeletePinjaman?.(p.id);
                                  }
                                }}
                                className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
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

      {/* Modal Bedah Rincian & Logika Debet SKUM Awal */}
      {isDebetBreakdownModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border transition-all ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0 border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-xs">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Bedah Rincian & Logika Perhitungan Debet SKUM</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      Audit Penerimaan
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Transparansi perhitungan Panjar Awal Perkara Masuk (Rp {debetBreakdown.totalPanjarMurni.toLocaleString('id-ID')}) vs Mutasi Debet Buku (Rp {totalDebet.toLocaleString('id-ID')})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDebetBreakdownModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              
              {/* Formula Clarification Card */}
              <div className={`p-4 rounded-2xl border ${
                isLight ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-emerald-950/30 border-emerald-900/60 text-emerald-100'
              }`}>
                <h4 className="font-extrabold text-sm mb-1.5 flex items-center gap-1.5 text-emerald-900 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Penjelasan Logika Perhitungan Angka Debet:</span>
                </h4>
                <p className="leading-relaxed text-[11px] mb-3 text-slate-700 dark:text-slate-300">
                  Ketika Anda menghitung ulang <strong>panjar awal dari seluruh perkara yang masuk</strong>, totalnya adalah 
                  <strong className="text-emerald-700 dark:text-emerald-300 font-mono"> Rp {debetBreakdown.totalPanjarMurni.toLocaleString('id-ID')}</strong> ({debetBreakdown.casePanjars.length} Perkara). 
                  Sedangkan angka <strong>Rp {totalDebet.toLocaleString('id-ID')}</strong> pada pembukuan Jurnal SKUM adalah <strong>Total Mutasi Debet</strong> yang mencakup pengembalian saldo pinjaman materai kasir sebesar 
                  <strong className="text-amber-700 dark:text-amber-300 font-mono"> Rp {debetBreakdown.totalNonPanjarDebet.toLocaleString('id-ID')}</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 shadow-xs">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">1. Panjar Murni Perkara Masuk</span>
                    <span className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      Rp {debetBreakdown.totalPanjarMurni.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      {debetBreakdown.gugatanPanjars.length} Gugatan + {debetBreakdown.permohonanPanjars.length} Permohonan
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 shadow-xs">
                    <span className="text-[10px] text-amber-600 uppercase font-bold block mb-1">2. Pengembalian Pinjaman</span>
                    <span className="font-mono text-base font-extrabold text-amber-600 dark:text-amber-400">
                      + Rp {debetBreakdown.totalNonPanjarDebet.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      Pelunasan bon materai (27/08/2026)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-600 text-white shadow-xs">
                    <span className="text-[10px] text-emerald-100 uppercase font-bold block mb-1">3. Total Mutasi Debet SKUM</span>
                    <span className="font-mono text-base font-black">
                      = Rp {totalDebet.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[9px] text-emerald-100/80 block mt-0.5">
                      Seluruh uang masuk ke buku SKUM
                    </span>
                  </div>
                </div>
              </div>

              {/* Table 1: Penerimaan Panjar Awal Perkara */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span>1. Rincian Panjar Awal {debetBreakdown.casePanjars.length} Perkara Masuk</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                      Total: Rp {debetBreakdown.totalPanjarMurni.toLocaleString('id-ID')}
                    </span>
                  </h5>
                </div>

                <div className="border rounded-xl overflow-hidden border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2.5 text-center w-8">No</th>
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5">Nomor Perkara</th>
                        <th className="p-2.5">Jenis</th>
                        <th className="p-2.5">Uraian Transaksi</th>
                        <th className="p-2.5 text-right">Nominal Panjar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {debetBreakdown.casePanjars.map((c, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-2.5 text-center text-slate-400 text-[10px]">{idx + 1}</td>
                          <td className="p-2.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">{c.tanggal}</td>
                          <td className="p-2.5 font-bold font-mono text-indigo-600 dark:text-indigo-400">{c.nomorPerkara}</td>
                          <td className="p-2.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              c.jenisPerkara === 'Gugatan' 
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' 
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            }`}>
                              {c.jenisPerkara}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{c.uraian}</td>
                          <td className="p-2.5 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                            Rp {c.nominal.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                      {/* Subtotal Row */}
                      <tr className="bg-emerald-50/50 dark:bg-emerald-950/30 font-black border-t border-emerald-200 dark:border-emerald-800">
                        <td colSpan={5} className="p-2.5 text-right text-emerald-900 dark:text-emerald-200">
                          SUBTOTAL PANJAR AWAL {debetBreakdown.casePanjars.length} PERKARA MASUK:
                        </td>
                        <td className="p-2.5 text-right font-mono text-emerald-700 dark:text-emerald-300">
                          Rp {debetBreakdown.totalPanjarMurni.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: Penerimaan Non-Panjar / Pengembalian Pinjaman */}
              {debetBreakdown.nonCaseDebets.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span>2. Rincian Pengembalian / Pelunasan Pinjaman Kas Masuk</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 font-bold text-amber-700 dark:text-amber-300">
                      Total: Rp {debetBreakdown.totalNonPanjarDebet.toLocaleString('id-ID')}
                    </span>
                  </h5>

                  <div className="border rounded-xl overflow-hidden border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2.5 text-center w-8">No</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Akun / Referensi</th>
                          <th className="p-2.5">Uraian Transaksi</th>
                          <th className="p-2.5 text-right">Nominal Masuk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {debetBreakdown.nonCaseDebets.map((nc, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-2.5 text-center text-slate-400 text-[10px]">{idx + 1}</td>
                            <td className="p-2.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">{nc.tanggal}</td>
                            <td className="p-2.5 font-bold font-mono text-amber-700 dark:text-amber-400">{nc.nomorPerkara}</td>
                            <td className="p-2.5 text-slate-600 dark:text-slate-300">{nc.uraian}</td>
                            <td className="p-2.5 text-right font-mono font-extrabold text-amber-600 dark:text-amber-400">
                              + Rp {nc.nominal.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex items-center justify-between shrink-0 border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">
                Total Mutasi Debet SKUM = <strong>Rp {totalDebet.toLocaleString('id-ID')}</strong>
              </div>
              <button
                onClick={() => setIsDebetBreakdownModalOpen(false)}
                className="px-5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold text-xs shadow-xs"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
