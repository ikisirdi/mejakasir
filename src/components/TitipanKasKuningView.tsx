import React, { useState, useMemo } from 'react';
import { JurnalBiayaSkumRecord, CaseRecord } from '../types';
import { getEffectiveWarnaBaris, stripWarnaTag } from './JurnalBiayaSkumView';
import { terbilang } from '../utils/terbilang';
import {
  Receipt,
  Printer,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  Calendar,
  Wallet,
  FileText,
  Clock,
  ArrowRight,
  PlusCircle,
  X,
  Scale,
  Smartphone,
  Table
} from 'lucide-react';

interface TitipanKasKuningViewProps {
  records: JurnalBiayaSkumRecord[];
  cases: CaseRecord[];
  onUpdateRecord: (record: JurnalBiayaSkumRecord) => void;
  onAddRecord: (record: Omit<JurnalBiayaSkumRecord, 'id' | 'createdAt'>) => void;
  onNavigateToJurnal: () => void;
  theme?: 'light' | 'dark';
}

export const TitipanKasKuningView: React.FC<TitipanKasKuningViewProps> = ({
  records,
  cases,
  onUpdateRecord,
  onAddRecord,
  onNavigateToJurnal,
  theme = 'light'
}) => {
  const isLight = theme === 'light';

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBulan, setFilterBulan] = useState<string>('ALL');
  const [filterTahun, setFilterTahun] = useState<string>(new Date().getFullYear().toString());

  // View Mode: otomatis 'mobile' pada layar HP (< 768px), atau switchable 'table'
  const [viewMode, setViewMode] = useState<'mobile' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'mobile' : 'table';
    }
    return 'table';
  });

  // Modal Cetak Kuitansi
  const [selectedRecordForReceipt, setSelectedRecordForReceipt] = useState<JurnalBiayaSkumRecord | null>(null);
  const [receiptPihakCustom, setReceiptPihakCustom] = useState('');
  const [receiptKasirName, setReceiptKasirName] = useState('Petugas Meja I / Kasir');
  const [receiptBendaharaName, setReceiptBendaharaName] = useState('Bendahara Penerimaan');
  const [receiptCatatan, setReceiptCatatan] = useState('');

  // Modal Tambah Kas Baru Langsung Kuning
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [formNomorPerkara, setFormNomorPerkara] = useState('');
  const [formNamaPihak, setFormNamaPihak] = useState('');
  const [formUraian, setFormUraian] = useState('');
  const [formNominal, setFormNominal] = useState<number>(0);
  const [formKeterangan, setFormKeterangan] = useState('');

  // Filter only records that have effective color "kuning"
  const kuningRecords = useMemo(() => {
    return records.filter(r => getEffectiveWarnaBaris(r) === 'kuning');
  }, [records]);

  // Lookup map case to party name
  const caseMap = useMemo(() => {
    const map: Record<string, string> = {};
    cases.forEach(c => {
      if (c.nomorPerkara) {
        map[c.nomorPerkara.trim().toLowerCase()] = c.namaPihak || '';
      }
    });
    return map;
  }, [cases]);

  // Filtered by search & period
  const filteredKuningRecords = useMemo(() => {
    return kuningRecords
      .filter(r => {
        const cleanKet = stripWarnaTag(r.keterangan);
        const partyName = caseMap[(r.nomorPerkara || '').trim().toLowerCase()] || '';
        const matchQuery =
          r.nomorPerkara.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.uraian.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cleanKet.toLowerCase().includes(searchQuery.toLowerCase()) ||
          partyName.toLowerCase().includes(searchQuery.toLowerCase());

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

        return matchQuery && matchMonthYear;
      })
      .sort((a, b) => {
        const dateA = a.tanggal || '';
        const dateB = b.tanggal || '';
        return dateB.localeCompare(dateA); // newest first
      });
  }, [kuningRecords, searchQuery, filterBulan, filterTahun, caseMap]);

  // Totals
  const totalNominalUangCash = useMemo(() => {
    return filteredKuningRecords.reduce((sum, r) => {
      // Prioritize penerimaan (debet), fallback to pengeluaran if entered as kredit
      const amt = (r.penerimaan || 0) > 0 ? r.penerimaan : (r.pengeluaran || 0);
      return sum + amt;
    }, 0);
  }, [filteredKuningRecords]);

  // Action: Mark single record as Sudah Disetor (Hijau)
  const handleMarkAsSudahDisetor = (record: JurnalBiayaSkumRecord) => {
    const cleanKet = stripWarnaTag(record.keterangan);
    const updatedKeterangan = cleanKet ? `${cleanKet} [WARNA:hijau]` : `[WARNA:hijau]`;

    onUpdateRecord({
      ...record,
      keterangan: updatedKeterangan,
      warnaBaris: 'hijau'
    });
  };

  // Action: Setor semua kas kuning ke hijau
  const handleSetorSemuaKeHijau = () => {
    if (filteredKuningRecords.length === 0) return;
    const confirmed = window.confirm(
      `Konfirmasi Penyerahan Uang Cash ke Bendahara Penerimaan:\n\n` +
      `Apakah seluruh uang cash sebesar Rp ${totalNominalUangCash.toLocaleString('id-ID')} (${filteredKuningRecords.length} transaksi) ` +
      `telah diserahkan ke Bendahara Penerimaan?\n\nStatus seluruh transaksi ini akan diubah menjadi HIJAU (Sudah Disetor).`
    );
    if (!confirmed) return;

    filteredKuningRecords.forEach(record => {
      const cleanKet = stripWarnaTag(record.keterangan);
      const updatedKeterangan = cleanKet ? `${cleanKet} [WARNA:hijau]` : `[WARNA:hijau]`;
      onUpdateRecord({
        ...record,
        keterangan: updatedKeterangan,
        warnaBaris: 'hijau'
      });
    });
  };

  // Open Receipt Modal for a specific record
  const handleOpenReceiptModal = (record: JurnalBiayaSkumRecord) => {
    const partyName = caseMap[(record.nomorPerkara || '').trim().toLowerCase()] || '';
    setSelectedRecordForReceipt(record);
    setReceiptPihakCustom(partyName);
    setReceiptCatatan(stripWarnaTag(record.keterangan) || 'Titipan uang cash panjar biaya perkara belum diserahkan ke Bendahara Penerimaan.');
  };

  // Print Single Kuitansi
  const handlePrintSingleReceipt = () => {
    if (!selectedRecordForReceipt) return;
    const r = selectedRecordForReceipt;
    const nominal = (r.penerimaan || 0) > 0 ? r.penerimaan : (r.pengeluaran || 0);
    const terbilangText = terbilang(nominal);
    const partyName = receiptPihakCustom || caseMap[(r.nomorPerkara || '').trim().toLowerCase()] || 'Pihak Berperkara';
    
    // Format date in Indonesian
    let tglIndo = r.tanggal || '';
    if (r.tanggal) {
      try {
        const d = new Date(r.tanggal);
        const bulanNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        tglIndo = `${d.getDate()} ${bulanNames[d.getMonth()]} ${d.getFullYear()}`;
      } catch {
        tglIndo = r.tanggal;
      }
    }

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const receiptNo = `KWT-KAS/${(r.tanggal || '').replace(/-/g, '')}/${r.id.slice(-5).toUpperCase()}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kuitansi Tanda Terima Kas - ${r.nomorPerkara}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            color: #111;
            padding: 20px;
            background: #fff;
            font-size: 13px;
          }
          .kuitansi-box {
            border: 2px solid #000;
            padding: 24px 30px;
            max-width: 800px;
            margin: 0 auto;
            position: relative;
            background: #fff;
          }
          .header-kop {
            text-align: center;
            border-bottom: 2px double #000;
            padding-bottom: 12px;
            margin-bottom: 18px;
          }
          .header-kop h3 {
            margin: 0;
            font-size: 14px;
            letter-spacing: 0.5px;
            font-weight: normal;
          }
          .header-kop h2 {
            margin: 3px 0;
            font-size: 17px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .header-kop p {
            margin: 2px 0 0 0;
            font-size: 11px;
            font-style: italic;
          }
          .receipt-title {
            text-align: center;
            margin: 15px 0 20px 0;
          }
          .receipt-title h1 {
            margin: 0;
            font-size: 18px;
            text-decoration: underline;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .receipt-title .receipt-no {
            font-size: 12px;
            margin-top: 4px;
            font-family: 'Courier New', monospace;
            font-weight: bold;
          }
          .badge-status {
            display: inline-block;
            background-color: #fef08a;
            color: #854d0e;
            border: 1px solid #eab308;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            border-radius: 4px;
            margin-top: 6px;
          }
          .row-field {
            display: flex;
            margin-bottom: 11px;
            line-height: 1.5;
          }
          .label-field {
            width: 170px;
            font-weight: bold;
            flex-shrink: 0;
          }
          .colon {
            width: 15px;
            flex-shrink: 0;
          }
          .value-field {
            flex: 1;
          }
          .box-terbilang {
            background-color: #f8fafc;
            border: 1px dashed #334155;
            padding: 8px 12px;
            font-style: italic;
            font-weight: bold;
            font-size: 13px;
          }
          .nominal-highlight {
            font-family: 'Courier New', monospace;
            font-size: 18px;
            font-weight: bold;
            color: #000;
          }
          .signatures {
            margin-top: 35px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .sign-col {
            text-align: center;
            width: 200px;
          }
          .sign-col .role {
            font-size: 12px;
            margin-bottom: 60px;
          }
          .sign-col .name {
            font-weight: bold;
            text-decoration: underline;
            font-size: 13px;
          }
          .sign-col .nip {
            font-size: 11px;
            color: #333;
          }
          .footer-note {
            margin-top: 25px;
            padding-top: 10px;
            border-top: 1px solid #ccc;
            font-size: 10px;
            color: #555;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="kuitansi-box">
          <div class="header-kop">
            <h3>MAHKAMAH AGUNG REPUBLIK INDONESIA</h3>
            <h3>DIREKTORAT JENDERAL BADAN PERADILAN AGAMA</h3>
            <h2>PENGADILAN AGAMA PANIAI</h2>
            <p>Jalan Trans Papua, Enarotali, Kabupaten Paniai, Papua Tengah</p>
          </div>

          <div class="receipt-title">
            <h1>BUKTI TANDA TERIMA / KUITANSI TITIPAN UANG CASH</h1>
            <div class="receipt-no">Nomor: ${receiptNo}</div>
            <div>
              <span class="badge-status">🟡 STATUS: UANG CASH BELUM DISERAHKAN KE BENDAHARA PENERIMAAN</span>
            </div>
          </div>

          <div class="row-field">
            <div class="label-field">Telah Diterima Dari</div>
            <div class="colon">:</div>
            <div class="value-field" style="font-size: 14px; font-weight: bold; text-transform: uppercase;">
              ${partyName}
            </div>
          </div>

          <div class="row-field">
            <div class="label-field">Nomor Perkara</div>
            <div class="colon">:</div>
            <div class="value-field" style="font-weight: bold; font-family: 'Courier New', monospace;">
              ${r.nomorPerkara}
            </div>
          </div>

          <div class="row-field">
            <div class="label-field">Uang Sejumlah</div>
            <div class="colon">:</div>
            <div class="value-field nominal-highlight">
              Rp ${nominal.toLocaleString('id-ID')},-
            </div>
          </div>

          <div class="row-field">
            <div class="label-field">Terbilang</div>
            <div class="colon">:</div>
            <div class="value-field box-terbilang">
              # ${terbilangText} #
            </div>
          </div>

          <div class="row-field">
            <div class="label-field">Untuk Pembayaran</div>
            <div class="colon">:</div>
            <div class="value-field" style="font-weight: 600;">
              ${r.uraian} (${r.kategori})
            </div>
          </div>

          <div class="row-field">
            <div class="label-field">Tanggal Transaksi</div>
            <div class="colon">:</div>
            <div class="value-field">
              ${tglIndo}
            </div>
          </div>

          <div class="row-field">
            <div class="label-field">Catatan / Keterangan</div>
            <div class="colon">:</div>
            <div class="value-field" style="color: #444;">
              ${receiptCatatan || '-'}
            </div>
          </div>

          <div class="signatures">
            <div class="sign-col">
              <div class="role">Yang Menyerahkan Uang,</div>
              <div class="name">${partyName}</div>
              <div class="nip">(Pihak / Penyetor)</div>
            </div>

            <div class="sign-col">
              <div class="role">Paniai, ${tglIndo}<br/>Yang Menerima Titipan Kas,</div>
              <div class="name">${receiptKasirName}</div>
              <div class="nip">NIP. ........................................</div>
            </div>

            <div class="sign-col">
              <div class="role">Tanda Terima Kasir /<br/>Bendahara Penerimaan,</div>
              <div class="name">${receiptBendaharaName}</div>
              <div class="nip">(Disahkan saat uang disetor)</div>
            </div>
          </div>

          <div class="footer-note">
            * Kuitansi ini dicetak sebagai bukti tanda terima fisik uang tunai yang belum diserahkan ke kas register Bendahara Penerimaan. Simpan lembar ini sebagai bukti pertanggungjawaban penyerahan uang kas.
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  };

  // Print Rekapitulasi / Berita Acara Penyerahan Kas ke Bendahara
  const handlePrintRekapPenyerahan = () => {
    if (filteredKuningRecords.length === 0) return;

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const todayIndo = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date());

    const tableRows = filteredKuningRecords.map((r, idx) => {
      const nominal = (r.penerimaan || 0) > 0 ? r.penerimaan : (r.pengeluaran || 0);
      const party = caseMap[(r.nomorPerkara || '').trim().toLowerCase()] || '-';
      const cleanKet = stripWarnaTag(r.keterangan);
      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center;">${r.tanggal || '-'}</td>
          <td style="font-weight: bold; font-family: monospace;">${r.nomorPerkara}</td>
          <td>${party}</td>
          <td>${r.uraian}</td>
          <td>${cleanKet || '-'}</td>
          <td style="text-align: right; font-weight: bold; font-family: monospace;">Rp ${nominal.toLocaleString('id-ID')}</td>
          <td style="text-align: center; width: 60px;">[ &nbsp; ]</td>
        </tr>
      `;
    }).join('');

    const terbilangTotal = terbilang(totalNominalUangCash);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Berita Acara & Rekap Penyerahan Uang Cash ke Bendahara Penerimaan</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: 'Times New Roman', serif; padding: 15px; color: #111; font-size: 11px; }
          .header { text-align: center; margin-bottom: 16px; border-bottom: 2px double #000; padding-bottom: 10px; }
          .header h2 { margin: 0; font-size: 15px; text-transform: uppercase; font-weight: bold; }
          .header h3 { margin: 3px 0; font-size: 13px; font-weight: normal; }
          .header p { margin: 2px 0 0 0; font-size: 10px; font-style: italic; }
          .title { text-align: center; margin: 15px 0; }
          .title h1 { margin: 0; font-size: 15px; text-transform: uppercase; text-decoration: underline; }
          .title p { margin: 4px 0 0 0; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #333; padding: 5px 7px; font-size: 10px; }
          th { background-color: #fef08a; font-weight: bold; text-align: center; text-transform: uppercase; }
          .terbilang-box { margin-top: 10px; padding: 6px 10px; background-color: #f9fafb; border: 1px dashed #666; font-style: italic; font-weight: bold; }
          .signatures { margin-top: 30px; display: flex; justify-content: space-around; page-break-inside: avoid; }
          .sign-col { text-align: center; width: 260px; }
          .sign-col .role { margin-bottom: 55px; font-size: 11px; }
          .sign-col .name { font-weight: bold; text-decoration: underline; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>MAHKAMAH AGUNG REPUBLIK INDONESIA - DITJEN BADAN PERADILAN AGAMA</h3>
          <h2>PENGADILAN AGAMA PANIAI</h2>
          <p>Jl. Trans Papua, Enarotali, Kabupaten Paniai, Papua Tengah</p>
        </div>

        <div class="title">
          <h1>BERITA ACARA & REKAPITULASI PENYERAHAN UANG CASH KE BENDAHARA PENERIMAAN</h1>
          <p>Daftar Fisik Uang Tunai Titipan Panjar Perkara (Status Kuning) yang Diserahkan pada: <strong>${todayIndo}</strong></p>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">No</th>
              <th style="width: 75px;">Tanggal</th>
              <th style="width: 140px;">Nomor Perkara</th>
              <th style="width: 140px;">Nama Pihak</th>
              <th>Uraian Transaksi</th>
              <th>Catatan</th>
              <th style="width: 110px;">Jumlah Uang Cash</th>
              <th style="width: 60px;">Paraf</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr style="background-color: #f3f4f6; font-weight: bold;">
              <td colspan="6" style="text-align: right; text-transform: uppercase;">TOTAL FISIK UANG CASH YANG DISERAHKAN:</td>
              <td style="text-align: right; font-family: monospace; font-size: 11px;">Rp ${totalNominalUangCash.toLocaleString('id-ID')}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="terbilang-box">
          Terbilang: # ${terbilangTotal} #
        </div>

        <div class="signatures">
          <div class="sign-col">
            <div class="role">Yang Menyerahkan Fisik Uang Cash,<br/>Petugas Meja I / Kasir Titipan</div>
            <div class="name">( ..................................................... )</div>
            <div>NIP. ....................................................</div>
          </div>

          <div class="sign-col">
            <div class="role">Paniai, ${todayIndo}<br/>Yang Menerima Fisik Uang Cash,<br/>Bendahara Penerimaan</div>
            <div class="name">( ..................................................... )</div>
            <div>NIP. ....................................................</div>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  };

  // Submit modal add record directly as kuning
  const handleSubmitAddKuning = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNomorPerkara.trim() || !formUraian.trim() || formNominal <= 0) {
      alert('Mohon lengkapi nomor perkara, uraian, dan nominal uang cash yang valid (> 0).');
      return;
    }

    const cleanKet = stripWarnaTag(formKeterangan || 'Titipan uang cash belum diserahkan ke Bendahara Penerimaan');
    const finalKeterangan = `${cleanKet} [WARNA:kuning]`;

    onAddRecord({
      tanggal: formTanggal,
      nomorPerkara: formNomorPerkara.trim(),
      uraian: formUraian.trim(),
      penerimaan: formNominal,
      pengeluaran: 0,
      kategori: 'Panjar',
      keterangan: finalKeterangan,
      warnaBaris: 'kuning'
    });

    setIsAddModalOpen(false);
    setFormNomorPerkara('');
    setFormNamaPihak('');
    setFormUraian('');
    setFormNominal(0);
    setFormKeterangan('');
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner - Specialized Yellow/Amber Theme */}
      <div className={`p-6 rounded-2xl border transition-all shadow-sm ${
        isLight 
          ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-slate-950 border-amber-400' 
          : 'bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 border-amber-700/60 text-white'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="p-3 bg-white/20 dark:bg-amber-500/20 rounded-2xl border border-white/30 dark:border-amber-400/40 text-amber-950 dark:text-amber-300 backdrop-blur-md shrink-0">
              <Receipt className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black tracking-tight">
                  🟡 Titipan Uang Cash Belum Disetor ke Bendahara Penerimaan
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/40 dark:bg-amber-500/30 text-slate-950 dark:text-amber-200 border border-white/40 uppercase tracking-wider">
                  Menu Khusus Warna Kuning
                </span>
              </div>
              <p className="text-xs mt-1 max-w-3xl leading-relaxed opacity-90">
                Menu khusus untuk mengelola seluruh transaksi yang ditandai <strong>Warna Kuning</strong> (uang cash belum diserahkan ke Bendahara Penerimaan). Anda dapat mencetak <strong>Kuitansi Resmi / Bukti Tanda Terima</strong> per transaksi, mencetak Rekap Penyerahan, atau menandai <strong>Sudah Disetor (Ubah ke Hijau)</strong> setelah uang cash diserahkan.
              </p>
            </div>
          </div>

          {/* Action Buttons in Banner */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              id="btn-rekap-kuning"
              onClick={handlePrintRekapPenyerahan}
              disabled={filteredKuningRecords.length === 0}
              className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 text-amber-300 hover:bg-slate-800 font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cetak Berita Acara & Rekapitulasi Penyerahan Uang Cash ke Bendahara"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Berita Acara Serah Terima</span>
            </button>

            <button
              id="btn-add-kuning-direct"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-white hover:bg-amber-50 text-slate-900 font-black rounded-xl text-xs transition-all shadow-md active:scale-95 border border-amber-300"
              title="Catat transaksi titipan uang cash baru langsung dengan warna Kuning"
            >
              <PlusCircle className="w-4 h-4 text-amber-600" />
              <span>+ Titipan Cash Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Meaning of Colors Guide / Flow Banner */}
      <div className={`p-4 rounded-2xl border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        isLight ? 'bg-amber-50/80 border-amber-200 text-amber-950' : 'bg-amber-950/20 border-amber-800/60 text-amber-200'
      }`}>
        <div className="flex items-center space-x-3">
          <span className="text-xl">💡</span>
          <div>
            <span className="font-extrabold uppercase tracking-wide block">Standar Alur Status Warna Keuangan:</span>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px]">
              <span className="inline-flex items-center space-x-1 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-600"></span>
                <strong>Kuning</strong>: Belum Berikan Uang Cash ke Bendahara (Bisa Cetak Kuitansi / Bukti)
              </span>
              <span className="text-slate-400">➔</span>
              <span className="inline-flex items-center space-x-1 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <strong>Hijau</strong>: Sudah Disetor ke Bendahara Penerimaan
              </span>
              <span className="text-slate-400">|</span>
              <span className="inline-flex items-center space-x-1 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <strong>Merah</strong>: Merupakan Pinjaman Saldo SKUM
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onNavigateToJurnal}
          className="self-start md:self-auto px-3 py-1.5 rounded-xl border border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-bold text-xs flex items-center space-x-1 shrink-0 transition-colors"
        >
          <span>Buka Buku Jurnal SKUM</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Uang Cash Belum Disetor */}
        <div className={`p-4 rounded-2xl border shadow-xs ${
          isLight ? 'bg-white border-amber-200 text-slate-800' : 'bg-slate-900 border-amber-800/80 text-slate-100'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Total Fisik Kas Belum Disetor
            </span>
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              Rp {totalNominalUangCash.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Fisik uang tunai yang masih dipegang dan wajib diserahkan ke Bendahara Penerimaan.
          </p>
        </div>

        {/* Jumlah Lembar / Transaksi */}
        <div className={`p-4 rounded-2xl border shadow-xs ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Jumlah Transaksi Kuning
            </span>
            <div className="p-2 rounded-xl bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-400">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black font-mono">
              {filteredKuningRecords.length}
            </span>
            <span className="text-xs text-slate-500 ml-1.5">Berkas / Transaksi</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Transaksi berstatus titipan uang cash (Kuning).
          </p>
        </div>

        {/* Action Settle All Card */}
        <div className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Serah Terima ke Bendahara
              </span>
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Jika fisik seluruh uang kas sudah diserahkan ke bendahara penerimaan, klik tombol di bawah:
            </p>
          </div>
          <button
            onClick={handleSetorSemuaKeHijau}
            disabled={filteredKuningRecords.length === 0}
            className="mt-3 w-full py-2 px-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>✓ Setor Semua Kas (Ubah ke Hijau)</span>
          </button>
        </div>

      </div>

      {/* Filter & Search Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
        isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900 border-slate-800 shadow-md'
      }`}>
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nomor perkara, nama pihak, uraian kas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-white'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bulan Filter */}
          <select
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-xs border font-semibold ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <option value="ALL">Semua Bulan</option>
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

          {/* Tahun Filter */}
          <select
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-xs border font-semibold ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <option value="ALL">Semua Tahun</option>
            <option value="2026">Tahun 2026</option>
            <option value="2025">Tahun 2025</option>
            <option value="2024">Tahun 2024</option>
          </select>

          {/* View Mode Toggle: Kartu HP vs Tabel */}
          <div className="flex items-center space-x-1 p-1 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs ml-auto sm:ml-0">
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

      {/* Main Content: Mobile Cards vs Wide Table */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${
        isLight ? 'bg-white border-amber-200' : 'bg-slate-900 border-slate-800'
      }`}>
        {viewMode === 'mobile' ? (
          <div className="p-3 sm:p-4 space-y-3">
            {filteredKuningRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <div className="max-w-md mx-auto space-y-2">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
                  <p className="font-extrabold text-sm text-slate-700 dark:text-slate-200">
                    Tidak Ada Uang Cash yang Tertahan (Kuning)
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Seluruh uang kas telah diserahkan ke Bendahara Penerimaan (Hijau), atau belum ada transaksi yang diberi warna Kuning.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={onNavigateToJurnal}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs"
                    >
                      Lihat Semua Transaksi di Jurnal SKUM
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              filteredKuningRecords.map((r, idx) => {
                const nominal = (r.penerimaan || 0) > 0 ? r.penerimaan : (r.pengeluaran || 0);
                const partyName = caseMap[(r.nomorPerkara || '').trim().toLowerCase()] || '-';
                const cleanKet = stripWarnaTag(r.keterangan);

                return (
                  <div
                    key={`mobile-kuning-card-${r.id}-${idx}`}
                    className={`p-4 rounded-2xl border transition-all shadow-xs space-y-3 ${
                      isLight 
                        ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300' 
                        : 'bg-slate-900 border-amber-900/60 hover:border-amber-700'
                    }`}
                  >
                    {/* Header: No, Tanggal & Status */}
                    <div className="flex items-start justify-between gap-2 border-b border-amber-100 dark:border-slate-800 pb-2">
                      <div>
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          #{idx + 1} • {r.tanggal || '-'}
                        </span>
                        <div className="font-mono text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 mt-0.5">
                          {r.nomorPerkara}
                        </div>
                      </div>

                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 dark:bg-amber-900/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                        <span>Belum Setor Cash</span>
                      </span>
                    </div>

                    {/* Pihak & Uraian */}
                    <div className="space-y-1">
                      {partyName !== '-' && (
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                          <span className="text-slate-400 font-normal">Pihak:</span>
                          <span className="text-amber-800 dark:text-amber-300 uppercase">{partyName}</span>
                        </div>
                      )}
                      <div className="font-bold text-sm leading-snug text-slate-900 dark:text-slate-100">
                        {r.uraian}
                      </div>
                      {cleanKet && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                          "{cleanKet}"
                        </div>
                      )}
                    </div>

                    {/* Nominal Box */}
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${
                      isLight ? 'bg-white border-amber-200' : 'bg-slate-800/80 border-slate-700'
                    }`}>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Fisik Uang Cash
                        </div>
                        <div className="font-mono text-lg font-black text-amber-600 dark:text-amber-400">
                          Rp {nominal.toLocaleString('id-ID')}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          Kas Titipan Meja I
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons: Big & Touch-friendly */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenReceiptModal(r)}
                        className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 text-amber-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-amber-300 transition-all shadow-xs flex items-center justify-center space-x-1.5 active:scale-98"
                        title="Cetak Kuitansi Resmi / Bukti Tanda Terima Titipan Uang Cash"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Cetak Kuitansi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMarkAsSudahDisetor(r)}
                        className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs flex items-center justify-center space-x-1.5 active:scale-98"
                        title="Uang cash sudah diserahkan ke Bendahara Penerimaan (Ubah status ke Hijau)"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Sudah Disetor</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Summary Card */}
            {filteredKuningRecords.length > 0 && (
              <div className={`p-4 rounded-2xl border shadow-sm ${
                isLight ? 'bg-amber-100/70 border-amber-300' : 'bg-slate-800 border-slate-700'
              }`}>
                <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300 mb-1">
                  <span>Total Fisik Kas Belum Disetor</span>
                  <span className="text-[11px] font-normal lowercase">({filteredKuningRecords.length} transaksi)</span>
                </div>
                <div className="font-mono text-xl font-black text-amber-700 dark:text-amber-300">
                  Rp {totalNominalUangCash.toLocaleString('id-ID')}
                </div>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-1">
                  Siap dibuatkan Berita Acara & diserahkan ke Bendahara Penerimaan.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={`border-b font-extrabold uppercase text-[10px] tracking-wider ${
                  isLight ? 'bg-amber-100/70 text-amber-900 border-amber-200' : 'bg-slate-800 text-amber-300 border-slate-700'
                }`}>
                  <th className="p-3 text-center w-12">No</th>
                  <th className="p-3 w-28">Tanggal</th>
                  <th className="p-3 w-44">Nomor Perkara</th>
                  <th className="p-3 w-48">Nama Pihak</th>
                  <th className="p-3">Uraian Transaksi</th>
                  <th className="p-3 text-right w-36">Jumlah Uang Cash</th>
                  <th className="p-3 text-center w-36">Status Fisik Kas</th>
                  <th className="p-3 text-center w-48">Aksi & Kuitansi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 dark:divide-slate-800 font-sans">
                {filteredKuningRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <div className="max-w-md mx-auto space-y-2">
                        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
                        <p className="font-extrabold text-sm text-slate-700 dark:text-slate-200">
                          Tidak Ada Uang Cash yang Tertahan (Kuning)
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Seluruh uang kas telah diserahkan ke Bendahara Penerimaan (Hijau), atau belum ada transaksi yang diberi warna Kuning.
                        </p>
                        <div className="pt-2">
                          <button
                            onClick={onNavigateToJurnal}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs"
                          >
                            Lihat Semua Transaksi di Jurnal SKUM
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredKuningRecords.map((r, idx) => {
                    const nominal = (r.penerimaan || 0) > 0 ? r.penerimaan : (r.pengeluaran || 0);
                    const partyName = caseMap[(r.nomorPerkara || '').trim().toLowerCase()] || '-';
                    const cleanKet = stripWarnaTag(r.keterangan);

                    return (
                      <tr
                        key={`kuning-row-${r.id}-${idx}`}
                        className={`transition-colors ${
                          isLight 
                            ? 'bg-amber-50/50 hover:bg-amber-100/60' 
                            : 'bg-amber-950/15 hover:bg-amber-950/30'
                        }`}
                      >
                        <td className="p-3 text-center font-bold text-amber-800 dark:text-amber-400">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {r.tanggal || '-'}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {r.nomorPerkara}
                        </td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                          {partyName}
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{r.uraian}</div>
                          {cleanKet && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                              "{cleanKet}"
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          Rp {nominal.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 dark:bg-amber-900/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                            <span>Belum Setor Cash</span>
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            {/* Tombol Cetak Kuitansi */}
                            <button
                              type="button"
                              onClick={() => handleOpenReceiptModal(r)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-black bg-slate-900 hover:bg-slate-800 text-amber-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-amber-300 transition-all shadow-xs flex items-center space-x-1 active:scale-95"
                              title="Cetak Kuitansi Resmi / Bukti Tanda Terima Titipan Uang Cash"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Cetak Kuitansi</span>
                            </button>

                            {/* Tombol Sudah Disetor (Ubah ke Hijau) */}
                            <button
                              type="button"
                              onClick={() => handleMarkAsSudahDisetor(r)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs flex items-center space-x-1 active:scale-95"
                              title="Uang cash sudah diserahkan ke Bendahara Penerimaan (Ubah status ke Hijau)"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Sudah Disetor</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredKuningRecords.length > 0 && (
                <tfoot>
                  <tr className={`border-t font-black text-xs ${
                    isLight ? 'bg-amber-100 text-amber-950 border-amber-300' : 'bg-slate-800 text-amber-300 border-slate-700'
                  }`}>
                    <td colSpan={5} className="p-3 text-right uppercase tracking-wider">
                      TOTAL KAS FISIK BELUM DISETOR:
                    </td>
                    <td className="p-3 text-right font-mono text-sm text-amber-600 dark:text-amber-400">
                      Rp {totalNominalUangCash.toLocaleString('id-ID')}
                    </td>
                    <td colSpan={2} className="p-3 text-center text-[10px] opacity-80">
                      ({filteredKuningRecords.length} Transaksi Siap Diserahkan ke Bendahara)
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog: Cetak Kuitansi / Bukti Tanda Terima */}
      {selectedRecordForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            
            {/* Modal Header */}
            <div className="p-4 border-b border-amber-200 dark:border-slate-800 bg-amber-50 dark:bg-slate-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-slate-950">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Cetak Bukti Tanda Terima / Kuitansi Titipan Kas
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Perkara: {selectedRecordForReceipt.nomorPerkara}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecordForReceipt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Preview */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              
              {/* Box Preview Kuitansi */}
              <div className={`p-4 rounded-xl border ${
                isLight ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-950/20 border-amber-800/40'
              }`}>
                <div className="flex justify-between items-start border-b border-amber-200 dark:border-amber-800 pb-2 mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                      PENGADILAN AGAMA PANIAI
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      KUITANSI TITIPAN UANG CASH
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                    🟡 BELUM DISETOR KE BENDAHARA
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Nomor Perkara:</span>
                    <span className="font-bold font-mono">{selectedRecordForReceipt.nomorPerkara}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Tanggal Transaksi:</span>
                    <span className="font-bold">{selectedRecordForReceipt.tanggal || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Uraian Pembayaran:</span>
                    <span className="font-medium">{selectedRecordForReceipt.uraian}</span>
                  </div>
                  <div className="col-span-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-amber-200 dark:border-slate-700">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">Jumlah Uang Cash:</span>
                      <span className="text-base font-black font-mono text-amber-600 dark:text-amber-400">
                        Rp {((selectedRecordForReceipt.penerimaan || 0) > 0 ? selectedRecordForReceipt.penerimaan : (selectedRecordForReceipt.pengeluaran || 0)).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold italic text-slate-600 dark:text-slate-300 mt-1 border-t pt-1 border-slate-100 dark:border-slate-700">
                      Terbilang: #{terbilang((selectedRecordForReceipt.penerimaan || 0) > 0 ? selectedRecordForReceipt.penerimaan : (selectedRecordForReceipt.pengeluaran || 0))}#
                    </div>
                  </div>
                </div>
              </div>

              {/* Input details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                    Telah Diterima Dari (Nama Pihak):
                  </label>
                  <input
                    type="text"
                    value={receiptPihakCustom}
                    onChange={(e) => setReceiptPihakCustom(e.target.value)}
                    placeholder="Nama Penggugat/Pemohon/Penyetor..."
                    className={`w-full p-2 rounded-xl border font-bold ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                    Nama Kasir / Petugas Penerima:
                  </label>
                  <input
                    type="text"
                    value={receiptKasirName}
                    onChange={(e) => setReceiptKasirName(e.target.value)}
                    placeholder="Nama Petugas Meja I / Kasir..."
                    className={`w-full p-2 rounded-xl border ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                    }`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                    Catatan Kuitansi:
                  </label>
                  <input
                    type="text"
                    value={receiptCatatan}
                    onChange={(e) => setReceiptCatatan(e.target.value)}
                    placeholder="Catatan tambahan kuitansi..."
                    className={`w-full p-2 rounded-xl border ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                    }`}
                  />
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedRecordForReceipt(null)}
                className="px-4 py-2 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Tutup
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    handlePrintSingleReceipt();
                  }}
                  className="px-5 py-2.5 rounded-xl font-black text-xs bg-slate-900 hover:bg-slate-800 text-amber-300 shadow-md flex items-center space-x-1.5 active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ Cetak Kuitansi Sekarang</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal Add Direct Kuning */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="p-4 border-b border-amber-200 dark:border-slate-800 bg-amber-50 dark:bg-slate-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black">🟡</div>
                <div>
                  <h3 className="font-extrabold text-sm">Catat Titipan Uang Cash Baru</h3>
                  <p className="text-[11px] text-slate-500">Otomatis berstatus Kuning (Belum Disetor ke Bendahara)</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAddKuning} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">Nomor Perkara:</label>
                <input
                  type="text"
                  list="cases-kuning-list"
                  placeholder="e.g. 1/Pdt.G/2026/PA.Pan"
                  value={formNomorPerkara}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormNomorPerkara(val);
                    const match = cases.find(c => c.nomorPerkara.trim().toLowerCase() === val.trim().toLowerCase());
                    if (match) {
                      setFormNamaPihak(match.namaPihak || '');
                    }
                  }}
                  className={`w-full p-2.5 rounded-xl border font-mono font-bold ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                  }`}
                  required
                />
                <datalist id="cases-kuning-list">
                  {cases.map((c, idx) => (
                    <option key={`c-kn-${c.id}-${idx}`} value={c.nomorPerkara}>{c.namaPihak}</option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Tanggal Terima Kas:</label>
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
                  <label className="block font-bold mb-1">Nominal Uang Cash (Rp):</label>
                  <input
                    type="number"
                    min="1"
                    step="1000"
                    value={formNominal || ''}
                    onChange={(e) => setFormNominal(Number(e.target.value))}
                    placeholder="Rp 0"
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold text-amber-600 ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                    }`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Uraian Transaksi:</label>
                <input
                  type="text"
                  placeholder="e.g. Penerimaan Panjar Awal Titipan Kas / Tambah Panjar..."
                  value={formUraian}
                  onChange={(e) => setFormUraian(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Catatan / Keterangan Tambahan:</label>
                <input
                  type="text"
                  placeholder="e.g. Diserahkan tunai oleh penggugat di Meja I..."
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border ${
                    isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'
                  }`}
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md flex items-center space-x-1"
                >
                  <span>Simpan Titipan Kas (Kuning)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
