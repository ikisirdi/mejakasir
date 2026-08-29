import React, { useState, Fragment } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { SyncSettings, CaseRecord } from '../types';
import { SyncService } from '../services/syncService';
import { 
  FileSpreadsheet, 
  X, 
  RefreshCw, 
  Link as LinkIcon, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface SpreadsheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncSettings: SyncSettings;
  onSaveSyncSettings: (settings: SyncSettings) => void;
  onImportCases: (importedCases: CaseRecord[]) => void;
  onTriggerLiveSync?: () => Promise<void>;
  theme?: 'light' | 'dark';
}

export const SpreadsheetSyncModal: React.FC<SpreadsheetSyncModalProps> = ({
  isOpen,
  onClose,
  syncSettings,
  onSaveSyncSettings,
  onImportCases,
  onTriggerLiveSync,
  theme = 'light'
}) => {
  const isLight = theme === 'light';
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>(syncSettings.googleSheetUrl || '');
  const [webhookUrl, setWebhookUrl] = useState<string>(syncSettings.googleSheetWebhookUrl || '');
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  const appScriptCode = `/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT (kode.gs) - SISTEM KEUANGAN PERKARA & BIAYA PROSES PA
 * Paste kode ini di: Extensions > Apps Script pada Spreadsheet Anda.
 * Kemudian klik Deploy > New deployment > Select type: Web App
 * - Execute as: Me
 * - Who has access: Anyone
 * ==============================================================================
 */

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function setupSheets() {
  var ss = getSpreadsheet();

  // 1. Sheet DataPerkara (Register Perkara & Saldo Panjar)
  var sheetPerkara = ss.getSheetByName('DataPerkara');
  if (!sheetPerkara) {
    sheetPerkara = ss.insertSheet('DataPerkara');
    sheetPerkara.appendRow([
      'ID', 'Nomor Perkara', 'Nama Pihak', 'Jenis Perkara', 'Kategori Perkara',
      'Panjar Awal', 'Pengeluaran', 'Saldo Perkara', 'Tanggal Register', 'Catatan', 'Updated At'
    ]);
    sheetPerkara.getRange('A1:K1').setFontWeight('bold').setBackground('#d1fae5');
  }

  // 2. Sheet JurnalBiayaSKUM (Log Transaksi SKUM Perkara)
  var sheetJurnal = ss.getSheetByName('JurnalBiayaSKUM') || ss.getSheetByName('JurnalSKUM');
  if (!sheetJurnal) {
    sheetJurnal = ss.insertSheet('JurnalBiayaSKUM');
    sheetJurnal.appendRow([
      'ID', 'Tanggal', 'Nomor Perkara', 'Uraian', 'Penerimaan / Debet',
      'Pengeluaran / Kredit', 'Kategori', 'Keterangan', 'Warna Baris', 'Created At'
    ]);
    sheetJurnal.getRange('A1:J1').setFontWeight('bold').setBackground('#bae6fd');
  } else {
    var lastCol = sheetJurnal.getLastColumn();
    var jHeaders = lastCol > 0 ? sheetJurnal.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    var hasWarna = false;
    for (var w = 0; w < jHeaders.length; w++) {
      if (String(jHeaders[w] || '').toLowerCase().indexOf('warna') !== -1) {
        hasWarna = true;
        break;
      }
    }
    if (!hasWarna) {
      sheetJurnal.getRange(1, 9).setValue('Warna Baris');
      if (lastCol < 10) {
        sheetJurnal.getRange(1, 10).setValue('Created At');
      }
      sheetJurnal.getRange('A1:J1').setFontWeight('bold').setBackground('#bae6fd');
    }
  }

  // 3. Sheet BukuBiayaProses (Buku Bantu Biaya Proses / ATK Kantor)
  var sheetBiaya = ss.getSheetByName('BukuBiayaProses') || ss.getSheetByName('LogTransaksi');
  if (!sheetBiaya) {
    sheetBiaya = ss.insertSheet('BukuBiayaProses');
    sheetBiaya.appendRow([
      'ID', 'Tanggal', 'Nomor Perkara', 'Uraian', 'Penerimaan',
      'Pengeluaran', 'Kategori', 'Keterangan', 'Created At'
    ]);
    sheetBiaya.getRange('A1:I1').setFontWeight('bold').setBackground('#fef3c7');
  }

  // 4. Sheet PinjamanSaldo / PinjamanSKUM (Pinjaman Saldo SKUM Kepaniteraan)
  var sheetPinjam = ss.getSheetByName('PinjamanSaldo') || ss.getSheetByName('PinjamanSKUM');
  if (!sheetPinjam) {
    sheetPinjam = ss.insertSheet('PinjamanSaldo');
    sheetPinjam.appendRow([
      'ID', 'Tanggal', 'Peminjam', 'Jumlah (Rp)', 'Keterangan', 'Status Lunas', 'Tanggal Lunas', 'Created At'
    ]);
    sheetPinjam.getRange('A1:H1').setFontWeight('bold').setBackground('#fed7aa');
  }
}

function doGet(e) {
  setupSheets();
  var ss = getSpreadsheet();
  
  // Fetch DataPerkara
  var sheetPerkara = ss.getSheetByName('DataPerkara');
  var dataPerkaraRows = sheetPerkara ? sheetPerkara.getDataRange().getValues() : [];
  var cases = [];
  for (var i = 1; i < dataPerkaraRows.length; i++) {
    var r = dataPerkaraRows[i];
    if (r[0] && String(r[0]).trim() !== '') {
      cases.push({
        id: String(r[0]),
        nomorPerkara: String(r[1] || ''),
        namaPihak: String(r[2] || ''),
        jenisPerkara: String(r[3] || 'Cerai Gugat'),
        kategoriPerkara: String(r[4] || 'Gugatan'),
        panjarAwal: Number(r[5]) || 0,
        pengeluaran: Number(r[6]) || 0,
        saldoPerkara: Number(r[7]) || 0,
        tanggalRegister: r[8] ? Utilities.formatDate(new Date(r[8]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
        catatan: String(r[9] || ''),
        updatedAt: String(r[10] || '')
      });
    }
  }

  // Fetch JurnalBiayaSKUM
  var sheetJurnal = ss.getSheetByName('JurnalBiayaSKUM') || ss.getSheetByName('JurnalSKUM');
  var jurnalSkum = [];
  if (sheetJurnal) {
    var dataJurnalRows = sheetJurnal.getDataRange().getValues();
    if (dataJurnalRows.length > 1) {
      var jHeaders = dataJurnalRows[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
      var idCol = 0, tglCol = 1, noCol = 2, uraianCol = 3, debetCol = 4, kreditCol = 5, katCol = 6, ketCol = 7, warnaCol = -1, createdCol = -1;

      for (var h = 0; h < jHeaders.length; h++) {
        if (jHeaders[h] === 'id') idCol = h;
        else if (jHeaders[h] === 'tanggal') tglCol = h;
        else if (jHeaders[h].indexOf('nomor') !== -1) noCol = h;
        else if (jHeaders[h].indexOf('uraian') !== -1) uraianCol = h;
        else if (jHeaders[h].indexOf('debet') !== -1 || jHeaders[h].indexOf('penerimaan') !== -1) debetCol = h;
        else if (jHeaders[h].indexOf('kredit') !== -1 || jHeaders[h].indexOf('pengeluaran') !== -1) kreditCol = h;
        else if (jHeaders[h].indexOf('kategori') !== -1) katCol = h;
        else if (jHeaders[h].indexOf('keterangan') !== -1) ketCol = h;
        else if (jHeaders[h].indexOf('warna') !== -1 || jHeaders[h].indexOf('status') !== -1) warnaCol = h;
        else if (jHeaders[h].indexOf('created') !== -1) createdCol = h;
      }

      if (warnaCol === -1 && jHeaders.length >= 10) warnaCol = 8;
      if (createdCol === -1) createdCol = jHeaders.length > 9 ? 9 : 8;

      for (var k = 1; k < dataJurnalRows.length; k++) {
        var j = dataJurnalRows[k];
        if (j[idCol] && String(j[idCol]).trim() !== '') {
          var rawW = warnaCol !== -1 ? String(j[warnaCol] || '').trim().toLowerCase() : '';
          var parsedW = 'default';
          if (rawW === 'hijau' || rawW === 'disetor' || rawW === 'green' || rawW === 'lunas' || rawW === 'sudah disetor') {
            parsedW = 'hijau';
          } else if (rawW === 'merah' || rawW === 'perhatian' || rawW === 'red' || rawW === 'belum' || rawW === 'belum disetor') {
            parsedW = 'merah';
          } else if (rawW === 'oranye' || rawW === 'orange' || rawW === 'proses' || rawW === 'dalam proses') {
            parsedW = 'oranye';
          }

          jurnalSkum.push({
            id: String(j[idCol]),
            tanggal: j[tglCol] ? Utilities.formatDate(new Date(j[tglCol]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
            nomorPerkara: String(j[noCol] || '-'),
            uraian: String(j[uraianCol] || ''),
            penerimaan: Number(j[debetCol]) || 0,
            pengeluaran: Number(j[kreditCol]) || 0,
            kategori: String(j[katCol] || 'Panggilan'),
            keterangan: String(j[ketCol] || ''),
            warnaBaris: parsedW,
            createdAt: String(createdCol !== -1 && j[createdCol] ? j[createdCol] : '')
          });
        }
      }
    }
  }

  // Fetch BukuBiayaProses
  var sheetBiaya = ss.getSheetByName('BukuBiayaProses') || ss.getSheetByName('LogTransaksi') || ss.getSheetByName('BukuBantu');
  var biayaProses = [];
  if (sheetBiaya) {
    var dataBiayaRows = sheetBiaya.getDataRange().getValues();
    for (var m = 1; m < dataBiayaRows.length; m++) {
      var b = dataBiayaRows[m];
      if (b[0] && String(b[0]).trim() !== '') {
        biayaProses.push({
          id: String(b[0]),
          tanggal: b[1] ? Utilities.formatDate(new Date(b[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
          nomorPerkara: String(b[2] || '-'),
          uraian: String(b[3] || ''),
          penerimaan: Number(b[4]) || 0,
          pengeluaran: Number(b[5]) || 0,
          kategori: String(b[6] || 'Proses'),
          keterangan: String(b[7] || ''),
          createdAt: String(b[8] || '')
        });
      }
    }
  }

  // Fetch PinjamanSaldo / PinjamanSKUM
  var sheetPinjam = ss.getSheetByName('PinjamanSaldo') || ss.getSheetByName('PinjamanSKUM') || ss.getSheetByName('Pinjaman');
  var pinjamanSkum = [];
  if (sheetPinjam) {
    var dataPinjamRows = sheetPinjam.getDataRange().getValues();
    var isPinjamanSaldo = (sheetPinjam.getName() === 'PinjamanSaldo') || (dataPinjamRows.length > 0 && String(dataPinjamRows[0][2] || '').toLowerCase().indexOf('peminjam') !== -1);
    for (var p = 1; p < dataPinjamRows.length; p++) {
      var rowP = dataPinjamRows[p];
      if (rowP[0] && String(rowP[0]).trim() !== '') {
        if (isPinjamanSaldo) {
          var rawStatus = String(rowP[5] || 'BELUM_DIBAYAR').toLowerCase();
          var isLunas = rawStatus.indexOf('lunas') !== -1 || rawStatus.indexOf('sudah') !== -1;
          pinjamanSkum.push({
            id: String(rowP[0]),
            tanggal: rowP[1] ? Utilities.formatDate(new Date(rowP[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
            nomorPerkara: 'Kepaniteraan Umum',
            peminjam: String(rowP[2] || 'Kepaniteraan'),
            jumlah: Number(rowP[3]) || 0,
            keterangan: String(rowP[4] || ''),
            status: isLunas ? 'SUDAH_DIBAYAR' : 'BELUM_DIBAYAR',
            statusLunas: isLunas ? 'Lunas' : 'Belum Lunas',
            tanggalBayar: rowP[6] ? Utilities.formatDate(new Date(rowP[6]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : undefined,
            createdAt: String(rowP[7] || '')
          });
        } else {
          pinjamanSkum.push({
            id: String(rowP[0]),
            tanggal: rowP[1] ? Utilities.formatDate(new Date(rowP[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
            nomorPerkara: String(rowP[2] || 'Kepaniteraan Umum'),
            peminjam: String(rowP[3] || ''),
            jumlah: Number(rowP[4]) || 0,
            keterangan: String(rowP[5] || ''),
            status: String(rowP[6] || 'BELUM_DIBAYAR'),
            tanggalBayar: rowP[7] ? Utilities.formatDate(new Date(rowP[7]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : undefined,
            skumPengeluaranId: rowP[8] ? String(rowP[8]) : undefined,
            skumPengembalianId: rowP[9] ? String(rowP[9]) : undefined,
            createdAt: String(rowP[10] || '')
          });
        }
      }
    }
  }

  var response = {
    status: 'success',
    timestamp: new Date().toISOString(),
    cases: cases,
    jurnalSkum: jurnalSkum,
    biayaProses: biayaProses,
    bukuBiayaProses: biayaProses,
    pinjamanSkum: pinjamanSkum,
    pinjamanSaldo: pinjamanSkum
  };

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  setupSheets();
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var payload = data.payload || data.record || data.rec || {};
    var ss = getSpreadsheet();

    // 1. SINKRONISASI TOTAL / BULK (sync_all / save_all)
    if (action === 'sync_all' || action === 'save_all') {
      if (payload.cases && Array.isArray(payload.cases)) {
        writeCasesToSheet(ss, payload.cases);
      }
      if (payload.biayaProses && Array.isArray(payload.biayaProses)) {
        writeBiayaProsesToSheet(ss, payload.biayaProses);
      }
      if (payload.jurnalSkum && Array.isArray(payload.jurnalSkum)) {
        writeJurnalSkumToSheet(ss, payload.jurnalSkum);
      }
      if (payload.pinjamanSkum && Array.isArray(payload.pinjamanSkum)) {
        writePinjamanSkumToSheet(ss, payload.pinjamanSkum);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Sync all complete' })).setMimeType(ContentService.MimeType.JSON);
    }

    var record = payload;

    if (action === 'add_case' || action === 'update_case') {
      var sheet = ss.getSheetByName('DataPerkara');
      var dataRows = sheet.getDataRange().getValues();
      var rowIndex = -1;
      
      var targetId = String(record.id || '').trim();
      var targetNomor = String(record.nomorPerkara || '').trim().toLowerCase();

      for (var i = 1; i < dataRows.length; i++) {
        var rowId = String(dataRows[i][0] || '').trim();
        var rowNomor = String(dataRows[i][1] || '').trim().toLowerCase();
        if ((targetId && rowId === targetId) || (targetNomor && rowNomor === targetNomor)) {
          rowIndex = i + 1;
          break;
        }
      }

      var rowValues = [
        record.id || ('case-' + Date.now()),
        record.nomorPerkara || '',
        record.namaPihak || '',
        record.jenisPerkara || 'Cerai Gugat',
        record.kategoriPerkara || 'Gugatan',
        Number(record.panjarAwal) || 0,
        Number(record.pengeluaran) || 0,
        Number(record.saldoPerkara) || 0,
        record.tanggalRegister || '',
        record.catatan || '',
        record.updatedAt || new Date().toISOString()
      ];

      if (rowIndex > 1) {
        sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }
    } else if (action === 'delete_case') {
      var sheet = ss.getSheetByName('DataPerkara');
      if (sheet) {
        var dataRows = sheet.getDataRange().getValues();
        for (var i = 1; i < dataRows.length; i++) {
          if (String(dataRows[i][0]) === String(record.id) || String(dataRows[i][1]) === String(record.nomorPerkara)) {
            sheet.deleteRow(i + 1);
            break;
          }
        }
      }
    } else if (action === 'add_jurnal_skum' || action === 'update_jurnal_skum') {
      var sheet = ss.getSheetByName('JurnalBiayaSKUM') || ss.getSheetByName('JurnalSKUM');
      if (!sheet) {
        sheet = ss.insertSheet('JurnalBiayaSKUM');
        sheet.appendRow(['ID', 'Tanggal', 'Nomor Perkara', 'Uraian', 'Penerimaan / Debet', 'Pengeluaran / Kredit', 'Kategori', 'Keterangan', 'Warna Baris', 'Created At']);
        sheet.getRange('A1:J1').setFontWeight('bold').setBackground('#bae6fd');
      }
      var rowValues = [
        record.id || ('skum-' + Date.now()),
        record.tanggal || '',
        record.nomorPerkara || '-',
        record.uraian || '',
        Number(record.penerimaan) || 0,
        Number(record.pengeluaran) || 0,
        record.kategori || 'Panggilan',
        record.keterangan || '',
        record.warnaBaris || 'default',
        record.createdAt || new Date().toISOString()
      ];

      var dataRows = sheet.getDataRange().getValues();
      var rowIndex = -1;
      var targetId = String(record.id || '').trim();
      var targetNomor = String(record.nomorPerkara || '').trim().toLowerCase();
      var targetUraian = String(record.uraian || '').trim().toLowerCase();

      if (dataRows.length > 1) {
        for (var j = 1; j < dataRows.length; j++) {
          var rowId = String(dataRows[j][0] || '').trim();
          var rowNomor = String(dataRows[j][2] || '').trim().toLowerCase();
          var rowUraian = String(dataRows[j][3] || '').trim().toLowerCase();
          if ((targetId && rowId === targetId) || (targetNomor && rowNomor === targetNomor && rowUraian === targetUraian)) {
            rowIndex = j + 1;
            break;
          }
        }
      }

      if (rowIndex > 1) {
        sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }
    } else if (action === 'delete_jurnal_skum') {
      var sheet = ss.getSheetByName('JurnalBiayaSKUM') || ss.getSheetByName('JurnalSKUM');
      if (sheet) {
        var dataRows = sheet.getDataRange().getValues();
        var targetId = String(record.id || '').trim();
        var targetNomor = String(record.nomorPerkara || '').trim().toLowerCase();
        var targetUraian = String(record.uraian || '').trim().toLowerCase();
        for (var k = 1; k < dataRows.length; k++) {
          var rowId = String(dataRows[k][0] || '').trim();
          var rowNomor = String(dataRows[k][2] || '').trim().toLowerCase();
          var rowUraian = String(dataRows[k][3] || '').trim().toLowerCase();
          if ((targetId && rowId === targetId) || (targetNomor && rowNomor === targetNomor && rowUraian === targetUraian)) {
            sheet.deleteRow(k + 1);
            break;
          }
        }
      }
    } else if (action === 'add_biaya_proses' || action === 'update_biaya_proses') {
      var sheet = ss.getSheetByName('BukuBiayaProses') || ss.getSheetByName('LogTransaksi') || ss.getSheetByName('BukuBantu');
      if (!sheet) {
        sheet = ss.insertSheet('BukuBiayaProses');
        sheet.appendRow(['ID', 'Tanggal', 'Nomor Perkara', 'Uraian', 'Penerimaan', 'Pengeluaran', 'Kategori', 'Keterangan', 'Created At']);
      }
      var rowValues = [
        record.id || ('bp-' + Date.now()),
        record.tanggal || '',
        record.nomorPerkara || '-',
        record.uraian || '',
        Number(record.penerimaan) || 0,
        Number(record.pengeluaran) || 0,
        record.kategori || 'Proses',
        record.keterangan || '',
        record.createdAt || new Date().toISOString()
      ];
      
      var dataRows = sheet.getDataRange().getValues();
      var rowIndex = -1;
      var targetId = String(record.id || '').trim();
      var targetNomor = String(record.nomorPerkara || '').trim().toLowerCase();
      var targetUraian = String(record.uraian || '').trim().toLowerCase();

      if (dataRows.length > 1) {
        for (var j = 1; j < dataRows.length; j++) {
          var rowId = String(dataRows[j][0] || '').trim();
          var rowNomor = String(dataRows[j][2] || '').trim().toLowerCase();
          var rowUraian = String(dataRows[j][3] || '').trim().toLowerCase();
          if ((targetId && rowId === targetId) || (targetNomor && rowNomor === targetNomor && rowUraian === targetUraian)) {
            rowIndex = j + 1;
            break;
          }
        }
      }

      if (rowIndex > 1) {
        sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }
    } else if (action === 'delete_biaya_proses') {
      var sheet = ss.getSheetByName('BukuBiayaProses') || ss.getSheetByName('LogTransaksi') || ss.getSheetByName('BukuBantu');
      if (sheet) {
        var dataRows = sheet.getDataRange().getValues();
        var targetId = String(record.id || '').trim();
        var targetNomor = String(record.nomorPerkara || '').trim().toLowerCase();
        var targetUraian = String(record.uraian || '').trim().toLowerCase();
        for (var m = 1; m < dataRows.length; m++) {
          var rowId = String(dataRows[m][0] || '').trim();
          var rowNomor = String(dataRows[m][2] || '').trim().toLowerCase();
          var rowUraian = String(dataRows[m][3] || '').trim().toLowerCase();
          if ((targetId && rowId === targetId) || (targetNomor && rowNomor === targetNomor && rowUraian === targetUraian)) {
            sheet.deleteRow(m + 1);
            break;
          }
        }
      }
    } else if (action === 'add_pinjaman_skum' || action === 'update_pinjaman_skum' || action === 'add_pinjaman_saldo' || action === 'update_pinjaman_saldo') {
      var sheet = ss.getSheetByName('PinjamanSaldo') || ss.getSheetByName('PinjamanSKUM');
      if (!sheet) {
        sheet = ss.insertSheet('PinjamanSaldo');
        sheet.appendRow(['ID', 'Tanggal', 'Peminjam', 'Jumlah (Rp)', 'Keterangan', 'Status Lunas', 'Tanggal Lunas', 'Created At']);
        sheet.getRange('A1:H1').setFontWeight('bold').setBackground('#fed7aa');
      }

      var isPinjamanSaldo = sheet.getName() === 'PinjamanSaldo';
      var rowValues;
      if (isPinjamanSaldo) {
        var isLunas = record.status === 'SUDAH_DIBAYAR' || String(record.statusLunas || '').toLowerCase().indexOf('lunas') !== -1;
        rowValues = [
          record.id || ('pinjam-' + Date.now()),
          record.tanggal || '',
          record.peminjam || 'Kepaniteraan',
          Number(record.jumlah || record.jumlahRp) || 0,
          record.keterangan || 'Peminjaman Saldo SKUM',
          isLunas ? 'Lunas' : 'Belum Lunas',
          record.tanggalBayar || record.tanggalLunas || '',
          record.createdAt || new Date().toISOString()
        ];
      } else {
        rowValues = [
          record.id || ('pinjam-' + Date.now()),
          record.tanggal || '',
          record.nomorPerkara || 'Kepaniteraan Umum',
          record.peminjam || '',
          Number(record.jumlah) || 0,
          record.keterangan || '',
          record.status || 'BELUM_DIBAYAR',
          record.tanggalBayar || '',
          record.skumPengeluaranId || '',
          record.skumPengembalianId || '',
          record.createdAt || new Date().toISOString()
        ];
      }

      var dataRows = sheet.getDataRange().getValues();
      var rowIndex = -1;
      var targetId = String(record.id || '').trim();

      if (dataRows.length > 1) {
        for (var p = 1; p < dataRows.length; p++) {
          var rowId = String(dataRows[p][0] || '').trim();
          if (targetId && rowId === targetId) {
            rowIndex = p + 1;
            break;
          }
        }
      }

      if (rowIndex > 1) {
        sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }
    } else if (action === 'delete_pinjaman_skum' || action === 'delete_pinjaman_saldo') {
      var sheet = ss.getSheetByName('PinjamanSaldo') || ss.getSheetByName('PinjamanSKUM');
      if (sheet) {
        var dataRows = sheet.getDataRange().getValues();
        var targetId = String(record.id || '').trim();
        for (var q = 1; q < dataRows.length; q++) {
          var rowId = String(dataRows[q][0] || '').trim();
          if (targetId && rowId === targetId) {
            sheet.deleteRow(q + 1);
            break;
          }
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function writeCasesToSheet(ss, cases) {
  var sheet = ss.getSheetByName('DataPerkara');
  if (!sheet) return;
  sheet.clearContents();
  sheet.appendRow([
    'ID', 'Nomor Perkara', 'Nama Pihak', 'Jenis Perkara', 'Kategori Perkara',
    'Panjar Awal', 'Pengeluaran', 'Saldo Perkara', 'Tanggal Register', 'Catatan', 'Updated At'
  ]);
  sheet.getRange('A1:K1').setFontWeight('bold').setBackground('#d1fae5');
  cases.forEach(function(c) {
    sheet.appendRow([
      c.id, c.nomorPerkara, c.namaPihak, c.jenisPerkara, c.kategoriPerkara,
      c.panjarAwal, c.pengeluaran, c.saldoPerkara, c.tanggalRegister, c.catatan, c.updatedAt
    ]);
  });
}

function writeBiayaProsesToSheet(ss, records) {
  var sheet = ss.getSheetByName('BukuBiayaProses') || ss.getSheetByName('LogTransaksi');
  if (!sheet) return;
  sheet.clearContents();
  sheet.appendRow([
    'ID', 'Tanggal', 'Nomor Perkara', 'Uraian', 'Penerimaan',
    'Pengeluaran', 'Kategori', 'Keterangan', 'Created At'
  ]);
  sheet.getRange('A1:I1').setFontWeight('bold').setBackground('#fef3c7');
  records.forEach(function(r) {
    sheet.appendRow([
      r.id, r.tanggal, r.nomorPerkara, r.uraian, r.penerimaan,
      r.pengeluaran, r.kategori, r.keterangan, r.createdAt
    ]);
  });
}

function writeJurnalSkumToSheet(ss, records) {
  var sheet = ss.getSheetByName('JurnalBiayaSKUM') || ss.getSheetByName('JurnalSKUM');
  if (!sheet) return;
  sheet.clearContents();
  sheet.appendRow([
    'ID', 'Tanggal', 'Nomor Perkara', 'Uraian', 'Penerimaan / Debet',
    'Pengeluaran / Kredit', 'Kategori', 'Keterangan', 'Warna Baris', 'Created At'
  ]);
  sheet.getRange('A1:J1').setFontWeight('bold').setBackground('#bae6fd');
  records.forEach(function(r) {
    sheet.appendRow([
      r.id, r.tanggal, r.nomorPerkara, r.uraian, r.penerimaan || 0,
      r.pengeluaran || 0, r.kategori, r.keterangan || '', r.warnaBaris || 'default', r.createdAt
    ]);
  });
}

function writePinjamanSkumToSheet(ss, records) {
  var sheet = ss.getSheetByName('PinjamanSKUM');
  if (!sheet) return;
  sheet.clearContents();
  sheet.appendRow([
    'ID', 'Tanggal', 'Nomor Perkara', 'Peminjam', 'Jumlah',
    'Keterangan', 'Status', 'Tanggal Bayar', 'SKUM Pengeluaran ID', 'SKUM Pengembalian ID', 'Created At'
  ]);
  sheet.getRange('A1:K1').setFontWeight('bold').setBackground('#fde68a');
  records.forEach(function(r) {
    sheet.appendRow([
      r.id, r.tanggal, r.nomorPerkara, r.peminjam, r.jumlah || 0,
      r.keterangan || '', r.status || 'BELUM_DIBAYAR', r.tanggalBayar || '',
      r.skumPengeluaranId || '', r.skumPengembalianId || '', r.createdAt || ''
    ]);
  });
}`;


  const handleCopyScript = () => {
    navigator.clipboard.writeText(appScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  // Handle direct Google Sheet URL fetch
  const handleSyncFromGoogleSheets = async () => {
    if (!googleSheetUrl) {
      setSyncMessage({ type: 'error', text: 'Silakan masukkan URL Google Sheets publik terlebih dahulu.' });
      return;
    }

    setIsSyncing(true);
    setSyncMessage(null);

    try {
      if (onTriggerLiveSync) {
        onSaveSyncSettings({
          ...syncSettings,
          googleSheetUrl,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'syncing'
        });
        await onTriggerLiveSync();
        onSaveSyncSettings({
          ...syncSettings,
          googleSheetUrl,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'success'
        });
        setSyncMessage({
          type: 'success',
          text: 'Berhasil menyinkronkan seluruh data (Perkara, Jurnal SKUM, Biaya Proses, & Pinjaman) secara langsung dari Google Sheets!'
        });
      } else {
        const records = await SyncService.fetchGoogleSheetCsv(googleSheetUrl);
        if (records.length === 0) {
          throw new Error('Spreadsheet kosong atau format kolom tidak dikenali.');
        }

        onImportCases(records);
        onSaveSyncSettings({
          ...syncSettings,
          googleSheetUrl,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'success'
        });

        setSyncMessage({
          type: 'success',
          text: `Berhasil sinkronisasi ${records.length} data perkara dari Google Sheets!`
        });
      }
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: err.message || 'Gagal terhubung dengan Google Sheets. Pastikan spreadsheet dipublikasikan ke web (File > Bagikan > Publikasikan ke web).'
      });
      onSaveSyncSettings({
        ...syncSettings,
        syncStatus: 'error',
        errorMessage: err.message
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle manual CSV text paste or file load
  const handleParseCsvText = () => {
    if (!csvRawText.trim()) {
      setSyncMessage({ type: 'error', text: 'Teks CSV atau data spreadsheet masih kosong.' });
      return;
    }

    try {
      const records = SyncService.parseCsv(csvRawText);
      if (records.length === 0) {
        throw new Error('Format CSV tidak valid atau kolom utama tidak ditemukan.');
      }

      onImportCases(records);
      setSyncMessage({
        type: 'success',
        text: `Berhasil mengimpor ${records.length} data perkara dari CSV!`
      });
      setCsvRawText('');
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: err.message || 'Gagal menguraikan data CSV.'
      });
    }
  };

  // Load sample header template provided in user request
  const handleLoadUserSample = () => {
    const sample = `Nomor Perkara,Nama Pihak,Jenis Perkara,Saldo Perkara (Rp),Kategori,Panjar Awal (Rp),Tanggal Register`;
    setCsvRawText(sample);
  };

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
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6 flex items-center justify-center">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className={`border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors text-slate-100 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
            }`}>
              
              {/* Modal Header */}
              <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/80 border-slate-700/80'
              }`}>
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <DialogTitle as="h3" className={`font-extrabold text-base ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    Integrasi & Sinkronisasi Google Sheets
                  </DialogTitle>
                </div>
                <button
                  onClick={onClose}
                  className={`p-1 rounded-lg transition-colors ${
                    isLight ? 'text-slate-500 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Answer Banner */}
          <div className={`p-4 rounded-xl border flex items-start space-x-3 text-xs leading-relaxed ${
            isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
          }`}>
            <Sparkles className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-emerald-800">
                Struktur 2 Sheet Google Sheets (DataPerkara & LogTransaksi)
              </p>
              <p className="mt-1">
                Aplikasi ini mendukung penuh struktur 2 sheet Google Sheets Anda:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-white border-emerald-200' : 'bg-slate-900 border-slate-700'}`}>
                  <span className="font-bold text-emerald-700 block mb-1">1. Sheet `DataPerkara` (12 Kolom)</span>
                  <code className="text-[10px] text-slate-600 block leading-tight">
                    nomor_perkara | nama_pihak | jenis_perkara | tingkat_perkara | tanggal_register | tanggal_terima_kasasi_pk | tanggal_putus | status | panjar_awal | Aksi | pengeluaran | saldo_perkara
                  </code>
                </div>
                <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-white border-emerald-200' : 'bg-slate-900 border-slate-700'}`}>
                  <span className="font-bold text-amber-700 block mb-1">2. Sheet `LogTransaksi` (7 Kolom)</span>
                  <code className="text-[10px] text-slate-600 block leading-tight">
                    tanggal | nomor_perkara | uraian | penerimaan | pengeluaran | kategori | keterangan
                  </code>
                </div>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-emerald-900">
                💡 <strong>Catatan Penting</strong>: Anda <strong>TIDAK PERLU</strong> membuat sheet baru untuk "Potong Biaya ATK Masuk Buku Bantu"! Karena transaksi potongan ATK otomatis masuk sebagai baris <u>Penerimaan</u> (Rp 100.000) di sheet <strong>`LogTransaksi`</strong>.
              </p>
            </div>
          </div>

          {/* Status Alert Banner */}
          {syncMessage && (
            <div className={`p-3.5 rounded-xl border flex items-start space-x-3 text-xs ${
              syncMessage.type === 'success'
                ? isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : isLight ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-rose-950/60 border-rose-800 text-rose-300'
            }`}>
              {syncMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              )}
              <div>
                <p className="font-semibold">{syncMessage.type === 'success' ? 'Berhasil' : 'Gagal'}</p>
                <p className="mt-0.5 leading-relaxed">{syncMessage.text}</p>
              </div>
            </div>
          )}

          {/* OPSI 1: GOOGLE APPS SCRIPT WEB-HOOK AUTO WRITE */}
          <div className={`border rounded-xl p-4 space-y-3 ${
            isLight ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-800/60 border-slate-700/70'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-amber-900' : 'text-slate-100'}`}>
                  Cara 1: Google Apps Script Webhook (Auto-Record Real-time)
                </h4>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                isLight ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}>
                Rekomendasi Utama
              </span>
            </div>

            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Salin skrip di bawah ke Google Sheets Anda (<strong>Ekstensi &gt; Apps Script</strong>) lalu terbitkan sebagai Web App. Setiap kali ada perkara / transaksi baru, data akan langsung otomatis tercatat di baris spreadsheet Anda!
            </p>

            <div className="relative">
              <pre className={`p-3 rounded-lg text-[11px] font-mono overflow-x-auto border max-h-36 ${
                isLight ? 'bg-slate-900 text-amber-300 border-slate-800' : 'bg-slate-950 text-amber-300 border-slate-800'
              }`}>
                {appScriptCode}
              </pre>
              <button
                onClick={handleCopyScript}
                className="absolute top-2 right-2 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold flex items-center space-x-1 shadow"
              >
                {copiedScript ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Tersalin!' : 'Salin Skrip'}</span>
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <label className={`text-xs font-semibold block ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                URL Web App Google Apps Script Anda (Opsional):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                  }`}
                />
                <button
                  onClick={() => {
                    onSaveSyncSettings({
                      ...syncSettings,
                      googleSheetWebhookUrl: webhookUrl
                    });
                    setSyncMessage({ type: 'success', text: 'URL Webhook Google Apps Script berhasil disimpan!' });
                  }}
                  className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Simpan Webhook
                </button>
              </div>
            </div>
          </div>

          {/* OPSI 2: REAL-TIME GOOGLE SHEETS READ (CSV URL) */}
          <div className={`border rounded-xl p-4 space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700/70'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <LinkIcon className="w-4 h-4 text-emerald-600" />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
                  Cara 2: Tarik Data dari Tautan Google Sheets (CSV URL)
                </h4>
              </div>
              {syncSettings.lastSyncedAt && (
                <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Terakhir sinkron: {new Date(syncSettings.lastSyncedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Masukkan tautan Google Sheets publik (File &gt; Bagikan &gt; Publikasikan ke Web &gt; CSV). Aplikasi akan menarik data perkara dari sheet.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                id="input-google-sheets-url"
                type="url"
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                }`}
              />
              <button
                onClick={handleSyncFromGoogleSheets}
                disabled={isSyncing}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Menghubungkan...' : 'Tarik Data'}</span>
              </button>
            </div>
          </div>

          {/* OPSI 3: MANUAL CSV PASTE OR SAMPLE */}
          <div className={`border rounded-xl p-4 space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700/70'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
                  Cara 3: Impor Manual CSV / Spreadsheet Text
                </h4>
              </div>
              <button
                onClick={handleLoadUserSample}
                className="text-[11px] text-emerald-600 hover:underline font-bold flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Isi Contoh Data</span>
              </button>
            </div>

            <textarea
              id="input-csv-textarea"
              rows={4}
              value={csvRawText}
              onChange={(e) => setCsvRawText(e.target.value)}
              placeholder={`Nomor Perkara,Nama Pihak,Jenis Perkara,Saldo Perkara (Rp),Kategori,Panjar Awal (Rp),Tanggal Register`}
              className={`w-full border rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-200'
              }`}
            />

            <div className="flex items-center justify-between">
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Kolom minimum: <code className="text-emerald-700 font-mono">Nomor Perkara</code>, <code className="text-emerald-700 font-mono">Nama Pihak</code>, <code className="text-emerald-700 font-mono">Jenis Perkara</code>, <code className="text-emerald-700 font-mono">Saldo Perkara (Rp)</code>
              </p>
              <button
                onClick={handleParseCsvText}
                className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                <span>Impor Teks CSV</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex justify-end shrink-0 ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/80 border-slate-700'
        }`}>
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-colors ${
              isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Tutup
          </button>
        </div>

            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};
