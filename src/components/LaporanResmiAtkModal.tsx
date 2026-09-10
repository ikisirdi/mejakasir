import React, { useState, useMemo, Fragment, useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { 
  Printer, 
  Download, 
  X, 
  Calendar, 
  SlidersHorizontal,
  Building2,
  ExternalLink,
  Palette,
  Check,
  FileText,
  Boxes,
  BookOpen,
  Filter
} from 'lucide-react';
import { CaseRecord, SimulasiAtkRecord } from '../types';
import { 
  calculateAtkInventoryUsage, 
  exportAtkInventoryToCsv, 
  AtkInventorySummary 
} from '../utils/atkInventoryCalculation';

interface LaporanResmiAtkModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseRecord[];
  simulasiAtkRecords: SimulasiAtkRecord[];
  googleSheetWebhookUrl?: string;
  theme?: 'light' | 'dark';
  initialMonth?: string; // '01' - '12' or 'all'
  initialYear?: string;  // '2026', '2025', etc. or 'all'
  initialReportType?: 'buku-kas' | 'rekap-persediaan';
  initialFilterPerkara?: string;
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
  initialYear = '2026',
  initialReportType = 'buku-kas',
  initialFilterPerkara = 'all'
}) => {
  const isLight = theme === 'light';
  const printContentRef = useRef<HTMLDivElement>(null);

  // Report Type State: 'buku-kas' (Buku Kas ATK) vs 'rekap-persediaan' (Rekapitulasi Persediaan Barang Digunakan)
  const [reportType, setReportType] = useState<'buku-kas' | 'rekap-persediaan'>(initialReportType);

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear);
  const [filterPerkaraStatus, setFilterPerkaraStatus] = useState<'all' | 'putus' | 'aktif'>('all');
  const [filterNomorPerkara, setFilterNomorPerkara] = useState<string>(initialFilterPerkara);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Print Mode & Page Setup States
  const [printColorMode, setPrintColorMode] = useState<'color' | 'bw'>('color');
  const [paperOrientation, setPaperOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [paperSize, setPaperSize] = useState<'a4' | 'f4' | 'legal'>('a4');
  const [ttdLayout, setTtdLayout] = useState<'3_kolom' | '2_kolom' | '1_kolom'>('3_kolom');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

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

  // Daftar nomor perkara unik untuk filter
  const distinctCaseNumbers = useMemo(() => {
    const set = new Set<string>();
    simulasiAtkRecords.forEach(s => {
      if (s.nomorPerkara) set.add(s.nomorPerkara.trim());
    });
    cases.forEach(c => {
      if (c.nomorPerkara) set.add(c.nomorPerkara.trim());
    });
    return Array.from(set).sort();
  }, [simulasiAtkRecords, cases]);

  // 1. Gabungkan seluruh entri kas ATK secara kronologis
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

    // Masukkan Penerimaan ATK dari pendaftaran setiap perkara (Rp 100.000)
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

    // Masukkan Pengeluaran ATK dari Simulasi / Realisasi ATK
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
      return b.penerimaan - a.penerimaan;
    });
  }, [cases, simulasiAtkRecords]);

  // 2. Filter berdasarkan Bulan, Tahun, Status Perkara, dan Filter Perkara
  const filteredLedger = useMemo(() => {
    return allLedgerItems.filter(item => {
      if (!item.tanggal) return false;
      const parts = item.tanggal.split('-');
      const itemYear = parts[0];
      const itemMonth = parts[1];

      if (selectedYear !== 'all' && itemYear !== selectedYear) return false;
      if (selectedMonth !== 'all' && itemMonth !== selectedMonth) return false;

      if (filterNomorPerkara !== 'all' && item.nomorPerkara.trim().toLowerCase() !== filterNomorPerkara.trim().toLowerCase()) {
        return false;
      }

      if (filterPerkaraStatus === 'putus') {
        const isPutus = item.statusPerkara === 'Putus' || item.statusPerkara === 'Selesai' || item.statusPerkara === 'Minutasi' || item.statusPerkara === 'Arsip';
        if (!isPutus) return false;
      } else if (filterPerkaraStatus === 'aktif') {
        const isPutus = item.statusPerkara === 'Putus' || item.statusPerkara === 'Selesai' || item.statusPerkara === 'Minutasi' || item.statusPerkara === 'Arsip';
        if (isPutus) return false;
      }

      return true;
    });
  }, [allLedgerItems, selectedMonth, selectedYear, filterPerkaraStatus, filterNomorPerkara]);

  // 3. Hitung running balance (saldo berjalan) dan agregat finansial buku kas
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

  // 4. Kalkulasi Persediaan Barang yang Digunakan (Inventory Supplies Calculation)
  // Menghitung kuantitas/volume, harga satuan, dan total pemakaian barang persediaan
  // Mengagregasi item jenis ATK yang sama untuk sebuah perkara atau seluruh perkara!
  const inventorySummary: AtkInventorySummary = useMemo(() => {
    // Saring simulasi records berdasarkan filter bulan & tahun
    const filteredSim = simulasiAtkRecords.filter(s => {
      if (!s.tanggal) return false;
      const parts = s.tanggal.split('-');
      if (selectedYear !== 'all' && parts[0] !== selectedYear) return false;
      if (selectedMonth !== 'all' && parts[1] !== selectedMonth) return false;
      return true;
    });

    return calculateAtkInventoryUsage(filteredSim, filterNomorPerkara);
  }, [simulasiAtkRecords, selectedMonth, selectedYear, filterNomorPerkara]);

  // 5. Rekapitulasi per Kategori Pengeluaran ATK (untuk Buku Kas)
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

  const periodeTeks = selectedMonth !== 'all' 
    ? `BULAN ${MONTH_LABELS[selectedMonth]?.toUpperCase() || selectedMonth} ${selectedYear !== 'all' ? selectedYear : ''}` 
    : (selectedYear !== 'all' ? `TAHUN ${selectedYear}` : 'SEMUA PERIODE');

  const filterPerkaraLabel = filterNomorPerkara !== 'all'
    ? ` • PERKARA: ${filterNomorPerkara}`
    : '';

  // =========================================================================
  // GENERATOR HTML LAPORAN DOKUMEN CETAK RESMI
  // Mendukung Cetak Buku Kas ATK maupun Rekapitulasi Persediaan Barang Digunakan
  // Warna penuh sistem, multi-halaman bersih, bebas scrollbar modal screenshot!
  // =========================================================================
  const generateCleanPrintHtml = (isColor: boolean): string => {
    const paperSizeCss = paperSize === 'f4' ? '215mm 330mm' : paperSize === 'legal' ? '8.5in 14in' : 'A4';
    
    // Palet Warna: Berwarna Penuh vs Monokrom
    const cDebet = isColor ? '#047857' : '#0f172a';
    const cKredit = isColor ? '#b91c1c' : '#0f172a';
    const cSaldo = isColor ? '#6d28d9' : '#0f172a';
    const bgHeader = isColor ? '#f8fafc' : '#f1f5f9';
    const bgTableHead = isColor ? '#f1f5f9' : '#e2e8f0';
    const borderCol = isColor ? '#cbd5e1' : '#475569';
    const badgeBgSync = isColor ? '#f3e8ff' : '#f1f5f9';
    const badgeTextSync = isColor ? '#6b21a8' : '#0f172a';
    const badgeBgPanjar = isColor ? '#d1fae5' : '#f1f5f9';
    const badgeTextPanjar = isColor ? '#065f46' : '#0f172a';

    // Signatures layout
    let signaturesHtml = '';
    if (ttdLayout === '3_kolom') {
      signaturesHtml = `
        <div style="display: flex; justify-content: space-between; text-align: center; margin-top: 20px; page-break-inside: avoid;">
          <div style="flex: 1; padding: 0 10px;">
            <div style="color: #334155;">Mengetahui,</div>
            <div style="font-weight: 800; margin-top: 2px;">Ketua Pengadilan Agama Paniai</div>
            <div style="height: 65px;"></div>
            <div style="font-weight: 800; text-decoration: underline;">${ketuaNama}</div>
            <div style="font-size: 10px; font-family: monospace; color: #475569;">${ketuaNip}</div>
          </div>
          <div style="flex: 1; padding: 0 10px;">
            <div style="color: #334155;">Memeriksa,</div>
            <div style="font-weight: 800; margin-top: 2px;">Panitera Pengadilan Agama Paniai</div>
            <div style="height: 65px;"></div>
            <div style="font-weight: 800; text-decoration: underline;">${paniteraNama}</div>
            <div style="font-size: 10px; font-family: monospace; color: #475569;">${paniteraNip}</div>
          </div>
          <div style="flex: 1; padding: 0 10px;">
            <div style="color: #334155;">Dibuat Oleh,</div>
            <div style="font-weight: 800; margin-top: 2px;">Kasir / Pengelola Persediaan ATK</div>
            <div style="height: 65px;"></div>
            <div style="font-weight: 800; text-decoration: underline;">${kasirNama}</div>
            <div style="font-size: 10px; font-family: monospace; color: #475569;">${kasirNip}</div>
          </div>
        </div>
      `;
    } else if (ttdLayout === '2_kolom') {
      signaturesHtml = `
        <div style="display: flex; justify-content: space-between; text-align: center; margin-top: 20px; page-break-inside: avoid;">
          <div style="flex: 1; padding: 0 20px;">
            <div style="color: #334155;">Mengetahui / Memeriksa,</div>
            <div style="font-weight: 800; margin-top: 2px;">Panitera Pengadilan Agama Paniai</div>
            <div style="height: 65px;"></div>
            <div style="font-weight: 800; text-decoration: underline;">${paniteraNama}</div>
            <div style="font-size: 10px; font-family: monospace; color: #475569;">${paniteraNip}</div>
          </div>
          <div style="flex: 1; padding: 0 20px;">
            <div style="color: #334155;">Dibuat Oleh,</div>
            <div style="font-weight: 800; margin-top: 2px;">Kasir / Pengelola Persediaan ATK</div>
            <div style="height: 65px;"></div>
            <div style="font-weight: 800; text-decoration: underline;">${kasirNama}</div>
            <div style="font-size: 10px; font-family: monospace; color: #475569;">${kasirNip}</div>
          </div>
        </div>
      `;
    } else {
      signaturesHtml = `
        <div style="display: flex; justify-content: flex-end; text-align: center; margin-top: 20px; page-break-inside: avoid;">
          <div style="width: 320px; padding: 0 10px;">
            <div style="color: #334155;">Dibuat Oleh,</div>
            <div style="font-weight: 800; margin-top: 2px;">Kasir / Pengelola Persediaan ATK</div>
            <div style="height: 65px;"></div>
            <div style="font-weight: 800; text-decoration: underline;">${kasirNama}</div>
            <div style="font-size: 10px; font-family: monospace; color: #475569;">${kasirNip}</div>
          </div>
        </div>
      `;
    }

    // -------------------------------------------------------------
    // TEMPLATE REKAPITULASI PEMAKAIAN & PERSEDIAAN BARANG ATK
    // -------------------------------------------------------------
    if (reportType === 'rekap-persediaan') {
      const invRowsHtml = inventorySummary.items.length === 0
        ? `<tr><td colspan="9" style="padding: 24px; text-align: center; color: #64748b; font-style: italic;">Tidak ada data pemakaian barang persediaan ATK pada periode yang dipilih.</td></tr>`
        : inventorySummary.items.map((it, idx) => {
            const perkaraList = it.daftarPerkara.map(p => p.nomorPerkara).filter((v, i, a) => a.indexOf(v) === i);
            const perkaraDisplay = perkaraList.length <= 3 
              ? perkaraList.join(', ') 
              : `${perkaraList.slice(0, 3).join(', ')} (+${perkaraList.length - 3} perkara lainnya)`;

            return `
              <tr style="border-bottom: 1px solid ${borderCol}; page-break-inside: avoid;">
                <td style="padding: 6px 8px; text-align: center; font-weight: 700; border-right: 1px solid ${borderCol};">${idx + 1}</td>
                <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 700; border-right: 1px solid ${borderCol}; color: #475569;">${it.kodeBarang}</td>
                <td style="padding: 6px 8px; border-right: 1px solid ${borderCol};">
                  <div style="font-weight: 700; color: #0f172a;">${it.namaBarang}</div>
                  <div style="font-size: 9px; color: #64748b; margin-top: 2px;">${it.keterangan}</div>
                </td>
                <td style="padding: 6px 8px; text-align: center; font-weight: 600; border-right: 1px solid ${borderCol};">${it.kategori}</td>
                <td style="padding: 6px 8px; text-align: center; font-weight: 700; border-right: 1px solid ${borderCol}; background: ${isColor ? '#f8fafc' : '#ffffff'};">${it.satuan}</td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; border-right: 1px solid ${borderCol};">${formatRp(it.hargaSatuan)}</td>
                <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 800; border-right: 1px solid ${borderCol}; color: ${isColor ? '#6d28d9' : '#0f172a'};">
                  ${it.totalKuantitas} ${it.satuan}
                </td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${cKredit}; border-right: 1px solid ${borderCol};">
                  ${formatRp(it.totalNominal)}
                </td>
                <td style="padding: 6px 8px; font-size: 9px; color: #334155;">
                  ${perkaraDisplay} (${it.frekuensiDipakai}x pemakaian)
                </td>
              </tr>
            `;
          }).join('');

      return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Rekapitulasi Pemakaian & Persediaan Barang ATK Perkara - ${namaPengadilan}</title>
  <style>
    @page {
      size: ${paperSizeCss} ${paperOrientation};
      margin: 12mm 15mm 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .kop-container {
      text-align: center;
      border-bottom: 3px double #000000;
      padding-bottom: 8px;
      margin-bottom: 14px;
    }
    .kop-logo {
      font-size: 26px;
      line-height: 1;
      margin-bottom: 4px;
    }
    .kop-h1 {
      font-family: "Times New Roman", Times, serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 1px 0;
    }
    .kop-pengadilan {
      font-family: "Times New Roman", Times, serif;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 2px 0;
    }
    .kop-alamat {
      font-size: 10px;
      color: #334155;
      margin: 2px 0 0 0;
    }
    .title-box {
      text-align: center;
      margin-bottom: 14px;
    }
    .title-h2 {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      text-decoration: underline;
      margin: 0 0 4px 0;
    }
    .title-periode {
      font-size: 11px;
      font-weight: 800;
      font-family: monospace;
      color: ${isColor ? '#6d28d9' : '#000000'};
      margin: 0;
    }
    .summary-grid {
      display: flex;
      border: 1px solid ${borderCol};
      border-radius: 6px;
      background: ${bgHeader};
      padding: 10px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .summary-item {
      flex: 1;
      padding: 0 10px;
      border-right: 1px solid ${borderCol};
    }
    .summary-item:last-child {
      border-right: none;
    }
    .summary-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }
    .summary-value {
      font-size: 13px;
      font-weight: 900;
      font-family: monospace;
      margin-top: 3px;
    }
    table.atk-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid ${borderCol};
      font-size: 10px;
      margin-bottom: 16px;
    }
    table.atk-table thead {
      display: table-header-group;
    }
    table.atk-table tr {
      page-break-inside: avoid;
    }
    table.atk-table th {
      background: ${bgTableHead};
      border: 1px solid ${borderCol};
      padding: 6px 8px;
      font-size: 10px;
      font-weight: 800;
      text-align: center;
    }
    table.atk-table td {
      border: 1px solid ${borderCol};
    }
    table.atk-table tfoot td {
      background: ${bgTableHead};
      font-weight: 800;
      border: 1px solid ${borderCol};
      padding: 8px;
    }
    .footer-doc {
      margin-top: 24px;
      padding-top: 6px;
      border-top: 1px solid ${borderCol};
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #64748b;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <!-- KOP SURAT MAHKAMAH AGUNG -->
  <div class="kop-container">
    <div class="kop-logo">⚖️</div>
    <div class="kop-h1">MAHKAMAH AGUNG REPUBLIK INDONESIA</div>
    <div class="kop-h1">DIREKTORAT JENDERAL BADAN PERADILAN AGAMA</div>
    <div class="kop-h1">${instansiTinggi}</div>
    <div class="kop-pengadilan">${namaPengadilan}</div>
    <div class="kop-alamat">${alamatPengadilan}</div>
  </div>

  <!-- JUDUL LAPORAN PERSEDIAAN -->
  <div class="title-box">
    <h2 class="title-h2">REKAPITULASI PEMAKAIAN & PERSEDIAAN BARANG ATK PERKARA</h2>
    <p class="title-periode">PERIODE : ${periodeTeks} ${filterPerkaraLabel}</p>
    <p style="font-size: 9.5px; color: #64748b; margin: 3px 0 0 0;">
      Kalkulasi Akumulasi Volume & Nilai Pengeluaran Barang Persediaan Habis Pakai Perkara Peradilan
    </p>
  </div>

  <!-- RINGKASAN PERSDIAAN -->
  <div class="summary-grid">
    <div class="summary-item">
      <div class="summary-label">Total Jenis Barang Digunakan</div>
      <div class="summary-value" style="color: ${isColor ? '#6d28d9' : '#000000'};">${inventorySummary.totalJenisBarang} Macam Barang</div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Barang habis pakai kepaniteraan</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Kuantitas Fisik Barang</div>
      <div class="summary-value" style="color: ${isColor ? '#0369a1' : '#000000'};">${inventorySummary.totalKuantitasSemua} Unit/Satuan</div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Akumulasi volume rim, lembar, buah</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Nilai Pemakaian Persediaan</div>
      <div class="summary-value" style="color: ${cKredit};">${formatRp(inventorySummary.totalNominal)}</div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Total rupiah barang dikeluarkan</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Cakupan Perkara</div>
      <div class="summary-value" style="color: ${cDebet}; font-size: 11px;">
        ${filterNomorPerkara !== 'all' ? filterNomorPerkara : 'Semua Perkara Teregister'}
      </div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Tersimpan di Tab SimulasiAtkPerkara</div>
    </div>
  </div>

  <!-- TABEL REKAPITULASI PERSEDIAAN BARANG -->
  <table class="atk-table">
    <thead>
      <tr>
        <th style="width: 32px;">NO</th>
        <th style="width: 85px;">KODE</th>
        <th>NAMA BARANG PERSEDIAAN ATK</th>
        <th style="width: 80px;">KATEGORI</th>
        <th style="width: 65px;">SATUAN</th>
        <th style="width: 85px; text-align: right;">HARGA (RP)</th>
        <th style="width: 95px;">VOLUME DIGUNAKAN</th>
        <th style="width: 105px; text-align: right;">TOTAL NILAI (RP)</th>
        <th style="width: 130px;">PERUNTUKAN PERKARA</th>
      </tr>
    </thead>
    <tbody>
      ${invRowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="6" style="text-align: center; font-weight: 900; letter-spacing: 0.5px;">
          JUMLAH TOTAL NILAI PEMAKAIAN PERSEDIAAN BARANG
        </td>
        <td style="text-align: center; font-family: monospace; font-weight: 900; color: ${isColor ? '#6d28d9' : '#000000'};">
          ${inventorySummary.totalKuantitasSemua}
        </td>
        <td style="text-align: right; font-family: monospace; font-weight: 900; color: ${cKredit};">
          ${formatRp(inventorySummary.totalNominal)}
        </td>
        <td style="text-align: center; font-size: 9px; color: #475569;">
          SEIMBANG (AUDITED)
        </td>
      </tr>
    </tfoot>
  </table>

  <!-- LEMBAR PENGESAHAN TANDA TANGAN RESMI -->
  <div style="page-break-inside: avoid; margin-top: 24px;">
    <div style="text-align: right; font-weight: 600; margin-bottom: 8px; padding-right: 15px;">
      ${kotaTanggal}
    </div>
    ${signaturesHtml}
  </div>

  <!-- CATATAN KAKI DOKUMEN -->
  <div class="footer-doc">
    <span>Dokumen ini dicetak otomatis melalui Aplikasi SI-PERKARA PA Paniai • Modul Rekapitulasi Persediaan Barang ATK</span>
    <span>Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}</span>
  </div>
</body>
</html>`;
    }

    // -------------------------------------------------------------
    // TEMPLATE BUKU PEMBANTU KAS ATK PERKARA (DEFAULT)
    // -------------------------------------------------------------
    const tableRowsHtml = ledgerWithBalance.length === 0 
      ? `<tr><td colspan="7" style="padding: 24px; text-align: center; color: #64748b; font-style: italic;">Tidak ada data transaksi ATK pada periode yang dipilih (${periodeTeks}).</td></tr>`
      : ledgerWithBalance.map(r => `
          <tr style="border-bottom: 1px solid ${borderCol}; page-break-inside: avoid;">
            <td style="padding: 6px 8px; text-align: center; font-weight: 700; border-right: 1px solid ${borderCol};">${r.no}</td>
            <td style="padding: 6px 8px; text-align: center; font-family: monospace; white-space: nowrap; border-right: 1px solid ${borderCol};">${r.tanggal}</td>
            <td style="padding: 6px 8px; font-family: monospace; font-weight: 700; white-space: nowrap; border-right: 1px solid ${borderCol};">${r.nomorPerkara}</td>
            <td style="padding: 6px 8px; border-right: 1px solid ${borderCol};">
              <div style="font-weight: 600;">${r.uraian}</div>
              <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Pihak: ${r.namaPihak} • Kat: ${r.kategori}</div>
            </td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 700; color: ${cDebet}; border-right: 1px solid ${borderCol};">
              ${r.penerimaan > 0 ? formatRp(r.penerimaan) : '-'}
            </td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 700; color: ${cKredit}; border-right: 1px solid ${borderCol};">
              ${r.pengeluaran > 0 ? formatRp(r.pengeluaran) : '-'}
            </td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${cSaldo};">
              ${formatRp(r.saldo)}
            </td>
          </tr>
        `).join('');

    const categoryColsHtml = (Object.entries(categoryBreakdown) as [string, { total: number; count: number }][]).map(([cat, d]) => `
      <div style="flex: 1; min-width: 90px; text-align: center; padding: 6px 4px; border-right: 1px solid ${borderCol};">
        <div style="font-size: 9.5px; font-weight: 700; color: #475569; text-transform: uppercase;">${cat}</div>
        <div style="font-family: monospace; font-weight: 800; font-size: 11px; margin-top: 2px; color: ${isColor ? '#1e293b' : '#000000'};">${formatRp(d.total)}</div>
        <div style="font-size: 8.5px; color: #64748b;">${d.count} item</div>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Laporan Resmi Buku Pembantu ATK Perkara - ${namaPengadilan}</title>
  <style>
    @page {
      size: ${paperSizeCss} ${paperOrientation};
      margin: 12mm 15mm 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .kop-container {
      text-align: center;
      border-bottom: 3px double #000000;
      padding-bottom: 8px;
      margin-bottom: 14px;
    }
    .kop-logo {
      font-size: 26px;
      line-height: 1;
      margin-bottom: 4px;
    }
    .kop-h1 {
      font-family: "Times New Roman", Times, serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 1px 0;
    }
    .kop-pengadilan {
      font-family: "Times New Roman", Times, serif;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 2px 0;
    }
    .kop-alamat {
      font-size: 10px;
      color: #334155;
      margin: 2px 0 0 0;
    }
    .title-box {
      text-align: center;
      margin-bottom: 14px;
    }
    .title-h2 {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      text-decoration: underline;
      margin: 0 0 4px 0;
    }
    .title-periode {
      font-size: 11px;
      font-weight: 800;
      font-family: monospace;
      color: ${isColor ? '#6d28d9' : '#000000'};
      margin: 0;
    }
    .summary-grid {
      display: flex;
      border: 1px solid ${borderCol};
      border-radius: 6px;
      background: ${bgHeader};
      padding: 10px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .summary-item {
      flex: 1;
      padding: 0 10px;
      border-right: 1px solid ${borderCol};
    }
    .summary-item:last-child {
      border-right: none;
    }
    .summary-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }
    .summary-value {
      font-size: 13px;
      font-weight: 900;
      font-family: monospace;
      margin-top: 3px;
    }
    .category-box {
      border: 1px solid ${borderCol};
      border-radius: 6px;
      margin-bottom: 14px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .category-head {
      background: ${bgTableHead};
      padding: 5px 10px;
      font-weight: 800;
      font-size: 10px;
      border-bottom: 1px solid ${borderCol};
      display: flex;
      justify-content: space-between;
    }
    .category-row {
      display: flex;
      background: #ffffff;
    }
    table.atk-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid ${borderCol};
      font-size: 10px;
      margin-bottom: 16px;
    }
    table.atk-table thead {
      display: table-header-group;
    }
    table.atk-table tr {
      page-break-inside: avoid;
    }
    table.atk-table th {
      background: ${bgTableHead};
      border: 1px solid ${borderCol};
      padding: 6px 8px;
      font-size: 10px;
      font-weight: 800;
      text-align: center;
    }
    table.atk-table td {
      border: 1px solid ${borderCol};
    }
    table.atk-table tfoot td {
      background: ${bgTableHead};
      font-weight: 800;
      border: 1px solid ${borderCol};
      padding: 8px;
    }
    .footer-doc {
      margin-top: 24px;
      padding-top: 6px;
      border-top: 1px solid ${borderCol};
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #64748b;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <!-- KOP SURAT MAHKAMAH AGUNG -->
  <div class="kop-container">
    <div class="kop-logo">⚖️</div>
    <div class="kop-h1">MAHKAMAH AGUNG REPUBLIK INDONESIA</div>
    <div class="kop-h1">DIREKTORAT JENDERAL BADAN PERADILAN AGAMA</div>
    <div class="kop-h1">${instansiTinggi}</div>
    <div class="kop-pengadilan">${namaPengadilan}</div>
    <div class="kop-alamat">${alamatPengadilan}</div>
  </div>

  <!-- JUDUL DOKUMEN -->
  <div class="title-box">
    <h2 class="title-h2">BUKU PEMBANTU BIAYA PROSES / ATK PERKARA</h2>
    <p class="title-periode">PERIODE : ${periodeTeks} ${filterPerkaraLabel}</p>
  </div>

  <!-- RINGKASAN FINANSIAL RESMI -->
  <div class="summary-grid">
    <div class="summary-item">
      <div class="summary-label">A. Total Penerimaan ATK</div>
      <div class="summary-value" style="color: ${cDebet};">${formatRp(totalPenerimaan)}</div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Panjar masuk pendaftaran perkara</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">B. Total Pengeluaran ATK</div>
      <div class="summary-value" style="color: ${cKredit};">${formatRp(totalPengeluaran)}</div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Realisasi & simulasi ATK (${countSimulasi} transaksi)</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">C. Sisa Saldo ATK Periode</div>
      <div class="summary-value" style="color: ${cSaldo};">${formatRp(saldoAkhir)}</div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Sisa saldo kas ATK berjalan</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">D. Status Saldo Putus Rp 0</div>
      <div class="summary-value" style="color: ${cDebet}; font-size: 11px;">Tuntas Sesuai Aturan</div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Tersimpan di Tab SimulasiAtkPerkara</div>
    </div>
  </div>

  <!-- REKAPITULASI PENGELUARAN PER KELOMPOK ATK -->
  <div class="category-box">
    <div class="category-head">
      <span>REKAPITULASI PENGELUARAN PER KELOMPOK ATK (STANDAR MAHKAMAH AGUNG RI)</span>
      <span style="font-family: monospace;">Total Item: ${countSimulasi}</span>
    </div>
    <div class="category-row">
      ${categoryColsHtml}
    </div>
  </div>

  <!-- TABEL BUKU PEMBANTU KAS ATK PERKARA -->
  <table class="atk-table">
    <thead>
      <tr>
        <th style="width: 32px;">NO</th>
        <th style="width: 75px;">TANGGAL</th>
        <th style="width: 140px;">NOMOR PERKARA</th>
        <th>URAIAN PENGELUARAN / JENIS ATK</th>
        <th style="width: 110px; text-align: right;">PENERIMAAN (DEBET)</th>
        <th style="width: 110px; text-align: right;">PENGELUARAN (KREDIT)</th>
        <th style="width: 110px; text-align: right;">SALDO</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="text-align: center; font-weight: 900; letter-spacing: 0.5px;">
          JUMLAH TOTAL PERIODE INI
        </td>
        <td style="text-align: right; font-family: monospace; font-weight: 900; color: ${cDebet};">
          ${formatRp(totalPenerimaan)}
        </td>
        <td style="text-align: right; font-family: monospace; font-weight: 900; color: ${cKredit};">
          ${formatRp(totalPengeluaran)}
        </td>
        <td style="text-align: right; font-family: monospace; font-weight: 900; color: ${cSaldo};">
          ${formatRp(saldoAkhir)}
        </td>
      </tr>
    </tfoot>
  </table>

  <!-- LEMBAR PENGESAHAN TANDA TANGAN RESMI -->
  <div style="page-break-inside: avoid; margin-top: 24px;">
    <div style="text-align: right; font-weight: 600; margin-bottom: 8px; padding-right: 15px;">
      ${kotaTanggal}
    </div>
    ${signaturesHtml}
  </div>

  <!-- CATATAN KAKI DOKUMEN -->
  <div class="footer-doc">
    <span>Dokumen ini dicetak otomatis melalui Aplikasi SI-PERKARA PA Paniai • Tab SimulasiAtkPerkara Google Spreadsheet</span>
    <span>Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}</span>
  </div>
</body>
</html>`;
  };

  // =========================================================================
  // PRINT HANDLER DEDIKASI
  // =========================================================================
  const handlePrintDedicated = (isColor: boolean = printColorMode === 'color') => {
    try {
      setIsPrinting(true);
      const fullHtml = generateCleanPrintHtml(isColor);

      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = 'none';
      printIframe.style.opacity = '0';
      printIframe.style.pointerEvents = 'none';
      document.body.appendChild(printIframe);

      const frameDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
      if (!frameDoc) {
        throw new Error('Gagal menginisialisasi print iframe');
      }

      frameDoc.open();
      frameDoc.write(fullHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print blocked, falling back to window.print():', e);
          window.print();
        } finally {
          setIsPrinting(false);
          setTimeout(() => {
            if (document.body.contains(printIframe)) {
              document.body.removeChild(printIframe);
            }
          }, 1000);
        }
      }, 400);

    } catch (err) {
      console.error('Error saat mencetak laporan resmi:', err);
      setIsPrinting(false);
      window.print();
    }
  };

  // Buka di Jendela / Tab Baru untuk kemudahan cetak langsung browser
  const handleOpenInNewTab = (isColor: boolean = printColorMode === 'color') => {
    const fullHtml = generateCleanPrintHtml(isColor);
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      alert('Pop-up diblokir oleh browser. Harap izinkan pop-up untuk mencetak dokumen dalam tab terpisah.');
    }
  };

  // Export CSV Handler
  const handleExportCsv = () => {
    const periodStr = selectedMonth !== 'all' 
      ? `${MONTH_LABELS[selectedMonth] || selectedMonth}_${selectedYear}` 
      : `TAHUN_${selectedYear}`;

    if (reportType === 'rekap-persediaan') {
      const csvData = exportAtkInventoryToCsv(
        inventorySummary,
        namaPengadilan,
        `${periodeTeks} ${filterPerkaraLabel}`
      );
      const filename = `Rekap_Persediaan_ATK_${namaPengadilan.replace(/\s+/g, '_')}_${periodStr}.csv`;
      const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const filename = `Laporan_Resmi_ATK_${namaPengadilan.replace(/\s+/g, '_')}_${periodStr}.csv`;
      const headers = ['No', 'Tanggal', 'Nomor Perkara', 'Nama Pihak', 'Uraian ATK / Transaksi', 'Kategori', 'Penerimaan (Debet)', 'Pengeluaran (Kredit)', 'Saldo Berjalan'];
      const rows = ledgerWithBalance.map(r => [
        r.no,
        `"${r.tanggal}"`,
        `"${r.nomorPerkara}"`,
        `"${r.namaPihak}"`,
        `"${r.uraian.replace(/"/g, '""')}"`,
        `"${r.kategori}"`,
        r.penerimaan,
        r.pengeluaran,
        r.saldo
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
    }
  };

  if (!isOpen) return null;

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
            <DialogPanel className={`w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] border printable-document-container ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
            }`}>
              
              {/* TOP ACTION BAR (PRINT HIDDEN) */}
              <div className={`px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden ${
                isLight ? 'bg-gradient-to-r from-purple-50 via-indigo-50 to-white border-purple-200' : 'bg-slate-800 border-slate-700'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
                    {reportType === 'rekap-persediaan' ? <Boxes className="w-5 h-5" /> : <Printer className="w-5 h-5" />}
                  </div>
                  <div>
                    <DialogTitle as="h3" className="font-extrabold text-base flex items-center space-x-2">
                      <span>{reportType === 'rekap-persediaan' ? 'Rekapitulasi Pemakaian & Persediaan Barang ATK' : 'Cetak Buku Pembantu Kas ATK Perkara'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white font-bold tracking-wide">
                        RESMI MA-RI
                      </span>
                    </DialogTitle>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Format Cetak Standar Pengadilan Agama • Mendukung Warna Sistem Penuh & Multi-Halaman Bersih
                    </p>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center space-x-2">
                  {/* Selector Jenis Laporan: Buku Kas vs Rekap Persediaan */}
                  <div className="flex items-center bg-purple-100 dark:bg-purple-950 p-1 rounded-xl border border-purple-300 dark:border-purple-800">
                    <button
                      onClick={() => setReportType('buku-kas')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                        reportType === 'buku-kas'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-purple-800 dark:text-purple-300 hover:bg-purple-200/50'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Buku Kas ATK</span>
                    </button>
                    <button
                      onClick={() => setReportType('rekap-persediaan')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                        reportType === 'rekap-persediaan'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-purple-800 dark:text-purple-300 hover:bg-purple-200/50'
                      }`}
                    >
                      <Boxes className="w-3.5 h-3.5" />
                      <span>Rekap Persediaan</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setShowConfig(prev => !prev)}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      showConfig 
                        ? 'bg-purple-600 text-white border-purple-600' 
                        : isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Opsi Kop & TTD</span>
                  </button>

                  <button
                    onClick={handleExportCsv}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    }`}
                    title={reportType === 'rekap-persediaan' ? 'Unduh Rekap Persediaan ATK ke Excel / CSV' : 'Unduh Buku Kas ATK ke Excel / CSV'}
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ekspor CSV</span>
                  </button>

                  <button
                    onClick={() => handleOpenInNewTab(printColorMode === 'color')}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      isLight ? 'bg-white border-purple-300 text-purple-700 hover:bg-purple-50' : 'bg-slate-800 border-purple-800 text-purple-300 hover:bg-slate-700'
                    }`}
                    title="Buka laporan di tab baru untuk preview mandiri atau simpan PDF"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                    <span>Tab Baru</span>
                  </button>

                  {/* Tombol Utama Cetak Langsung Berwarna Sesuai Sistem */}
                  <button
                    onClick={() => handlePrintDedicated(printColorMode === 'color')}
                    disabled={isPrinting}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-purple-600/30 transform active:scale-95 disabled:opacity-75"
                  >
                    <Printer className={`w-4 h-4 ${isPrinting ? 'animate-spin' : ''}`} />
                    <span>{isPrinting ? 'Menyiapkan...' : 'Cetak Sekarang (Print PDF)'}</span>
                  </button>

                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* TOOLBAR CONTROLS: WARNA, KERTAS & FILTER PERIODE (PRINT HIDDEN) */}
              <div className={`px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 print:hidden ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}>
                {/* Left: Mode Warna & Kertas */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1 bg-purple-100/80 dark:bg-purple-950/60 p-1 rounded-xl border border-purple-200 dark:border-purple-800">
                    <button
                      onClick={() => setPrintColorMode('color')}
                      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                        printColorMode === 'color' 
                          ? 'bg-purple-600 text-white shadow-xs' 
                          : 'text-purple-800 dark:text-purple-300 hover:bg-purple-200/50'
                      }`}
                      title="Hasil cetak mempertahankan warna asli sistem"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>🎨 Berwarna Sesuai Sistem</span>
                      {printColorMode === 'color' && <Check className="w-3 h-3 ml-0.5" />}
                    </button>
                    <button
                      onClick={() => setPrintColorMode('bw')}
                      className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                        printColorMode === 'bw' 
                          ? 'bg-slate-800 text-white shadow-xs' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
                      }`}
                      title="Hasil cetak monokrom formal"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>🖨️ Hitam Putih (B&W)</span>
                      {printColorMode === 'bw' && <Check className="w-3 h-3 ml-0.5" />}
                    </button>
                  </div>

                  {/* Orientasi Kertas */}
                  <div className="flex items-center space-x-1 border border-slate-300 dark:border-slate-700 rounded-xl p-0.5">
                    <button
                      onClick={() => setPaperOrientation('portrait')}
                      className={`px-2 py-1 rounded-lg font-bold text-xs ${
                        paperOrientation === 'portrait'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      📄 Potret
                    </button>
                    <button
                      onClick={() => setPaperOrientation('landscape')}
                      className={`px-2 py-1 rounded-lg font-bold text-xs ${
                        paperOrientation === 'landscape'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      📑 Lanskap
                    </button>
                  </div>

                  {/* Ukuran Kertas */}
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value as any)}
                    className={`px-2.5 py-1 rounded-xl font-bold border ${
                      isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                  >
                    <option value="a4">Kertas: A4</option>
                    <option value="f4">Kertas: F4 / Folio</option>
                    <option value="legal">Kertas: Legal</option>
                  </select>
                </div>

                {/* Right: Filter Periode & Perkara */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Filter Nomor Perkara Spesifik */}
                  <div className="flex items-center space-x-1">
                    <Filter className="w-3.5 h-3.5 text-purple-600" />
                    <select
                      value={filterNomorPerkara}
                      onChange={(e) => setFilterNomorPerkara(e.target.value)}
                      className={`px-2 py-1 rounded-xl font-bold border max-w-[180px] ${
                        isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'
                      }`}
                      title="Saring laporan untuk seluruh perkara atau satu nomor perkara spesifik"
                    >
                      <option value="all">📁 Semua Perkara</option>
                      {distinctCaseNumbers.map(nom => (
                        <option key={nom} value={nom}>{nom}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-1 font-bold text-slate-700 dark:text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    <span>Periode:</span>
                  </div>

                  {/* Dropdown Bulan */}
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className={`px-2 py-1 rounded-xl font-bold border ${
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
                    className={`px-2 py-1 rounded-xl font-bold border ${
                      isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                  >
                    <option value="all">Semua Tahun</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>
              </div>

              {/* COLLAPSIBLE CONFIGURATION PANEL FOR KOP, TTD & PEJABAT (PRINT HIDDEN) */}
              {showConfig && (
                <div className={`p-4 border-b text-xs space-y-3 shrink-0 print:hidden animate-fade-in ${
                  isLight ? 'bg-purple-50/60 border-purple-200' : 'bg-purple-950/30 border-purple-800/50'
                }`}>
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 pb-1 border-b border-purple-200/50">
                    <span className="flex items-center space-x-1.5">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <span>Kustomisasi Identitas Kop Surat & Pejabat Penandatangan</span>
                    </span>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 font-normal">Format TTD:</span>
                      <select
                        value={ttdLayout}
                        onChange={(e) => setTtdLayout(e.target.value as any)}
                        className="px-2 py-1 rounded border border-purple-300 bg-white dark:bg-slate-800 font-bold"
                      >
                        <option value="3_kolom">3 Kolom (Ketua, Panitera, Kasir)</option>
                        <option value="2_kolom">2 Kolom (Panitera & Kasir)</option>
                        <option value="1_kolom">1 Kolom (Kasir / Petugas Saja)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Pengadilan Tinggi Agama (Banding)
                      </label>
                      <input
                        type="text"
                        value={instansiTinggi}
                        onChange={(e) => setInstansiTinggi(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Nama Satker Pengadilan Agama
                      </label>
                      <input
                        type="text"
                        value={namaPengadilan}
                        onChange={(e) => setNamaPengadilan(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-purple-600"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Tempat & Tanggal Surat Tanda Tangan
                      </label>
                      <input
                        type="text"
                        value={kotaTanggal}
                        onChange={(e) => setKotaTanggal(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  {/* Pejabat Penandatangan */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">Mengetahui: Ketua</span>
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

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">Memeriksa: Panitera</span>
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

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">Dibuat Oleh: Kasir / Persediaan</span>
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

              {/* =========================================================================
                  LIVE REPORT PREVIEW AREA (TERLIHAT JELAS, BERWARNA, RAPI)
                  ========================================================================= */}
              <div 
                ref={printContentRef}
                id="printable-laporan-resmi-atk"
                className={`p-6 sm:p-10 overflow-y-auto space-y-6 text-xs bg-white text-slate-900 border-t ${
                  printColorMode === 'bw' ? 'grayscale' : ''
                }`}
              >
                
                {/* KOP SURAT RESMI PENGADILAN AGAMA */}
                <div className="text-center space-y-0.5 border-b-[3px] border-double border-slate-900 pb-3">
                  <div className="flex items-center justify-center space-x-3 mb-1">
                    <div className="w-10 h-10 rounded-full border-2 border-slate-900 flex items-center justify-center font-serif font-black text-lg">
                      ⚖️
                    </div>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-800 font-serif">
                    MAHKAMAH AGUNG REPUBLIK INDONESIA
                  </h4>
                  <h4 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-800 font-serif">
                    DIREKTORAT JENDERAL BADAN PERADILAN AGAMA
                  </h4>
                  <h4 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-800 font-serif">
                    {instansiTinggi}
                  </h4>
                  <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-slate-950 font-serif">
                    {namaPengadilan}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-600 font-sans">
                    {alamatPengadilan}
                  </p>
                </div>

                {/* -------------------------------------------------------------
                    KONTEN LAPORAN PERSDIAAN ATAU BUKU KAS
                    ------------------------------------------------------------- */}
                {reportType === 'rekap-persediaan' ? (
                  <>
                    {/* JUDUL LAPORAN REKAP PERSEDIAAN */}
                    <div className="text-center space-y-1 pt-1">
                      <h3 className="text-sm sm:text-base font-black tracking-wider uppercase underline underline-offset-4 text-slate-900">
                        REKAPITULASI PEMAKAIAN & PERSEDIAAN BARANG ATK PERKARA
                      </h3>
                      <p className={`text-xs font-bold uppercase font-mono ${
                        printColorMode === 'color' ? 'text-purple-700' : 'text-slate-900'
                      }`}>
                        PERIODE : {periodeTeks} {filterPerkaraLabel}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Kalkulasi Akumulasi Volume & Nilai Pengeluaran Barang Persediaan Habis Pakai Perkara Peradilan
                      </p>
                    </div>

                    {/* RINGKASAN PERSDIAAN */}
                    <div className={`grid grid-cols-1 md:grid-cols-4 gap-3 border p-3 rounded-lg text-xs ${
                      printColorMode === 'color' ? 'border-purple-200 bg-purple-50/40' : 'border-slate-300 bg-slate-50'
                    }`}>
                      <div className="border-r-0 md:border-r border-slate-300 pr-2">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Jenis Barang</span>
                        <strong className={`text-sm font-black font-mono block mt-0.5 ${
                          printColorMode === 'color' ? 'text-purple-700' : 'text-slate-900'
                        }`}>
                          {inventorySummary.totalJenisBarang} Macam Barang
                        </strong>
                        <span className="text-[9px] text-slate-500">Barang habis pakai kepaniteraan</span>
                      </div>
                      <div className="border-r-0 md:border-r border-slate-300 pr-2">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Kuantitas Fisik</span>
                        <strong className={`text-sm font-black font-mono block mt-0.5 ${
                          printColorMode === 'color' ? 'text-sky-700' : 'text-slate-900'
                        }`}>
                          {inventorySummary.totalKuantitasSemua} Unit/Satuan
                        </strong>
                        <span className="text-[9px] text-slate-500">Akumulasi volume barang terpakai</span>
                      </div>
                      <div className="border-r-0 md:border-r border-slate-300 pr-2">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Nilai Pemakaian</span>
                        <strong className={`text-sm font-black font-mono block mt-0.5 ${
                          printColorMode === 'color' ? 'text-rose-700' : 'text-slate-900'
                        }`}>
                          {formatRp(inventorySummary.totalNominal)}
                        </strong>
                        <span className="text-[9px] text-slate-500">Total rupiah barang dikeluarkan</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">Cakupan Perkara</span>
                        <strong className={`text-xs font-black font-mono block mt-0.5 ${
                          printColorMode === 'color' ? 'text-emerald-700' : 'text-slate-900'
                        }`}>
                          {filterNomorPerkara !== 'all' ? filterNomorPerkara : 'Semua Perkara'}
                        </strong>
                        <span className="text-[9px] text-slate-500">Tersinkron di Spreadsheet</span>
                      </div>
                    </div>

                    {/* TABEL REKAP PERSDIAAN */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 font-bold border-b border-slate-300 text-center text-slate-800">
                            <th className="p-1.5 border-r border-slate-300 w-10">NO</th>
                            <th className="p-1.5 border-r border-slate-300 w-24">KODE</th>
                            <th className="p-1.5 border-r border-slate-300">NAMA BARANG PERSEDIAAN ATK</th>
                            <th className="p-1.5 border-r border-slate-300 w-20">KATEGORI</th>
                            <th className="p-1.5 border-r border-slate-300 w-16 text-center">SATUAN</th>
                            <th className="p-1.5 border-r border-slate-300 text-right w-24">HARGA (RP)</th>
                            <th className="p-1.5 border-r border-slate-300 text-center w-28">VOLUME DIGUNAKAN</th>
                            <th className="p-1.5 border-r border-slate-300 text-right w-28">TOTAL NILAI (RP)</th>
                            <th className="p-1.5 text-center w-36">PERUNTUKAN PERKARA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {inventorySummary.items.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-6 text-center text-slate-400 italic">
                                Tidak ada data pemakaian barang persediaan ATK pada periode yang dipilih.
                              </td>
                            </tr>
                          ) : (
                            inventorySummary.items.map((it, idx) => {
                              const perkaraList = it.daftarPerkara.map(p => p.nomorPerkara).filter((v, i, a) => a.indexOf(v) === i);
                              const perkaraDisplay = perkaraList.length <= 2 
                                ? perkaraList.join(', ') 
                                : `${perkaraList.slice(0, 2).join(', ')} (+${perkaraList.length - 2} perkara)`;

                              return (
                                <tr key={it.id} className="hover:bg-slate-50">
                                  <td className="p-1.5 border-r border-slate-200 text-center font-bold text-slate-700">{idx + 1}</td>
                                  <td className="p-1.5 border-r border-slate-200 font-mono text-center font-bold text-slate-600">{it.kodeBarang}</td>
                                  <td className="p-1.5 border-r border-slate-200">
                                    <span className="font-bold block text-slate-900">{it.namaBarang}</span>
                                    <span className="text-[10px] text-slate-500 block">{it.keterangan}</span>
                                  </td>
                                  <td className="p-1.5 border-r border-slate-200 text-center font-semibold text-slate-700">{it.kategori}</td>
                                  <td className="p-1.5 border-r border-slate-200 text-center font-bold text-slate-800 bg-slate-50/50">{it.satuan}</td>
                                  <td className="p-1.5 border-r border-slate-200 text-right font-mono text-slate-700">{formatRp(it.hargaSatuan)}</td>
                                  <td className={`p-1.5 border-r border-slate-200 text-center font-mono font-black ${
                                    printColorMode === 'color' ? 'text-purple-700' : 'text-slate-900'
                                  }`}>
                                    {it.totalKuantitas} {it.satuan}
                                  </td>
                                  <td className={`p-1.5 border-r border-slate-200 text-right font-mono font-bold ${
                                    printColorMode === 'color' ? 'text-rose-700' : 'text-slate-900'
                                  }`}>
                                    {formatRp(it.totalNominal)}
                                  </td>
                                  <td className="p-1.5 text-center text-[10px] text-slate-600">
                                    <span className="font-semibold block">{perkaraDisplay}</span>
                                    <span className="text-[9px] text-slate-400">({it.frekuensiDipakai}x pemakaian)</span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-xs text-slate-900">
                            <td colSpan={6} className="p-2 border-r border-slate-300 text-center font-black uppercase tracking-wider">
                              JUMLAH TOTAL NILAI PEMAKAIAN PERSEDIAAN
                            </td>
                            <td className={`p-2 border-r border-slate-300 text-center font-mono font-black ${
                              printColorMode === 'color' ? 'text-purple-700' : 'text-slate-900'
                            }`}>
                              {inventorySummary.totalKuantitasSemua}
                            </td>
                            <td className={`p-2 border-r border-slate-300 text-right font-mono font-black ${
                              printColorMode === 'color' ? 'text-rose-700' : 'text-slate-900'
                            }`}>
                              {formatRp(inventorySummary.totalNominal)}
                            </td>
                            <td className="p-2 text-center text-[10px] font-bold text-slate-500">
                              BALANCE
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    {/* JUDUL LAPORAN RESMI BUKU KAS */}
                    <div className="text-center space-y-1 pt-1">
                      <h3 className="text-sm sm:text-base font-black tracking-wider uppercase underline underline-offset-4 text-slate-900">
                        BUKU PEMBANTU BIAYA PROSES / ATK PERKARA
                      </h3>
                      <p className={`text-xs font-bold uppercase font-mono ${
                        printColorMode === 'color' ? 'text-purple-700' : 'text-slate-900'
                      }`}>
                        PERIODE : {periodeTeks} {filterPerkaraLabel}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Berdasarkan Ketentuan Pengelolaan Panjar Biaya Perkara & Penyelesaian Saldo Perkara Putus Rp 0
                      </p>
                    </div>

                    {/* RINGKASAN FINANSIAL RESMI (A, B, C, D) DENGAN WARNA SISTEM */}
                    <div className={`grid grid-cols-1 md:grid-cols-4 gap-3 border p-3 rounded-lg text-xs ${
                      printColorMode === 'color' 
                        ? 'border-purple-200 bg-purple-50/40' 
                        : 'border-slate-300 bg-slate-50'
                    }`}>
                      <div className="border-r-0 md:border-r border-slate-300 pr-2">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          A. Total Penerimaan ATK
                        </span>
                        <strong className={`text-sm font-black font-mono block mt-0.5 ${
                          printColorMode === 'color' ? 'text-emerald-700' : 'text-slate-900'
                        }`}>
                          {formatRp(totalPenerimaan)}
                        </strong>
                        <span className="text-[9px] text-slate-500">
                          Panjar pendaftaran perkara
                        </span>
                      </div>

                      <div className="border-r-0 md:border-r border-slate-300 pr-2">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          B. Total Pengeluaran ATK
                        </span>
                        <strong className={`text-sm font-black font-mono block mt-0.5 ${
                          printColorMode === 'color' ? 'text-rose-700' : 'text-slate-900'
                        }`}>
                          {formatRp(totalPengeluaran)}
                        </strong>
                        <span className="text-[9px] text-slate-500">
                          Realisasi & simulasi ATK
                        </span>
                      </div>

                      <div className="border-r-0 md:border-r border-slate-300 pr-2">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          C. Sisa Saldo ATK Periode
                        </span>
                        <strong className={`text-sm font-black font-mono block mt-0.5 ${
                          printColorMode === 'color' ? 'text-purple-700' : 'text-slate-900'
                        }`}>
                          {formatRp(saldoAkhir)}
                        </strong>
                        <span className="text-[9px] text-slate-500">
                          Sisa kas ATK kantor berjalan
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          D. Status Saldo Putus Rp 0
                        </span>
                        <strong className={`text-xs font-black font-mono block mt-0.5 ${
                          printColorMode === 'color' ? 'text-emerald-700' : 'text-slate-900'
                        }`}>
                          Tuntas Sesuai Aturan
                        </strong>
                        <span className="text-[9px] text-slate-500">
                          Tersimpan di Sheet
                        </span>
                      </div>
                    </div>

                    {/* REKAP RINCIAN PENGELUARAN PER KATEGORI ATK */}
                    <div className="border border-slate-300 rounded-lg overflow-hidden">
                      <div className="bg-slate-100 px-3 py-1.5 font-bold text-[11px] border-b border-slate-300 flex justify-between items-center text-slate-800">
                        <span>REKAPITULASI PENGELUARAN PER KELOMPOK ATK (STANDAR MAHKAMAH AGUNG RI)</span>
                        <span className="text-[10px] font-mono">Total Item: {countSimulasi}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-slate-200 text-[11px] p-2 bg-white">
                        {(Object.entries(categoryBreakdown) as [string, { total: number; count: number }][]).map(([cat, data]) => (
                          <div key={cat} className="p-2 text-center">
                            <span className="text-[10px] font-bold text-slate-500 block">{cat}</span>
                            <strong className="font-mono font-bold text-slate-800 block">
                              {formatRp(data.total)}
                            </strong>
                            <span className="text-[9px] text-slate-400">{data.count} transaksi</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* TABEL BUKU BESAR PEMBANTU KAS ATK PERKARA */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 font-bold border-b border-slate-300 text-center text-slate-800">
                            <th className="p-1.5 border-r border-slate-300 w-10">NO</th>
                            <th className="p-1.5 border-r border-slate-300 w-24">TANGGAL</th>
                            <th className="p-1.5 border-r border-slate-300 w-36">NOMOR PERKARA</th>
                            <th className="p-1.5 border-r border-slate-300">URAIAN PENGELUARAN / JENIS ATK</th>
                            <th className="p-1.5 border-r border-slate-300 text-right w-28">PENERIMAAN (DEBET)</th>
                            <th className="p-1.5 border-r border-slate-300 text-right w-28">PENGELUARAN (KREDIT)</th>
                            <th className="p-1.5 text-right w-28">SALDO</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {ledgerWithBalance.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                                Tidak ada data transaksi ATK pada periode yang dipilih ({periodeTeks}).
                              </td>
                            </tr>
                          ) : (
                            ledgerWithBalance.map((row) => (
                              <tr key={row.id} className="hover:bg-slate-50">
                                <td className="p-1.5 border-r border-slate-200 text-center font-bold text-slate-700">
                                  {row.no}
                                </td>
                                <td className="p-1.5 border-r border-slate-200 font-mono whitespace-nowrap text-center text-slate-700">
                                  {row.tanggal}
                                </td>
                                <td className="p-1.5 border-r border-slate-200 font-mono font-bold whitespace-nowrap text-slate-900">
                                  {row.nomorPerkara}
                                </td>
                                <td className="p-1.5 border-r border-slate-200">
                                  <span className="font-semibold block text-slate-900">{row.uraian}</span>
                                  <span className="text-[10px] text-slate-500 block">
                                    Pihak: {row.namaPihak} • Kat: {row.kategori}
                                  </span>
                                </td>
                                <td className={`p-1.5 border-r border-slate-200 text-right font-mono font-bold ${
                                  printColorMode === 'color' ? 'text-emerald-700' : 'text-slate-900'
                                }`}>
                                  {row.penerimaan > 0 ? formatRp(row.penerimaan) : '-'}
                                </td>
                                <td className={`p-1.5 border-r border-slate-200 text-right font-mono font-bold ${
                                  printColorMode === 'color' ? 'text-rose-700' : 'text-slate-900'
                                }`}>
                                  {row.pengeluaran > 0 ? formatRp(row.pengeluaran) : '-'}
                                </td>
                                <td className={`p-1.5 text-right font-mono font-black ${
                                  printColorMode === 'color' ? 'text-purple-800' : 'text-slate-900'
                                }`}>
                                  {formatRp(row.saldo)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-xs text-slate-900">
                            <td colSpan={4} className="p-2 border-r border-slate-300 text-center font-black uppercase tracking-wider">
                              JUMLAH TOTAL PERIODE INI
                            </td>
                            <td className={`p-2 border-r border-slate-300 text-right font-mono font-black ${
                              printColorMode === 'color' ? 'text-emerald-700' : 'text-slate-900'
                            }`}>
                              {formatRp(totalPenerimaan)}
                            </td>
                            <td className={`p-2 border-r border-slate-300 text-right font-mono font-black ${
                              printColorMode === 'color' ? 'text-rose-700' : 'text-slate-900'
                            }`}>
                              {formatRp(totalPengeluaran)}
                            </td>
                            <td className={`p-2 text-right font-mono font-black ${
                              printColorMode === 'color' ? 'text-purple-800' : 'text-slate-900'
                            }`}>
                              {formatRp(saldoAkhir)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}

                {/* LEMBAR PENGESAHAN TANDA TANGAN RESMI KEPANITERAAN */}
                <div className="pt-6 border-t border-slate-300 break-inside-avoid">
                  <div className="text-right text-xs font-semibold mb-6 pr-4">
                    {kotaTanggal}
                  </div>

                  {ttdLayout === '3_kolom' ? (
                    <div className="grid grid-cols-3 gap-4 text-center text-xs">
                      <div className="space-y-16">
                        <div>
                          <p className="font-semibold text-slate-700">Mengetahui,</p>
                          <p className="font-black text-slate-900">Ketua Pengadilan Agama Paniai</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-black text-slate-900 underline underline-offset-2">
                            {ketuaNama}
                          </p>
                          <p className="text-[10px] font-mono text-slate-600">
                            {ketuaNip}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-16">
                        <div>
                          <p className="font-semibold text-slate-700">Memeriksa,</p>
                          <p className="font-black text-slate-900">Panitera Pengadilan Agama Paniai</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-black text-slate-900 underline underline-offset-2">
                            {paniteraNama}
                          </p>
                          <p className="text-[10px] font-mono text-slate-600">
                            {paniteraNip}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-16">
                        <div>
                          <p className="font-semibold text-slate-700">Dibuat Oleh,</p>
                          <p className="font-black text-slate-900">Kasir / Pengelola Persediaan ATK</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-black text-slate-900 underline underline-offset-2">
                            {kasirNama}
                          </p>
                          <p className="text-[10px] font-mono text-slate-600">
                            {kasirNip}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : ttdLayout === '2_kolom' ? (
                    <div className="grid grid-cols-2 gap-8 text-center text-xs">
                      <div className="space-y-16">
                        <div>
                          <p className="font-semibold text-slate-700">Mengetahui / Memeriksa,</p>
                          <p className="font-black text-slate-900">Panitera Pengadilan Agama Paniai</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-black text-slate-900 underline underline-offset-2">
                            {paniteraNama}
                          </p>
                          <p className="text-[10px] font-mono text-slate-600">
                            {paniteraNip}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-16">
                        <div>
                          <p className="font-semibold text-slate-700">Dibuat Oleh,</p>
                          <p className="font-black text-slate-900">Kasir / Pengelola Persediaan ATK</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-black text-slate-900 underline underline-offset-2">
                            {kasirNama}
                          </p>
                          <p className="text-[10px] font-mono text-slate-600">
                            {kasirNip}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end text-center text-xs pr-4">
                      <div className="w-72 space-y-16">
                        <div>
                          <p className="font-semibold text-slate-700">Dibuat Oleh,</p>
                          <p className="font-black text-slate-900">Kasir / Pengelola Persediaan ATK</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-black text-slate-900 underline underline-offset-2">
                            {kasirNama}
                          </p>
                          <p className="text-[10px] font-mono text-slate-600">
                            {kasirNip}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400">
                    <span>Dokumen ini dicetak resmi melalui Sistem Manajemen Perkara • Tersinkronisasi Tab SimulasiAtkPerkara Google Spreadsheet</span>
                    <span>Format Resmi Pengadilan Agama</span>
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
