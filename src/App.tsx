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
import { StorageService, TARGET_APPS_SCRIPT_URL } from './services/storage';
import { SyncService } from './services/syncService';
import { Navbar } from './components/Navbar';
import { CaseTable } from './components/CaseTable';
import { BukuBiayaProses } from './components/BukuBiayaProses';
import { JurnalBiayaSkumView } from './components/JurnalBiayaSkumView';
import { CaseFormModal } from './components/CaseFormModal';
import { SpreadsheetSyncModal } from './components/SpreadsheetSyncModal';
import { NotificationCenter } from './components/NotificationCenter';
import { GitHubWorkflowModal } from './components/GitHubWorkflowModal';
import { CacheManagerModal } from './components/CacheManagerModal';
import { CaseDetailModal } from './components/CaseDetailModal';
import { JurnalBiayaModal } from './components/JurnalBiayaModal';
import { ToastNotification } from './components/ToastNotification';

export default function App() {
  const [activeTab, setActiveTab] = useState<'table' | 'buku-biaya-proses' | 'jurnal-skum'>('buku-biaya-proses');
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
    return currentCases.map(c => {
      let caseSkumLogs: JurnalBiayaSkumRecord[] = [];
      if (c.nomorPerkara) {
        const normCaseNum = c.nomorPerkara.trim().toLowerCase();
        caseSkumLogs = skumList.filter(r => r.nomorPerkara && r.nomorPerkara.trim().toLowerCase() === normCaseNum);
      }

      const totalPenerimaan = caseSkumLogs.reduce((sum, r) => sum + (Number(r.penerimaan) || 0), 0);
      const totalPengeluaran = caseSkumLogs.reduce((sum, r) => sum + (Number(r.pengeluaran) || 0), 0);

      const hasPanjarAwalLog = caseSkumLogs.some(r =>
        r.kategori === 'Panjar' ||
        (r.uraian && r.uraian.toLowerCase().includes('panjar awal'))
      );

      let effectivePanjar = c.panjarAwal || 0;
      if (hasPanjarAwalLog) {
        effectivePanjar = totalPenerimaan;
      } else if (totalPenerimaan > 0) {
        effectivePanjar = Math.max(c.panjarAwal || 0, (c.panjarAwal || 0) + totalPenerimaan);
      }

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

      // PRIORITIZE SPREADSHEET SALDO 0 OR COMPLETED STATUS:
      // If the case from Spreadsheet explicitly has saldoPerkara === 0, OR status is 'Selesai' / 'Arsip', OR has a Sisa Panjar log,
      // strictly retain saldoPerkara as 0!
      const isSpreadsheetZeroOrFinished = 
        c.saldoPerkara === 0 || 
        c.status === 'Selesai' || 
        c.status === 'Arsip' || 
        hasSisaPanjarLog;

      const calculatedSaldo = Math.max(0, effectivePanjar - totalPengeluaran);
      const finalSaldo = isSpreadsheetZeroOrFinished ? 0 : calculatedSaldo;

      let newStatus: StatusPerkara = c.status || 'Pendaftaran';

      if (finalSaldo === 0 || isSpreadsheetZeroOrFinished) {
        newStatus = c.status === 'Arsip' ? 'Arsip' : 'Selesai';
      } else if (hasMinutasiLog) {
        newStatus = 'Minutasi';
      } else if (hasPutusanLog || c.tanggalPutus) {
        newStatus = 'Putus';
      } else if (hasActivityLog || totalPengeluaran > 0) {
        if (c.status === 'Pendaftaran') {
          newStatus = 'Diperiksa';
        }
      }

      return {
        ...c,
        panjarAwal: effectivePanjar,
        pengeluaran: isSpreadsheetZeroOrFinished ? Math.max(totalPengeluaran, effectivePanjar) : totalPengeluaran,
        saldoPerkara: finalSaldo,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
    });
  };

  // Load Initial Data from Storage / Cache & merge with fresh public data / Google Sheet
  const loadDataFromSource = useCallback(async (isForceSpreadsheetOverwrite = false) => {
    const loadedCases = StorageService.getCases();
    const loadedBiayaProses = StorageService.getBiayaProsesRecords();
    const loadedJurnalSkum = StorageService.getJurnalSkumRecords();
    const loadedPinjamanSkum = StorageService.getPinjamanSkumRecords();
    const loadedNotifs = StorageService.getNotifications();
    const currentSyncSettings = StorageService.getSyncSettings();

    const syncedLoadedCases = ensureUniqueCaseIds(updateCasesWithSkumLogs(loadedCases, loadedJurnalSkum));

    setCases(syncedLoadedCases);
    setBiayaProsesRecords(loadedBiayaProses);
    setJurnalSkumRecords(sortSkumRecords(loadedJurnalSkum));
    setPinjamanSkumRecords(loadedPinjamanSkum);
    setNotifications(loadedNotifs);
    setCacheMeta(StorageService.getCacheMeta());

    const targetUrl = (currentSyncSettings.googleSheetUrl && currentSyncSettings.googleSheetUrl.trim().length > 0)
      ? currentSyncSettings.googleSheetUrl.trim()
      : TARGET_APPS_SCRIPT_URL;

    if (targetUrl) {
      try {
        if (targetUrl.includes('script.google.com')) {
          const appsScriptData = await SyncService.fetchFromAppsScript(targetUrl);
          if (appsScriptData && appsScriptData.cases.length > 0) {
            let fetchedCases = appsScriptData.cases;
            const activeJurnal = (appsScriptData.jurnalSkum && appsScriptData.jurnalSkum.length > 0)
              ? appsScriptData.jurnalSkum
              : loadedJurnalSkum;

            fetchedCases = updateCasesWithSkumLogs(fetchedCases, activeJurnal);
            const uniqueFetched = ensureUniqueCaseIds(fetchedCases);
            setCases(uniqueFetched);
            StorageService.saveCases(uniqueFetched);

            if (appsScriptData.biayaProses.length > 0) {
              setBiayaProsesRecords(appsScriptData.biayaProses);
              StorageService.saveBiayaProsesRecords(appsScriptData.biayaProses);
            }

            if (appsScriptData.jurnalSkum.length > 0) {
              setJurnalSkumRecords(appsScriptData.jurnalSkum);
              StorageService.saveJurnalSkumRecords(appsScriptData.jurnalSkum);
            }

            setCacheMeta(StorageService.getCacheMeta());
          }
        } else {
          const casesData = await SyncService.fetchGoogleSheetCsv(targetUrl);
          if (Array.isArray(casesData) && casesData.length > 0) {
            const syncedCsvCases = ensureUniqueCaseIds(updateCasesWithSkumLogs(casesData, loadedJurnalSkum));
            setCases(syncedCsvCases);
            StorageService.saveCases(syncedCsvCases);
          }

          const logData = await SyncService.fetchGoogleSheetBiayaProsesCsv(targetUrl);
          if (Array.isArray(logData) && logData.length > 0) {
            setBiayaProsesRecords(logData);
            StorageService.saveBiayaProsesRecords(logData);
          }
        }
      } catch (err) {
        console.warn('Gagal auto-sync Google Sheet:', err);
      }
    }
  }, []);

  useEffect(() => {
    loadDataFromSource(false);
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
    const sorted = sortSkumRecords(newRecords);
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
    // Ensure penerimaan & pengeluaran are mutually exclusive
    const isDebet = record.penerimaan > 0 || record.kategori === 'Panjar';
    const cleanRecord = {
      ...record,
      penerimaan: isDebet ? (record.penerimaan || record.pengeluaran || 0) : 0,
      pengeluaran: isDebet ? 0 : (record.pengeluaran || 0)
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
      const isDebet = updatedRecord.penerimaan > 0 || updatedRecord.kategori === 'Panjar';
      const cleanRecord: JurnalBiayaSkumRecord = {
        ...updatedRecord,
        penerimaan: isDebet ? (updatedRecord.penerimaan || updatedRecord.pengeluaran || 0) : 0,
        pengeluaran: isDebet ? 0 : (updatedRecord.pengeluaran || 0)
      };

      const updatedSkum = jurnalSkumRecords.map(r => r.id === cleanRecord.id ? cleanRecord : r);
      updateJurnalSkumState(updatedSkum);

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
        `Berhasil memperbarui data transaksi SKUM perkara ${cleanRecord.nomorPerkara}: ${cleanRecord.uraian}`,
        'info',
        cleanRecord.nomorPerkara
      );
    } catch (err: any) {
      addNotification('Gagal Memperbarui Log SKUM', err?.message || 'Terjadi kesalahan saat memperbarui data SKUM.', 'alert');
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
      const updatedSkum = jurnalSkumRecords.filter(r => r.id !== id);
      updateJurnalSkumState(updatedSkum);

      // Cascade delete corresponding Buku Bantu Biaya Proses record for this nomorPerkara
      const isAtkRecord = target.kategori === 'ATK' || 
                          target.uraian.toLowerCase().includes('atk') || 
                          target.uraian.toLowerCase().includes('pemberkasan');

      let deletedBpRecords: BiayaProsesRecord[] = [];
      let updatedBpRecords = biayaProsesRecords;

      if (normNomor) {
        if (isAtkRecord) {
          deletedBpRecords = biayaProsesRecords.filter(b => {
            const bNomor = (b.nomorPerkara || '').trim().toLowerCase();
            if (bNomor !== normNomor) return false;
            return b.uraian.trim().toLowerCase() === target.uraian.trim().toLowerCase() ||
                   b.kategori === 'ATK' ||
                   b.penerimaan === target.penerimaan;
          });
          updatedBpRecords = biayaProsesRecords.filter(b => !deletedBpRecords.some(d => d.id === b.id));
        } else {
          const remainingSkumForCase = updatedSkum.filter(s => (s.nomorPerkara || '').trim().toLowerCase() === normNomor);
          if (remainingSkumForCase.length === 0) {
            deletedBpRecords = biayaProsesRecords.filter(b => (b.nomorPerkara || '').trim().toLowerCase() === normNomor);
            updatedBpRecords = biayaProsesRecords.filter(b => (b.nomorPerkara || '').trim().toLowerCase() !== normNomor);
          }
        }

        if (deletedBpRecords.length > 0) {
          updateBiayaProsesState(updatedBpRecords);
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
        `Data transaksi SKUM perkara ${target.nomorPerkara} (${target.uraian}) telah dihapus.${deletedBpRecords.length > 0 ? ' Log transaksi terkait di Buku Bantu Biaya Proses juga dihapus.' : ''}`,
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

    const updatedPinjaman = pinjamanSkumRecords.map(p => {
      if (p.id === pinjamanId) {
        return {
          ...p,
          status: 'SUDAH_DIBAYAR' as const,
          tanggalBayar: today,
          skumPengembalianId: skumKembaliId
        };
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

    addNotification(
      '✅ Pelunasan Pinjaman SKUM',
      `Pinjaman SKUM sebesar Rp ${target.jumlah.toLocaleString('id-ID')} (${target.peminjam}) telah DIBAYAR & DIKEMBALIKAN ke Saldo SKUM.`,
      'success',
      target.nomorPerkara
    );
  };

  const handleDeletePinjamanSkum = (pinjamanId: string) => {
    const target = pinjamanSkumRecords.find(p => p.id === pinjamanId);
    if (!target) return;

    const updatedPinjaman = pinjamanSkumRecords.filter(p => p.id !== pinjamanId);
    updatePinjamanSkumState(updatedPinjaman);

    const updatedSkum = jurnalSkumRecords.filter(s => 
      s.id !== target.skumPengeluaranId && s.id !== target.skumPengembalianId
    );
    updateJurnalSkumState(updatedSkum);

    const updatedCases = updateCasesWithSkumLogs(cases, updatedSkum);
    updateCasesState(updatedCases);

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
    if (syncSettings.googleSheetUrl && syncSettings.googleSheetUrl.trim().length > 0) {
      await loadDataFromSource(true);
      addNotification('Muat Ulang Data Terkini', 'Data telah diperbarui secara langsung dari Google Spreadsheet.', 'success');
    } else {
      const freshCases = StorageService.getCases();
      const freshBiaya = StorageService.getBiayaProsesRecords();
      const freshJurnal = StorageService.getJurnalSkumRecords();
      setCases(freshCases);
      setBiayaProsesRecords(freshBiaya);
      setJurnalSkumRecords(freshJurnal);
      setCacheMeta(StorageService.getCacheMeta());
      addNotification('Muat Ulang Data Terkini', 'Data memori cache disinkronkan dengan basis data saat ini.', 'success');
    }
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;
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
        onOpenGithubModal={() => setIsGithubModalOpen(true)}
        onOpenCacheModal={() => setIsCacheModalOpen(true)}
        onToggleNotifPopover={() => setIsNotifOpen(prev => !prev)}
        unreadNotifCount={unreadNotifCount}
        syncSettings={syncSettings}
        cacheMeta={cacheMeta}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Container - Responsive layout adapting to full width */}
      <main className="flex-1 max-w-[100%] xl:max-w-[1700px] 2xl:max-w-[1920px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        
        {/* Dynamic View rendering */}
        {activeTab === 'jurnal-skum' ? (
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
            onBayarPinjaman={handleBayarPinjamanSkum}
            onDeletePinjaman={handleDeletePinjamanSkum}
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
