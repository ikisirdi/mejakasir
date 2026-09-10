import React, { useState, useMemo } from 'react';
import { 
  Sparkles, Plus, Trash2, Edit3, Search, Filter, 
  Download, Printer, RefreshCw, FileText, CheckCircle2, 
  AlertTriangle, Eye, Code, Copy, Check, X, Calendar, ArrowUpDown, CloudUpload,
  Boxes, PackageCheck, Layers, PieChart, Info
} from 'lucide-react';
import { CaseRecord, SimulasiAtkRecord, JurnalBiayaSkumRecord } from '../types';
import { ATK_REFERENCE_ITEMS, generateAtkSimulationDeterministic } from '../data/atkRubric';
import { SyncService } from '../services/syncService';
import { LaporanResmiAtkModal } from './LaporanResmiAtkModal';
import { 
  calculateAtkInventoryUsage, 
  exportAtkInventoryToCsv, 
  downloadAtkInventoryCsv,
  AtkInventorySummary, 
  MASTER_PERSEDIAAN_ATK 
} from '../utils/atkInventoryCalculation';

interface BukuBantuAtkProps {
  cases: CaseRecord[];
  jurnalSkum: JurnalBiayaSkumRecord[];
  simulasiAtkRecords: SimulasiAtkRecord[];
  onSaveSimulasiAtkRecords: (records: SimulasiAtkRecord[], syncPayload?: SimulasiAtkRecord[] | false) => void;
  onAddSimulasiAtkRecord?: (record: SimulasiAtkRecord) => void;
  onDeleteSimulasiAtkRecord?: (id: string) => void;
  onDeleteCaseSimulasi?: (nomorPerkara: string) => void;
  googleSheetWebhookUrl?: string;
  theme?: 'light' | 'dark';
  isOpenReportModal?: boolean;
  onOpenReportModal?: () => void;
  onCloseReportModal?: () => void;
}

export const BukuBantuAtk: React.FC<BukuBantuAtkProps> = ({
  cases,
  jurnalSkum,
  simulasiAtkRecords,
  onSaveSimulasiAtkRecords,
  onAddSimulasiAtkRecord,
  onDeleteSimulasiAtkRecord,
  onDeleteCaseSimulasi,
  googleSheetWebhookUrl,
  theme = 'light',
  isOpenReportModal,
  onOpenReportModal,
  onCloseReportModal
}) => {
  const isLight = theme === 'light';

  // View mode: 'ringkasan-perkara' | 'buku-jurnal' | 'rekap-persediaan' | 'tabel-acuan'
  const [viewMode, setViewMode] = useState<'ringkasan-perkara' | 'buku-jurnal' | 'rekap-persediaan' | 'tabel-acuan'>('ringkasan-perkara');

  // Print Report modal state
  const [showPrintReportModal, setShowPrintReportModal] = useState<boolean>(false);
  const [reportModalType, setReportModalType] = useState<'buku-kas' | 'rekap-persediaan'>('buku-kas');
  const [reportModalFilterCase, setReportModalFilterCase] = useState<string>('all');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'putus-belum-nol' | 'putus-sudah-nol' | 'aktif'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // Rekap Persediaan specific filters
  const [inventoryCaseFilter, setInventoryCaseFilter] = useState<string>('all');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>('all');

  // Detail drawer tab: 'transaksi' vs 'persediaan'
  const [caseDetailTab, setCaseDetailTab] = useState<'transaksi' | 'persediaan'>('transaksi');

  // Modal states
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [selectedCaseForModal, setSelectedCaseForModal] = useState<CaseRecord | null>(null);
  const [modalTanggalMasuk, setModalTanggalMasuk] = useState<string>('');
  const [modalTanggalSelesai, setModalTanggalSelesai] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [previewSimulatedItems, setPreviewSimulatedItems] = useState<SimulasiAtkRecord[]>([]);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isBatchSimulating, setIsBatchSimulating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Detail drawer for a single case
  const [inspectCase, setInspectCase] = useState<CaseRecord | null>(null);

  // Manual transaction modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState<{
    tanggal: string;
    nomorPerkara: string;
    uraian: string;
    tipe: 'penerimaan' | 'pengeluaran';
    nominal: number;
    kategori: string;
    keterangan: string;
  }>({
    tanggal: new Date().toISOString().split('T')[0],
    nomorPerkara: '',
    uraian: '',
    tipe: 'pengeluaran',
    nominal: 10000,
    kategori: 'ATK Lainnya',
    keterangan: ''
  });

  // Calculate ATK financials per case
  // Standard incoming ATK per registered case is Rp 100.000 (from SKUM or Biaya Pendaftaran Hak ATK)
  const caseFinancials = useMemo(() => {
    return cases.map(c => {
      const normCase = (c.nomorPerkara || '').trim().toLowerCase();
      // Find incoming ATK entries in Jurnal SKUM or Simulasi records
      const skumAtkDebet = jurnalSkum
        .filter(j => (j.nomorPerkara || '').trim().toLowerCase() === normCase && (j.kategori === 'ATK' || (j.uraian || '').toLowerCase().includes('atk') || (j.uraian || '').toLowerCase().includes('pemberkasan')))
        .reduce((acc, curr) => acc + (curr.pengeluaran > 0 ? curr.pengeluaran : (curr.penerimaan || 0)), 0);

      const simAtkDebet = simulasiAtkRecords
        .filter(s => (s.nomorPerkara || '').trim().toLowerCase() === normCase && (s.penerimaan || 0) > 0)
        .reduce((acc, curr) => acc + curr.penerimaan, 0);

      // Standard court rule: Each registered case brings in Rp 100.000 for ATK / Pemberkasan
      // Use explicit entries if exists, otherwise standard Rp 100.000
      const totalMasuk = Math.max(100000, skumAtkDebet + simAtkDebet);

      // Simulated or actual ATK expenses recorded
      const totalKeluar = simulasiAtkRecords
        .filter(s => (s.nomorPerkara || '').trim().toLowerCase() === normCase && (s.pengeluaran || 0) > 0)
        .reduce((acc, curr) => acc + curr.pengeluaran, 0);

      const sisaSaldo = totalMasuk - totalKeluar;
      const isPutus = c.status === 'Putus' || c.status === 'Selesai' || (c.tanggalPutus && c.tanggalPutus.trim() !== '');
      const isZeroed = sisaSaldo === 0 && totalKeluar > 0;
      const needsSimulation = isPutus && !isZeroed;

      return {
        caseRecord: c,
        totalMasuk,
        totalKeluar,
        sisaSaldo,
        isPutus,
        isZeroed,
        needsSimulation
      };
    });
  }, [cases, jurnalSkum, simulasiAtkRecords]);

  // Metric summaries
  const metrics = useMemo(() => {
    const totalPenerimaan = caseFinancials.reduce((acc, c) => acc + c.totalMasuk, 0);
    const totalPengeluaran = simulasiAtkRecords.reduce((acc, s) => acc + (s.pengeluaran || 0), 0);
    const sisaSaldoTotal = totalPenerimaan - totalPengeluaran;

    const putusCases = caseFinancials.filter(c => c.isPutus);
    const putusTuntas = putusCases.filter(c => c.isZeroed);
    const putusPending = putusCases.filter(c => c.needsSimulation);

    return {
      totalPenerimaan,
      totalPengeluaran,
      sisaSaldoTotal,
      putusTotal: putusCases.length,
      putusTuntas: putusTuntas.length,
      putusPendingCount: putusPending.length,
      putusPendingCases: putusPending.map(p => p.caseRecord)
    };
  }, [caseFinancials, simulasiAtkRecords]);

  // Filtered case financials
  const filteredCaseFinancials = useMemo(() => {
    return caseFinancials.filter(item => {
      const c = item.caseRecord;
      const query = searchQuery.toLowerCase().trim();
      const matchSearch = !query || 
        c.nomorPerkara.toLowerCase().includes(query) ||
        c.namaPihak.toLowerCase().includes(query) ||
        c.jenisPerkara.toLowerCase().includes(query);

      if (!matchSearch) return false;

      if (filterStatus === 'putus-belum-nol' && !item.needsSimulation) return false;
      if (filterStatus === 'putus-sudah-nol' && (!item.isPutus || !item.isZeroed)) return false;
      if (filterStatus === 'aktif' && item.isPutus) return false;

      if (selectedYear !== 'all') {
        const regYear = c.tanggalRegister ? c.tanggalRegister.substring(0, 4) : '';
        const putusYear = c.tanggalPutus ? c.tanggalPutus.substring(0, 4) : '';
        if (regYear !== selectedYear && putusYear !== selectedYear) return false;
      }

      if (selectedMonth !== 'all') {
        const regMonth = c.tanggalRegister ? c.tanggalRegister.substring(5, 7) : '';
        const putusMonth = c.tanggalPutus ? c.tanggalPutus.substring(5, 7) : '';
        if (regMonth !== selectedMonth && putusMonth !== selectedMonth) return false;
      }

      return true;
    });
  }, [caseFinancials, searchQuery, filterStatus, selectedMonth, selectedYear]);

  // Combined ledger records (Penerimaan ATK Perkara + Pengeluaran Simulasi ATK)
  const allLedgerRecords = useMemo(() => {
    const list: SimulasiAtkRecord[] = [...simulasiAtkRecords];
    const registeredPerkaraIncomeSet = new Set(
      list.filter(r => (r.penerimaan || 0) > 0).map(r => r.nomorPerkara.trim().toLowerCase())
    );

    // Pastikan setiap perkara memiliki entri pemasukan biaya pemberkasan / ATK
    cases.forEach(c => {
      const normCase = (c.nomorPerkara || '').trim().toLowerCase();
      if (!registeredPerkaraIncomeSet.has(normCase)) {
        // Cari apakah ada pencatatan di Jurnal SKUM
        const skumAtk = jurnalSkum.find(j => 
          (j.nomorPerkara || '').trim().toLowerCase() === normCase && 
          (j.kategori === 'ATK' || (j.uraian || '').toLowerCase().includes('atk') || (j.uraian || '').toLowerCase().includes('pemberkasan'))
        );
        const tglMasuk = skumAtk?.tanggal || c.tanggalRegister || '2026-01-01';
        const nominalMasuk = skumAtk ? (skumAtk.pengeluaran > 0 ? skumAtk.pengeluaran : (skumAtk.penerimaan || 100000)) : 100000;

        list.push({
          id: `penerimaan-atk-${c.id}`,
          tanggal: tglMasuk,
          nomorPerkara: c.nomorPerkara,
          kategoriPerkara: c.kategoriPerkara,
          statusPerkara: c.status,
          uraian: `Pencatatan Jurnal: Biaya Pemberkasan / ATK (${c.namaPihak || c.jenisPerkara})`,
          penerimaan: nominalMasuk,
          pengeluaran: 0,
          kategori: 'Penerimaan ATK',
          keterangan: 'Penerimaan Panjar Biaya Pemberkasan ATK Perkara',
          isAiGenerated: false,
          createdAt: c.updatedAt || new Date().toISOString()
        });
      }
    });

    return list;
  }, [simulasiAtkRecords, cases, jurnalSkum]);

  // Filtered raw ledger records
  const filteredLedgerRecords = useMemo(() => {
    return allLedgerRecords.filter(r => {
      const query = searchQuery.toLowerCase().trim();
      const matchSearch = !query || 
        r.nomorPerkara.toLowerCase().includes(query) ||
        r.uraian.toLowerCase().includes(query) ||
        (r.keterangan || '').toLowerCase().includes(query);

      if (!matchSearch) return false;

      if (selectedYear !== 'all') {
        const recYear = r.tanggal ? r.tanggal.substring(0, 4) : '';
        if (recYear !== selectedYear) return false;
      }

      if (selectedMonth !== 'all') {
        const recMonth = r.tanggal ? r.tanggal.substring(5, 7) : '';
        if (recMonth !== selectedMonth) return false;
      }

      return true;
    }).sort((a, b) => {
      const cmp = a.tanggal.localeCompare(b.tanggal);
      if (cmp !== 0) return cmp;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [allLedgerRecords, searchQuery, selectedMonth, selectedYear]);

  // Calculation of aggregated ATK Inventory consumption (persediaan barang habis pakai)
  const inventorySummary = useMemo<AtkInventorySummary>(() => {
    // Saring simulasi records berdasarkan filter periode aktif
    const filtered = simulasiAtkRecords.filter(r => {
      if (!r.tanggal) return false;
      const parts = r.tanggal.split('-');
      if (selectedYear !== 'all' && parts[0] !== selectedYear) return false;
      if (selectedMonth !== 'all' && parts[1] !== selectedMonth) return false;
      return true;
    });

    return calculateAtkInventoryUsage(filtered, inventoryCaseFilter);
  }, [simulasiAtkRecords, selectedMonth, selectedYear, inventoryCaseFilter]);

  const filteredInventoryItems = useMemo(() => {
    let list = inventorySummary.items;
    if (inventoryCategoryFilter !== 'all') {
      list = list.filter(it => it.kategori.toLowerCase() === inventoryCategoryFilter.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(it =>
        it.namaBarang.toLowerCase().includes(q) ||
        it.kodeBarang.toLowerCase().includes(q) ||
        it.kategori.toLowerCase().includes(q) ||
        it.satuan.toLowerCase().includes(q) ||
        (it.keterangan || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [inventorySummary, inventoryCategoryFilter, searchQuery]);

  // Open modal for AI Simulation of a single case
  const handleOpenSimulateModal = (c: CaseRecord) => {
    setSelectedCaseForModal(c);
    const fin = caseFinancials.find(f => f.caseRecord.id === c.id);
    const targetAmt = fin ? (fin.sisaSaldo > 0 ? fin.sisaSaldo : 100000) : 100000;

    const tglMasuk = c.tanggalRegister || '2026-01-01';
    let tglSelesai = c.tanggalPutus || '';
    if (!tglSelesai || !tglSelesai.trim()) {
      if (c.status === 'Putus' || c.status === 'Selesai' || c.status === 'Minutasi' || c.status === 'Arsip') {
        tglSelesai = new Date().toISOString().split('T')[0];
      } else {
        const startMs = new Date(tglMasuk).getTime();
        tglSelesai = new Date(!isNaN(startMs) ? startMs + 45 * 86400000 : Date.now()).toISOString().split('T')[0];
      }
    }

    setModalTanggalMasuk(tglMasuk);
    setModalTanggalSelesai(tglSelesai);

    // Generate initial items using rubric
    const initialItems = generateAtkSimulationDeterministic({
      caseRecord: c,
      targetAmount: targetAmt,
      tanggalMasuk: tglMasuk,
      tanggalSelesai: tglSelesai
    });
    setPreviewSimulatedItems(initialItems);
    setShowSimulateModal(true);
  };

  // Re-calculate simulation dates when user changes tanggal masuk or tanggal selesai in modal
  const handleUpdateModalDates = (newMasuk: string, newSelesai: string) => {
    setModalTanggalMasuk(newMasuk);
    setModalTanggalSelesai(newSelesai);
    if (!selectedCaseForModal) return;

    const fin = caseFinancials.find(f => f.caseRecord.id === selectedCaseForModal.id);
    const targetAmt = fin ? (fin.sisaSaldo > 0 ? fin.sisaSaldo : 100000) : 100000;
    const recalculated = generateAtkSimulationDeterministic({
      caseRecord: selectedCaseForModal,
      targetAmount: targetAmt,
      tanggalMasuk: newMasuk,
      tanggalSelesai: newSelesai
    });
    setPreviewSimulatedItems(recalculated);
  };

  // Call Gemini AI Endpoint to refine / re-generate simulation
  const handleTriggerGeminiSimulation = async () => {
    if (!selectedCaseForModal) return;
    setIsGeneratingAi(true);

    try {
      const fin = caseFinancials.find(f => f.caseRecord.id === selectedCaseForModal.id);
      const targetAmt = fin ? (fin.sisaSaldo > 0 ? fin.sisaSaldo : 100000) : 100000;

      const regDate = modalTanggalMasuk || selectedCaseForModal.tanggalRegister || '2026-01-01';
      const putusDate = modalTanggalSelesai || selectedCaseForModal.tanggalPutus || new Date().toISOString().split('T')[0];

      const res = await fetch('/api/generate-atk-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomorPerkara: selectedCaseForModal.nomorPerkara,
          jenisPerkara: selectedCaseForModal.jenisPerkara,
          kategoriPerkara: selectedCaseForModal.kategoriPerkara,
          tanggalRegister: regDate,
          tanggalPutus: putusDate,
          targetAmount: targetAmt
        })
      });

      const data = await res.json();
      if (data && data.status === 'success' && Array.isArray(data.items) && data.items.length > 0) {
        const mappedItems: SimulasiAtkRecord[] = data.items.map((it: any, idx: number) => ({
          id: `sim-atk-${selectedCaseForModal.id}-${Date.now()}-${idx}`,
          tanggal: it.tanggal || putusDate,
          nomorPerkara: selectedCaseForModal.nomorPerkara,
          kategoriPerkara: selectedCaseForModal.kategoriPerkara,
          statusPerkara: selectedCaseForModal.status,
          uraian: it.jenisAtk || it.uraian,
          penerimaan: 0,
          pengeluaran: Number(it.jumlah) || 0,
          kategori: it.kategori || 'ATK Lainnya',
          keterangan: it.keterangan || 'Simulasi Gemini AI',
          isAiGenerated: true,
          createdAt: new Date().toISOString()
        }));
        setPreviewSimulatedItems(mappedItems);
      } else {
        // Fallback to deterministic
        const fallback = generateAtkSimulationDeterministic({
          caseRecord: selectedCaseForModal,
          targetAmount: targetAmt,
          tanggalMasuk: regDate,
          tanggalSelesai: putusDate
        });
        setPreviewSimulatedItems(fallback);
      }
    } catch (e) {
      console.warn('Gemini API call warning, using standard fallback:', e);
      const fin = caseFinancials.find(f => f.caseRecord.id === selectedCaseForModal.id);
      const fallback = generateAtkSimulationDeterministic({
        caseRecord: selectedCaseForModal,
        targetAmount: fin?.sisaSaldo || 100000,
        tanggalMasuk: modalTanggalMasuk || selectedCaseForModal.tanggalRegister,
        tanggalSelesai: modalTanggalSelesai || selectedCaseForModal.tanggalPutus
      });
      setPreviewSimulatedItems(fallback);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Save generated simulation for a single case
  const handleSaveModalSimulation = async () => {
    if (!selectedCaseForModal || previewSimulatedItems.length === 0) return;

    const targetNo = (selectedCaseForModal.nomorPerkara || '').trim().toLowerCase();
    // Filter out previous simulation records for this case
    const cleanedRecords = simulasiAtkRecords.filter(r => (r.nomorPerkara || '').trim().toLowerCase() !== targetNo);
    const updatedRecords = [...previewSimulatedItems, ...cleanedRecords];

    // Update state & storage without double-firing webhook (we trigger pushSimulasiAtkToCloud directly below)
    onSaveSimulasiAtkRecords(updatedRecords, false);
    setShowSimulateModal(false);

    // Sync to Google Sheets if webhook configured
    if (googleSheetWebhookUrl) {
      setSyncStatusMsg({ type: 'success', text: `Menyimpan ${previewSimulatedItems.length} item simulasi ke Google Sheets...` });
      const res = await SyncService.pushSimulasiAtkToCloud(googleSheetWebhookUrl, previewSimulatedItems);
      if (res.success) {
        setSyncStatusMsg({ type: 'success', text: `Berhasil menyinkronkan rincian ATK perkara ${selectedCaseForModal.nomorPerkara} ke Google Sheets!` });
      } else {
        setSyncStatusMsg({ type: 'error', text: 'Tersimpan di sistem lokal. Pastikan Apps Script Webhook sudah aktif untuk sinkronisasi Google Sheets.' });
      }
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }
  };

  // One-click Batch simulation for ALL Putus cases that need zeroing out
  const handleBatchSimulateAllPutus = async () => {
    const pending = metrics.putusPendingCases;
    if (pending.length === 0) return;

    setIsBatchSimulating(true);
    setBatchProgress({ current: 0, total: pending.length });

    const newSimulatedList: SimulasiAtkRecord[] = [];

    for (let i = 0; i < pending.length; i++) {
      const c = pending[i];
      const fin = caseFinancials.find(f => f.caseRecord.id === c.id);
      const targetAmt = fin && fin.sisaSaldo > 0 ? fin.sisaSaldo : 100000;

      const items = generateAtkSimulationDeterministic({
        caseRecord: c,
        targetAmount: targetAmt,
        tanggalMasuk: c.tanggalRegister,
        tanggalSelesai: c.tanggalPutus || new Date().toISOString().split('T')[0]
      });

      newSimulatedList.push(...items);
      setBatchProgress({ current: i + 1, total: pending.length });
      // Small tick for smooth UI
      await new Promise(res => setTimeout(res, 50));
    }

    // Merge into records
    const pendingNos = new Set(pending.map(p => (p.nomorPerkara || '').trim().toLowerCase()));
    const retained = simulasiAtkRecords.filter(r => !pendingNos.has((r.nomorPerkara || '').trim().toLowerCase()));
    const finalAll = [...newSimulatedList, ...retained];

    onSaveSimulasiAtkRecords(finalAll, false);
    setIsBatchSimulating(false);
    setBatchProgress(null);

    // Sync to Google Sheets
    if (googleSheetWebhookUrl) {
      setSyncStatusMsg({ type: 'success', text: `Menyinkronkan ${newSimulatedList.length} item simulasi ke Google Sheets...` });
      const res = await SyncService.pushSimulasiAtkToCloud(googleSheetWebhookUrl, newSimulatedList);
      if (res.success) {
        setSyncStatusMsg({ type: 'success', text: `Berhasil menyelesaikan simulasi & nolkan saldo ${pending.length} perkara putus di Google Sheets!` });
      } else {
        setSyncStatusMsg({ type: 'error', text: 'Tersimpan di sistem lokal. Sinkronkan via tombol di navbar saat koneksi stabil.' });
      }
      setTimeout(() => setSyncStatusMsg(null), 6000);
    }
  };

  // Reset simulation for a case
  const handleResetCaseSimulation = (nomorPerkara: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus seluruh simulasi pengeluaran ATK untuk perkara ${nomorPerkara}?`)) {
      if (onDeleteCaseSimulasi) {
        onDeleteCaseSimulasi(nomorPerkara);
      } else {
        const normNo = (nomorPerkara || '').trim().toLowerCase();
        const filtered = simulasiAtkRecords.filter(r => (r.nomorPerkara || '').trim().toLowerCase() !== normNo);
        onSaveSimulasiAtkRecords(filtered, false);
      }
      if (googleSheetWebhookUrl) {
        SyncService.postToWebhook(googleSheetWebhookUrl, 'delete_simulasi_atk_case', { nomorPerkara });
      }
    }
  };

  // Save manual transaction
  const handleSaveManual = () => {
    if (!manualForm.nomorPerkara || !manualForm.uraian || manualForm.nominal <= 0) {
      alert('Mohon lengkapi Nomor Perkara, Uraian, dan Nominal');
      return;
    }

    const newRecord: SimulasiAtkRecord = {
      id: `sim-atk-manual-${Date.now()}`,
      tanggal: manualForm.tanggal,
      nomorPerkara: manualForm.nomorPerkara,
      uraian: manualForm.uraian,
      penerimaan: manualForm.tipe === 'penerimaan' ? manualForm.nominal : 0,
      pengeluaran: manualForm.tipe === 'pengeluaran' ? manualForm.nominal : 0,
      kategori: manualForm.kategori,
      keterangan: manualForm.keterangan || 'Catatan Manual Petugas ATK',
      isAiGenerated: false,
      createdAt: new Date().toISOString()
    };

    if (onAddSimulasiAtkRecord) {
      onAddSimulasiAtkRecord(newRecord);
    } else {
      onSaveSimulasiAtkRecords([...simulasiAtkRecords, newRecord]);
    }

    if (googleSheetWebhookUrl) {
      SyncService.postToWebhook(googleSheetWebhookUrl, 'add_simulasi_atk', newRecord);
    }

    setShowManualModal(false);
  };

  // Format currency
  const formatRp = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

  // Apps Script snippet for easy copy
  const appScriptAdditionSnippet = `// ==============================================================================
// KODE TAMBAHAN APPS SCRIPT: TAB SimulasiAtkPerkara (BUKU BANTU ATK PERKARA AI)
// ==============================================================================

// 1. Tambahkan ke dalam function setupSheets():
var sheetSimAtk = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
if (!sheetSimAtk) {
  sheetSimAtk = ss.insertSheet('SimulasiAtkPerkara');
  sheetSimAtk.appendRow([
    'ID', 'Tanggal', 'Nomor Perkara', 'Uraian / Jenis ATK', 'Penerimaan / Debet',
    'Pengeluaran / Kredit', 'Kategori', 'Keterangan', 'AI Generated', 'Created At'
  ]);
  sheetSimAtk.getRange('A1:J1').setFontWeight('bold').setBackground('#e9d5ff');
}

// 2. Tambahkan ke dalam function doGet(e):
var sheetSimAtk = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
var simulasiAtkList = [];
if (sheetSimAtk) {
  var dataSimRows = sheetSimAtk.getDataRange().getValues();
  for (var sa = 1; sa < dataSimRows.length; sa++) {
    var rowSa = dataSimRows[sa];
    if (rowSa[0] && String(rowSa[0]).trim() !== '') {
      simulasiAtkList.push({
        id: String(rowSa[0]),
        tanggal: rowSa[1] ? Utilities.formatDate(new Date(rowSa[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
        nomorPerkara: String(rowSa[2] || '-'),
        uraian: String(rowSa[3] || ''),
        penerimaan: Number(rowSa[4]) || 0,
        pengeluaran: Number(rowSa[5]) || 0,
        kategori: String(rowSa[6] || 'ATK Lainnya'),
        keterangan: String(rowSa[7] || ''),
        isAiGenerated: String(rowSa[8] || '').toLowerCase() === 'true' || String(rowSa[8] || '').toLowerCase() === 'ya',
        createdAt: String(rowSa[9] || '')
      });
    }
  }
}
// sertakan di objek respons: simulasiAtk: simulasiAtkList

// 3. Tambahkan ke dalam function doPost(e):
} else if (action === 'add_simulasi_atk' || action === 'update_simulasi_atk') {
  var sheetSim = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
  if (!sheetSim) { setupSheets(); sheetSim = ss.getSheetByName('SimulasiAtkPerkara'); }
  var simValues = [
    record.id || ('sim-atk-' + Date.now()),
    record.tanggal ? String(record.tanggal).split('T')[0] : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    record.nomorPerkara || '-',
    record.uraian || record.jenisAtk || '',
    Number(record.penerimaan || record.debet) || 0,
    Number(record.pengeluaran || record.kredit || record.jumlah) || 0,
    record.kategori || 'ATK Lainnya',
    record.keterangan || '',
    record.isAiGenerated !== false ? 'TRUE' : 'FALSE',
    record.createdAt || new Date().toISOString()
  ];
  sheetSim.appendRow(simValues);
} else if (action === 'batch_add_simulasi_atk') {
  var sheetSim = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
  if (!sheetSim) { setupSheets(); sheetSim = ss.getSheetByName('SimulasiAtkPerkara'); }
  var items = payload.items || payload.records || [];
  for (var bi = 0; bi < items.length; bi++) {
    var itm = items[bi];
    sheetSim.appendRow([
      itm.id || ('sim-atk-' + Date.now() + '-' + bi),
      itm.tanggal ? String(itm.tanggal).split('T')[0] : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      itm.nomorPerkara || '-',
      itm.uraian || itm.jenisAtk || '',
      Number(itm.penerimaan || itm.debet) || 0,
      Number(itm.pengeluaran || itm.kredit || itm.jumlah) || 0,
      itm.kategori || 'ATK Lainnya',
      itm.keterangan || '',
      itm.isAiGenerated !== false ? 'TRUE' : 'FALSE',
      itm.createdAt || new Date().toISOString()
    ]);
  }
} else if (action === 'delete_simulasi_atk_case') {
  var sheetSim = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
  if (sheetSim) {
    var targetNo = String(record.nomorPerkara || '').trim().toLowerCase();
    var sRows = sheetSim.getDataRange().getValues();
    for (var di = sRows.length - 1; di >= 1; di--) {
      if (String(sRows[di][2] || '').trim().toLowerCase() === targetNo) {
        sheetSim.deleteRow(di + 1);
      }
    }
  }
}`;

  return (
    <div className={`space-y-6 ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
      
      {/* Sync Alert Banner */}
      {syncStatusMsg && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in ${
          syncStatusMsg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-amber-50 text-amber-800 border border-amber-200'
        }`}>
          <div className="flex items-center space-x-2">
            {syncStatusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
            <span>{syncStatusMsg.text}</span>
          </div>
          <button onClick={() => setSyncStatusMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className={`p-5 rounded-2xl border transition-all ${
        isLight 
          ? 'bg-gradient-to-r from-purple-50 via-indigo-50 to-white border-purple-200/80 shadow-sm' 
          : 'bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border-purple-800/50 shadow-lg'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                Buku Pembantu & Simulasi Pengeluaran ATK Perkara
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-600 text-white shadow-xs">
                AI Powered
              </span>
            </div>
            <p className={`text-xs sm:text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Pencatatan resmi penerimaan & pengeluaran ATK perkara. Perkara dengan status <strong>Putus</strong> otomatis disimulasikan agar <strong>saldo ATK menjadi Rp 0</strong> sesuai standar operasional kepaniteraan.
            </p>
          </div>

          {/* Top Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setReportModalType('buku-kas');
                if (onOpenReportModal) {
                  onOpenReportModal();
                } else {
                  setShowPrintReportModal(true);
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/30 flex items-center space-x-1.5 transition-all transform active:scale-95"
              title="Cetak Laporan Resmi Buku Pembantu ATK (Perbulan / Pertahun) - Format Resmi Pengadilan Agama"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Buku Kas ATK</span>
            </button>

            <button
              onClick={() => {
                setReportModalType('rekap-persediaan');
                setReportModalFilterCase(inventoryCaseFilter);
                setShowPrintReportModal(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 flex items-center space-x-1.5 transition-all transform active:scale-95"
              title="Cetak Rekapitulasi Persediaan Barang ATK yang Digunakan untuk Perkara"
            >
              <Boxes className="w-4 h-4" />
              <span>Cetak Rekap Persediaan</span>
            </button>

            <button
              onClick={() => setShowManualModal(true)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center space-x-1.5 transition-all ${
                isLight 
                  ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-xs' 
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Plus className="w-4 h-4 text-purple-600" />
              <span>Input Manual ATK</span>
            </button>

            <button
              onClick={() => setShowCodeModal(true)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center space-x-1.5 transition-all ${
                isLight 
                  ? 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50 shadow-xs' 
                  : 'bg-purple-950/50 text-purple-300 border-purple-800 hover:bg-purple-900/50'
              }`}
              title="Lihat kode Google Apps Script untuk tab SimulasiAtkPerkara"
            >
              <Code className="w-4 h-4 text-purple-600" />
              <span>Kode Apps Script (kode.gs)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alert Putus Cases Requiring Zero-Balance Simulation */}
      {metrics.putusPendingCount > 0 && (
        <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isLight 
            ? 'bg-amber-50 border-amber-300 text-amber-900' 
            : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
        }`}>
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-extrabold">
                Terdapat {metrics.putusPendingCount} Perkara Putus yang Saldo ATK-nya Belum Dinolkan (Saldo &gt; Rp 0)
              </p>
              <p className="text-[11px] sm:text-xs opacity-90">
                Sesuai aturan, perkara putus wajib memiliki saldo ATK Rp 0. Klik tombol di kanan untuk generate rincian 13 item standar otomatis berbasis AI.
              </p>
            </div>
          </div>
          <button
            onClick={handleBatchSimulateAllPutus}
            disabled={isBatchSimulating}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/30 flex items-center justify-center space-x-2 transition-all shrink-0 disabled:opacity-75"
          >
            <Sparkles className={`w-4 h-4 ${isBatchSimulating ? 'animate-spin' : ''}`} />
            <span>
              {isBatchSimulating && batchProgress 
                ? `Memproses (${batchProgress.current}/${batchProgress.total})...` 
                : '⚡ Generate AI Semua Perkara Putus'}
            </span>
          </button>
        </div>
      )}

      {/* Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Penerimaan ATK */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
        }`}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Penerimaan ATK
          </span>
          <div className="mt-1 text-xl sm:text-2xl font-black text-emerald-600">
            {formatRp(metrics.totalPenerimaan)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Dari panjar pendaftaran perkara ({cases.length} perkara)
          </p>
        </div>

        {/* Total Pengeluaran ATK */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
        }`}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Pengeluaran ATK
          </span>
          <div className="mt-1 text-xl sm:text-2xl font-black text-rose-600">
            {formatRp(metrics.totalPengeluaran)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Realisasi & simulasi ATK ({simulasiAtkRecords.length} transaksi)
          </p>
        </div>

        {/* Sisa Saldo Kumulatif */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
        }`}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Sisa Saldo ATK Kantor
          </span>
          <div className={`mt-1 text-xl sm:text-2xl font-black ${
            metrics.sisaSaldoTotal >= 0 ? 'text-purple-600' : 'text-rose-600'
          }`}>
            {formatRp(metrics.sisaSaldoTotal)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Penerimaan dikurangi seluruh pengeluaran
          </p>
        </div>

        {/* Status Perkara Putus Rp 0 */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
        }`}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Kepatuhan Saldo Putus Rp 0
          </span>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className={`text-xl sm:text-2xl font-black ${
              metrics.putusPendingCount === 0 ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {metrics.putusTuntas} / {metrics.putusTotal}
            </span>
            <span className="text-xs font-bold text-slate-500">perkara tuntas</span>
          </div>
          <p className={`mt-1 text-[11px] font-bold ${
            metrics.putusPendingCount === 0 ? 'text-emerald-600' : 'text-amber-600'
          }`}>
            {metrics.putusPendingCount === 0 ? '✅ 100% Saldo Putus Bersih Rp 0' : `⚠️ ${metrics.putusPendingCount} perkara perlu disimulasikan`}
          </p>
        </div>
      </div>

      {/* Main View Mode Selector & Filter Bar */}
      <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
        isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Sub Tab View Buttons */}
          <div className={`flex items-center p-1 rounded-xl border ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'
          }`}>
            <button
              onClick={() => setViewMode('ringkasan-perkara')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                viewMode === 'ringkasan-perkara'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>⚖️ Ringkasan Saldo Per Perkara</span>
            </button>
            <button
              onClick={() => setViewMode('buku-jurnal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                viewMode === 'buku-jurnal'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📖 Buku Kas / Jurnal ATK ({filteredLedgerRecords.length})</span>
            </button>
            <button
              onClick={() => setViewMode('rekap-persediaan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                viewMode === 'rekap-persediaan'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>📦 Rekap Persediaan ({inventorySummary.totalJenisBarang} Item)</span>
            </button>
            <button
              onClick={() => setViewMode('tabel-acuan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                viewMode === 'tabel-acuan'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📋 Acuan Standar ATK</span>
            </button>
          </div>

          {/* Quick Year & Month Filter */}
          <div className="flex items-center space-x-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <option value="all">Semua Bulan</option>
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

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <option value="all">Semua Tahun</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>

            <button
              onClick={() => {
                if (onOpenReportModal) {
                  onOpenReportModal();
                } else {
                  setShowPrintReportModal(true);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center space-x-1.5 transition-all ${
                isLight 
                  ? 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100 shadow-xs' 
                  : 'bg-purple-950/60 text-purple-300 border-purple-800 hover:bg-purple-900/60'
              }`}
              title="Cetak Laporan Resmi ATK untuk bulan dan tahun yang dipilih"
            >
              <Printer className="w-3.5 h-3.5 text-purple-600" />
              <span>Cetak Periode Ini</span>
            </button>
          </div>
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-slate-200/50">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nomor perkara, nama pihak, uraian ATK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs border transition-colors ${
                isLight 
                  ? 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-purple-500' 
                  : 'bg-slate-800 border-slate-700 text-slate-100 focus:bg-slate-900 focus:border-purple-500'
              }`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Pill Buttons */}
          <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                filterStatus === 'all' 
                  ? 'bg-purple-600 text-white' 
                  : isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Semua ({caseFinancials.length})
            </button>
            <button
              onClick={() => setFilterStatus('putus-belum-nol')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                filterStatus === 'putus-belum-nol' 
                  ? 'bg-amber-600 text-white' 
                  : isLight ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-amber-950/60 text-amber-300'
              }`}
            >
              ⚠️ Perlu Disimulasi ({metrics.putusPendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('putus-sudah-nol')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                filterStatus === 'putus-sudah-nol' 
                  ? 'bg-emerald-600 text-white' 
                  : isLight ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-emerald-950/60 text-emerald-300'
              }`}
            >
              ✅ Putus Saldo Rp0 ({metrics.putusTuntas})
            </button>
            <button
              onClick={() => setFilterStatus('aktif')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                filterStatus === 'aktif' 
                  ? 'bg-sky-600 text-white' 
                  : isLight ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-sky-950/60 text-sky-300'
              }`}
            >
              ⏳ Perkara Aktif
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: RINGKASAN SALDO PER PERKARA */}
      {viewMode === 'ringkasan-perkara' && (
        <div className={`rounded-2xl border overflow-hidden transition-all ${
          isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b font-extrabold uppercase tracking-wider text-[11px] ${
                  isLight ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nomor Perkara & Pihak</th>
                  <th className="py-3 px-4">Kategori / Status</th>
                  <th className="py-3 px-4 text-center">Tgl Reg & Putus</th>
                  <th className="py-3 px-4 text-right">Penerimaan ATK (Debet)</th>
                  <th className="py-3 px-4 text-right">Pengeluaran ATK (Kredit)</th>
                  <th className="py-3 px-4 text-right">Sisa Saldo ATK</th>
                  <th className="py-3 px-4 text-center">Status Saldo Putus</th>
                  <th className="py-3 px-4 text-center">Aksi Simulasi AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {filteredCaseFinancials.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                      Tidak ada perkara yang cocok dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredCaseFinancials.map((item, idx) => {
                    const c = item.caseRecord;
                    return (
                      <tr 
                        key={c.id} 
                        className={`transition-colors hover:bg-purple-50/30 ${
                          item.needsSimulation ? (isLight ? 'bg-amber-50/40' : 'bg-amber-950/20') : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                            <span>{c.nomorPerkara}</span>
                            {c.nomorPerkara === '2/Pdt.G/2026/PA.Pan' && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                                Target Verifikasi
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium truncate max-w-xs">
                            {c.namaPihak || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {c.jenisPerkara}
                          </div>
                          <div className="flex items-center space-x-1 mt-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                              c.status === 'Putus' || c.status === 'Selesai'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}>
                              {c.status || 'Berjalan'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              • {c.kategoriPerkara || 'Gugatan'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-[11px]">
                          <div className="font-mono text-slate-600 dark:text-slate-300">
                            Reg: {c.tanggalRegister || '-'}
                          </div>
                          {c.tanggalPutus && (
                            <div className="font-mono text-purple-700 dark:text-purple-300 font-bold">
                              Pts: {c.tanggalPutus}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          {formatRp(item.totalMasuk)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                          {formatRp(item.totalKeluar)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-sm">
                          <span className={item.sisaSaldo === 0 ? 'text-emerald-600' : 'text-purple-700 font-black'}>
                            {formatRp(item.sisaSaldo)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.isPutus ? (
                            item.isZeroed ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>SALDO RP 0 (TUNTAS)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                <span>BELUM DINOLKAN</span>
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Perkara Berjalan
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleOpenSimulateModal(c)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center space-x-1 transition-all ${
                                item.needsSimulation
                                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm'
                                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                              }`}
                              title="Simulasi AI Rincian ATK Perkara"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>{item.isZeroed ? 'Ulangi AI' : '⚡ Simulasi AI'}</span>
                            </button>

                            <button
                              onClick={() => setInspectCase(c)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              title="Lihat Detail Transaksi ATK"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {item.totalKeluar > 0 && (
                              <button
                                onClick={() => handleResetCaseSimulation(c.nomorPerkara)}
                                className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Reset / Hapus Simulasi ATK"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: BUKU KAS / JURNAL ATK (CHRONOLOGICAL LEDGER) */}
      {viewMode === 'buku-jurnal' && (
        <div className={`rounded-2xl border overflow-hidden transition-all ${
          isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                Daftar Seluruh Transaksi & Catatan ATK ({filteredLedgerRecords.length} Catatan)
              </h2>
              <p className="text-xs text-slate-500">
                Rincian transaksi penerimaan dan pengeluaran ATK perkara (Manual & Simulasi AI)
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (onOpenReportModal) {
                    onOpenReportModal();
                  } else {
                    setShowPrintReportModal(true);
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center space-x-1.5 shadow-xs transition-colors"
                title="Buka Cetak Laporan Resmi Buku Pembantu ATK"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Laporan Resmi ATK</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b font-extrabold uppercase tracking-wider text-[11px] ${
                  isLight ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Nomor Perkara</th>
                  <th className="py-3 px-4">Uraian / Jenis ATK</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Penerimaan (Rp)</th>
                  <th className="py-3 px-4 text-right">Pengeluaran (Rp)</th>
                  <th className="py-3 px-4 text-center">Metode / AI</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {filteredLedgerRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                      Belum ada transaksi pengeluaran ATK tercatat. Klik tombol <strong>⚡ Generate AI Semua Perkara Putus</strong> di atas untuk membuat simulasi otomatis.
                    </td>
                  </tr>
                ) : (
                  filteredLedgerRecords.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-purple-50/20 transition-colors">
                      <td className="py-2.5 px-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {r.tanggal}
                      </td>
                      <td className="py-2.5 px-4 font-extrabold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {r.nomorPerkara}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-200 max-w-sm">
                        {r.uraian}
                        {r.keterangan && (
                          <span className="block text-[10px] text-slate-400 truncate">{r.keterangan}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {r.kategori}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {r.penerimaan > 0 ? formatRp(r.penerimaan) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                        {r.pengeluaran > 0 ? formatRp(r.pengeluaran) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {r.isAiGenerated ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center space-x-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>AI Sim</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {r.id.startsWith('penerimaan-atk-') ? (
                          <span className="text-[10px] text-slate-400 italic">Pendaftaran</span>
                        ) : (
                          <button
                            onClick={() => {
                              if (window.confirm('Hapus transaksi ATK ini?')) {
                                if (onDeleteSimulasiAtkRecord) {
                                  onDeleteSimulasiAtkRecord(r.id);
                                } else {
                                  onSaveSimulasiAtkRecords(simulasiAtkRecords.filter(x => x.id !== r.id));
                                }
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-600"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: REKAPITULASI & KALKULASI PERSEDIAAN BARANG ATK */}
      {viewMode === 'rekap-persediaan' && (
        <div className="space-y-4 animate-fade-in">
          {/* Header & Controls Panel */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="font-black text-base text-slate-800 dark:text-slate-100">
                      Kalkulasi & Rekapitulasi Persediaan Barang ATK
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Agregasi Otomatis
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Menghitung total volume fisik barang persediaan habis pakai (kertas, map, tinta, materai, dll.) yang dikeluarkan untuk penanganan perkara.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    downloadAtkInventoryCsv(
                      inventorySummary,
                      'Pengadilan Negeri / Agama',
                      inventoryCaseFilter === 'all' 
                        ? 'Semua Perkara (Konsolidasi)' 
                        : `Perkara ${inventoryCaseFilter}`
                    );
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center space-x-1.5 transition-all ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs' 
                      : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  }`}
                  title="Unduh data kalkulasi persediaan barang dalam format CSV/Excel"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Unduh CSV</span>
                </button>

                <button
                  onClick={() => {
                    setReportModalType('rekap-persediaan');
                    setReportModalFilterCase(inventoryCaseFilter);
                    setShowPrintReportModal(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white flex items-center space-x-1.5 shadow-md shadow-purple-600/30 transition-all transform active:scale-95"
                  title="Buka Cetak Laporan Resmi Rekapitulasi Persediaan ATK"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Rekap Persediaan</span>
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Filter Perkara
                </label>
                <select
                  value={inventoryCaseFilter}
                  onChange={(e) => setInventoryCaseFilter(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <option value="all">📁 Semua Perkara (Konsolidasi)</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.nomorPerkara}>
                      ⚖️ {c.nomorPerkara} - {c.namaPihak || 'Pihak'} ({c.status || 'Berjalan'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Kategori Barang
                </label>
                <select
                  value={inventoryCategoryFilter}
                  onChange={(e) => setInventoryCategoryFilter(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <option value="all">Semua Kategori</option>
                  <option value="Kertas">Kertas</option>
                  <option value="Map">Map & Sampul</option>
                  <option value="Tinta">Tinta & Ribbon</option>
                  <option value="Materai & Pos">Materai & Pos</option>
                  <option value="Alat Tulis">Alat Tulis</option>
                  <option value="Buku Register">Buku Register & Jurnal</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-end">
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari kode barang, nama ATK, satuan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs border ${
                      isLight 
                        ? 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-purple-500' 
                        : 'bg-slate-800 border-slate-700 text-slate-100 focus:bg-slate-900 focus:border-purple-500'
                    }`}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`p-4 rounded-2xl border transition-all ${
              isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="flex items-center space-x-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <PackageCheck className="w-4 h-4 text-purple-600" />
                <span>Jenis Barang ATK</span>
              </div>
              <div className="mt-2 flex items-baseline space-x-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                  {inventorySummary.totalJenisBarang}
                </span>
                <span className="text-xs font-bold text-slate-500">item persediaan</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {filteredInventoryItems.length} item sesuai filter pencarian
              </p>
            </div>

            <div className={`p-4 rounded-2xl border transition-all ${
              isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="flex items-center space-x-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Total Volume Fisik</span>
              </div>
              <div className="mt-2 flex items-baseline space-x-1.5">
                <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400 font-mono">
                  {inventorySummary.totalKuantitasSemua.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-bold text-slate-500">satuan barang</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Rim, Lembar, Buah, Keping, Botol
              </p>
            </div>

            <div className={`p-4 rounded-2xl border transition-all ${
              isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="flex items-center space-x-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-rose-600" />
                <span>Total Nilai Pemakaian</span>
              </div>
              <div className="mt-2 flex items-baseline space-x-1.5">
                <span className="text-2xl font-black text-rose-600 font-mono">
                  {formatRp(inventorySummary.totalNominal)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Akumulasi biaya persediaan terpakai
              </p>
            </div>

            <div className={`p-4 rounded-2xl border transition-all ${
              isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="flex items-center space-x-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <PieChart className="w-4 h-4 text-emerald-600" />
                <span>Cakupan Pemakaian</span>
              </div>
              <div className="mt-2 flex items-baseline space-x-1.5">
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {inventoryCaseFilter === 'all' 
                    ? new Set(inventorySummary.items.flatMap(it => it.daftarPerkara.map(p => p.nomorPerkara))).size 
                    : '1'}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {inventoryCaseFilter === 'all' ? 'perkara tercakup' : 'perkara terpilih'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 truncate">
                {inventoryCaseFilter === 'all' 
                  ? `${inventorySummary.items.reduce((acc, it) => acc + it.frekuensiDipakai, 0)} transaksi dicatat` 
                  : inventoryCaseFilter}
              </p>
            </div>
          </div>

          {/* Table of Calculated Inventory Items */}
          <div className={`rounded-2xl border overflow-hidden transition-all ${
            isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                  Rincian Persediaan Barang ATK Terpakai
                </h3>
                <span className="text-xs text-slate-400">
                  ({filteredInventoryItems.length} jenis barang)
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
                Plafon Standar: Rp 100.000,- / perkara
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b font-extrabold uppercase tracking-wider text-[11px] ${
                    isLight ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4 w-28">Kode Barang</th>
                    <th className="py-3 px-4">Nama Barang Persediaan & Spesifikasi</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4 text-center">Satuan</th>
                    <th className="py-3 px-4 text-right">Harga Satuan (Rp)</th>
                    <th className="py-3 px-4 text-right">Volume Terpakai</th>
                    <th className="py-3 px-4 text-right">Total Nilai (Rp)</th>
                    <th className="py-3 px-4 text-center">Frekuensi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60">
                  {filteredInventoryItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                        Tidak ada barang persediaan yang terdata pada kriteria filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredInventoryItems.map((item, idx) => (
                      <tr key={item.kodeBarang} className="hover:bg-purple-50/30 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] border border-slate-200 dark:border-slate-700">
                            {item.kodeBarang}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-900 dark:text-slate-100">
                            {item.namaBarang}
                          </div>
                          {item.keterangan && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {item.keterangan}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            {item.kategori}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                          {item.satuan}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatRp(item.hargaSatuan)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-indigo-700 dark:text-indigo-400">
                          {item.totalKuantitas.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">{item.satuan}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-rose-600 text-sm">
                          {formatRp(item.totalNominal)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700">
                            {item.frekuensiDipakai}x
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className={`border-t font-black text-xs ${
                    isLight ? 'bg-purple-50 text-purple-950 border-purple-200' : 'bg-slate-800 text-white border-slate-700'
                  }`}>
                    <td colSpan={6} className="py-3 px-4 text-right uppercase tracking-wider">
                      TOTAL PENGELUARAN PERSEDIAAN ATK :
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-indigo-800 dark:text-indigo-300 font-bold">
                      {inventorySummary.totalKuantitasSemua.toLocaleString('id-ID')} Satuan
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-base text-rose-700 dark:text-rose-400">
                      {formatRp(inventorySummary.totalNominal)}
                    </td>
                    <td className="py-3 px-4 text-center text-[10px] font-bold text-emerald-700">
                      {inventorySummary.items.reduce((acc, it) => acc + it.frekuensiDipakai, 0)} Transaksi
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: TABEL ACUAN RESMI ATK (13 ITEM DARI PENGGUNA) */}
      {viewMode === 'tabel-acuan' && (
        <div className={`rounded-2xl border overflow-hidden transition-all ${
          isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-black text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <span>📋 Tabel Standar Rincian Pengeluaran ATK Perkara</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                  Total Plafon Rp 100.000,-
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Rujukan resmi yang digunakan oleh model AI untuk mensimulasikan pemakaian ATK setiap perkara hingga saldo menjadi Rp 0.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b font-extrabold uppercase tracking-wider text-[11px] ${
                  isLight ? 'bg-purple-50/70 text-purple-900 border-purple-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Jenis A T K</th>
                  <th className="py-3 px-4 text-right">Harga Satuan</th>
                  <th className="py-3 px-4 text-right">Jumlah (Porsi Perkara)</th>
                  <th className="py-3 px-4">Peruntukan / Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 font-medium">
                {ATK_REFERENCE_ITEMS.map((item) => (
                  <tr key={item.no} className="hover:bg-purple-50/30 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-slate-400">{item.no}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {item.jenisAtk}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                      {formatRp(item.hargaSatuan)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-purple-700 dark:text-purple-300">
                      {formatRp(item.jumlah)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {item.keterangan}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`border-t font-black text-sm ${
                  isLight ? 'bg-purple-100/50 text-purple-950 border-purple-200' : 'bg-slate-800 text-white border-slate-700'
                }`}>
                  <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider">
                    J U M L A H   T O T A L
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-base text-purple-800 dark:text-purple-300">
                    Rp 100.000,-
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold text-emerald-700">
                    Sesuai Biaya Pemberkasan / ATK Pendaftaran SKUM
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: AI SIMULATION PREVIEW & CONFIRMATION FOR SINGLE CASE */}
      {showSimulateModal && selectedCaseForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-100'
          }`}>
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200/80 flex items-center justify-between bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
              <div className="flex items-center space-x-2.5">
                <Sparkles className="w-5 h-5 text-purple-200" />
                <div>
                  <h3 className="font-extrabold text-base">
                    Simulasi Pengeluaran ATK: {selectedCaseForModal.nomorPerkara}
                  </h3>
                  <p className="text-xs text-purple-100">
                    {selectedCaseForModal.namaPihak} • Status: {selectedCaseForModal.status} (Target Saldo: Rp 0)
                  </p>
                </div>
              </div>
              <button onClick={() => setShowSimulateModal(false)} className="text-purple-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Date & Workflow Stage Controller */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 border border-purple-200/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span>Jadwal Kronologis Pengeluaran Setiap Jenis ATK:</span>
                  </div>
                  <button
                    onClick={handleTriggerGeminiSimulation}
                    disabled={isGeneratingAi}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs disabled:opacity-75"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingAi ? 'Mengontak Gemini AI...' : 'Re-Generate Gemini AI'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      📅 1. Tanggal Perkara Masuk (Pendaftaran Berkas)
                    </label>
                    <input
                      type="date"
                      value={modalTanggalMasuk}
                      onChange={(e) => handleUpdateModalDates(e.target.value, modalTanggalSelesai)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-slate-800 font-bold focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Dimulai: Stofmap folio pendaftaran, kertas A4 gugatan, & map sampul perkara.
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      🏁 2. Tanggal Perkara Selesai (Putus / Minutasi)
                    </label>
                    <input
                      type="date"
                      value={modalTanggalSelesai}
                      onChange={(e) => handleUpdateModalDates(modalTanggalMasuk, e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-slate-800 font-bold focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Berakhir: Map Putusan/Penetapan, Map Produk, & ATK habis pakai penutup berkas.
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-purple-100">
                  <span>
                    Kategori: <strong className="text-slate-800">{selectedCaseForModal.kategoriPerkara || 'Gugatan'}</strong> ({selectedCaseForModal.jenisPerkara || 'Perkara'})
                  </span>
                  <span className="text-purple-700 font-medium">
                    ⚡ Simulasi terdistribusi kronologis dari tanggal masuk hingga selesai
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-600">
                      <th className="py-2.5 px-3 w-8 text-center">No</th>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Jenis ATK</th>
                      <th className="py-2.5 px-3 text-right">Jumlah (Rp)</th>
                      <th className="py-2.5 px-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {previewSimulatedItems.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center text-slate-400 font-bold">{i + 1}</td>
                        <td className="py-2 px-3 font-mono text-slate-700 font-bold whitespace-nowrap">{item.tanggal}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{item.uraian}</td>
                        <td className="py-2 px-3 text-right font-mono font-black text-rose-600">
                          {formatRp(item.pengeluaran)}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">{item.keterangan}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-purple-50 font-black text-xs border-t border-purple-200">
                      <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-purple-900">
                        Total Pengeluaran Simulasi:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-purple-900 text-sm">
                        {formatRp(previewSimulatedItems.reduce((acc, it) => acc + it.pengeluaran, 0))}
                      </td>
                      <td className="py-2.5 px-3 text-emerald-700 font-bold">
                        Saldo Akhir Perkara = Rp 0 (Tuntas)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="text-xs text-slate-500">
                {googleSheetWebhookUrl ? '✅ Terhubung ke Google Sheets Webhook' : '⚠️ Mode Lokal (Atur Webhook di Navbar)'}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveModalSimulation}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-600/30 flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan ke Buku ATK & Spreadsheet</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INPUT MANUAL TRANSACTION */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-100'
          }`}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-purple-600 text-white">
              <h3 className="font-extrabold text-sm">Input Catatan Transaksi ATK Manual</h3>
              <button onClick={() => setShowManualModal(false)} className="text-purple-200 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Nomor Perkara</label>
                <input
                  type="text"
                  placeholder="Contoh: 2/Pdt.G/2026/PA.Pan"
                  value={manualForm.nomorPerkara}
                  onChange={(e) => setManualForm({ ...manualForm, nomorPerkara: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  value={manualForm.tanggal}
                  onChange={(e) => setManualForm({ ...manualForm, tanggal: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Jenis Transaksi</label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, tipe: 'pengeluaran' })}
                    className={`flex-1 py-1.5 rounded-lg font-bold ${
                      manualForm.tipe === 'pengeluaran' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Pengeluaran ATK
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, tipe: 'penerimaan' })}
                    className={`flex-1 py-1.5 rounded-lg font-bold ${
                      manualForm.tipe === 'penerimaan' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Penerimaan ATK
                  </button>
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Uraian / Jenis ATK</label>
                <input
                  type="text"
                  placeholder="Contoh: Pembelian Kertas A4 1/5 Rim"
                  value={manualForm.uraian}
                  onChange={(e) => setManualForm({ ...manualForm, uraian: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Nominal (Rp)</label>
                  <input
                    type="number"
                    value={manualForm.nominal}
                    onChange={(e) => setManualForm({ ...manualForm, nominal: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Kategori</label>
                  <select
                    value={manualForm.kategori}
                    onChange={(e) => setManualForm({ ...manualForm, kategori: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  >
                    <option value="Kertas">Kertas</option>
                    <option value="Map">Map</option>
                    <option value="Tinta">Tinta</option>
                    <option value="Catridge">Catridge</option>
                    <option value="Amplop">Amplop</option>
                    <option value="ATK Lainnya">ATK Lainnya</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">Keterangan</label>
                <input
                  type="text"
                  placeholder="Keterangan tambahan..."
                  value={manualForm.keterangan}
                  onChange={(e) => setManualForm({ ...manualForm, keterangan: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end space-x-2 bg-slate-50">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                onClick={handleSaveManual}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GOOGLE APPS SCRIPT EXTENSION CODE */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-100'
          }`}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-800 text-white">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm">Kode Tambahan Apps Script (kode.gs) untuk Tab SimulasiAtkPerkara</h3>
              </div>
              <button onClick={() => setShowCodeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              <p className="text-xs text-slate-600">
                Salin kode berikut dan tambahkan ke Apps Script Spreadsheet Anda agar hasil generate simulasi tersimpan secara permanen di tab sheet <strong>SimulasiAtkPerkara</strong>:
              </p>
              <pre className="p-3.5 rounded-xl bg-slate-950 text-emerald-400 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
                {appScriptAdditionSnippet}
              </pre>
            </div>
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="text-xs text-slate-500">Tab Sheet: <strong>SimulasiAtkPerkara</strong></span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(appScriptAdditionSnippet);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 3000);
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs"
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Tersalin!' : 'Salin Kode ke Clipboard'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER / MODAL FOR SINGLE CASE TRANSACTIONS */}
      {inspectCase && (() => {
        const targetNo = (inspectCase.nomorPerkara || '').trim().toLowerCase();
        const caseSimRecords = simulasiAtkRecords.filter(r => (r.nomorPerkara || '').trim().toLowerCase() === targetNo);
        const totalPengeluaranCase = caseSimRecords.reduce((acc, r) => acc + (r.pengeluaran || 0), 0);
        const fin = caseFinancials.find(f => (f.caseRecord.nomorPerkara || '').trim().toLowerCase() === targetNo);
        const totalMasukCase = fin ? fin.totalMasuk : 100000;
        const sisaSaldoCase = totalMasukCase - totalPengeluaranCase;
        const caseInventory = calculateAtkInventoryUsage(caseSimRecords, inspectCase.nomorPerkara);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
              isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-100'
            }`}>
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-purple-600 text-white">
                <div>
                  <h3 className="font-extrabold text-sm">Rincian Transaksi & Persediaan ATK: {inspectCase.nomorPerkara}</h3>
                  <p className="text-[11px] text-purple-100">{inspectCase.namaPihak} • Status: {inspectCase.status || 'Berjalan'}</p>
                </div>
                <button onClick={() => setInspectCase(null)} className="text-purple-200 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Ringkasan Finansial Perkara */}
              <div className="p-3 bg-purple-50/70 border-b border-purple-100 grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg border border-purple-100 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-bold block">Penerimaan Biaya ATK</span>
                  <span className="font-extrabold text-slate-800 font-mono">{formatRp(totalMasukCase)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-purple-100 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-bold block">Total Pengeluaran ATK</span>
                  <span className="font-extrabold text-rose-600 font-mono">{formatRp(totalPengeluaranCase)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-purple-100 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-bold block">Sisa Saldo ATK</span>
                  <span className={`font-black font-mono ${sisaSaldoCase === 0 ? 'text-emerald-600' : 'text-purple-700'}`}>
                    {formatRp(sisaSaldoCase)} {sisaSaldoCase === 0 ? '✓ Nol' : ''}
                  </span>
                </div>
              </div>

              {/* Tab Selector Inside Drawer */}
              <div className="flex items-center px-4 pt-2 border-b border-slate-200 bg-slate-50 gap-2">
                <button
                  onClick={() => setCaseDetailTab('transaksi')}
                  className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                    caseDetailTab === 'transaksi'
                      ? 'border-purple-600 text-purple-700 bg-white rounded-t-lg'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>16 Transaksi Kronologis ({caseSimRecords.length})</span>
                </button>
                <button
                  onClick={() => setCaseDetailTab('persediaan')}
                  className={`px-3 py-1.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                    caseDetailTab === 'persediaan'
                      ? 'border-purple-600 text-purple-700 bg-white rounded-t-lg'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Kalkulasi Persediaan Terpakai ({caseInventory.totalJenisBarang} Item)</span>
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-3 flex-1">
                {caseSimRecords.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <Sparkles className="w-8 h-8 text-purple-300 mx-auto mb-2 opacity-60" />
                    <p className="font-bold text-slate-600">Belum ada rincian transaksi ATK yang tersimpan.</p>
                    <p className="text-[11px] mt-1">Klik tombol &quot;Simulasi Ulang AI&quot; di bawah untuk men-generate otomatis.</p>
                  </div>
                ) : caseDetailTab === 'transaksi' ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b font-bold text-slate-600">
                          <th className="p-2.5 w-8 text-center">No</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Uraian / Jenis ATK</th>
                          <th className="p-2.5 text-right">Pengeluaran</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {caseSimRecords.map((r, idx) => (
                          <tr key={r.id} className="hover:bg-purple-50/40">
                            <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{r.tanggal}</td>
                            <td className="p-2.5 font-bold text-slate-800">
                              <div>{r.uraian}</div>
                              {r.keterangan && <div className="text-[10px] text-slate-400 font-normal">{r.keterangan}</div>}
                            </td>
                            <td className="p-2.5 text-right font-mono font-black text-rose-600">{formatRp(r.pengeluaran)}</td>
                            <td className="p-2.5 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-800 font-bold">
                                {r.isAiGenerated ? 'AI Sim' : 'Manual'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b font-bold text-slate-600">
                          <th className="p-2.5 w-8 text-center">No</th>
                          <th className="p-2.5">Nama Barang Persediaan ATK</th>
                          <th className="p-2.5 text-center">Satuan</th>
                          <th className="p-2.5 text-right">Volume</th>
                          <th className="p-2.5 text-right">Harga (Rp)</th>
                          <th className="p-2.5 text-right">Total (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {caseInventory.items.map((it, idx) => (
                          <tr key={it.kodeBarang} className="hover:bg-purple-50/40">
                            <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-slate-800">
                              <div>{it.namaBarang}</div>
                              <span className="text-[10px] text-purple-700 bg-purple-50 px-1 rounded">{it.kategori}</span>
                            </td>
                            <td className="p-2.5 text-center text-slate-600 font-semibold">{it.satuan}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-indigo-700">{it.totalKuantitas}</td>
                            <td className="p-2.5 text-right font-mono text-slate-600">{formatRp(it.hargaSatuan)}</td>
                            <td className="p-2.5 text-right font-mono font-black text-rose-600">{formatRp(it.totalNominal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-purple-50 border-t font-black text-xs">
                          <td colSpan={5} className="p-2.5 text-right uppercase text-purple-950">Total Nilai Persediaan Perkara Ini :</td>
                          <td className="p-2.5 text-right font-mono text-rose-700 font-black">{formatRp(caseInventory.totalNominal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const c = inspectCase;
                      setInspectCase(null);
                      handleOpenSimulateModal(c);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center space-x-1.5 shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simulasi Ulang AI</span>
                  </button>

                  <button
                    onClick={() => {
                      setReportModalType('rekap-persediaan');
                      setReportModalFilterCase(inspectCase.nomorPerkara);
                      setShowPrintReportModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1.5 shadow-xs"
                    title="Cetak format cetak resmi rekapitulasi persediaan khusus untuk perkara ini"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Rekap Persediaan</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  {googleSheetWebhookUrl && caseSimRecords.length > 0 && (
                    <button
                      onClick={async () => {
                        setSyncStatusMsg({ type: 'success', text: `Menyinkronkan transaksi perkara ${inspectCase.nomorPerkara} ke Google Sheets...` });
                        const res = await SyncService.pushSimulasiAtkToCloud(googleSheetWebhookUrl, caseSimRecords);
                        if (res.success) {
                          setSyncStatusMsg({ type: 'success', text: `Berhasil tersimpan ke Google Sheets!` });
                        } else {
                          setSyncStatusMsg({ type: 'error', text: 'Gagal menyinkronkan ke Google Sheets. Periksa URL webhook.' });
                        }
                        setTimeout(() => setSyncStatusMsg(null), 5000);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1"
                    >
                      <CloudUpload className="w-3.5 h-3.5" />
                      <span>Sinkron ke Sheet</span>
                    </button>
                  )}
                  <button
                    onClick={() => setInspectCase(null)}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL CETAK LAPORAN RESMI BUKU PEMBANTU ATK */}
      <LaporanResmiAtkModal
        isOpen={Boolean(isOpenReportModal || showPrintReportModal)}
        onClose={() => {
          setShowPrintReportModal(false);
          if (onCloseReportModal) onCloseReportModal();
        }}
        cases={cases}
        simulasiAtkRecords={simulasiAtkRecords}
        googleSheetWebhookUrl={googleSheetWebhookUrl}
        theme={theme}
        initialMonth={selectedMonth}
        initialYear={selectedYear}
        initialReportType={reportModalType}
        initialFilterPerkara={reportModalFilterCase}
      />

    </div>
  );
};
