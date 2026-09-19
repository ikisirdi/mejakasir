import React, { useState, useMemo, useRef } from 'react';
import { BiayaProsesRecord, CaseRecord, JurnalBiayaSkumRecord } from '../types';
import { terbilang } from '../utils/terbilang';
import { 
  Printer, 
  X, 
  ExternalLink, 
  FileText, 
  BookOpen, 
  Calendar, 
  Palette, 
  Maximize2, 
  Check, 
  Settings2,
  ChevronDown
} from 'lucide-react';
import { MONTH_NAMES } from './BukuBiayaProses';

interface CetakBukuBiayaModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'rekap-bulanan' | 'jurnal-biaya';
  records: BiayaProsesRecord[];
  cases: CaseRecord[];
  jurnalSkumRecords?: JurnalBiayaSkumRecord[];
  selectedMonthDefault?: string;
  selectedYearDefault?: string;
  theme?: 'light' | 'dark';
}

export const CetakBukuBiayaModal: React.FC<CetakBukuBiayaModalProps> = ({
  isOpen,
  onClose,
  initialType = 'rekap-bulanan',
  records,
  cases,
  jurnalSkumRecords = [],
  selectedMonthDefault = 'ALL',
  selectedYearDefault = '2026',
  theme = 'light'
}) => {
  if (!isOpen) return null;

  const isDark = theme === 'dark';

  // Laporan type: Rekap Bulanan Buku Bantu vs Tabel Jurnal Biaya SKUM
  const [reportType, setReportType] = useState<'rekap-bulanan' | 'jurnal-biaya'>(initialType);

  // Periode Filter
  const [selectedMonth, setSelectedMonth] = useState<string>(selectedMonthDefault);
  const [selectedYear, setSelectedYear] = useState<string>(selectedYearDefault);

  // Print Setup Options
  const [paperOrientation, setPaperOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [paperSize, setPaperSize] = useState<'A4' | 'F4'>('A4');
  const [isColor, setIsColor] = useState<boolean>(true);
  const [includeBlankRows, setIncludeBlankRows] = useState<boolean>(true);
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);

  // Official Signers Info
  const [paniteraNama, setPaniteraNama] = useState<string>('ACHMAD HABIBUL ALIM MAPPIASSE, S.H.I., M.H.');
  const [paniteraNip, setPaniteraNip] = useState<string>('199210182019031003');
  const [petugasNama, setPetugasNama] = useState<string>('IDRIS AL BASYIR, A.Md.');
  const [petugasNip, setPetugasNip] = useState<string>('199601112025061004');
  const [petugasJabatan, setPetugasJabatan] = useState<string>('Petugas Biaya Proses / Kasir');

  // Institution Details
  const namaInstansiTinggi = 'PENGADILAN TINGGI AGAMA JAYAPURA';
  const namaPengadilan = 'PENGADILAN AGAMA PANIAI';
  const alamatPengadilan = 'Jl. Raya Enarotali - Madi, Distrik Paniai Timur, Kab. Paniai - Papua Tengah 98912';

  // Current Date String for Document
  const documentDateStr = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const monthName = selectedMonth !== 'ALL' ? selectedMonth : MONTH_NAMES[now.getMonth()];
    return `Paniai, ${day} ${monthName} ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  // Filtered Records based on Month & Year
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      if (!record.tanggal) return false;
      const recYear = record.tanggal.substring(0, 4);
      if (selectedYear !== 'ALL' && recYear !== selectedYear) return false;

      if (selectedMonth !== 'ALL') {
        const monthNum = parseInt(record.tanggal.substring(5, 7), 10);
        const monthIdx = monthNum - 1;
        if (MONTH_NAMES[monthIdx] !== selectedMonth) return false;
      }
      return true;
    }).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [records, selectedMonth, selectedYear]);

  // Financial Calculations
  const totalPenerimaan = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (r.penerimaan || 0), 0);
  }, [filteredRecords]);

  const totalPengeluaran = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (r.pengeluaran || 0), 0);
  }, [filteredRecords]);

  const saldoKas = useMemo(() => {
    return totalPenerimaan - totalPengeluaran;
  }, [totalPenerimaan, totalPengeluaran]);

  // Format Helper
  const formatRp = (val: number) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`;
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  // Printable Rows with optional empty padding rows for clean court register look
  const tableRows = useMemo(() => {
    const rows = [...filteredRecords];
    const minRows = includeBlankRows ? (paperOrientation === 'landscape' ? 10 : 14) : rows.length;
    const missing = minRows - rows.length;
    return {
      actualRows: rows,
      emptyRowsCount: missing > 0 ? missing : 0
    };
  }, [filteredRecords, includeBlankRows, paperOrientation]);

  // Generate Isolated Clean HTML for Iframe Printing & New Tab Export
  const generateCleanPrintHtml = (): string => {
    const isLandscape = paperOrientation === 'landscape';
    const paperDimensions = paperSize === 'A4' 
      ? (isLandscape ? '297mm 210mm' : '210mm 297mm')
      : (isLandscape ? '330mm 215mm' : '215mm 330mm');

    const emeraldGreen = isColor ? '#065f46' : '#000000';
    const primaryBorder = isColor ? '#047857' : '#000000';
    const headerBg = isColor ? '#f0fdf4' : '#f8fafc';
    const tableHeaderBg = isColor ? '#ecfdf5' : '#f1f5f9';
    const badgeBg = isColor ? '#d1fae5' : '#e2e8f0';

    const docTitle = reportType === 'rekap-bulanan' 
      ? 'BUKU BANTU BIAYA PROSES PERKARA'
      : 'TABEL BUKU JURNAL BIAYA SKUM PERKARA';

    const periodeText = selectedMonth === 'ALL' 
      ? `TAHUN ANGGARAN ${selectedYear}`
      : `BULAN ${selectedMonth} TAHUN ${selectedYear}`;

    // Table Content based on Report Type
    let tableHeaderHtml = '';
    let tableBodyHtml = '';
    let tableFooterHtml = '';

    if (reportType === 'rekap-bulanan') {
      tableHeaderHtml = `
        <thead>
          <tr style="background-color: ${tableHeaderBg}; border-bottom: 1.5px solid #000;">
            <th rowspan="2" style="border: 1px solid #000; padding: 6px 4px; width: 35px; text-align: center;">NO</th>
            <th rowspan="2" style="border: 1px solid #000; padding: 6px 6px; width: 85px; text-align: center;">TANGGAL</th>
            <th rowspan="2" style="border: 1px solid #000; padding: 6px 6px; width: 140px; text-align: center;">NOMOR PERKARA</th>
            <th rowspan="2" style="border: 1px solid #000; padding: 6px 8px; text-align: left;">URAIAN TRANSAKSI</th>
            <th colspan="2" style="border: 1px solid #000; padding: 5px 6px; text-align: center;">JUMLAH BIAYA (RP)</th>
            <th rowspan="2" style="border: 1px solid #000; padding: 6px 6px; width: 110px; text-align: center;">KETERANGAN</th>
          </tr>
          <tr style="background-color: ${tableHeaderBg}; border-bottom: 1.5px solid #000;">
            <th style="border: 1px solid #000; padding: 5px 6px; width: 115px; text-align: right;">PENERIMAAN</th>
            <th style="border: 1px solid #000; padding: 5px 6px; width: 115px; text-align: right;">PENGELUARAN</th>
          </tr>
          <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #000; font-size: 8.5pt; font-weight: bold; text-align: center;">
            <td style="border: 1px solid #000; padding: 2px;">1</td>
            <td style="border: 1px solid #000; padding: 2px;">2</td>
            <td style="border: 1px solid #000; padding: 2px;">3</td>
            <td style="border: 1px solid #000; padding: 2px;">4</td>
            <td style="border: 1px solid #000; padding: 2px;">5</td>
            <td style="border: 1px solid #000; padding: 2px;">6</td>
            <td style="border: 1px solid #000; padding: 2px;">7</td>
          </tr>
        </thead>
      `;

      const rowsHtml = tableRows.actualRows.map((r, i) => `
        <tr style="border-bottom: 1px solid #000;">
          <td style="border: 1px solid #000; padding: 5px 4px; text-align: center; font-weight: bold;">${i + 1}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; text-align: center; font-family: 'Courier New', Courier, monospace;">${formatShortDate(r.tanggal)}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; text-align: left; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${r.nomorPerkara}</td>
          <td style="border: 1px solid #000; padding: 5px 8px; text-align: left;">${r.uraian}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; text-align: right; font-family: 'Courier New', Courier, monospace;">${r.penerimaan > 0 ? r.penerimaan.toLocaleString('id-ID') : '-'}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; text-align: right; font-family: 'Courier New', Courier, monospace;">${r.pengeluaran > 0 ? r.pengeluaran.toLocaleString('id-ID') : '-'}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; text-align: left; font-size: 8.5pt;">${r.keterangan || '-'}</td>
        </tr>
      `).join('');

      let emptyRowsHtml = '';
      for (let idx = 0; idx < tableRows.emptyRowsCount; idx++) {
        const rowNum = tableRows.actualRows.length + idx + 1;
        emptyRowsHtml += `
          <tr style="border-bottom: 1px solid #000; height: 26px;">
            <td style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold;">${rowNum}</td>
            <td style="border: 1px solid #000; padding: 4px;"></td>
            <td style="border: 1px solid #000; padding: 4px;"></td>
            <td style="border: 1px solid #000; padding: 4px;"></td>
            <td style="border: 1px solid #000; padding: 4px;"></td>
            <td style="border: 1px solid #000; padding: 4px;"></td>
            <td style="border: 1px solid #000; padding: 4px;"></td>
          </tr>
        `;
      }

      tableBodyHtml = `<tbody>${rowsHtml}${emptyRowsHtml}</tbody>`;

      tableFooterHtml = `
        <tfoot>
          <tr style="background-color: ${tableHeaderBg}; border-top: 2px solid #000; font-weight: bold;">
            <td colspan="4" style="border: 1px solid #000; padding: 6px 8px; text-align: right; font-weight: 800;">JUMLAH TOTAL :</td>
            <td style="border: 1px solid #000; padding: 6px 6px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${formatRp(totalPenerimaan)}</td>
            <td style="border: 1px solid #000; padding: 6px 6px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${formatRp(totalPengeluaran)}</td>
            <td style="border: 1px solid #000; padding: 6px;"></td>
          </tr>
          <tr style="background-color: ${badgeBg}; border-top: 1.5px solid #000; font-weight: bold;">
            <td colspan="4" style="border: 1px solid #000; padding: 6px 8px; text-align: right; font-weight: 800;">SISA SALDO KAS BUKU BANTU :</td>
            <td colspan="3" style="border: 1px solid #000; padding: 6px 8px; text-align: center; font-family: 'Courier New', Courier, monospace; font-size: 11pt; font-weight: 900; color: ${emeraldGreen};">
              ${formatRp(saldoKas)}
            </td>
          </tr>
        </tfoot>
      `;
    } else {
      // TABEL BUKU JURNAL BIAYA SKUM PERKARA
      tableHeaderHtml = `
        <thead>
          <tr style="background-color: ${tableHeaderBg}; border-bottom: 1.5px solid #000;">
            <th style="border: 1px solid #000; padding: 6px 4px; width: 35px; text-align: center;">NO</th>
            <th style="border: 1px solid #000; padding: 6px 6px; width: 85px; text-align: center;">TANGGAL</th>
            <th style="border: 1px solid #000; padding: 6px 6px; width: 140px; text-align: center;">NOMOR PERKARA</th>
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: left;">URAIAN TRANSAKSI JURNAL SKUM</th>
            <th style="border: 1px solid #000; padding: 6px 6px; width: 85px; text-align: center;">KATEGORI</th>
            <th style="border: 1px solid #000; padding: 6px 6px; width: 125px; text-align: right;">DEBET (PENERIMAAN)</th>
            <th style="border: 1px solid #000; padding: 6px 6px; width: 125px; text-align: right;">KREDIT (PENGELUARAN)</th>
          </tr>
          <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #000; font-size: 8.5pt; font-weight: bold; text-align: center;">
            <td style="border: 1px solid #000; padding: 2px;">1</td>
            <td style="border: 1px solid #000; padding: 2px;">2</td>
            <td style="border: 1px solid #000; padding: 2px;">3</td>
            <td style="border: 1px solid #000; padding: 2px;">4</td>
            <td style="border: 1px solid #000; padding: 2px;">5</td>
            <td style="border: 1px solid #000; padding: 2px;">6</td>
            <td style="border: 1px solid #000; padding: 2px;">7</td>
          </tr>
        </thead>
      `;

      const rowsHtml = tableRows.actualRows.map((r, i) => `
        <tr style="border-bottom: 1px solid #000;">
          <td style="border: 1px solid #000; padding: 5px 4px; text-align: center; font-weight: bold;">${i + 1}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; text-align: center; font-family: 'Courier New', Courier, monospace;">${formatShortDate(r.tanggal)}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; text-align: left; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${r.nomorPerkara}</td>
          <td style="border: 1px solid #000; padding: 5px 8px; text-align: left;">${r.uraian}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; text-align: center; font-weight: 600; font-size: 8.5pt;">${r.kategori}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; text-align: right; font-family: 'Courier New', Courier, monospace;">${r.penerimaan > 0 ? r.penerimaan.toLocaleString('id-ID') : '-'}</td>
          <td style="border: 1px solid #000; padding: 5px 6px; text-align: right; font-family: 'Courier New', Courier, monospace;">${r.pengeluaran > 0 ? r.pengeluaran.toLocaleString('id-ID') : '-'}</td>
        </tr>
      `).join('');

      tableBodyHtml = `<tbody>${rowsHtml}</tbody>`;

      tableFooterHtml = `
        <tfoot>
          <tr style="background-color: ${tableHeaderBg}; border-top: 2px solid #000; font-weight: bold;">
            <td colspan="5" style="border: 1px solid #000; padding: 6px 8px; text-align: right; font-weight: 800;">TOTAL JURNAL SKUM :</td>
            <td style="border: 1px solid #000; padding: 6px 6px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${formatRp(totalPenerimaan)}</td>
            <td style="border: 1px solid #000; padding: 6px 6px; text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold;">${formatRp(totalPengeluaran)}</td>
          </tr>
          <tr style="background-color: ${badgeBg}; border-top: 1.5px solid #000; font-weight: bold;">
            <td colspan="5" style="border: 1px solid #000; padding: 6px 8px; text-align: right; font-weight: 800;">SELISIH DEBET / KREDIT :</td>
            <td colspan="2" style="border: 1px solid #000; padding: 6px 8px; text-align: center; font-family: 'Courier New', Courier, monospace; font-size: 11pt; font-weight: 900; color: ${emeraldGreen};">
              ${formatRp(saldoKas)}
            </td>
          </tr>
        </tfoot>
      `;
    }

    const terbilangText = terbilang(Math.abs(saldoKas));

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${docTitle} - ${namaPengadilan}</title>
  <style>
    @page {
      size: ${paperDimensions};
      margin: 10mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 9.5pt;
      line-height: 1.35;
      color: #000000;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* KOP SURAT MAHKAMAH AGUNG */
    .kop-wrapper {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 3px double #000000;
      position: relative;
    }
    .kop-logo {
      display: inline-block;
      margin-bottom: 4px;
    }
    .kop-line-1 {
      font-size: 11pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin: 0;
      text-transform: uppercase;
    }
    .kop-line-2 {
      font-size: 10pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin: 1px 0;
      text-transform: uppercase;
    }
    .kop-line-3 {
      font-size: 10.5pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin: 1px 0;
      text-transform: uppercase;
    }
    .kop-line-4 {
      font-size: 14pt;
      font-weight: 900;
      letter-spacing: 1px;
      margin: 2px 0;
      text-transform: uppercase;
      color: ${emeraldGreen};
    }
    .kop-address {
      font-size: 8.5pt;
      font-style: italic;
      color: #1e293b;
      margin-top: 2px;
    }

    /* JUDUL DOKUMEN */
    .doc-header {
      text-align: center;
      margin: 14px 0 12px 0;
    }
    .doc-title {
      font-size: 13pt;
      font-weight: 900;
      text-decoration: underline;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin: 0;
    }
    .doc-subtitle {
      font-size: 10pt;
      font-weight: bold;
      margin-top: 3px;
      letter-spacing: 0.5px;
    }

    /* RINGKASAN STATUS KAS */
    .summary-strip {
      display: flex;
      justify-content: space-between;
      border: 1px solid #000000;
      background-color: ${headerBg};
      padding: 6px 12px;
      margin-bottom: 12px;
      font-size: 9pt;
    }
    .summary-item {
      display: flex;
      gap: 6px;
    }
    .summary-label {
      font-weight: bold;
    }
    .summary-val {
      font-family: 'Courier New', Courier, monospace;
      font-weight: bold;
    }

    /* TABEL REGISTER */
    table.official-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000000;
      font-size: 9pt;
      margin-bottom: 14px;
      page-break-inside: auto;
    }
    table.official-table tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    table.official-table th {
      font-weight: bold;
      text-transform: uppercase;
    }

    /* TERBILANG PENUTUPAN BUKU */
    .closing-statement {
      margin: 12px 0 16px 0;
      padding: 8px 12px;
      border: 1px dashed #000000;
      background-color: #fafafa;
      font-size: 9pt;
      line-height: 1.5;
    }

    /* LEMBAR TANDA TANGAN */
    .signature-container {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
      font-size: 9.5pt;
    }
    .sign-block {
      width: 320px;
      text-align: center;
    }
    .sign-space {
      height: 65px;
    }
    .sign-name {
      font-weight: bold;
      text-decoration: underline;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sign-nip {
      font-size: 9pt;
      margin-top: 2px;
    }

    /* FOOTER HALAMAN */
    .doc-footer {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      font-style: italic;
      color: #64748b;
      border-top: 1px solid #cbd5e1;
      padding-top: 4px;
    }
  </style>
</head>
<body>

  <!-- KOP SURAT RESMI -->
  <div class="kop-wrapper">
    <div class="kop-line-1">MAHKAMAH AGUNG REPUBLIK INDONESIA</div>
    <div class="kop-line-2">DIREKTORAT JENDERAL BADAN PERADILAN AGAMA</div>
    <div class="kop-line-3">${namaInstansiTinggi}</div>
    <div class="kop-line-4">${namaPengadilan}</div>
    <div class="kop-address">${alamatPengadilan}</div>
  </div>

  <!-- JUDUL DOKUMEN -->
  <div class="doc-header">
    <h1 class="doc-title">${docTitle}</h1>
    <div class="doc-subtitle">${periodeText}</div>
  </div>

  <!-- RINGKASAN STATUS KAS -->
  <div class="summary-strip">
    <div class="summary-item">
      <span class="summary-label">Total Transaksi:</span>
      <span class="summary-val">${filteredRecords.length} Log</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Penerimaan:</span>
      <span class="summary-val">${formatRp(totalPenerimaan)}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Pengeluaran:</span>
      <span class="summary-val">${formatRp(totalPengeluaran)}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Saldo Kas:</span>
      <span class="summary-val" style="color: ${emeraldGreen}; font-size: 10pt;">${formatRp(saldoKas)}</span>
    </div>
  </div>

  <!-- TABEL REGISTER -->
  <table class="official-table">
    ${tableHeaderHtml}
    ${tableBodyHtml}
    ${tableFooterHtml}
  </table>

  <!-- TEKS TERBILANG PENUTUPAN REGISTER -->
  <div class="closing-statement">
    Pada hari ini <strong>${documentDateStr}</strong>, 
    <em>${docTitle}</em> ditutup dengan sisa saldo kas tercatat sebesar 
    <strong>${formatRp(saldoKas)}</strong> 
    (<em>${terbilangText} Rupiah</em>).
  </div>

  <!-- LEMBAR TANDA TANGAN -->
  <div class="signature-container">
    <!-- Kiri: Panitera -->
    <div class="sign-block">
      <div>Mengetahui,</div>
      <div style="font-weight: bold;">Panitera</div>
      <div class="sign-space"></div>
      <div class="sign-name">${paniteraNama}</div>
      <div class="sign-nip">NIP. ${paniteraNip}</div>
    </div>

    <!-- Kanan: Petugas Biaya Proses / Kasir -->
    <div class="sign-block">
      <div>${documentDateStr}</div>
      <div style="font-weight: bold;">${petugasJabatan}</div>
      <div class="sign-space"></div>
      <div class="sign-name">${petugasNama}</div>
      <div class="sign-nip">NIP. ${petugasNip}</div>
    </div>
  </div>

  <!-- FOOTER DOKUMEN -->
  <div class="doc-footer">
    <span>Dicetak secara otomatis melalui SI-PERKARA Pengadilan Agama Paniai</span>
    <span>Tanggal Cetak: ${new Date().toLocaleString('id-ID')}</span>
  </div>

  <script>
    // Auto-focus window if needed
  </script>
</body>
</html>`;
  };

  // Execution: Clean Iframe Print (100% Matches Preview without UI artifacts)
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const handlePrint = () => {
    setIsPrinting(true);
    try {
      const fullHtml = generateCleanPrintHtml();

      // Create a hidden print iframe
      const existingIframe = document.getElementById('buku-biaya-print-iframe');
      if (existingIframe && document.body.contains(existingIframe)) {
        document.body.removeChild(existingIframe);
      }

      const printIframe = document.createElement('iframe');
      printIframe.id = 'buku-biaya-print-iframe';
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
        throw new Error('Gagal menyiapkan dokumen cetak');
      }

      frameDoc.open();
      frameDoc.write(fullHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print error, falling back to window.print():', e);
          window.print();
        } finally {
          setIsPrinting(false);
          setTimeout(() => {
            if (document.body.contains(printIframe)) {
              document.body.removeChild(printIframe);
            }
          }, 1500);
        }
      }, 350);

    } catch (err) {
      console.error('Error print buku biaya:', err);
      setIsPrinting(false);
      window.print();
    }
  };

  // Open Clean Document in New Tab
  const handleOpenNewTab = () => {
    const fullHtml = generateCleanPrintHtml();
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      alert('Pop-up terblokir oleh browser. Izinkan pop-up untuk mencetak dokumen dalam jendela baru.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-md overflow-hidden animate-fade-in">
      
      {/* TOP CONTROL BAR (Enterprise Judicial Toolbar) */}
      <div className={`shrink-0 px-4 sm:px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shadow-md ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Left: Document Identity & Switcher */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-sm sm:text-base tracking-tight">
                Pratinjau Dokumen Resmi
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                PA Paniai
              </span>
            </div>

            {/* Document Type Switcher Tabs */}
            <div className="flex items-center gap-1 mt-1">
              <button
                onClick={() => setReportType('rekap-bulanan')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  reportType === 'rekap-bulanan'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                1. Buku Bantu Biaya Proses (Rekap Bulanan)
              </button>
              <button
                onClick={() => setReportType('jurnal-biaya')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  reportType === 'jurnal-biaya'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                2. Tabel Jurnal Biaya SKUM Perkara
              </button>
            </div>
          </div>
        </div>

        {/* Center / Right: Print Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Filter Bulan */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 text-[11px] font-semibold hidden lg:inline">Bulan:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <option value="ALL">Semua Bulan (Tahunan)</option>
              {MONTH_NAMES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Paper Orientation Selector */}
          <div className="flex items-center rounded-lg border p-0.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700">
            <button
              onClick={() => setPaperOrientation('landscape')}
              className={`px-2 py-1 rounded-md transition-all ${
                paperOrientation === 'landscape'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Landscape / Mendatar (Disarankan untuk Register Buku Pembantu)"
            >
              Landscape
            </button>
            <button
              onClick={() => setPaperOrientation('portrait')}
              className={`px-2 py-1 rounded-md transition-all ${
                paperOrientation === 'portrait'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Portrait / Tegak"
            >
              Portrait
            </button>
          </div>

          {/* Paper Size Selector */}
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value as 'A4' | 'F4')}
            className={`px-2 py-1.5 rounded-lg border text-xs font-bold ${
              isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
            }`}
          >
            <option value="A4">A4 (210×297)</option>
            <option value="F4">F4 / Folio (215×330)</option>
          </select>

          {/* Color Mode Toggle */}
          <button
            onClick={() => setIsColor(!isColor)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all ${
              isColor 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' 
                : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
            title="Ganti Mode Warna: Hijau Resmi Mahkamah Agung vs Hitam Putih"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>{isColor ? 'Warna Resmi' : 'Hitam Putih'}</span>
          </button>

          {/* Settings / Pejabat Dropdown Toggle */}
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className={`p-1.5 rounded-lg border transition-all ${
              showConfigPanel
                ? 'bg-slate-200 dark:bg-slate-700 border-slate-400'
                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-white'
            }`}
            title="Pengaturan Nama & NIP Pejabat Penandatangan"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {/* Open in New Tab Button */}
          <button
            onClick={handleOpenNewTab}
            className={`p-1.5 rounded-lg border transition-all ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
            title="Buka Dokumen di Tab Baru Browser (Cetak Mandiri)"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Main Action: Cetak Dokumen Sekarang */}
          <button
            id="btn-cetak-dokumen-eksekusi"
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'Menyiapkan Cetak...' : 'Cetak Dokumen'}</span>
          </button>

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Tutup Pratinjau"
          >
            <X className="w-5 h-5" />
          </button>

        </div>
      </div>

      {/* OPTIONAL CONFIG PANEL: NAMA & NIP PEJABAT */}
      {showConfigPanel && (
        <div className={`shrink-0 px-6 py-3 border-b text-xs flex flex-wrap items-center gap-4 animate-fade-in ${
          isDark ? 'bg-slate-900/95 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Settings2 className="w-3.5 h-3.5" />
            <span>Pengesahan Tanda Tangan:</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Panitera:</span>
            <input
              type="text"
              value={paniteraNama}
              onChange={(e) => setPaniteraNama(e.target.value)}
              className="px-2 py-1 border rounded text-xs w-64 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
              placeholder="Nama Lengkap Panitera"
            />
            <input
              type="text"
              value={paniteraNip}
              onChange={(e) => setPaniteraNip(e.target.value)}
              className="px-2 py-1 border rounded text-xs w-44 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 font-mono"
              placeholder="NIP Panitera"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Petugas / Kasir:</span>
            <input
              type="text"
              value={petugasNama}
              onChange={(e) => setPetugasNama(e.target.value)}
              className="px-2 py-1 border rounded text-xs w-56 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
              placeholder="Nama Petugas"
            />
            <input
              type="text"
              value={petugasNip}
              onChange={(e) => setPetugasNip(e.target.value)}
              className="px-2 py-1 border rounded text-xs w-44 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 font-mono"
              placeholder="NIP Petugas"
            />
          </div>

          <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={includeBlankRows}
              onChange={(e) => setIncludeBlankRows(e.target.checked)}
              className="rounded border-slate-400 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Sertakan baris register kosong penyeimbang</span>
          </label>
        </div>
      )}

      {/* WORKSPACE PREVIEW CANVAS (Realistic Physical Paper Sheet Studio) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-950/90 custom-scrollbar">
        
        {/* PHYSICAL PAPER SHEET CONTAINER */}
        <div 
          className={`bg-white text-black shadow-2xl transition-all duration-300 font-serif leading-relaxed ${
            paperOrientation === 'landscape'
              ? 'w-full max-w-[1120px] p-8 sm:p-12'
              : 'w-full max-w-[850px] p-8 sm:p-14'
          }`}
          style={{ minHeight: '800px' }}
        >
          
          {/* 1. KOP SURAT MAHKAMAH AGUNG */}
          <div className="text-center pb-3 mb-4 border-b-[3px] border-double border-black">
            <div className="text-[11pt] font-bold tracking-wider uppercase">MAHKAMAH AGUNG REPUBLIK INDONESIA</div>
            <div className="text-[10pt] font-bold tracking-wide uppercase mt-0.5">DIREKTORAT JENDERAL BADAN PERADILAN AGAMA</div>
            <div className="text-[10.5pt] font-bold tracking-wide uppercase mt-0.5">{namaInstansiTinggi}</div>
            <div className={`text-[14pt] font-black tracking-widest uppercase mt-1 ${isColor ? 'text-emerald-800' : 'text-black'}`}>
              {namaPengadilan}
            </div>
            <div className="text-[8.5pt] italic text-slate-700 mt-0.5">
              {alamatPengadilan}
            </div>
          </div>

          {/* 2. JUDUL DOKUMEN */}
          <div className="text-center my-4">
            <h1 className="text-[13pt] font-black underline tracking-wide uppercase">
              {reportType === 'rekap-bulanan' 
                ? 'BUKU BANTU BIAYA PROSES PERKARA'
                : 'TABEL BUKU JURNAL BIAYA SKUM PERKARA'}
            </h1>
            <div className="text-[10pt] font-bold mt-1 tracking-wider uppercase">
              {selectedMonth === 'ALL' ? `TAHUN ANGGARAN ${selectedYear}` : `BULAN ${selectedMonth} TAHUN ${selectedYear}`}
            </div>
          </div>

          {/* 3. RINGKASAN STATUS KAS (EXECUTIVE BAR) */}
          <div className={`flex flex-wrap items-center justify-between border border-black px-4 py-2 mb-4 text-[9pt] ${
            isColor ? 'bg-emerald-50/60' : 'bg-slate-50'
          }`}>
            <div className="flex items-center gap-1.5">
              <span className="font-bold">Total Transaksi:</span>
              <span className="font-mono font-bold">{filteredRecords.length} Log</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold">Penerimaan:</span>
              <span className="font-mono font-bold text-emerald-700">{formatRp(totalPenerimaan)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold">Pengeluaran:</span>
              <span className="font-mono font-bold text-rose-700">{formatRp(totalPengeluaran)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold">Sisa Saldo Kas:</span>
              <span className={`font-mono font-black text-[10pt] ${isColor ? 'text-emerald-800' : 'text-black'}`}>
                {formatRp(saldoKas)}
              </span>
            </div>
          </div>

          {/* 4. TABEL REGISTER RESMI DITJEN BADILAG */}
          <div className="overflow-x-auto">
            {reportType === 'rekap-bulanan' ? (
              <table className="w-full text-[9pt] border-collapse border border-black">
                <thead>
                  <tr className={`border-b-2 border-black font-bold uppercase text-center ${
                    isColor ? 'bg-emerald-50/70' : 'bg-slate-100'
                  }`}>
                    <th rowSpan={2} className="border border-black p-2 w-10">NO</th>
                    <th rowSpan={2} className="border border-black p-2 w-24">TANGGAL</th>
                    <th rowSpan={2} className="border border-black p-2 w-36">NOMOR PERKARA</th>
                    <th rowSpan={2} className="border border-black p-2 text-left">URAIAN TRANSAKSI</th>
                    <th colSpan={2} className="border border-black p-1.5">JUMLAH BIAYA (RP)</th>
                    <th rowSpan={2} className="border border-black p-2 w-32">KETERANGAN</th>
                  </tr>
                  <tr className={`border-b-2 border-black font-bold uppercase text-center ${
                    isColor ? 'bg-emerald-50/70' : 'bg-slate-100'
                  }`}>
                    <th className="border border-black p-1.5 w-28 text-right">PENERIMAAN</th>
                    <th className="border border-black p-1.5 w-28 text-right">PENGELUARAN</th>
                  </tr>
                  <tr className="bg-slate-200 border-b border-black font-bold text-[8.5pt] text-center">
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
                  {tableRows.actualRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border border-black p-4 text-center italic text-slate-500">
                        Tidak ada catatan transaksi biaya proses untuk periode yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    tableRows.actualRows.map((r, i) => (
                      <tr key={r.id} className="border-b border-black hover:bg-slate-50">
                        <td className="border border-black py-1 px-1.5 text-center font-bold">{i + 1}</td>
                        <td className="border border-black py-1 px-1.5 text-center font-mono">{formatShortDate(r.tanggal)}</td>
                        <td className="border border-black py-1 px-2 font-mono font-bold text-left">{r.nomorPerkara}</td>
                        <td className="border border-black py-1 px-2 text-left leading-snug">{r.uraian}</td>
                        <td className="border border-black py-1 px-2 text-right font-mono">
                          {r.penerimaan > 0 ? r.penerimaan.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="border border-black py-1 px-2 text-right font-mono">
                          {r.pengeluaran > 0 ? r.pengeluaran.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="border border-black py-1 px-2 text-left text-[8.5pt]">{r.keterangan || '-'}</td>
                      </tr>
                    ))
                  )}

                  {/* Empty rows padding */}
                  {Array.from({ length: tableRows.emptyRowsCount }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="border-b border-black h-7">
                      <td className="border border-black py-1 px-1.5 text-center font-bold">{tableRows.actualRows.length + idx + 1}</td>
                      <td className="border border-black"></td>
                      <td className="border border-black"></td>
                      <td className="border border-black"></td>
                      <td className="border border-black"></td>
                      <td className="border border-black"></td>
                      <td className="border border-black"></td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className={`border-t-2 border-black font-bold text-[9.5pt] ${
                    isColor ? 'bg-emerald-50/70' : 'bg-slate-100'
                  }`}>
                    <td colSpan={4} className="border border-black p-2 text-right uppercase font-black">
                      JUMLAH TOTAL :
                    </td>
                    <td className="border border-black p-2 text-right font-mono font-bold text-emerald-800">
                      {formatRp(totalPenerimaan)}
                    </td>
                    <td className="border border-black p-2 text-right font-mono font-bold text-rose-800">
                      {formatRp(totalPengeluaran)}
                    </td>
                    <td className="border border-black p-2"></td>
                  </tr>
                  <tr className={`border-t border-black font-bold ${
                    isColor ? 'bg-emerald-100/70' : 'bg-slate-200'
                  }`}>
                    <td colSpan={4} className="border border-black p-2 text-right uppercase font-black">
                      SISA SALDO KAS BUKU BANTU :
                    </td>
                    <td colSpan={3} className={`border border-black p-2 text-center font-mono font-black text-[11pt] ${
                      isColor ? 'text-emerald-800' : 'text-black'
                    }`}>
                      {formatRp(saldoKas)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              // TABEL JURNAL BIAYA SKUM PERKARA
              <table className="w-full text-[9pt] border-collapse border border-black">
                <thead>
                  <tr className={`border-b-2 border-black font-bold uppercase text-center ${
                    isColor ? 'bg-emerald-50/70' : 'bg-slate-100'
                  }`}>
                    <th className="border border-black p-2 w-10">NO</th>
                    <th className="border border-black p-2 w-24">TANGGAL</th>
                    <th className="border border-black p-2 w-36">NOMOR PERKARA</th>
                    <th className="border border-black p-2 text-left">URAIAN TRANSAKSI JURNAL SKUM</th>
                    <th className="border border-black p-2 w-28">KATEGORI</th>
                    <th className="border border-black p-2 w-32 text-right">DEBET (PENERIMAAN)</th>
                    <th className="border border-black p-2 w-32 text-right">KREDIT (PENGELUARAN)</th>
                  </tr>
                  <tr className="bg-slate-200 border-b border-black font-bold text-[8.5pt] text-center">
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
                  {tableRows.actualRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border border-black p-4 text-center italic text-slate-500">
                        Tidak ada transaksi jurnal biaya untuk periode yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    tableRows.actualRows.map((r, i) => (
                      <tr key={r.id} className="border-b border-black hover:bg-slate-50">
                        <td className="border border-black py-1 px-1.5 text-center font-bold">{i + 1}</td>
                        <td className="border border-black py-1 px-1.5 text-center font-mono">{formatShortDate(r.tanggal)}</td>
                        <td className="border border-black py-1 px-2 font-mono font-bold text-left">{r.nomorPerkara}</td>
                        <td className="border border-black py-1 px-2 text-left leading-snug">{r.uraian}</td>
                        <td className="border border-black py-1 px-1 text-center font-bold text-[8.5pt]">{r.kategori}</td>
                        <td className="border border-black py-1 px-2 text-right font-mono">
                          {r.penerimaan > 0 ? r.penerimaan.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="border border-black py-1 px-2 text-right font-mono">
                          {r.pengeluaran > 0 ? r.pengeluaran.toLocaleString('id-ID') : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                <tfoot>
                  <tr className={`border-t-2 border-black font-bold text-[9.5pt] ${
                    isColor ? 'bg-emerald-50/70' : 'bg-slate-100'
                  }`}>
                    <td colSpan={5} className="border border-black p-2 text-right uppercase font-black">
                      TOTAL JURNAL SKUM :
                    </td>
                    <td className="border border-black p-2 text-right font-mono font-bold text-emerald-800">
                      {formatRp(totalPenerimaan)}
                    </td>
                    <td className="border border-black p-2 text-right font-mono font-bold text-rose-800">
                      {formatRp(totalPengeluaran)}
                    </td>
                  </tr>
                  <tr className={`border-t border-black font-bold ${
                    isColor ? 'bg-emerald-100/70' : 'bg-slate-200'
                  }`}>
                    <td colSpan={5} className="border border-black p-2 text-right uppercase font-black">
                      SELISIH DEBET / KREDIT :
                    </td>
                    <td colSpan={2} className={`border border-black p-2 text-center font-mono font-black text-[11pt] ${
                      isColor ? 'text-emerald-800' : 'text-black'
                    }`}>
                      {formatRp(saldoKas)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* 5. TEKS TERBILANG RESMI PENUTUPAN BUKU */}
          <div className="my-5 p-3 border border-dashed border-black bg-slate-50/80 text-[9pt] leading-relaxed">
            Pada hari ini <strong>{documentDateStr}</strong>, 
            <em>{reportType === 'rekap-bulanan' ? ' Buku Bantu Biaya Proses Perkara ' : ' Tabel Buku Jurnal Biaya SKUM '}</em> 
            ditutup dengan saldo kas tercatat sebesar <strong>{formatRp(saldoKas)}</strong> 
            (<em>{terbilang(Math.abs(saldoKas))} Rupiah</em>).
          </div>

          {/* 6. LEMBAR PENGESAHAN TANDA TANGAN RESMI */}
          <div className="mt-8 pt-2 grid grid-cols-2 text-[9.5pt] leading-relaxed">
            
            {/* Kiri: Mengetahui Panitera */}
            <div className="text-center w-72">
              <div>Mengetahui,</div>
              <div className="font-bold">Panitera</div>
              <div className="h-16"></div>
              <div className="font-bold underline uppercase tracking-wide">{paniteraNama}</div>
              <div className="text-[9pt]">NIP. {paniteraNip}</div>
            </div>

            {/* Kanan: Petugas Biaya Proses / Kasir */}
            <div className="text-center w-72 ml-auto">
              <div>{documentDateStr}</div>
              <div className="font-bold">{petugasJabatan}</div>
              <div className="h-16"></div>
              <div className="font-bold underline uppercase tracking-wide">{petugasNama}</div>
              <div className="text-[9pt]">NIP. {petugasNip}</div>
            </div>

          </div>

          {/* 7. DOKUMEN FOOTER */}
          <div className="mt-8 pt-3 border-t border-slate-300 flex items-center justify-between text-[8pt] text-slate-500 italic">
            <span>SI-PERKARA Pengadilan Agama Paniai (Klasifikasi Keuangan SKUM)</span>
            <span>Halaman 1 dari 1 (Dokumen Sah)</span>
          </div>

        </div>

      </div>

    </div>
  );
};
