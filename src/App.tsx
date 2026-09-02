import React, { useState, useEffect, useCallback } from 'react';
import { 
  CaseRecord, 
  FilterState, 
  NotificationItem, 
  SyncSettings, 
  CacheMetadata,
  BiayaProsesRecord,
  JurnalBiayaSkumRecord,
  PinjamanSkumRecord,
  StatusPerkara
} from './types';
import { StorageService, TARGET_APPS_SCRIPT_URL, TARGET_SPREADSHEET_URL } from './services/storage';
import { SyncService } from './services/syncService';
import { Navbar } from './components/Navbar';
import { CaseTable } from './components/CaseTable';
import { BukuBiayaProses } from './components/BukuBiayaProses';
import { JurnalBiayaSkumView, getEffectiveWarnaBaris } from './components/JurnalBiayaSkumView';
import { TitipanKasKuningView } from './components/TitipanKasKuningView';
import { CaseFormModal } from './components/CaseFormModal';
import { SpreadsheetSyncModal } from './components/SpreadsheetSyncModal';
import { NotificationCenter } from './components/NotificationCenter';
import { GitHubWorkflowModal } from './components/GitHubWorkflowModal';
import { CacheManagerModal } from './components/CacheManagerModal';
import { CaseDetailModal } from './components/CaseDetailModal';
import { JurnalBiayaModal } from './components/JurnalBiayaModal';
import { ToastNotification } from './components/ToastNotification';

export default function App() {
  const [activeTab, setActiveTab] = useState<'table' | 'buku-biaya-proses' | 'jurnal-skum' | 'kas-kuning'>('table');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('pa_perkara_theme_v1') as 'light' | 'dark') || 'light';
  });
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [biayaProsesRecords, setBiayaProsesRecords] = useState<BiayaProsesRecord[]>([]);
  const [jurnalSkumRecords, setJurnalSkumRecords] = useState<JurnalBiayaSkumRecord[]>([]);
  const [pinjamanSkumRecords, setPinjamanSkumRecords] = useState<PinjamanSkumRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(StorageService.getSyncSettings());
  const [cacheMeta, setCacheMeta] = useState<CacheMetadata>(StorageService.getCacheMeta());

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('pa_perkara_theme_v1', nextTheme);
  };

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    jenisPerkara: 'ALL',
    kategoriPerkara: 'ALL',
    status: 'ALL',
    tahun: 'ALL'
  });

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CaseRecord | undefined>(undefined);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);
  const [isCacheModalOpen, setIsCacheModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<CaseRecord | null>(null);
  const [isJurnalModalOpen, setIsJurnalModalOpen] = useState(false);
  const [jurnalSelectedCase, setJurnalSelectedCase] = useState<CaseRecord | null>(null);
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Sanitizer to guarantee SKUM Debet/Kredit correctness and heal legacy corrupted records
  const sanitizeSkumRecords = (records: JurnalBiayaSkumRecord[]): JurnalBiayaSkumRecord[] => {
    return records.map(r => {
      const uraianLower = (r.uraian || '').toLowerCase();
      let pen = Number(r.penerimaan) || 0;
      let peng = Number(r.pengeluaran) || 0;
      let kat = r.kategori || 'Panggilan';

      const isPengembalianPinjaman = uraianLower.includes('pengembalian pinjaman') || 
                                     uraianLower.includes('pelunasan pinjaman') ||
                                     uraianLower.includes('pengembalian saldo skum');

      const isPeminjamanPinjaman = (kat === 'Pinjaman' && !isPengembalianPinjaman) ||
                                   uraianLower.includes('peminjaman saldo') || 
                                   uraianLower.includes('pinjam saldo') ||
                                   r.id.startsWith('skum-pinjam') ||
                                   r.id.startsWith('pinjam-');

      const isExplicitPanjarAwal = uraianLower.includes('panjar awal') || 
                                   uraianLower.includes('penerimaan panjar') || 
                                   uraianLower.includes('tambah panjar') || 
                                   uraianLower.includes('setoran panjar') ||
                                   uraianLower.includes('penambahan panjar');

      const isSisaPanjar = kat === 'Sisa Panjar' || uraianLower.includes('sisa panjar') || uraianLower.includes('pengembalian sisa');
      const isJurnalExecutionExpense = uraianLower.startsWith('pencatatan jurnal:');

      // Determine Debet (Penerimaan/Income) vs Kredit (Pengeluaran/Expense)
      let isDebet = false;
      if (isPengembalianPinjaman || isExplicitPanjarAwal) {
        isDebet = true;
      } else if (isPeminjamanPinjaman || isJurnalExecutionExpense || isSisaPanjar || 
                 kat === 'Panggilan' || kat === 'ATK' || kat === 'Meterai' || kat === 'Redaksi' || kat === 'Proses') {
        isDebet = false;
      } else if (kat === 'Panjar') {
        isDebet = true;
      } else {
        isDebet = pen > 0 && peng === 0;
      }

      const totalVal = (pen > 0 ? pen : 0) + (peng > 0 ? peng : 0);
      const val = totalVal > 0 ? (pen > 0 && peng > 0 ? (isDebet ? pen : peng) : totalVal) : 0;

      if (isDebet) {
        pen = val;
        peng = 0;
        if (isPengembalianPinjaman) kat = 'Pinjaman';
        else kat = 'Panjar';
      } else {
        pen = 0;
        peng = val;
        if (isPeminjamanPinjaman) {
          kat = 'Pinjaman';
        } else if (isSisaPanjar) {
          kat = 'Sisa Panjar';
        } else if (kat === 'Panjar') {
          if (uraianLower.includes('panggilan')) kat = 'Panggilan';
          else if (uraianLower.includes('meterai')) kat = 'Meterai';
          else if (uraianLower.includes('redaksi')) kat = 'Redaksi';
          else if (uraianLower.includes('atk') || uraianLower.includes('pemberkasan')) kat = 'ATK';
          else if (uraianLower.includes('proses') || uraianLower.includes('pnbp')) kat = 'Proses';
          else kat = 'Panggilan';
        }
      }

      return {
        ...r,
        penerimaan: pen,
        pengeluaran: peng,
        kategori: kat as any
      };
    });
  };

  // Helper to ensure case IDs are unique
  const ensureUniqueCaseIds = (caseList: CaseRecord[]): CaseRecord[] => {
    const seen = new Set<string>();
    return caseList.map((c, idx) => {
      let id = c.id;
      if (!id || seen.has(id)) {
        id = `case-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      }
      seen.add(id);
      return { ...c, id };
    });
  };

  // Helper to recalculate case balances & auto-status whenever SKUM records change
  const updateCasesWithSkumLogs = (
    currentCases: CaseRecord[],
    skumList: JurnalBiayaSkumRecord[]
  ): CaseRecord[] => {
    const cleanSkumList = sanitizeSkumRecords(skumList);
    return currentCases.map(c => {
      let caseSkumLogs: JurnalBiayaSkumRecord[] = [];
      if (c.nomorPerkara) {
        const normCaseNum = c.nomorPerkara.trim().toLowerCase();
        caseSkumLogs = cleanSkumList.filter(r => r.nomorPerkara && r.nomorPerkara.trim().toLowerCase() === normCaseNum);
      }

      // 1. Separate income vs expenses for this case
      let panjarAwalIncomeTotal = 0;
      let pinjamanRepaymentTotal = 0;
      let totalPengeluaran = 0;

      caseSkumLogs.forEach(r => {
        const pen = Number(r.penerimaan) || 0;
        const peng = Number(r.pengeluaran) || 0;
        const uraianLower = (r.uraian || '').toLowerCase();

        if (r.kategori === 'Pinjaman' && (uraianLower.includes('pengembalian') || uraianLower.includes('pelunasan'))) {
          pinjamanRepaymentTotal += pen;
        } else if (pen > 0 && (r.kategori === 'Panjar' || uraianLower.includes('panjar') || uraianLower.includes('setoran'))) {
          panjarAwalIncomeTotal += pen;
        } else if (pen > 0) {
          panjarAwalIncomeTotal += pen;
        }

        if (peng > 0) {
          totalPengeluaran += peng;
        }
      });

      let basePanjar = c.panjarAwal || 0;
      if (panjarAwalIncomeTotal > 0) {
        basePanjar = panjarAwalIncomeTotal;
      } else if (basePanjar === 0 && (c.saldoPerkara || 0) > 0) {
        basePanjar = (c.saldoPerkara || 0) + totalPengeluaran;
      }

      const effectivePanjar = basePanjar + pinjamanRepaymentTotal;

      const hasSisaPanjarLog = caseSkumLogs.some(r =>
        r.kategori === 'Sisa Panjar' ||
        (r.uraian && (
          r.uraian.toLowerCase().includes('sisa panjar') ||
          r.uraian.toLowerCase().includes('pengembalian panjar') ||
          r.uraian.toLowerCase().includes('pengembalian sisa')
        ))
      );

      const hasMinutasiLog = caseSkumLogs.some(r =>
        r.uraian && (r.uraian.toLowerCase().includes('minutasi') || r.uraian.toLowerCase().includes('arsip'))
      );

      const hasPutusanLog = caseSkumLogs.some(r =>
        r.uraian && (
          r.uraian.toLowerCase().includes('putusan') ||
          r.uraian.toLowerCase().includes('pemberitahuan putusan') ||
          r.uraian.toLowerCase().includes('akta cerai') ||
          r.uraian.toLowerCase().includes('ikrar talak')
        )
      );

      const hasActivityLog = caseSkumLogs.some(r =>
        r.kategori === 'Panggilan' ||
        r.kategori === 'ATK' ||
        r.kategori === 'Proses' ||
        (r.uraian && (
          r.uraian.toLowerCase().includes('panggilan') ||
          r.uraian.toLowerCase().includes('relaas') ||
          r.uraian.toLowerCase().includes('pemberkasan')
        ))
      );

      // Determine new balance:
      // 1. If 'Sisa Panjar' log exists, remaining balance was refunded -> saldo = 0
      // 2. If SKUM logs exist, dynamically calculate: effectivePanjar - totalPengeluaran
      // 3. If NO SKUM logs exist at all for this case, restore/retain effectivePanjar or c.saldoPerkara
      let newSaldo = c.saldoPerkara;
      if (hasSisaPanjarLog) {
        newSaldo = 0;
      } else if (caseSkumLogs.length > 0) {
        newSaldo = Math.max(0, effectivePanjar - totalPengeluaran);
      } else if (effectivePanjar > 0) {
        newSaldo = effectivePanjar;
      }

      let newStatus: StatusPerkara = c.status || 'Pendaftaran';

      if (newSaldo === 0 || hasSisaPanjarLog) {
        newStatus = c.status === 'Arsip' ? 'Arsip' : 'Selesai';
      } else if (hasMinutasiLog) {
        newStatus = 'Minutasi';
      } else if (hasPutusanLog || c.tanggalPutus) {
        newStatus = 'Putus';
      } else if (hasActivityLog || totalPengeluaran > 0 || caseSkumLogs.length > 0) {
        if (c.status === 'Pendaftaran' || c.status === 'Selesai') {
          newStatus = 'Diperiksa';
        }
      } else if (c.status === 'Selesai' && newSaldo > 0) {
        newStatus = 'Diperiksa';
      }

      return {
        ...c,
        panjarAwal: effectivePanjar > 0 ? effectivePanjar : c.panjarAwal,
        pengeluaran: caseSkumLogs.length > 0 ? totalPengeluaran : (c.pengeluaran || 0),
        saldoPerkara: newSaldo,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
    });
  };

  // Helper to guarantee 2-way synchronization between PinjamanSKUM and JurnalBiayaSKUM:
  // 1. Any loan in Pinjaman records MUST appear as an expense (pengeluaran) in Jurnal SKUM.
  // 2. Any repaid loan in Pinjaman records MUST appear as an income (penerimaan) in Jurnal SKUM.
  // 3. Any loan in Jurnal SKUM is reconstructed into Pinjaman records.
  const synchronizePinjamanAndJurnal = (
    jurnalRecords: JurnalBiayaSkumRecord[],
    pinjamanList: PinjamanSkumRecord[],
    isFromLiveSheet: boolean = false
  ): { syncedJurnal: JurnalBiayaSkumRecord[]; syncedPinjaman: PinjamanSkumRecord[] } => {
    const updatedJurnal = [...jurnalRecords];
    let updatedPinjaman = [...pinjamanList];

    const existingPengeluaranKeys = new Set<string>();
    const existingPenerimaanKeys = new Set<string>();

    updatedJurnal.forEach(j => {
      const isLoanExpense = SyncService.isPinjamanExpense(j.uraian, j.kategori, j.keterangan, j.id);
      const isLoanRepayment = SyncService.isPinjamanRepayment(j.uraian, j.kategori, j.keterangan);

      if (isLoanExpense && (Number(j.pengeluaran) || 0) > 0) {
        existingPengeluaranKeys.add(`${j.tanggal}-${j.pengeluaran}`);
        existingPengeluaranKeys.add(j.id);
      }
      if (isLoanRepayment && (Number(j.penerimaan) || 0) > 0) {
        existingPenerimaanKeys.add(`${j.tanggal}-${j.penerimaan}`);
        existingPenerimaanKeys.add(j.id);
      }
    });

    // If syncing from live sheet, purge phantom loans that don't exist in sheet
    if (isFromLiveSheet && pinjamanList.length === 0) {
      // Sheet has no explicit Pinjaman tab rows; build purely from Jurnal
      updatedPinjaman = [];
    }

    // 2. Ensure every valid loan in Pinjaman list exists in Jurnal SKUM
    updatedPinjaman.forEach(p => {
      if (!p.jumlah || p.jumlah <= 0) return;
      const loanKey = `${p.tanggal}-${p.jumlah}`;
      const hasDisbursement = existingPengeluaranKeys.has(loanKey) || (p.skumPengeluaranId && existingPengeluaranKeys.has(p.skumPengeluaranId));

      if (!hasDisbursement && !isFromLiveSheet) {
        const newDisbursementId = p.skumPengeluaranId || `skum-pinjam-${p.id}`;
        updatedJurnal.push({
          id: newDisbursementId,
          tanggal: p.tanggal || new Date().toISOString().split('T')[0],
          nomorPerkara: p.nomorPerkara || 'Kepaniteraan Umum',
          uraian: `Peminjaman Saldo SKUM: ${p.peminjam || 'Kepaniteraan'} (${p.keterangan || 'Pinjaman Operasional'})`,
          penerimaan: 0,
          pengeluaran: p.jumlah,
          kategori: 'Pinjaman',
          keterangan: `Peminjaman Saldo SKUM Kepaniteraan [WARNA:oranye]`,
          warnaBaris: 'oranye',
          createdAt: p.createdAt || new Date().toISOString()
        });
        existingPengeluaranKeys.add(loanKey);
        existingPengeluaranKeys.add(newDisbursementId);
      }

      // If loan is already paid, ensure repayment is in Jurnal SKUM
      const isPaid = p.status === 'SUDAH_DIBAYAR';
      if (isPaid) {
        const repayDate = p.tanggalBayar || p.tanggal || new Date().toISOString().split('T')[0];
        const repayKey = `${repayDate}-${p.jumlah}`;
        const hasRepayment = existingPenerimaanKeys.has(repayKey) || (p.skumPengembalianId && existingPenerimaanKeys.has(p.skumPengembalianId));

        if (!hasRepayment && !isFromLiveSheet) {
          const newRepaymentId = p.skumPengembalianId || `skum-kembali-${p.id}`;
          updatedJurnal.push({
            id: newRepaymentId,
            tanggal: repayDate,
            nomorPerkara: p.nomorPerkara || 'Kepaniteraan Umum',
            uraian: `Pengembalian Pinjaman Saldo SKUM: ${p.peminjam || 'Kepaniteraan'}`,
            penerimaan: p.jumlah,
            pengeluaran: 0,
            kategori: 'Pinjaman',
            keterangan: `Pelunasan Pinjaman Saldo SKUM Kepaniteraan [WARNA:hijau]`,
            warnaBaris: 'hijau',
            createdAt: p.createdAt || new Date().toISOString()
          });
          existingPenerimaanKeys.add(repayKey);
          existingPenerimaanKeys.add(newRepaymentId);
        }
      }
    });

    // 3. Reconstruct any loans in Jurnal SKUM into Pinjaman records
    const reconstructed = SyncService.reconstructPinjamanFromJurnal(updatedJurnal);
    reconstructed.forEach(r => {
      const key = `${r.tanggal}-${r.jumlah}-${(r.peminjam || '').toLowerCase()}`;
      const existingIndex = updatedPinjaman.findIndex(p => 
        `${p.tanggal}-${p.jumlah}-${(p.peminjam || '').toLowerCase()}` === key || 
        p.id === r.id || 
        (p.id && r.id && p.id.replace(/[^0-9]/g, '') && p.id.replace(/[^0-9]/g, '') === r.id.replace(/[^0-9]/g, '')) ||
        (p.skumPengeluaranId && (p.skumPengeluaranId === r.skumPengeluaranId || p.skumPengeluaranId === r.id)) ||
        (r.skumPengeluaranId && (p.id.includes(r.skumPengeluaranId.replace(/[^a-zA-Z0-9]/g, '')) || p.skumPengeluaranId === r.skumPengeluaranId)) ||
        (p.tanggal === r.tanggal && p.jumlah === r.jumlah)
      );
      if (existingIndex === -1) {
        updatedPinjaman.push(r);
      } else {
        if ((!updatedPinjaman[existingIndex].nomorPerkara || updatedPinjaman[existingIndex].nomorPerkara === 'Kepaniteraan Umum') && r.nomorPerkara && r.nomorPerkara !== 'Kepaniteraan Umum') {
          updatedPinjaman[existingIndex].nomorPerkara = r.nomorPerkara;
        }
        if (!updatedPinjaman[existingIndex].skumPengeluaranId && r.skumPengeluaranId) {
          updatedPinjaman[existingIndex].skumPengeluaranId = r.skumPengeluaranId;
        }
      }
    });

    return {
      syncedJurnal: sanitizeSkumRecords(updatedJurnal),
      syncedPinjaman: updatedPinjaman
    };
  };

  // Load Initial Data from Storage / Cache & merge with fresh public data / Google Sheet
  const loadDataFromSource = useCallback(async (isForceSpreadsheetOverwrite = false) => {
    setIsRefreshing(true);
    const loadedCases = StorageService.getCases();
    const loadedBiayaProses = StorageService.getBiayaProsesRecords();
    const loadedJurnalSkum = sanitizeSkumRecords(StorageService.getJurnalSkumRecords());
    const loadedPinjamanSkum = StorageService.getPinjamanSkumRecords();
    const loadedNotifs = StorageService.getNotifications();
    const currentSyncSettings = StorageService.getSyncSettings();

    // Harmonize loaded local pinjaman with loaded local jurnal
    const { syncedJurnal: initialSyncedJurnal, syncedPinjaman: initialSyncedPinjaman } = synchronizePinjamanAndJurnal(
      loadedJurnalSkum,
      loadedPinjamanSkum
    );

    const syncedLoadedCases = ensureUniqueCaseIds(updateCasesWithSkumLogs(loadedCases, initialSyncedJurnal));

    setCases(syncedLoadedCases);
    setBiayaProsesRecords(loadedBiayaProses);
    setJurnalSkumRecords(sortSkumRecords(initialSyncedJurnal));
    setPinjamanSkumRecords(initialSyncedPinjaman);
    setNotifications(loadedNotifs);
    setCacheMeta(StorageService.getCacheMeta());

    const userUrl = (currentSyncSettings.googleSheetUrl && currentSyncSettings.googleSheetUrl.trim().length > 0)
      ? currentSyncSettings.googleSheetUrl.trim()
      : '';

    const targetSpreadsheetUrl = userUrl.includes('docs.google.com') ? userUrl : TARGET_SPREADSHEET_URL;
    const targetAppsScriptUrl = userUrl.includes('script.google.com') ? userUrl : TARGET_APPS_SCRIPT_URL;

    try {
      const liveData = await SyncService.fetchAllLiveSpreadsheetData({
        spreadsheetUrl: targetSpreadsheetUrl,
        appsScriptUrl: targetAppsScriptUrl
      });

      if (liveData && (liveData.cases.length > 0 || liveData.jurnalSkum.length > 0 || liveData.biayaProses.length > 0)) {
        let fetchedCases = liveData.cases;
        // Intelligently merge remote Jurnal SKUM with local loaded records to preserve row colors (warnaBaris)
        let mergedJurnal: JurnalBiayaSkumRecord[] = loadedJurnalSkum;
        if (liveData.jurnalSkum && liveData.jurnalSkum.length > 0) {
          mergedJurnal = liveData.jurnalSkum.map(remoteItem => {
            const localMatch = loadedJurnalSkum.find(l => 
              (l.id && l.id === remoteItem.id) ||
              (l.nomorPerkara && l.uraian && 
               l.nomorPerkara.trim().toLowerCase() === remoteItem.nomorPerkara.trim().toLowerCase() && 
               l.uraian.trim().toLowerCase() === remoteItem.uraian.trim().toLowerCase())
            );

            let finalWarna = remoteItem.warnaBaris || 'default';
            if (finalWarna === 'default' && localMatch && localMatch.warnaBaris && localMatch.warnaBaris !== 'default') {
              finalWarna = localMatch.warnaBaris;
            }

            return {
              ...remoteItem,
              warnaBaris: finalWarna
            };
          });
        }

        let combinedPinjaman = liveData.pinjamanSkum || [];

        // Two-way synchronization between live Jurnal and live Pinjaman
        const { syncedJurnal: finalSyncedJurnal, syncedPinjaman: finalSyncedPinjaman } = synchronizePinjamanAndJurnal(
          mergedJurnal,
          combinedPinjaman,
          true
        );

        const activeJurnal = sanitizeSkumRecords(finalSyncedJurnal);

        if (fetchedCases.length > 0) {
          fetchedCases = updateCasesWithSkumLogs(fetchedCases, activeJurnal);
          const uniqueFetched = ensureUniqueCaseIds(fetchedCases);
          setCases(uniqueFetched);
          StorageService.saveCases(uniqueFetched);
        } else if (loadedCases.length > 0) {
          const syncedLoaded = ensureUniqueCaseIds(updateCasesWithSkumLogs(loadedCases, activeJurnal));
          setCases(syncedLoaded);
          StorageService.saveCases(syncedLoaded);
        }

        if (liveData.biayaProses.length > 0) {
          setBiayaProsesRecords(liveData.biayaProses);
          StorageService.saveBiayaProsesRecords(liveData.biayaProses);
        }

        if (activeJurnal.length > 0) {
          const sortedJurnal = sortSkumRecords(activeJurnal);
          setJurnalSkumRecords(sortedJurnal);
          StorageService.saveJurnalSkumRecords(sortedJurnal);
        }

        setPinjamanSkumRecords(finalSyncedPinjaman);
        StorageService.savePinjamanSkumRecords(finalSyncedPinjaman);

        if (liveData.kasOpname) {
          StorageService.saveKasOpname(liveData.kasOpname);
        }

        setCacheMeta(StorageService.getCacheMeta());
        StorageService.saveSyncSettings({
          ...currentSyncSettings,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'success'
        });
      }
    } catch (err) {
      console.warn('Gagal auto-sync Google Sheet:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDataFromSource(false);

    // Auto-refresh when tab becomes active / visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDataFromSource(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Background sync interval (every 5 minutes)
    const intervalId = setInterval(() => {
      loadDataFromSource(false);
    }, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [loadDataFromSource]);

  // Sync state changes to storage
  const updateCasesState = useCallback((newCases: CaseRecord[]) => {
    const uniqueCases = ensureUniqueCaseIds(newCases);
    setCases(uniqueCases);
    StorageService.saveCases(uniqueCases);
    setCacheMeta(StorageService.getCacheMeta());
  }, []);

  const sortSkumRecords = (records: JurnalBiayaSkumRecord[]): JurnalBiayaSkumRecord[] => {
    return [...records].sort((a, b) => {
      const dateA = a.tanggal || '';
      const dateB = b.tanggal || '';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      const createdA = a.createdAt || '';
      const createdB = b.createdAt || '';
      return createdA.localeCompare(createdB);
    });
  };

  const updateBiayaProsesState = useCallback((newRecords: BiayaProsesRecord[]) => {
    setBiayaProsesRecords(newRecords);
    StorageService.saveBiayaProsesRecords(newRecords);
  }, []);

  const updateJurnalSkumState = useCallback((newRecords: JurnalBiayaSkumRecord[]) => {
    const clean = sanitizeSkumRecords(newRecords);
    const sorted = sortSkumRecords(clean);
    setJurnalSkumRecords(sorted);
    StorageService.saveJurnalSkumRecords(sorted);
  }, []);

  const updatePinjamanSkumState = useCallback((newRecords: PinjamanSkumRecord[]) => {
    setPinjamanSkumRecords(newRecords);
    StorageService.savePinjamanSkumRecords(newRecords);
  }, []);

  const addNotification = useCallback((title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert', nomorPerkara?: string) => {
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false,
      nomorPerkara
    };
    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      StorageService.saveNotifications(updated);
      return updated;
    });
    setActiveToast(newNotif);
  }, []);

  const getWebhookUrl = (settings: SyncSettings): string | undefined => {
    if (settings.googleSheetWebhookUrl && settings.googleSheetWebhookUrl.trim().length > 0) {
      return settings.googleSheetWebhookUrl.trim();
    }
    if (settings.googleSheetUrl && settings.googleSheetUrl.trim().includes('script.google.com')) {
      return settings.googleSheetUrl.trim();
    }
    return undefined;
  };

  // Handlers for Buku Bantu Biaya Proses
  const handleAddBiayaProsesRecord = (record: Omit<BiayaProsesRecord, 'id' | 'createdAt'>) => {
    const newRecord: BiayaProsesRecord = {
      ...record,
      id: `bp-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    const updated = [...biayaProsesRecords, newRecord];
    updateBiayaProsesState(updated);

    const webhook = getWebhookUrl(syncSettings);
    if (webhook) {
      SyncService.postToWebhook(webhook, 'add_biaya_proses', newRecord);
    }

    addNotification(
      'Transaksi Log Biaya Proses',
      `Berhasil mencatat log transaksi: ${newRecord.uraian} (${newRecord.penerimaan > 0 ? `Penerimaan Rp${newRecord.penerimaan.toLocaleString('id-ID')}` : `Pengeluaran Rp${newRecord.pengeluaran.toLocaleString('id-ID')}`}).`,
      'success',
      newRecord.nomorPerkara !== '-' ? newRecord.nomorPerkara : undefined
    );
  };

  const handleUpdateBiayaProsesRecord = (record: BiayaProsesRecord) => {
    try {
      const updated = biayaProsesRecords.map(r => r.id === record.id ? record : r);
      updateBiayaProsesState(updated);

      const webhook = getWebhookUrl(syncSettings);
      if (webhook) {
        SyncService.postToWebhook(webhook, 'update_biaya_proses', record);
      }

      addNotification(
        'Log Transaksi Berhasil Diperbarui',
        `Log transaksi ${record.uraian} berhasil diperbarui.`,
        'info',
        record.nomorPerkara !== '-' ? record.nomorPerkara : undefined
      );
    } catch (err: any) {
      addNotification('Gagal Memperbarui Transaksi', err?.message || 'Terjadi kesalahan saat memperbarui log transaksi.', 'alert');
    }
  };

  const handleDeleteBiayaProsesRecord = (id: string) => {
    try {
      const target = biayaProsesRecords.find(r => r.id === id);
      if (!target) {
        addNotification('Gagal Menghapus Transaksi', 'Data log transaksi tidak ditemukan.', 'alert');
        return;
      }
      const updated = biayaProsesRecords.filter(r => r.id !== id);
      updateBiayaProsesState(updated);

      const webhook = getWebhookUrl(syncSettings);
      if (webhook) {
        SyncService.postToWebhook(webhook, 'delete_biaya_proses', target);
      }

      addNotification(
        'Log Transaksi Berhasil Dihapus',
        `Satu log transaksi (${target.uraian}) telah berhasil dihapus.`,
        'warning',
        target.nomorPerkara !== '-' ? target.nomorPerkara : undefined
      );
    } catch (err: any) {
      addNotification('Gagal Menghapus Transaksi', err?.message || 'Terjadi kesalahan saat menghapus log transaksi.', 'alert');
    }
  };

  const handlePotongAtkPerkara = (nomorPerkara: string, amount: number, uraian: string, tanggal: string) => {
    const newRecord: BiayaProsesRecord = {
      id: `bp-atk-${Date.now()}`,
      tanggal,
      nomorPerkara,
      uraian,
      penerimaan: amount,
      pengeluaran: 0,
      keterangan: 'Penerimaan Pemotongan ATK Perkara',
      kategori: 'ATK',
      createdAt: new Date().toISOString()
    };
    const updated = [...biayaProsesRecords, newRecord];
    updateBiayaProsesState(updated);

    let updatedCaseRecord: CaseRecord | undefined;
    const updatedCases = cases.map(c => {
      if (c.nomorPerkara === nomorPerkara) {
        updatedCaseRecord = {
          ...c,
          pengeluaran: (c.pengeluaran || 0) + amount,
          saldoPerkara: Math.max(0, (c.saldoPerkara || 0) - amount),
          updatedAt: new Date().toISOString()
        };
        return updatedCaseRecord;
      }
      return c;
    });
    if (updatedCaseRecord) {
      updateCasesState(updatedCases);
    }

    const webhook = getWebhookUrl(syncSettings);
    if (webhook) {
      SyncService.postToWebhook(webhook, 'add_biaya_proses', newRecord);
      if (updatedCaseRecord) {
        SyncService.postToWebhook(webhook, 'update_case', updatedCaseRecord);
      }
    }

    addNotification(
      'Pemotongan ATK Perkara',
      `Uang sebesar Rp${amount.toLocaleString('id-ID')} dari perkara ${nomorPerkara} berhasil dipotong & masuk ke Buku Bantu Biaya Proses.`,
      'success',
      nomorPerkara
    );
  };

  // Zero Out Case Balance handler
  const handleZeroOutCaseBalance = (
    caseNumber: string,
    generatedItems: { uraian: string; amount: number; kategori: 'ATK' | 'Proses' | 'Meterai' | 'Redaksi' | 'Panggilan' | 'Lainnya' }[]
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const newRecords: BiayaProsesRecord[] = generatedItems.map((item, idx) => ({
      id: `zero-${Date.now()}-${idx}`,
      tanggal: today,
      nomorPerkara: caseNumber,
      uraian: item.uraian,
      penerimaan: 0,
      pengeluaran: item.amount,
      keterangan: 'Auto-Zeroing Saldo Putus',
      kategori: item.kategori,
      createdAt: new Date().toISOString()
    }));

    const totalExpense = generatedItems.reduce((sum, item) => sum + item.amount, 0);

    const updatedRecords = [...biayaProsesRecords, ...newRecords];
    updateBiayaProsesState(updatedRecords);

    let targetUpdatedCase: CaseRecord | undefined;
    const updatedCases = cases.map(c => {
      if (c.nomorPerkara === caseNumber) {
        targetUpdatedCase = {
          ...c,
          pengeluaran: (c.pengeluaran || 0) + totalExpense,
          saldoPerkara: 0,
          updatedAt: new Date().toISOString()
        };
        return targetUpdatedCase;
      }
      return c;
    });
    updateCasesState(updatedCases);

    const webhook = getWebhookUrl(syncSettings);
    if (webhook) {
      newRecords.forEach(rec => {
        SyncService.postToWebhook(webhook, 'add_biaya_proses', rec);
      });
      if (targetUpdatedCase) {
        SyncService.postToWebhook(webhook, 'update_case', targetUpdatedCase);
      }
    }

    addNotification(
      'Saldo Zero-Out Berhasil',
      `Sisa saldo perkara ${caseNumber} sebesar Rp ${totalExpense.toLocaleString('id-ID')} telah dialokasikan hingga saldo menjadi Rp0.`,
      'success',
      caseNumber
    );
  };

  // Handlers for Jurnal Biaya SKUM
  const handleAddJurnalSkumRecord = (record: Omit<JurnalBiayaSkumRecord, 'id' | 'createdAt'>) => {
    // Determine whether transaction is Debet (Penerimaan Panjar) or Kredit (Pengeluaran Biaya Perkara)
    const isExplicitExpense = (Number(record.pengeluaran) || 0) > 0;
    const isExplicitIncome = (Number(record.penerimaan) || 0) > 0;
    const isDebet = isExplicitIncome || (!isExplicitExpense && record.kategori === 'Panjar');

    const cleanRecord = {
      ...record,
      penerimaan: isDebet ? (Number(record.penerimaan) || Number(record.pengeluaran) || 0) : 0,
      pengeluaran: isDebet ? 0 : (Number(record.pengeluaran) || 0)
    };

    const newRecord: JurnalBiayaSkumRecord = {
      ...cleanRecord,
      id: `skum-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    const updatedSkum = [newRecord, ...jurnalSkumRecords];
    updateJurnalSkumState(updatedSkum);

    // Reupdate cases state based on updated SKUM logs
    const updatedCases = updateCasesWithSkumLogs(cases, updatedSkum);
    updateCasesState(updatedCases);

    const webhook = getWebhookUrl(syncSettings);
    if (webhook) {
      SyncService.postToWebhook(webhook, 'add_jurnal_skum', newRecord);
      const targetCase = updatedCases.find(c => c.nomorPerkara && c.nomorPerkara.trim().toLowerCase() === newRecord.nomorPerkara.trim().toLowerCase());
      if (targetCase) {
        SyncService.postToWebhook(webhook, 'update_case', targetCase);
      }
    }

    addNotification(
      'Log Jurnal SKUM Dicatat',
      `Berhasil mencatat log transaksi SKUM perkara ${newRecord.nomorPerkara}: ${newRecord.uraian}`,
      'success',
      newRecord.nomorPerkara
    );
  };

  const handleUpdateJurnalSkumRecord = (updatedRecord: JurnalBiayaSkumRecord) => {
    try {
      const isExplicitExpense = (Number(updatedRecord.pengeluaran) || 0) > 0;
      const isExplicitIncome = (Number(updatedRecord.penerimaan) || 0) > 0;
      const isDebet = isExplicitIncome || (!isExplicitExpense && updatedRecord.kategori === 'Panjar');

      const cleanRecord: JurnalBiayaSkumRecord = {
        ...updatedRecord,
        penerimaan: isDebet ? (Number(updatedRecord.penerimaan) || Number(updatedRecord.pengeluaran) || 0) : 0,
        pengeluaran: isDebet ? 0 : (Number(updatedRecord.pengeluaran) || 0)
      };

      const oldRecord = jurnalSkumRecords.find(r => r.id === cleanRecord.id);
      const updatedSkum = jurnalSkumRecords.map(r => r.id === cleanRecord.id ? cleanRecord : r);
      updateJurnalSkumState(updatedSkum);

      // Sync with Buku Bantu Biaya Proses records if matching entry exists
      const normNomor = (cleanRecord.nomorPerkara || '').trim().toLowerCase();
      if (oldRecord && normNomor) {
        const oldUraian = (oldRecord.uraian || '').trim().toLowerCase();
        const updatedBp = biayaProsesRecords.map(b => {
          const bNomor = (b.nomorPerkara || '').trim().toLowerCase();
          const bUraian = (b.uraian || '').trim().toLowerCase();
          if (bNomor === normNomor && (bUraian === oldUraian || b.kategori === oldRecord.kategori)) {
            return {
              ...b,
              tanggal: cleanRecord.tanggal,
              uraian: cleanRecord.uraian,
              kategori: cleanRecord.kategori as any,
              penerimaan: cleanRecord.kategori === 'ATK' ? (cleanRecord.pengeluaran || cleanRecord.penerimaan) : b.penerimaan,
              pengeluaran: cleanRecord.kategori !== 'ATK' ? cleanRecord.pengeluaran : b.pengeluaran
            };
          }
          return b;
        });
        updateBiayaProsesState(updatedBp);
      }

      // Reupdate cases state based on updated SKUM logs
      const updatedCases = updateCasesWithSkumLogs(cases, updatedSkum);
      updateCasesState(updatedCases);

      const webhook = getWebhookUrl(syncSettings);
      if (webhook) {
        SyncService.postToWebhook(webhook, 'update_jurnal_skum', cleanRecord);
        const targetCase = updatedCases.find(c => c.nomorPerkara && c.nomorPerkara.trim().toLowerCase() === cleanRecord.nomorPerkara.trim().toLowerCase());
        if (targetCase) {
          SyncService.postToWebhook(webhook, 'update_case', targetCase);
        }
      }

      addNotification(
        'Log SKUM Berhasil Diperbarui',
        `Berhasil memperbarui data transaksi SKUM perkara ${cleanRecord.nomorPerkara}: ${cleanRecord.uraian}. Saldo perkara telah dihitung ulang.`,
        'info',
        cleanRecord.nomorPerkara
      );
    } catch (err: any) {
      addNotification('Gagal Memperbarui Log SKUM', err?.message || 'Terjadi kesalahan saat memperbarui data SKUM.', 'alert');
    }
  };

  const handleSyncAllColorsToCloud = async () => {
    const webhook = getWebhookUrl(syncSettings);
    if (!webhook) {
      addNotification(
        'Sinkronisasi Cloud Belum Terkonfigurasi',
        'URL Google Apps Script belum diatur. Silakan atur URL Spreadsheet melalui menu sinkronisasi.',
        'warning'
      );
      return { success: false, total: 0, synced: 0 };
    }

    try {
      const res = await SyncService.syncColoredRecordsToCloud(webhook, jurnalSkumRecords);
      if (res.success) {
        addNotification(
          'Warna Berhasil Disimpan ke Cloud',
          `Sebanyak ${res.synced} dari ${res.total} baris berstatus/berwarna berhasil disinkronkan ke Google Sheets dan otomatis tampil di HP/laptop lain!`,
          'success'
        );
      }
      return res;
    } catch (err: any) {
      addNotification('Gagal Sinkronisasi Warna', err?.message || 'Terjadi kendala saat menyimpan warna baris ke cloud.', 'alert');
      return { success: false, total: 0, synced: 0 };
    }
  };

  const handleDeleteJurnalSkumRecord = (id: string) => {
    try {
      const target = jurnalSkumRecords.find(r => r.id === id);
      if (!target) {
        addNotification('Gagal Menghapus SKUM', 'Data log SKUM tidak ditemukan.', 'alert');
        return;
      }
      const normNomor = (target.nomorPerkara || '').trim().toLowerCase();
      const targetUraian = (target.uraian || '').trim().toLowerCase();

      const updatedSkum = jurnalSkumRecords.filter(r => r.id !== id);
      updateJurnalSkumState(updatedSkum);

      // Delete corresponding Buku Bantu Biaya Proses record for this transaction
      let deletedBpRecords: BiayaProsesRecord[] = [];
      let updatedBpRecords = biayaProsesRecords;

      if (normNomor) {
        deletedBpRecords = biayaProsesRecords.filter(b => {
          const bNomor = (b.nomorPerkara || '').trim().toLowerCase();
          if (bNomor !== normNomor) return false;
          const bUraian = (b.uraian || '').trim().toLowerCase();
          return bUraian === targetUraian || 
                 (b.kategori === target.kategori && target.kategori !== 'Lainnya') ||
                 b.penerimaan === target.pengeluaran ||
                 b.pengeluaran === target.pengeluaran;
        });

        if (deletedBpRecords.length > 0) {
          updatedBpRecords = biayaProsesRecords.filter(b => !deletedBpRecords.some(d => d.id === b.id));
          updateBiayaProsesState(updatedBpRecords);
        }
      }

      // Delete corresponding Pinjaman record if this was a loan or repayment
      if (target.kategori === 'Pinjaman' || (target.uraian || '').toLowerCase().includes('pinjam') || (target.uraian || '').toLowerCase().includes('pelunasan') || (target.uraian || '').toLowerCase().includes('pengembalian')) {
        const remainingPinjaman = pinjamanSkumRecords.filter(p => {
          if (p.skumPengeluaranId === target.id || p.skumPengembalianId === target.id || p.id === target.id) return false;
          const uLower = (target.uraian || '').toLowerCase();
          const pLower = (p.peminjam || '').toLowerCase();
          if (pLower && uLower.includes(pLower) && (p.jumlah === target.pengeluaran || p.jumlah === target.penerimaan)) {
            return false;
          }
          return true;
        });
        if (remainingPinjaman.length !== pinjamanSkumRecords.length) {
          updatePinjamanSkumState(remainingPinjaman);
        }
      }

      // Reupdate cases state based on updated SKUM logs
      const updatedCases = updateCasesWithSkumLogs(cases, updatedSkum);
      updateCasesState(updatedCases);

      const webhook = getWebhookUrl(syncSettings);
      if (webhook) {
        SyncService.postToWebhook(webhook, 'delete_jurnal_skum', target);
        deletedBpRecords.forEach(rec => {
          SyncService.postToWebhook(webhook, 'delete_biaya_proses', rec);
        });
        const targetCase = updatedCases.find(c => c.nomorPerkara && c.nomorPerkara.trim().toLowerCase() === normNomor);
        if (targetCase) {
          SyncService.postToWebhook(webhook, 'update_case', targetCase);
        }
      }

      addNotification(
        'Log SKUM Berhasil Dihapus',
        `Data transaksi SKUM perkara ${target.nomorPerkara} (${target.uraian}) telah dihapus. Saldo perkara telah dikembalikan secara otomatis.`,
        'warning',
        target.nomorPerkara
      );
    } catch (err: any) {
      addNotification('Gagal Menghapus Log SKUM', err?.message || 'Terjadi kesalahan saat menghapus data SKUM.', 'alert');
    }
  };

  const handleAddPinjamanSkum = (data: {
    tanggal: string;
    nomorPerkara: string;
    peminjam: string;
    jumlah: number;
    keterangan: string;
  }) => {
    const now = Date.now();
    const skumId = `skum-pinjam-${now}`;
    const pinjamanId = `pinjam-${now}`;

    const newPinjaman: PinjamanSkumRecord = {
      id: pinjamanId,
      tanggal: data.tanggal || new Date().toISOString().split('T')[0],
      nomorPerkara: data.nomorPerkara || 'Kepaniteraan Umum',
      peminjam: data.peminjam,
      jumlah: data.jumlah,
      keterangan: data.keterangan || '',
      status: 'BELUM_DIBAYAR',
      createdAt: new Date().toISOString(),
      skumPengeluaranId: skumId
    };

    const newSkumRecord: JurnalBiayaSkumRecord = {
      id: skumId,
      tanggal: data.tanggal || new Date().toISOString().split('T')[0],
      nomorPerkara: data.nomorPerkara || 'Kepaniteraan Umum',
      uraian: `Peminjaman Saldo SKUM: ${data.peminjam}`,
      penerimaan: 0,
      pengeluaran: data.jumlah,
      kategori: 'Pinjaman',
      keterangan: `Peminjaman Saldo SKUM Kepaniteraan (${data.keterangan || 'Belum Dibayar'})`,
      createdAt: new Date().toISOString()
    };

    const updatedPinjaman = [newPinjaman, ...pinjamanSkumRecords];
    updatePinjamanSkumState(updatedPinjaman);

    const updatedSkum = [newSkumRecord, ...jurnalSkumRecords];
    updateJurnalSkumState(updatedSkum);

    const updatedCases = updateCasesWithSkumLogs(cases, updatedSkum);
    updateCasesState(updatedCases);

    const webhook = getWebhookUrl(syncSettings);
    if (webhook) {
      SyncService.postToWebhook(webhook, 'add_pinjaman_skum', newPinjaman);
      SyncService.postToWebhook(webhook, 'add_jurnal_skum', newSkumRecord);
      const targetCase = updatedCases.find(c => c.nomorPerkara && c.nomorPerkara.trim().toLowerCase() === newPinjaman.nomorPerkara.trim().toLowerCase());
      if (targetCase) {
        SyncService.postToWebhook(webhook, 'update_case', targetCase);
      }
    }

    addNotification(
      '⚠️ Peminjaman Saldo SKUM',
      `Peminjaman saldo SKUM sebesar Rp ${data.jumlah.toLocaleString('id-ID')} oleh ${data.peminjam} telah dicatat dan memotong saldo sementara.`,
      'warning',
      data.nomorPerkara
    );
  };

  const handleBayarPinjamanSkum = (pinjamanId: string) => {
    const target = pinjamanSkumRecords.find(p => p.id === pinjamanId);
    if (!target) return;

    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();
    const skumKembaliId = `skum-kembali-${now}`;

    let updatedTargetPinjaman: PinjamanSkumRecord | null = null;
    const updatedPinjaman = pinjamanSkumRecords.map(p => {
      if (p.id === pinjamanId) {
        updatedTargetPinjaman = {
          ...p,
          status: 'SUDAH_DIBAYAR' as const,
          tanggalBayar: today,
          skumPengembalianId: skumKembaliId
        };
        return updatedTargetPinjaman;
      }
      return p;
    });
    updatePinjamanSkumState(updatedPinjaman);

    const newSkumRecord: JurnalBiayaSkumRecord = {
      id: skumKembaliId,
      tanggal: today,
      nomorPerkara: target.nomorPerkara,
      uraian: `Pengembalian Pinjaman Saldo SKUM: ${target.peminjam}`,
      penerimaan: target.jumlah,
      pengeluaran: 0,
      kategori: 'Pinjaman',
      keterangan: `Pelunasan Peminjaman Saldo SKUM Kepaniteraan (Tanggal Bayar: ${today})`,
      createdAt: new Date().toISOString()
    };

    const updatedSkum = [newSkumRecord, ...jurnalSkumRecords];
    updateJurnalSkumState(updatedSkum);

    const updatedCases = updateCasesWithSkumLogs(cases, updatedSkum);
    updateCasesState(updatedCases);

    const webhook = getWebhookUrl(syncSettings);
    if (webhook) {
      if (updatedTargetPinjaman) {
        SyncService.postToWebhook(webhook, 'update_pinjaman_skum', updatedTargetPinjaman);
      }
      SyncService.postToWebhook(webhook, 'add_jurnal_skum', newSkumRecord);
      const targetCase = updatedCases.find(c => c.nomorPerkara && c.nomorPerkara.trim().toLowerCase() === target.nomorPerkara.trim().toLowerCase());
      if (targetCase) {
        SyncService.postToWebhook(webhook, 'update_case', targetCase);
      }
    }

    addNotification(
      '✅ Pelunasan Pinjaman SKUM',
      `Pinjaman SKUM sebesar Rp ${target.jumlah.toLocaleString('id-ID')} (${target.peminjam}) telah DIBAYAR & DIKEMBALIKAN ke Saldo SKUM.`,
      'success',
      target.nomorPerkara
    );
  };

  const handleUpdatePinjamanSkum = (updatedPinjaman: PinjamanSkumRecord) => {
    let existingIndex = pinjamanSkumRecords.findIndex(p => 
      p.id === updatedPinjaman.id || 
      (p.id && updatedPinjaman.id && p.id.replace(/[^0-9]/g, '') === updatedPinjaman.id.replace(/[^0-9]/g, '')) ||
      (p.skumPengeluaranId && (p.skumPengeluaranId === updatedPinjaman.id || p.skumPengeluaranId === updatedPinjaman.skumPengeluaranId)) ||
      (updatedPinjaman.skumPengeluaranId && p.id === updatedPinjaman.skumPengeluaranId) ||
      (p.tanggal === updatedPinjaman.tanggal && p.jumlah === updatedPinjaman.jumlah && (p.peminjam || '').toLowerCase() === (updatedPinjaman.peminjam || '').toLowerCase())
    );

    const oldPinjaman = existingIndex !== -1 ? pinjamanSkumRecords[existingIndex] : updatedPinjaman;
    const updatedList = [...pinjamanSkumRecords];
    if (existingIndex !== -1) {
      updatedList[existingIndex] = updatedPinjaman;
    } else {
      updatedList.push(updatedPinjaman);
    }
    updatePinjamanSkumState(updatedList);

    // Update or sync JurnalBiayaSkumRecords accordingly
    let updatedSkum = [...jurnalSkumRecords];

    // 1. Update or create the loan disbursement (pengeluaran) record in Jurnal SKUM
    let pengeluaranIndex = updatedSkum.findIndex(s => 
      (updatedPinjaman.skumPengeluaranId && s.id === updatedPinjaman.skumPengeluaranId) ||
      s.id === updatedPinjaman.id ||
      (oldPinjaman.skumPengeluaranId && s.id === oldPinjaman.skumPengeluaranId) ||
      (s.kategori === 'Pinjaman' && s.pengeluaran === oldPinjaman.jumlah && (s.uraian || '').toLowerCase().includes((oldPinjaman.peminjam || '').toLowerCase()))
    );

    if (pengeluaranIndex !== -1) {
      updatedSkum[pengeluaranIndex] = {
        ...updatedSkum[pengeluaranIndex],
        tanggal: updatedPinjaman.tanggal,
        nomorPerkara: updatedPinjaman.nomorPerkara || 'Kepaniteraan Umum',
        uraian: `Peminjaman Saldo SKUM: ${updatedPinjaman.peminjam}`,
        pengeluaran: updatedPinjaman.jumlah,
        keterangan: `Peminjaman Saldo SKUM Kepaniteraan (${updatedPinjaman.keterangan || (updatedPinjaman.status === 'SUDAH_DIBAYAR' ? 'Lunas' : 'Belum Dibayar')}) [WARNA:oranye]`,
        warnaBaris: 'oranye'
      };
    } else if (updatedPinjaman.jumlah > 0) {
      const disbursementId = updatedPinjaman.skumPengeluaranId || `skum-pinjam-${updatedPinjaman.id || Date.now()}`;
      updatedPinjaman.skumPengeluaranId = disbursementId;
      const newDisbursement: JurnalBiayaSkumRecord = {
        id: disbursementId,
        tanggal: updatedPinjaman.tanggal || new Date().toISOString().split('T')[0],
        nomorPerkara: updatedPinjaman.nomorPerkara || 'Kepaniteraan Umum',
        uraian: `Peminjaman Saldo SKUM: ${updatedPinjaman.peminjam}`,
        penerimaan: 0,
        pengeluaran: updatedPinjaman.jumlah,
        kategori: 'Pinjaman',
        keterangan: `Peminjaman Saldo SKUM Kepaniteraan (${updatedPinjaman.keterangan || 'Belum Dibayar'}) [WARNA:oranye]`,
        warnaBaris: 'oranye',
        createdAt: new Date().toISOString()
      };
      updatedSkum = [newDisbursement, ...updatedSkum];
      pengeluaranIndex = 0;
    }

    // 2. Handle repayment (penerimaan debet) record in Jurnal SKUM based on status change
    let deletedRepaymentId: string | null = null;
    if (updatedPinjaman.status === 'SUDAH_DIBAYAR') {
      const today = updatedPinjaman.tanggalBayar || new Date().toISOString().split('T')[0];
      const kembaliIndex = updatedSkum.findIndex(s => 
        (updatedPinjaman.skumPengembalianId && s.id === updatedPinjaman.skumPengembalianId) ||
        (s.kategori === 'Pinjaman' && s.penerimaan > 0 && (s.uraian || '').toLowerCase().includes((oldPinjaman.peminjam || '').toLowerCase()))
      );

      if (kembaliIndex !== -1) {
        // Update existing repayment record
        updatedSkum[kembaliIndex] = {
          ...updatedSkum[kembaliIndex],
          tanggal: today,
          nomorPerkara: updatedPinjaman.nomorPerkara,
          uraian: `Pengembalian Pinjaman Saldo SKUM: ${updatedPinjaman.peminjam}`,
          penerimaan: updatedPinjaman.jumlah,
          keterangan: `Pelunasan Peminjaman Saldo SKUM Kepaniteraan (Tanggal Bayar: ${today}) [WARNA:hijau]`,
          warnaBaris: 'hijau'
        };
      } else {
        // Create new repayment debet record to balance the loan out
        const skumKembaliId = updatedPinjaman.skumPengembalianId || `skum-kembali-${Date.now()}`;
        updatedPinjaman.skumPengembalianId = skumKembaliId;
        const newSkumRecord: JurnalBiayaSkumRecord = {
          id: skumKembaliId,
          tanggal: today,
          nomorPerkara: updatedPinjaman.nomorPerkara,
          uraian: `Pengembalian Pinjaman Saldo SKUM: ${updatedPinjaman.peminjam}`,
          penerimaan: updatedPinjaman.jumlah,
          pengeluaran: 0,
          kategori: 'Pinjaman',
          keterangan: `Pelunasan Peminjaman Saldo SKUM Kepaniteraan (Tanggal Bayar: ${today}) [WARNA:hijau]`,
          warnaBaris: 'hijau',
          createdAt: new Date().toISOString()
        };
        updatedSkum = [newSkumRecord, ...updatedSkum];
      }
    } else if (updatedPinjaman.status === 'BELUM_DIBAYAR') {
      // If status reverted to BELUM_DIBAYAR, remove any repayment record so it's not marked as returned debet
      if (updatedPinjaman.skumPengembalianId || oldPinjaman.skumPengembalianId) {
        deletedRepaymentId = updatedPinjaman.skumPengembalianId || oldPinjaman.skumPengembalianId || null;
      }
      updatedSkum = updatedSkum.filter(s => {
        if (updatedPinjaman.skumPengembalianId && s.id === updatedPinjaman.skumPengembalianId) return false;
        if (oldPinjaman.skumPengembalianId && s.id === oldPinjaman.skumPengembalianId) return false;
        if (s.kategori === 'Pinjaman' && s.penerimaan === oldPinjaman.jumlah && (s.uraian || '').toLowerCase().includes((oldPinjaman.peminjam || '').toLowerCase())) return false;
        return true;
      });
      delete updatedPinjaman.tanggalBayar;
      delete updatedPinjaman.skumPengembalianId;
    }

    updateJurnalSkumState(updatedSkum);
    const updatedCases = updateCasesWithSkumLogs(cases, updatedSkum);
    updateCasesState(updatedCases);

    const webhook = getWebhookUrl(syncSettings);
    if (webhook) {
      const isLunas = updatedPinjaman.status === 'SUDAH_DIBAYAR';
      SyncService.postToWebhook(webhook, 'update_pinjaman_skum', {
        ...updatedPinjaman,
        jumlahRp: updatedPinjaman.jumlah,
        status: isLunas ? 'SUDAH_DIBAYAR' : 'BELUM_DIBAYAR',
        statusLunas: isLunas ? 'Lunas' : 'Belum Lunas',
        tanggalLunas: isLunas ? (updatedPinjaman.tanggalBayar || '') : '',
        tanggalBayar: isLunas ? (updatedPinjaman.tanggalBayar || '') : ''
      });
      const activePengeluaran = updatedSkum.find(s => s.id === updatedPinjaman.skumPengeluaranId || s.id === updatedPinjaman.id);
      if (activePengeluaran) {
        SyncService.postToWebhook(webhook, 'update_jurnal_skum', activePengeluaran);
      }
      if (deletedRepaymentId) {
        SyncService.postToWebhook(webhook, 'delete_jurnal_skum', { id: deletedRepaymentId });
      }
      const targetCase = updatedCases.find(c => {
        if (!c.nomorPerkara) return false;
        const normC = c.nomorPerkara.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const normP = (updatedPinjaman.nomorPerkara || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const normKet = (updatedPinjaman.keterangan || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        return (normP.length > 0 && normC === normP) || (normKet.length > 0 && normKet.includes(normC));
      });
      if (targetCase) {
        SyncService.postToWebhook(webhook, 'update_case', targetCase);
      }
    }

    addNotification(
      'Data Pinjaman Diperbarui',
      `Data pinjaman ${updatedPinjaman.peminjam} (Rp ${updatedPinjaman.jumlah.toLocaleString('id-ID')}) status ${updatedPinjaman.status === 'SUDAH_DIBAYAR' ? 'LUNAS' : 'BELUM LUNAS'} berhasil diperbarui dan disinkronkan ke Spreadsheet.`,
      'success',
      updatedPinjaman.nomorPerkara
    );
  };

  const handleDeletePinjamanSkum = (pinjamanId: string) => {
    const target = pinjamanSkumRecords.find(p => p.id === pinjamanId);
    if (!target) return;

    const updatedPinjaman = pinjamanSkumRecords.filter(p => p.id !== pinjamanId);
    updatePinjamanSkumState(updatedPinjaman);

    const updatedSkum = jurnalSkumRecords.filter(s => {
      if (target.skumPengeluaranId && s.id === target.skumPengeluaranId) return false;
      if (target.skumPengembalianId && s.id === target.skumPengembalianId) return false;
      if (s.id === target.id) return false;
      
      const sIdNorm = s.id.replace(/[^a-zA-Z0-9]/g, '');
      const tIdNorm = target.id.replace('pinjam-', '').replace(/[^a-zA-Z0-9]/g, '');
      if (tIdNorm && sIdNorm.includes(tIdNorm)) return false;

      const uLower = (s.uraian || '').toLowerCase();
      const pLower = (target.peminjam || '').toLowerCase();
      const isPinjamUraian = s.kategori === 'Pinjaman' || uLower.includes('pinjam') || uLower.includes('pengembalian');
      if (isPinjamUraian && pLower && uLower.includes(pLower)) {
        if ((s.pengeluaran === target.jumlah) || (s.penerimaan === target.jumlah)) {
          return false;
        }
      }
      return true;
    });
    updateJurnalSkumState(updatedSkum);

    const updatedCases = updateCasesWithSkumLogs(cases, updatedSkum);
    updateCasesState(updatedCases);

    const webhook = getWebhookUrl(syncSettings);
    if (webhook) {
      SyncService.postToWebhook(webhook, 'delete_pinjaman_skum', target);
      if (target.skumPengeluaranId) {
        SyncService.postToWebhook(webhook, 'delete_jurnal_skum', { id: target.skumPengeluaranId, nomorPerkara: target.nomorPerkara });
      }
      if (target.skumPengembalianId) {
        SyncService.postToWebhook(webhook, 'delete_jurnal_skum', { id: target.skumPengembalianId, nomorPerkara: target.nomorPerkara });
      }
      const targetCase = updatedCases.find(c => c.nomorPerkara && c.nomorPerkara.trim().toLowerCase() === target.nomorPerkara.trim().toLowerCase());
      if (targetCase) {
        SyncService.postToWebhook(webhook, 'update_case', targetCase);
      }
    }

    addNotification(
      'Catatan Pinjaman Dihapus',
      `Catatan peminjaman SKUM ${target.peminjam} telah dihapus.`,
      'info',
      target.nomorPerkara
    );
  };

  // Handle Jurnal SKUM execution per case
  const handleExecuteJurnal = (
    caseId: string,
    nomorPerkara: string,
    journalItems: { uraian: string; amount: number; kategori: 'Panjar' | 'ATK' | 'Proses' | 'Meterai' | 'Redaksi' | 'Panggilan' | 'Sisa Panjar' | 'Lainnya' }[],
    tanggalJurnal?: string
  ) => {
    const today = tanggalJurnal || new Date().toISOString().split('T')[0];

    const now = Date.now();
    // 1. Generate JurnalBiayaSkumRecord entries (Logged in JurnalBiayaSKUM sheet)
    const newSkumRecords: JurnalBiayaSkumRecord[] = journalItems.map((item, idx) => ({
      id: `skum-${now}-${idx}`,
      tanggal: today,
      nomorPerkara,
      uraian: item.uraian,
      penerimaan: item.kategori === 'Panjar' ? item.amount : 0,
      pengeluaran: item.kategori !== 'Panjar' ? item.amount : 0,
      kategori: item.kategori,
      keterangan: 'Pencatatan Jurnal SKUM Perkara',
      createdAt: new Date(now + idx * 100).toISOString()
    }));

    // 2. Generate BiayaProsesRecord ONLY for ATK items so Buku Bantu Biaya Proses isn't polluted
    const atkItems = journalItems.filter(item => item.kategori === 'ATK');
    const newBiayaProsesRecords: BiayaProsesRecord[] = atkItems.map((item, idx) => ({
      id: `bp-atk-${Date.now()}-${idx}`,
      tanggal: today,
      nomorPerkara,
      uraian: item.uraian,
      penerimaan: item.amount,
      pengeluaran: 0,
      keterangan: 'Pemotongan Panjar ATK Perkara (Buku Bantu)',
      kategori: 'ATK',
      createdAt: new Date().toISOString()
    }));

    const expenseItems = journalItems.filter(item => item.kategori !== 'Panjar');
    const totalExpense = expenseItems.reduce((acc, item) => acc + item.amount, 0);

    // Save Jurnal SKUM Records
    const updatedSkum = [...newSkumRecords, ...jurnalSkumRecords];
    updateJurnalSkumState(updatedSkum);

    // Save Biaya Proses Records (if ATK present)
    if (newBiayaProsesRecords.length > 0) {
      const updatedBp = [...newBiayaProsesRecords, ...biayaProsesRecords];
      updateBiayaProsesState(updatedBp);
    }

    // Deduct/update case balance dynamically based on SKUM logs
    const updatedCases = updateCasesWithSkumLogs(cases, updatedSkum);
    updateCasesState(updatedCases);

    const targetUpdatedCase = updatedCases.find(c => c.id === caseId || (c.nomorPerkara && c.nomorPerkara.trim().toLowerCase() === nomorPerkara.trim().toLowerCase()));

    // Webhook push
    const webhook = getWebhookUrl(syncSettings);
    if (webhook) {
      newSkumRecords.forEach(rec => {
        SyncService.postToWebhook(webhook, 'add_jurnal_skum', rec);
      });
      newBiayaProsesRecords.forEach(rec => {
        SyncService.postToWebhook(webhook, 'add_biaya_proses', rec);
      });
      if (targetUpdatedCase) {
        SyncService.postToWebhook(webhook, 'update_case', targetUpdatedCase);
      }
    }

    addNotification(
      'Eksekusi Jurnal SKUM',
      `Jurnal biaya SKUM perkara ${nomorPerkara} berhasil dicatatkan ke Buku Jurnal SKUM. Total pengeluaran: Rp ${totalExpense.toLocaleString('id-ID')}.`,
      'success',
      nomorPerkara
    );
  };

  // Save/Update Case Record
  const handleSaveCase = (formData: Partial<CaseRecord>) => {
    const webhook = getWebhookUrl(syncSettings);

    if (formData.id) {
      // Edit existing
      let updatedCaseRecord: CaseRecord | undefined;
      const updated = cases.map(c => {
        if (c.id === formData.id) {
          const isSaldoZero = formData.saldoPerkara === 0;
          if (isSaldoZero && c.saldoPerkara !== 0) {
            addNotification(
              'Peringatan Saldo Rp0',
              `Perkara ${formData.nomorPerkara} (${formData.namaPihak}) kini memiliki saldo Rp0. Memerlukan konfirmasi penambahan panjar.`,
              'alert',
              formData.nomorPerkara
            );
          } else if (c.status !== formData.status) {
            addNotification(
              'Pembaruan Status Perkara',
              `Perkara ${formData.nomorPerkara} telah berubah status menjadi ${formData.status}.`,
              'info',
              formData.nomorPerkara
            );
          }
          updatedCaseRecord = {
            ...c,
            ...formData,
            updatedAt: new Date().toISOString()
          } as CaseRecord;
          return updatedCaseRecord;
        }
        return c;
      });
      updateCasesState(updated);

      if (webhook && updatedCaseRecord) {
        SyncService.postToWebhook(webhook, 'update_case', updatedCaseRecord);
      }
    } else {
      // Create new
      const newRecord: CaseRecord = {
        id: `case-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        nomorPerkara: formData.nomorPerkara || `${String(cases.length + 1).padStart(2, '0')}/Pdt.G/2026/PA.Pan`,
        namaPihak: formData.namaPihak || 'Pihak Berperkara',
        jenisPerkara: formData.jenisPerkara || 'Cerai Gugat',
        kategoriPerkara: formData.kategoriPerkara || 'Gugatan',
        tingkatPerkara: formData.tingkatPerkara || 'Tingkat Pertama',
        saldoPerkara: formData.saldoPerkara ?? 0,
        panjarAwal: formData.panjarAwal ?? 1000000,
        pengeluaran: formData.pengeluaran ?? 1000000,
        tanggalRegister: formData.tanggalRegister || new Date().toISOString().split('T')[0],
        tanggalTerimaKasasiPk: formData.tanggalTerimaKasasiPk,
        tanggalPutus: formData.tanggalPutus,
        status: formData.status || 'Pendaftaran',
        hakimKetua: formData.hakimKetua,
        panitera: formData.panitera,
        ruangSidang: formData.ruangSidang,
        catatan: formData.catatan,
        updatedAt: new Date().toISOString()
      };

      const updated = [newRecord, ...cases];
      updateCasesState(updated);

      if (webhook) {
        SyncService.postToWebhook(webhook, 'add_case', newRecord);
      }

      addNotification(
        'Perkara Baru Terdaftar',
        `Perkara nomor ${newRecord.nomorPerkara} (${newRecord.namaPihak}) berhasil diinput secara otomatis.`,
        'success',
        newRecord.nomorPerkara
      );

      if (newRecord.saldoPerkara === 0) {
        addNotification(
          'Peringatan Saldo Rp0',
          `Perkara ${newRecord.nomorPerkara} terdaftar dengan saldo Rp0.`,
          'alert',
          newRecord.nomorPerkara
        );
      }
    }
  };

  // Delete Case
  const handleDeleteCase = (id: string) => {
    try {
      const target = cases.find(c => c.id === id);
      if (!target) {
        addNotification('Gagal Menghapus Perkara', 'Data perkara tidak ditemukan.', 'alert');
        return;
      }
      const targetNomor = (target.nomorPerkara || '').trim().toLowerCase();

      // 1. Remove case from cases list
      const updatedCases = cases.filter(c => c.id !== id);
      updateCasesState(updatedCases);

      // 2. Cascade delete all BukuBiayaProses records for this nomorPerkara
      const targetBpRecords = targetNomor 
        ? biayaProsesRecords.filter(b => (b.nomorPerkara || '').trim().toLowerCase() === targetNomor)
        : [];
      const updatedBp = targetNomor 
        ? biayaProsesRecords.filter(b => (b.nomorPerkara || '').trim().toLowerCase() !== targetNomor)
        : biayaProsesRecords;
      updateBiayaProsesState(updatedBp);

      // 3. Cascade delete all JurnalSkum records for this nomorPerkara
      const targetSkumRecords = targetNomor 
        ? jurnalSkumRecords.filter(s => (s.nomorPerkara || '').trim().toLowerCase() === targetNomor)
        : [];
      const updatedSkum = targetNomor
        ? jurnalSkumRecords.filter(s => (s.nomorPerkara || '').trim().toLowerCase() !== targetNomor)
        : jurnalSkumRecords;
      updateJurnalSkumState(updatedSkum);

      // Webhook sync
      const webhook = getWebhookUrl(syncSettings);
      if (webhook) {
        SyncService.postToWebhook(webhook, 'delete_case', target);
        targetBpRecords.forEach(rec => {
          SyncService.postToWebhook(webhook, 'delete_biaya_proses', rec);
        });
        targetSkumRecords.forEach(rec => {
          SyncService.postToWebhook(webhook, 'delete_jurnal_skum', rec);
        });
      }

      addNotification(
        'Perkara & Data Terkait Berhasil Dihapus',
        `Data perkara ${target.nomorPerkara} (${target.namaPihak}) beserta seluruh log di Buku Bantu Biaya Proses dan Jurnal SKUM telah berhasil dihapus.`,
        'warning',
        target.nomorPerkara
      );
    } catch (err: any) {
      addNotification('Gagal Menghapus Perkara', err?.message || 'Terjadi kesalahan saat menghapus data perkara.', 'alert');
    }
  };

  // Bulk Import Cases from Spreadsheet
  const handleImportCases = (importedCases: CaseRecord[]) => {
    // Merge or Replace strategy (here replace/prepend unique)
    const existingNumbers = new Set(cases.map(c => c.nomorPerkara));
    const newItems = importedCases.filter(c => !existingNumbers.has(c.nomorPerkara));
    
    const combined = [...newItems, ...cases];
    updateCasesState(combined);

    addNotification(
      'Sinkronisasi Spreadsheet',
      `Berhasil mengimpor ${newItems.length} data perkara baru dari spreadsheet. Total data: ${combined.length}.`,
      'success'
    );
  };

  // Notification actions
  const handleMarkAllNotifsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    StorageService.saveNotifications(updated);
  };

  const handleClearAllNotifs = () => {
    setNotifications([]);
    StorageService.saveNotifications([]);
  };

  const handleSelectNotification = (notif: NotificationItem) => {
    if (notif.nomorPerkara) {
      const match = cases.find(c => c.nomorPerkara === notif.nomorPerkara);
      if (match) {
        setSelectedCaseDetail(match);
      }
    }
    // Mark this notif as read
    const updated = notifications.map(n => n.id === notif.id ? { ...n, read: true } : n);
    setNotifications(updated);
    StorageService.saveNotifications(updated);
  };

  // Cache reset
  const handleClearCache = () => {
    StorageService.resetToDefault();
    setCases([]);
    setBiayaProsesRecords([]);
    setJurnalSkumRecords([]);
    setCacheMeta(StorageService.getCacheMeta());
    addNotification('Cache Direset', 'Basis data JSON lokal direset ke keadaan kosong/awal.', 'info');
  };

  const handleForceReload = async () => {
    await loadDataFromSource(true);
    addNotification('Muat Ulang Data Terkini', 'Data telah diperbarui secara langsung dari Google Spreadsheet.', 'success');
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;
  const countKasKuning = jurnalSkumRecords.filter(r => getEffectiveWarnaBaris(r) === 'kuning').length;
  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-200 ${
      isLight 
        ? 'bg-slate-100 text-slate-800 selection:bg-emerald-500 selection:text-white' 
        : 'bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white'
    }`}>
      
      {/* Navigation Header */}
      <Navbar
        onOpenForm={() => {
          setEditingRecord(undefined);
          setIsFormOpen(true);
        }}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onRefreshLive={handleForceReload}
        isRefreshing={isRefreshing}
        onOpenGithubModal={() => setIsGithubModalOpen(true)}
        onOpenCacheModal={() => setIsCacheModalOpen(true)}
        onToggleNotifPopover={() => setIsNotifOpen(prev => !prev)}
        unreadNotifCount={unreadNotifCount}
        syncSettings={syncSettings}
        cacheMeta={cacheMeta}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        countKasKuning={countKasKuning}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Container - Responsive layout adapting to full width */}
      <main className="flex-1 max-w-[100%] xl:max-w-[1700px] 2xl:max-w-[1920px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        
        {/* Dynamic View rendering */}
        {activeTab === 'kas-kuning' ? (
          <TitipanKasKuningView
            records={jurnalSkumRecords}
            cases={cases}
            onUpdateRecord={handleUpdateJurnalSkumRecord}
            onAddRecord={handleAddJurnalSkumRecord}
            onDeleteRecord={handleDeleteJurnalSkumRecord}
            onNavigateToJurnal={() => setActiveTab('jurnal-skum')}
            theme={theme}
          />
        ) : activeTab === 'jurnal-skum' ? (
          <JurnalBiayaSkumView
            records={jurnalSkumRecords}
            cases={cases}
            pinjamanRecords={pinjamanSkumRecords}
            onAddRecord={handleAddJurnalSkumRecord}
            onUpdateRecord={handleUpdateJurnalSkumRecord}
            onDeleteRecord={handleDeleteJurnalSkumRecord}
            onOpenJurnalModal={() => {
              setJurnalSelectedCase(cases[0] || null);
              setIsJurnalModalOpen(true);
            }}
            onAddPinjaman={handleAddPinjamanSkum}
            onUpdatePinjaman={handleUpdatePinjamanSkum}
            onBayarPinjaman={handleBayarPinjamanSkum}
            onDeletePinjaman={handleDeletePinjamanSkum}
            onSyncAllColorsToCloud={handleSyncAllColorsToCloud}
            onNavigateToKasKuning={() => setActiveTab('kas-kuning')}
            theme={theme}
          />
        ) : activeTab === 'buku-biaya-proses' ? (
          <BukuBiayaProses
            records={biayaProsesRecords}
            cases={cases}
            onAddRecord={handleAddBiayaProsesRecord}
            onUpdateRecord={handleUpdateBiayaProsesRecord}
            onDeleteRecord={handleDeleteBiayaProsesRecord}
            onPotongAtkPerkara={handlePotongAtkPerkara}
            onZeroOutCaseBalance={handleZeroOutCaseBalance}
            onSyncSpreadsheet={() => loadDataFromSource(true)}
            syncSettings={syncSettings}
            theme={theme}
          />
        ) : (
          <CaseTable
            cases={cases}
            filters={filters}
            setFilters={setFilters}
            onOpenForm={(recordToEdit) => {
              setEditingRecord(recordToEdit);
              setIsFormOpen(true);
            }}
            onSelectCase={(record) => setSelectedCaseDetail(record)}
            onDeleteCase={handleDeleteCase}
            onOpenJurnal={(record) => {
              setJurnalSelectedCase(record || cases[0]);
              setIsJurnalModalOpen(true);
            }}
            theme={theme}
          />
        )}

      </main>

      {/* Footer */}
      <footer className={`border-t py-4 text-center text-xs w-full transition-colors ${
        isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-900 border-slate-800 text-slate-500'
      }`}>
        <div className="max-w-[100%] xl:max-w-[1700px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Sistem Manajemen Perkara & Buku Bantu Biaya Proses (PA PANIAI). Real-time Sync & Export Ready.</p>
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsGithubModalOpen(true)} className={`${isLight ? 'text-slate-600 hover:text-emerald-600' : 'text-slate-400 hover:text-emerald-400'} underline`}>
              GitHub Workflow & Storage Info
            </button>
            <button onClick={() => setIsCacheModalOpen(true)} className={`${isLight ? 'text-slate-600 hover:text-emerald-600' : 'text-slate-400 hover:text-emerald-400'} underline`}>
              System Cache ({cacheMeta.cacheHitCount} hits)
            </button>
          </div>
        </div>
      </footer>

      {/* Modals & Popovers */}
      <CaseFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveCase}
        recordToEdit={editingRecord}
        totalCasesCount={cases.length}
        existingCases={cases}
      />

      <SpreadsheetSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncSettings={syncSettings}
        onSaveSyncSettings={(newSettings) => {
          setSyncSettings(newSettings);
          StorageService.saveSyncSettings(newSettings);
        }}
        onImportCases={handleImportCases}
        onTriggerLiveSync={handleForceReload}
        theme={theme}
      />

      <NotificationCenter
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllNotifsRead}
        onClearAll={handleClearAllNotifs}
        onSelectNotification={handleSelectNotification}
      />

      <GitHubWorkflowModal
        isOpen={isGithubModalOpen}
        onClose={() => setIsGithubModalOpen(false)}
      />

      <CacheManagerModal
        isOpen={isCacheModalOpen}
        onClose={() => setIsCacheModalOpen(false)}
        cacheMeta={cacheMeta}
        onClearCache={handleClearCache}
        onForceReload={handleForceReload}
      />

      <CaseDetailModal
        record={selectedCaseDetail}
        onClose={() => setSelectedCaseDetail(null)}
        onEdit={(record) => {
          setEditingRecord(record);
          setIsFormOpen(true);
        }}
        onOpenJurnal={(record) => {
          setJurnalSelectedCase(record);
          setIsJurnalModalOpen(true);
        }}
      />

      <JurnalBiayaModal
        isOpen={isJurnalModalOpen}
        onClose={() => setIsJurnalModalOpen(false)}
        cases={cases}
        selectedCase={jurnalSelectedCase}
        jurnalSkumRecords={jurnalSkumRecords}
        onExecuteJurnal={handleExecuteJurnal}
        theme={theme}
      />

      <ToastNotification
        toast={activeToast}
        onDismiss={() => setActiveToast(null)}
        onOpenCenter={() => {
          setActiveToast(null);
          setIsNotifOpen(true);
        }}
      />

    </div>
  );
}
