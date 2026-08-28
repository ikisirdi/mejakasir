/**
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

  // 4. Sheet PinjamanSKUM (Pinjaman Saldo SKUM Kepaniteraan)
  var sheetPinjam = ss.getSheetByName('PinjamanSKUM');
  if (!sheetPinjam) {
    sheetPinjam = ss.insertSheet('PinjamanSKUM');
    sheetPinjam.appendRow([
      'ID', 'Tanggal', 'Nomor Perkara', 'Peminjam', 'Jumlah',
      'Keterangan', 'Status', 'Tanggal Bayar', 'SKUM Pengeluaran ID', 'SKUM Pengembalian ID', 'Created At'
    ]);
    sheetPinjam.getRange('A1:K1').setFontWeight('bold').setBackground('#fde68a');
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

  // Fetch PinjamanSKUM
  var sheetPinjam = ss.getSheetByName('PinjamanSKUM');
  var pinjamanSkum = [];
  if (sheetPinjam) {
    var dataPinjamRows = sheetPinjam.getDataRange().getValues();
    for (var p = 1; p < dataPinjamRows.length; p++) {
      var rowP = dataPinjamRows[p];
      if (rowP[0] && String(rowP[0]).trim() !== '') {
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

  var response = {
    status: 'success',
    timestamp: new Date().toISOString(),
    cases: cases,
    jurnalSkum: jurnalSkum,
    biayaProses: biayaProses,
    pinjamanSkum: pinjamanSkum
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
    } else if (action === 'add_pinjaman_skum' || action === 'update_pinjaman_skum') {
      var sheet = ss.getSheetByName('PinjamanSKUM');
      if (!sheet) {
        sheet = ss.insertSheet('PinjamanSKUM');
        sheet.appendRow(['ID', 'Tanggal', 'Nomor Perkara', 'Peminjam', 'Jumlah', 'Keterangan', 'Status', 'Tanggal Bayar', 'SKUM Pengeluaran ID', 'SKUM Pengembalian ID', 'Created At']);
      }
      var rowValues = [
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
    } else if (action === 'delete_pinjaman_skum') {
      var sheet = ss.getSheetByName('PinjamanSKUM');
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
}
