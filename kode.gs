/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - SINKRONISASI BUKU KAS SKUM & DATA PERKARA PENGADILAN
 * Mendukung 6 Modul Utama:
 * 1. DataPerkara / SaldoPerkara (Daftar Register & Saldo Panjar Perkara)
 * 2. BukuBiayaProses (Buku Bantu Biaya Proses / ATK Kantor)
 * 3. JurnalBiayaSKUM (Jurnal Transaksi Kas SKUM Perkara)
 * 4. PinjamanSaldo / PinjamanSKUM (Pinjaman Saldo Kasir SKUM & Status Lunas)
 * 5. KasOpnameKasir (Berita Acara Pemeriksaan Kas Fisik Harian Kasir)
 * 6. SimulasiAtkPerkara (Buku Pembantu ATK & Simulasi AI Perkara Selesai/Putus Rp0)
 * =========================================================================
 */

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Sheet DataPerkara / SaldoPerkara
  var sheetCases = ss.getSheetByName('DataPerkara') || ss.getSheetByName('Perkara') || ss.getSheetByName('SaldoPerkara') || ss.getSheetByName('Saldo Perkara');
  if (!sheetCases) {
    sheetCases = ss.insertSheet('DataPerkara');
    sheetCases.appendRow([
      'ID', 'Nomor Perkara', 'Nama Pihak', 'Jenis Perkara', 'Kategori Perkara',
      'Panjar Awal', 'Pengeluaran', 'Saldo Perkara', 'Tanggal Register', 'Catatan', 'Updated At'
    ]);
    sheetCases.getRange('A1:K1').setFontWeight('bold').setBackground('#d1fae5');
  }

  // 2. Sheet BukuBiayaProses
  var sheetBiaya = ss.getSheetByName('BukuBiayaProses') || ss.getSheetByName('LogTransaksi') || ss.getSheetByName('BukuBantu');
  if (!sheetBiaya) {
    sheetBiaya = ss.insertSheet('BukuBiayaProses');
    sheetBiaya.appendRow([
      'ID', 'Tanggal', 'Nomor Perkara', 'Uraian', 'Penerimaan',
      'Pengeluaran', 'Kategori', 'Keterangan', 'Created At'
    ]);
    sheetBiaya.getRange('A1:I1').setFontWeight('bold').setBackground('#fef3c7');
  }

  // 3. Sheet JurnalBiayaSKUM
  var sheetJurnal = ss.getSheetByName('JurnalBiayaSKUM') || ss.getSheetByName('JurnalSKUM');
  if (!sheetJurnal) {
    sheetJurnal = ss.insertSheet('JurnalBiayaSKUM');
    sheetJurnal.appendRow([
      'ID', 'Tanggal', 'Nomor Perkara', 'Uraian', 'Penerimaan / Debet',
      'Pengeluaran / Kredit', 'Kategori', 'Keterangan', 'Warna Baris', 'Created At'
    ]);
    sheetJurnal.getRange('A1:J1').setFontWeight('bold').setBackground('#bae6fd');
  }

  // 4. Sheet PinjamanSaldo
  var sheetPinjam = ss.getSheetByName('PinjamanSaldo') || ss.getSheetByName('PinjamanSKUM') || ss.getSheetByName('Pinjaman');
  if (!sheetPinjam) {
    sheetPinjam = ss.insertSheet('PinjamanSaldo');
    sheetPinjam.appendRow([
      'ID', 'Tanggal', 'Peminjam', 'Jumlah (Rp)', 'Keterangan', 'Status Lunas', 'Tanggal Lunas', 'Created At'
    ]);
    sheetPinjam.getRange('A1:H1').setFontWeight('bold').setBackground('#fed7aa');
  }

  // 5. Sheet KasOpnameKasir
  var sheetOpname = ss.getSheetByName('KasOpnameKasir') || ss.getSheetByName('KasOpname');
  if (!sheetOpname) {
    sheetOpname = ss.insertSheet('KasOpnameKasir');
    sheetOpname.appendRow([
      'ID', 'Tanggal', 'Saldo Fisik Kasir (Rp)', 'Saldo Standar Buku (Rp)', 'Selisih (Rp)',
      'Status Selisih', 'Mode Kas Belum Setor', 'Custom Kas Belum Setor (Rp)', 'Pecahan Denominasi JSON', 'Catatan', 'Updated At'
    ]);
    sheetOpname.getRange('A1:K1').setFontWeight('bold').setBackground('#c7d2fe');
  }

  // 6. Sheet SimulasiAtkPerkara (Buku Bantu ATK Perkara)
  var sheetSimAtk = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
  if (!sheetSimAtk) {
    sheetSimAtk = ss.insertSheet('SimulasiAtkPerkara');
    sheetSimAtk.appendRow([
      'ID', 'Tanggal', 'Nomor Perkara', 'Uraian / Jenis ATK', 'Penerimaan / Debet',
      'Pengeluaran / Kredit', 'Kategori', 'Keterangan', 'AI Generated', 'Created At'
    ]);
    sheetSimAtk.getRange('A1:J1').setFontWeight('bold').setBackground('#e9d5ff');
  }
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. DataPerkara / SaldoPerkara
  var sheetCases = ss.getSheetByName('DataPerkara') || ss.getSheetByName('Perkara') || ss.getSheetByName('SaldoPerkara') || ss.getSheetByName('Saldo Perkara') || ss.getSheetByName('Data Perkara') || ss.getSheets()[0];
  var cases = [];
  if (sheetCases) {
    var dataRows = sheetCases.getDataRange().getValues();
    var headers = dataRows.length > 0 ? dataRows[0].map(function(h) { return String(h || '').toLowerCase().trim(); }) : [];
    var hasIdCol = headers.length > 0 && (headers[0] === 'id' || headers[0].indexOf('id') !== -1);
    var noPerkIdx = -1, namaIdx = -1, panjarIdx = -1, pengeluaranIdx = -1, saldoIdx = -1;
    for (var h = 0; h < headers.length; h++) {
      if (headers[h].indexOf('nomor') !== -1 || headers[h].indexOf('perkara') !== -1 || headers[h] === 'no') noPerkIdx = h;
      if (headers[h].indexOf('nama') !== -1 || headers[h].indexOf('pihak') !== -1) namaIdx = h;
      if (headers[h].indexOf('panjar') !== -1 || headers[h].indexOf('penerimaan') !== -1) panjarIdx = h;
      if (headers[h].indexOf('pengeluaran') !== -1 || headers[h].indexOf('biaya') !== -1) pengeluaranIdx = h;
      if (headers[h].indexOf('saldo') !== -1 || headers[h].indexOf('sisa') !== -1) saldoIdx = h;
    }
    if (noPerkIdx === -1) noPerkIdx = hasIdCol ? 1 : 0;
    if (namaIdx === -1) namaIdx = hasIdCol ? 2 : 1;
    if (panjarIdx === -1) panjarIdx = hasIdCol ? 5 : 4;
    if (pengeluaranIdx === -1) pengeluaranIdx = hasIdCol ? 6 : 5;
    if (saldoIdx === -1) saldoIdx = hasIdCol ? 7 : 6;

    for (var i = 1; i < dataRows.length; i++) {
      var row = dataRows[i];
      if (row[noPerkIdx] && String(row[noPerkIdx]).trim() !== '') {
        cases.push({
          id: hasIdCol ? String(row[0]) : ('case-' + i),
          nomorPerkara: String(row[noPerkIdx] || ''),
          namaPihak: String(row[namaIdx] || 'Pihak Berperkara'),
          jenisPerkara: String(row[3] || 'Cerai Gugat'),
          kategoriPerkara: String(row[4] || 'Gugatan'),
          panjarAwal: Number(row[panjarIdx]) || 0,
          pengeluaran: Number(row[pengeluaranIdx]) || 0,
          saldoPerkara: Number(row[saldoIdx]) || 0,
          tanggalRegister: row[8] ? (row[8] instanceof Date ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(row[8]).split('T')[0]) : '',
          catatan: String(row[9] || ''),
          updatedAt: String(row[10] || new Date().toISOString())
        });
      }
    }
  }

  // 2. JurnalBiayaSKUM
  var sheetJurnal = ss.getSheetByName('JurnalBiayaSKUM') || ss.getSheetByName('JurnalSKUM');
  var jurnalSkum = [];
  if (sheetJurnal) {
    var dataJurnalRows = sheetJurnal.getDataRange().getValues();
    for (var j = 1; j < dataJurnalRows.length; j++) {
      var rowJ = dataJurnalRows[j];
      if (rowJ[0] && String(rowJ[0]).trim() !== '') {
        jurnalSkum.push({
          id: String(rowJ[0]),
          tanggal: rowJ[1] ? (rowJ[1] instanceof Date ? Utilities.formatDate(rowJ[1], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(rowJ[1]).split('T')[0]) : '',
          nomorPerkara: String(rowJ[2] || ''),
          uraian: String(rowJ[3] || ''),
          penerimaan: Number(rowJ[4]) || 0,
          pengeluaran: Number(rowJ[5]) || 0,
          kategori: String(rowJ[6] || 'Panjar'),
          keterangan: String(rowJ[7] || ''),
          warnaBaris: String(rowJ[8] || 'default'),
          createdAt: String(rowJ[9] || '')
        });
      }
    }
  }

  // 3. BukuBiayaProses
  var sheetBiaya = ss.getSheetByName('BukuBiayaProses') || ss.getSheetByName('LogTransaksi') || ss.getSheetByName('BukuBantu');
  var biayaProses = [];
  if (sheetBiaya) {
    var dataBiayaRows = sheetBiaya.getDataRange().getValues();
    for (var k = 1; k < dataBiayaRows.length; k++) {
      var b = dataBiayaRows[k];
      if (b[0] && String(b[0]).trim() !== '') {
        biayaProses.push({
          id: String(b[0]),
          tanggal: b[1] ? (b[1] instanceof Date ? Utilities.formatDate(b[1], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(b[1]).split('T')[0]) : '',
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

  // 4. PinjamanSaldo / PinjamanSKUM
  var sheetPinjam = ss.getSheetByName('PinjamanSaldo') || ss.getSheetByName('PinjamanSKUM') || ss.getSheetByName('Pinjaman');
  var pinjamanSkum = [];
  if (sheetPinjam) {
    var dataPinjamRows = sheetPinjam.getDataRange().getValues();
    var isPinjamanSaldo = (sheetPinjam.getName() === 'PinjamanSaldo') || (dataPinjamRows.length > 0 && String(dataPinjamRows[0][2] || '').toLowerCase().indexOf('peminjam') !== -1);
    for (var p = 1; p < dataPinjamRows.length; p++) {
      var rowP = dataPinjamRows[p];
      if (rowP[0] && String(rowP[0]).trim() !== '') {
        if (isPinjamanSaldo) {
          var rawStatus = String(rowP[5] || 'BELUM_DIBAYAR').toLowerCase().trim();
          var isLunas = (rawStatus === 'lunas' || rawStatus === 'sudah_dibayar' || rawStatus === 'sudah lunas' || rawStatus === 'paid' ||
                        (rawStatus.indexOf('lunas') !== -1 || rawStatus.indexOf('sudah') !== -1 || rawStatus.indexOf('paid') !== -1)) &&
                        rawStatus.indexOf('belum') === -1 && rawStatus.indexOf('unpaid') === -1 && rawStatus.indexOf('tidak') === -1;
          var nomorPerkaraVal = 'Kepaniteraan Umum';
          var ketVal = String(rowP[4] || '');
          var peminjamVal = String(rowP[2] || 'Kepaniteraan');
          var matchPerk = (ketVal + ' ' + peminjamVal).match(/(?:Perkara\s+)?(\d+\/Pdt\.[G|P]\/\d{4}\/PA\.[A-Za-z]+)/i);
          if (matchPerk && matchPerk[1]) {
            nomorPerkaraVal = matchPerk[1];
          }
          pinjamanSkum.push({
            id: String(rowP[0]),
            tanggal: rowP[1] ? (rowP[1] instanceof Date ? Utilities.formatDate(rowP[1], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(rowP[1]).split('T')[0]) : '',
            nomorPerkara: nomorPerkaraVal,
            peminjam: peminjamVal,
            jumlah: Number(rowP[3]) || 0,
            keterangan: ketVal,
            status: isLunas ? 'SUDAH_DIBAYAR' : 'BELUM_DIBAYAR',
            statusLunas: isLunas ? 'Lunas' : 'Belum Lunas',
            tanggalBayar: isLunas && rowP[6] ? (rowP[6] instanceof Date ? Utilities.formatDate(rowP[6], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(rowP[6]).split('T')[0]) : undefined,
            createdAt: String(rowP[7] || '')
          });
        } else {
          var rawStatus = String(rowP[6] || 'BELUM_DIBAYAR').toLowerCase().trim();
          var isLunas = (rawStatus === 'lunas' || rawStatus === 'sudah_dibayar' || rawStatus === 'sudah lunas' || rawStatus === 'paid' ||
                        (rawStatus.indexOf('lunas') !== -1 || rawStatus.indexOf('sudah') !== -1 || rawStatus.indexOf('paid') !== -1)) &&
                        rawStatus.indexOf('belum') === -1 && rawStatus.indexOf('unpaid') === -1 && rawStatus.indexOf('tidak') === -1;
          pinjamanSkum.push({
            id: String(rowP[0]),
            tanggal: rowP[1] ? (rowP[1] instanceof Date ? Utilities.formatDate(rowP[1], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(rowP[1]).split('T')[0]) : '',
            nomorPerkara: String(rowP[2] || 'Kepaniteraan Umum'),
            peminjam: String(rowP[3] || ''),
            jumlah: Number(rowP[4]) || 0,
            keterangan: String(rowP[5] || ''),
            status: isLunas ? 'SUDAH_DIBAYAR' : 'BELUM_DIBAYAR',
            statusLunas: isLunas ? 'Lunas' : 'Belum Lunas',
            tanggalBayar: isLunas && rowP[7] ? (rowP[7] instanceof Date ? Utilities.formatDate(rowP[7], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(rowP[7]).split('T')[0]) : undefined,
            skumPengeluaranId: rowP[8] ? String(rowP[8]) : undefined,
            skumPengembalianId: rowP[9] ? String(rowP[9]) : undefined,
            createdAt: String(rowP[10] || '')
          });
        }
      }
    }
  }

  // 5. KasOpnameKasir
  var sheetOpname = ss.getSheetByName('KasOpnameKasir') || ss.getSheetByName('KasOpname');
  var kasOpnameData = null;
  if (sheetOpname) {
    var dataOpnameRows = sheetOpname.getDataRange().getValues();
    if (dataOpnameRows.length > 1) {
      var latestRow = dataOpnameRows[dataOpnameRows.length - 1];
      if (latestRow[0] && String(latestRow[0]).trim() !== '') {
        var parsedDenom = {};
        try {
          if (latestRow[8]) {
            parsedDenom = typeof latestRow[8] === 'object' ? latestRow[8] : JSON.parse(String(latestRow[8]));
          }
        } catch (err) {
          parsedDenom = {};
        }
        kasOpnameData = {
          id: String(latestRow[0]),
          tanggal: latestRow[1] ? (latestRow[1] instanceof Date ? Utilities.formatDate(latestRow[1], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(latestRow[1]).split('T')[0]) : '',
          saldoFisikKasir: Number(latestRow[2]) || 0,
          saldoStandarBuku: Number(latestRow[3]) || 0,
          selisih: Number(latestRow[4]) || 0,
          statusSelisih: String(latestRow[5] || 'PAS'),
          modeKasBelumSetor: String(latestRow[6] || 'auto'),
          customKasBelumSetor: Number(latestRow[7]) || 0,
          denominations: parsedDenom,
          catatan: String(latestRow[9] || ''),
          updatedAt: String(latestRow[10] || '')
        };
      }
    }
  }

  // 6. SimulasiAtkPerkara (Buku Pembantu ATK Perkara)
  var sheetSimAtk = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
  var simulasiAtk = [];
  if (sheetSimAtk) {
    var simData = sheetSimAtk.getDataRange().getValues();
    for (var s = 1; s < simData.length; s++) {
      var rSim = simData[s];
      if (rSim[0] && String(rSim[0]).trim() !== '') {
        simulasiAtk.push({
          id: String(rSim[0]),
          tanggal: rSim[1] ? (rSim[1] instanceof Date ? Utilities.formatDate(rSim[1], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(rSim[1]).split('T')[0]) : '',
          nomorPerkara: String(rSim[2] || '-'),
          uraian: String(rSim[3] || ''),
          penerimaan: Number(rSim[4]) || 0,
          pengeluaran: Number(rSim[5]) || 0,
          kategori: String(rSim[6] || 'ATK'),
          keterangan: String(rSim[7] || ''),
          isAiGenerated: String(rSim[8] || '').toUpperCase() === 'TRUE',
          createdAt: String(rSim[9] || '')
        });
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    data: cases,
    cases: cases,
    jurnalSkum: jurnalSkum,
    biayaProses: biayaProses,
    pinjamanSkum: pinjamanSkum,
    pinjamanSaldo: pinjamanSkum,
    kasOpname: kasOpnameData,
    simulasiAtk: simulasiAtk,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupSheets();

    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var payload = requestData.payload || requestData.data || requestData;
    var record = requestData.record || requestData.rec || payload;

    // Aksi Sinkronisasi Massal Lengkap (Batch Sync)
    if (action === 'batch_sync' || action === 'update_all' || action === 'sync_all' || action === 'save_all') {
      if (payload.cases && payload.cases.length > 0) {
        writeCasesToSheet(ss, payload.cases);
      }
      if (payload.biayaProses && payload.biayaProses.length > 0) {
        writeBiayaProsesToSheet(ss, payload.biayaProses);
      }
      if (payload.jurnalSkum && payload.jurnalSkum.length > 0) {
        writeJurnalSkumToSheet(ss, payload.jurnalSkum);
      }
      if (payload.pinjamanSkum && payload.pinjamanSkum.length > 0) {
        writePinjamanSkumToSheet(ss, payload.pinjamanSkum);
      }
      if (payload.kasOpname && typeof payload.kasOpname === 'object') {
        writeKasOpnameToSheet(ss, payload.kasOpname);
      }
      if (payload.simulasiAtk && Array.isArray(payload.simulasiAtk)) {
        writeSimulasiAtkToSheet(ss, payload.simulasiAtk);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Full sync completed' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Aksi Data Perkara / Saldo Perkara
    if (action === 'add_case' || action === 'update_case') {
      var sheet = ss.getSheetByName('DataPerkara') || ss.getSheetByName('Perkara') || ss.getSheetByName('SaldoPerkara') || ss.getSheetByName('Saldo Perkara') || ss.getSheetByName('Data Perkara') || ss.getSheets()[0];
      if (!sheet) {
        sheet = ss.insertSheet('DataPerkara');
        sheet.appendRow([
          'ID', 'Nomor Perkara', 'Nama Pihak', 'Jenis Perkara', 'Kategori Perkara',
          'Panjar Awal', 'Pengeluaran', 'Saldo Perkara', 'Tanggal Register', 'Catatan', 'Updated At'
        ]);
        sheet.getRange('A1:K1').setFontWeight('bold').setBackground('#d1fae5');
      }

      var dataRows = sheet.getDataRange().getValues();
      var rowIndex = -1;
      
      var targetId = String(record.id || '').trim();
      var targetNomor = String(record.nomorPerkara || '').trim().toLowerCase();
      var cleanTargetNomor = targetNomor.replace(/[^a-z0-9]/g, '');

      var headers = dataRows.length > 0 ? dataRows[0].map(function(h) { return String(h || '').toLowerCase().trim(); }) : [];
      var hasIdCol = headers.length > 0 && (headers[0] === 'id' || headers[0].indexOf('id') !== -1);
      var noPerkColIdx = -1;
      for (var h = 0; h < headers.length; h++) {
        if (headers[h].indexOf('nomor') !== -1 || headers[h].indexOf('perkara') !== -1 || headers[h] === 'no') {
          noPerkColIdx = h;
          break;
        }
      }
      if (noPerkColIdx === -1) noPerkColIdx = hasIdCol ? 1 : 0;

      for (var i = 1; i < dataRows.length; i++) {
        var rowId = String(dataRows[i][0] || '').trim();
        var rowNomor = String(dataRows[i][noPerkColIdx] || dataRows[i][1] || dataRows[i][0] || '').trim().toLowerCase();
        var cleanRowNomor = rowNomor.replace(/[^a-z0-9]/g, '');
        if ((targetId && rowId === targetId) || 
            (targetNomor && rowNomor === targetNomor) || 
            (cleanTargetNomor && cleanRowNomor && cleanTargetNomor === cleanRowNomor)) {
          rowIndex = i + 1;
          break;
        }
      }

      var saldoColIdx = -1, panjarColIdx = -1, pengeluaranColIdx = -1;
      for (var c = 0; c < headers.length; c++) {
        if (headers[c].indexOf('saldo') !== -1 || headers[c].indexOf('sisa') !== -1) saldoColIdx = c + 1;
        if (headers[c].indexOf('panjar') !== -1 || headers[c].indexOf('penerimaan') !== -1) panjarColIdx = c + 1;
        if (headers[c].indexOf('pengeluaran') !== -1 || headers[c].indexOf('biaya') !== -1) pengeluaranColIdx = c + 1;
      }

      if (rowIndex > 1 && saldoColIdx > 0 && panjarColIdx > 0 && pengeluaranColIdx > 0) {
        sheet.getRange(rowIndex, panjarColIdx).setValue(Number(record.panjarAwal) || 0);
        sheet.getRange(rowIndex, pengeluaranColIdx).setValue(Number(record.pengeluaran) || 0);
        sheet.getRange(rowIndex, saldoColIdx).setValue(Number(record.saldoPerkara) || 0);
      } else {
        var rowValues = hasIdCol ? [
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
        ] : [
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
      }
    } else if (action === 'delete_case') {
      var sheet = ss.getSheetByName('DataPerkara') || ss.getSheetByName('Perkara') || ss.getSheetByName('SaldoPerkara') || ss.getSheetByName('Saldo Perkara');
      if (sheet) {
        var dataRows = sheet.getDataRange().getValues();
        var targetId = String(record.id || '').trim();
        var targetNomor = String(record.nomorPerkara || '').trim().toLowerCase();
        for (var d = 1; d < dataRows.length; d++) {
          var rowId = String(dataRows[d][0] || '').trim();
          var rowNomor = String(dataRows[d][1] || dataRows[d][0] || '').trim().toLowerCase();
          if ((targetId && rowId === targetId) || (targetNomor && rowNomor === targetNomor)) {
            sheet.deleteRow(d + 1);
            break;
          }
        }
      }
    }

    // Aksi Jurnal Biaya SKUM
    else if (action === 'add_jurnal_skum' || action === 'update_jurnal_skum') {
      var sheet = ss.getSheetByName('JurnalBiayaSKUM') || ss.getSheetByName('JurnalSKUM');
      if (!sheet) {
        sheet = ss.insertSheet('JurnalBiayaSKUM');
        sheet.appendRow(['ID', 'Tanggal', 'Nomor Perkara', 'Uraian', 'Penerimaan / Debet', 'Pengeluaran / Kredit', 'Kategori', 'Keterangan', 'Warna Baris', 'Created At']);
      }
      var rowValues = [
        record.id || ('skum-' + Date.now()),
        record.tanggal || '',
        record.nomorPerkara || '',
        record.uraian || '',
        Number(record.penerimaan) || 0,
        Number(record.pengeluaran) || 0,
        record.kategori || 'Panjar',
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
        for (var k = 1; k < dataRows.length; k++) {
          var rowId = String(dataRows[k][0] || '').trim();
          var rowNomor = String(dataRows[k][2] || '').trim().toLowerCase();
          var rowUraian = String(dataRows[k][3] || '').trim().toLowerCase();
          if ((targetId && rowId === targetId) || (targetNomor && rowNomor === targetNomor && rowUraian === targetUraian)) {
            rowIndex = k + 1;
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
        for (var l = 1; l < dataRows.length; l++) {
          var rowId = String(dataRows[l][0] || '').trim();
          var rowNomor = String(dataRows[l][2] || '').trim().toLowerCase();
          var rowUraian = String(dataRows[l][3] || '').trim().toLowerCase();
          if ((targetId && rowId === targetId) || (targetNomor && rowNomor === targetNomor && rowUraian === targetUraian)) {
            sheet.deleteRow(l + 1);
            break;
          }
        }
      }
    }

    // Aksi Pinjaman Saldo SKUM (Status Lunas & Belum Lunas)
    else if (action === 'add_pinjaman_skum' || action === 'update_pinjaman_skum' || action === 'add_pinjaman_saldo' || action === 'update_pinjaman_saldo') {
      var sheet = ss.getSheetByName('PinjamanSaldo') || ss.getSheetByName('PinjamanSKUM') || ss.getSheetByName('Pinjaman');
      if (!sheet) {
        sheet = ss.insertSheet('PinjamanSaldo');
        sheet.appendRow(['ID', 'Tanggal', 'Peminjam', 'Jumlah (Rp)', 'Keterangan', 'Status Lunas', 'Tanggal Lunas', 'Created At']);
        sheet.getRange('A1:H1').setFontWeight('bold').setBackground('#fed7aa');
      }

      var isPinjamanSaldo = sheet.getName() === 'PinjamanSaldo';
      var rawStatusInput = String(record.statusLunas || record.status || '').toLowerCase().trim();
      var isLunas = (record.status === 'SUDAH_DIBAYAR' || rawStatusInput === 'lunas' || rawStatusInput === 'sudah lunas' || rawStatusInput === 'paid' ||
                    (rawStatusInput.indexOf('lunas') !== -1 || rawStatusInput.indexOf('sudah') !== -1 || rawStatusInput.indexOf('paid') !== -1)) &&
                    rawStatusInput.indexOf('belum') === -1 && rawStatusInput.indexOf('unpaid') === -1 && rawStatusInput.indexOf('tidak') === -1;

      if (record.status === 'BELUM_DIBAYAR' || rawStatusInput.indexOf('belum') !== -1 || rawStatusInput.indexOf('unpaid') !== -1) {
        isLunas = false;
      }

      var rowValues;
      if (isPinjamanSaldo) {
        rowValues = [
          record.id || ('pinjam-' + Date.now()),
          record.tanggal || '',
          record.peminjam || 'Kepaniteraan',
          Number(record.jumlah || record.jumlahRp) || 0,
          record.keterangan || 'Peminjaman Saldo SKUM',
          isLunas ? 'Lunas' : 'Belum Lunas',
          isLunas ? (record.tanggalBayar || record.tanggalLunas || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')) : '',
          record.createdAt || new Date().toISOString()
        ];
      } else {
        rowValues = [
          record.id || ('pinjam-' + Date.now()),
          record.tanggal || '',
          record.nomorPerkara || 'Kepaniteraan Umum',
          record.peminjam || '',
          Number(record.jumlah || record.jumlahRp) || 0,
          record.keterangan || '',
          isLunas ? 'SUDAH_DIBAYAR' : 'BELUM_DIBAYAR',
          isLunas ? (record.tanggalBayar || record.tanggalLunas || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')) : '',
          record.skumPengeluaranId || '',
          record.skumPengembalianId || '',
          record.createdAt || new Date().toISOString()
        ];
      }

      var dataRows = sheet.getDataRange().getValues();
      var rowIndex = -1;
      var targetId = String(record.id || '').trim();
      var targetPeminjam = String(record.peminjam || '').trim().toLowerCase();
      var targetJumlah = Number(record.jumlah || record.jumlahRp) || 0;
      var targetKet = String(record.keterangan || '').trim().toLowerCase();

      if (dataRows.length > 1) {
        for (var p = 1; p < dataRows.length; p++) {
          var rowId = String(dataRows[p][0] || '').trim();
          var rowPeminjam = isPinjamanSaldo ? String(dataRows[p][2] || '').trim().toLowerCase() : String(dataRows[p][3] || '').trim().toLowerCase();
          var rowJumlah = isPinjamanSaldo ? Number(dataRows[p][3]) || 0 : Number(dataRows[p][4]) || 0;
          var rowKet = isPinjamanSaldo ? String(dataRows[p][4] || '').trim().toLowerCase() : String(dataRows[p][5] || '').trim().toLowerCase();
          
          if (targetId && (rowId === targetId || (rowId.replace(/[^0-9]/g, '') && targetId.replace(/[^0-9]/g, '') && rowId.replace(/[^0-9]/g, '') === targetId.replace(/[^0-9]/g, '')))) {
            rowIndex = p + 1;
            break;
          }
          if (targetJumlah > 0 && Math.abs(rowJumlah - targetJumlah) < 1) {
            if ((targetPeminjam && (rowPeminjam.indexOf(targetPeminjam) !== -1 || targetPeminjam.indexOf(rowPeminjam) !== -1)) ||
                (targetKet && (rowKet.indexOf(targetKet) !== -1 || targetKet.indexOf(rowKet) !== -1)) ||
                (targetPeminjam && (rowKet.indexOf(targetPeminjam) !== -1 || targetPeminjam.indexOf(rowKet) !== -1))) {
              rowIndex = p + 1;
              break;
            }
          }
        }
      }

      if (rowIndex > 1) {
        sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }
    }

    // Aksi Kas Opname
    else if (action === 'update_kas_opname' || action === 'save_kas_opname') {
      writeKasOpnameToSheet(ss, record);
    }

    // =========================================================================
    // AKSI BUKU PEMBANTU ATK PERKARA (AI & Deterministik)
    // Mendukung penambahan batch cerdas tanpa menghapus perkara lain!
    // =========================================================================
    else if (action === 'batch_add_simulasi_atk' || action === 'save_simulasi_atk') {
      var sheetSim = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
      if (!sheetSim) {
        setupSheets();
        sheetSim = ss.getSheetByName('SimulasiAtkPerkara');
      }

      var items = payload.items || payload.records || (Array.isArray(payload) ? payload : []);
      if (!Array.isArray(items) || items.length === 0) {
        if (record && (record.nomorPerkara || record.uraian)) items = [record];
      }

      if (items.length > 0) {
        // 1. Kumpulkan nomor perkara yang sedang diperbarui
        var caseNumbersToDelete = {};
        for (var bi = 0; bi < items.length; bi++) {
          var cn = String(items[bi].nomorPerkara || '').trim().toLowerCase();
          if (cn && cn !== '-') caseNumbersToDelete[cn] = true;
        }

        // 2. Hapus HANYA baris transaksi milik nomor perkara yang sedang di-generate ulang
        //    (Transaksi perkara lain tetap aman dan tidak terhapus!)
        var existingRows = sheetSim.getDataRange().getValues();
        if (existingRows.length > 1) {
          for (var rIdx = existingRows.length - 1; rIdx >= 1; rIdx--) {
            var rowCaseNo = String(existingRows[rIdx][2] || '').trim().toLowerCase();
            if (caseNumbersToDelete[rowCaseNo]) {
              sheetSim.deleteRow(rIdx + 1);
            }
          }
        }

        // 3. Masukkan baris-baris baru secara massal (batch setValues) demi performa cepat
        var newRows = [];
        for (var ni = 0; ni < items.length; ni++) {
          var itm = items[ni];
          var tglStr = '';
          if (itm.tanggal instanceof Date) {
            tglStr = Utilities.formatDate(itm.tanggal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (itm.tanggal) {
            var s = String(itm.tanggal).trim();
            tglStr = s.length >= 10 ? s.substring(0, 10) : s;
          } else {
            tglStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
          }

          newRows.push([
            itm.id || ('sim-atk-' + Date.now() + '-' + ni),
            tglStr,
            itm.nomorPerkara || '-',
            itm.uraian || itm.jenisAtk || '',
            Number(itm.penerimaan || itm.debet) || 0,
            Number(itm.pengeluaran || itm.kredit || itm.jumlah) || 0,
            itm.kategori || 'ATK',
            itm.keterangan || '',
            itm.isAiGenerated !== false ? 'TRUE' : 'FALSE',
            itm.createdAt || new Date().toISOString()
          ]);
        }

        if (newRows.length > 0) {
          sheetSim.getRange(sheetSim.getLastRow() + 1, 1, newRows.length, 10).setValues(newRows);
        }
      }
    } else if (action === 'batch_simulasi_atk' || action === 'save_simulasi_atk_all') {
      var allItems = payload.items || payload.records || (Array.isArray(payload) ? payload : []);
      if (Array.isArray(allItems)) {
        writeSimulasiAtkToSheet(ss, allItems);
      }
    } else if (action === 'add_simulasi_atk' || action === 'update_simulasi_atk') {
      var sheetSim = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
      if (!sheetSim) {
        setupSheets();
        sheetSim = ss.getSheetByName('SimulasiAtkPerkara');
      }
      var tglStr = '';
      if (record.tanggal instanceof Date) {
        tglStr = Utilities.formatDate(record.tanggal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (record.tanggal) {
        var sTgl = String(record.tanggal).trim();
        tglStr = sTgl.length >= 10 ? sTgl.substring(0, 10) : sTgl;
      } else {
        tglStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }

      var simValues = [
        record.id || ('sim-atk-' + Date.now()),
        tglStr,
        record.nomorPerkara || '-',
        record.uraian || record.jenisAtk || '',
        Number(record.penerimaan || record.debet) || 0,
        Number(record.pengeluaran || record.kredit || record.jumlah) || 0,
        record.kategori || 'ATK',
        record.keterangan || '',
        record.isAiGenerated !== false ? 'TRUE' : 'FALSE',
        record.createdAt || new Date().toISOString()
      ];

      var simRows = sheetSim.getDataRange().getValues();
      var simRowIndex = -1;
      var targetSimId = String(record.id || '').trim();
      for (var si = 1; si < simRows.length; si++) {
        if (targetSimId && String(simRows[si][0] || '').trim() === targetSimId) {
          simRowIndex = si + 1;
          break;
        }
      }

      if (simRowIndex > 1) {
        sheetSim.getRange(simRowIndex, 1, 1, simValues.length).setValues([simValues]);
      } else {
        sheetSim.appendRow(simValues);
      }
    } else if (action === 'delete_simulasi_atk_case') {
      var sheetSim = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
      if (sheetSim) {
        var targetNo = String(record.nomorPerkara || payload.nomorPerkara || '').trim().toLowerCase();
        var sRows = sheetSim.getDataRange().getValues();
        for (var di = sRows.length - 1; di >= 1; di--) {
          if (String(sRows[di][2] || '').trim().toLowerCase() === targetNo) {
            sheetSim.deleteRow(di + 1);
          }
        }
      }
    } else if (action === 'delete_simulasi_atk') {
      var sheetSim = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
      if (sheetSim) {
        var targetId = String(record.id || '').trim();
        var sRows = sheetSim.getDataRange().getValues();
        for (var di = 1; di < sRows.length; di++) {
          if (targetId && String(sRows[di][0] || '').trim() === targetId) {
            sheetSim.deleteRow(di + 1);
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
  var sheet = ss.getSheetByName('DataPerkara') || ss.getSheetByName('Perkara') || ss.getSheetByName('SaldoPerkara') || ss.getSheetByName('Saldo Perkara') || ss.getSheetByName('Data Perkara') || ss.getSheets()[0];
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
  var sheet = ss.getSheetByName('BukuBiayaProses') || ss.getSheetByName('LogTransaksi') || ss.getSheetByName('BukuBantu');
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
  var sheet = ss.getSheetByName('PinjamanSaldo') || ss.getSheetByName('PinjamanSKUM') || ss.getSheetByName('Pinjaman');
  if (!sheet) {
    sheet = ss.insertSheet('PinjamanSaldo');
  }
  sheet.clearContents();

  var isPinjamanSaldo = (sheet.getName() === 'PinjamanSaldo');
  if (isPinjamanSaldo) {
    sheet.appendRow([
      'ID', 'Tanggal', 'Peminjam', 'Jumlah (Rp)', 'Keterangan', 'Status Lunas', 'Tanggal Lunas', 'Created At'
    ]);
    sheet.getRange('A1:H1').setFontWeight('bold').setBackground('#fed7aa');
    records.forEach(function(r) {
      var rawStatusR = String(r.statusLunas || r.status || '').toLowerCase().trim();
      var isLunas = (r.status === 'SUDAH_DIBAYAR' || rawStatusR === 'lunas' || rawStatusR === 'sudah lunas' || rawStatusR === 'paid' ||
                    (rawStatusR.indexOf('lunas') !== -1 || rawStatusR.indexOf('sudah') !== -1 || rawStatusR.indexOf('paid') !== -1)) &&
                    rawStatusR.indexOf('belum') === -1 && rawStatusR.indexOf('unpaid') === -1 && rawStatusR.indexOf('tidak') === -1;
      
      if (r.status === 'BELUM_DIBAYAR' || rawStatusR.indexOf('belum') !== -1 || rawStatusR.indexOf('unpaid') !== -1) {
        isLunas = false;
      }
      sheet.appendRow([
        r.id || ('pinjam-' + Date.now()),
        r.tanggal || '',
        r.peminjam || 'Kepaniteraan',
        Number(r.jumlah || r.jumlahRp) || 0,
        r.keterangan || 'Peminjaman Saldo SKUM',
        isLunas ? 'Lunas' : 'Belum Lunas',
        isLunas ? (r.tanggalBayar || r.tanggalLunas || '') : '',
        r.createdAt || new Date().toISOString()
      ]);
    });
  } else {
    sheet.appendRow([
      'ID', 'Tanggal', 'Nomor Perkara', 'Peminjam', 'Jumlah',
      'Keterangan', 'Status', 'Tanggal Bayar', 'SKUM Pengeluaran ID', 'SKUM Pengembalian ID', 'Created At'
    ]);
    sheet.getRange('A1:K1').setFontWeight('bold').setBackground('#fde68a');
    records.forEach(function(r) {
      var rawStatusR = String(r.status || '').toLowerCase().trim();
      var isLunas = r.status === 'SUDAH_DIBAYAR' || (rawStatusR.indexOf('lunas') !== -1 && rawStatusR.indexOf('belum') === -1);
      sheet.appendRow([
        r.id, r.tanggal, r.nomorPerkara || 'Kepaniteraan Umum', r.peminjam || 'Kepaniteraan', r.jumlah || 0,
        r.keterangan || '', isLunas ? 'SUDAH_DIBAYAR' : 'BELUM_DIBAYAR', isLunas ? (r.tanggalBayar || '') : '',
        r.skumPengeluaranId || '', r.skumPengembalianId || '', r.createdAt || ''
      ]);
    });
  }
}

function writeKasOpnameToSheet(ss, record) {
  var sheet = ss.getSheetByName('KasOpnameKasir') || ss.getSheetByName('KasOpname');
  if (!sheet) {
    sheet = ss.insertSheet('KasOpnameKasir');
    sheet.appendRow([
      'ID', 'Tanggal', 'Saldo Fisik Kasir (Rp)', 'Saldo Standar Buku (Rp)', 'Selisih (Rp)',
      'Status Selisih', 'Mode Kas Belum Setor', 'Custom Kas Belum Setor (Rp)', 'Pecahan Denominasi JSON', 'Catatan', 'Updated At'
    ]);
    sheet.getRange('A1:K1').setFontWeight('bold').setBackground('#c7d2fe');
  }
  var denomStr = typeof record.denominations === 'object' ? JSON.stringify(record.denominations) : String(record.denominations || record.denominasiJson || '');
  var rowValues = [
    record.id || 'kas-opname-latest',
    record.tanggal || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    Number(record.saldoFisikKasir) || 0,
    Number(record.saldoStandarBuku) || 0,
    Number(record.selisih) || 0,
    String(record.statusSelisih || (Number(record.selisih) === 0 ? 'PAS' : Number(record.selisih) > 0 ? 'SURPLUS' : 'DEFISIT')),
    String(record.modeKasBelumSetor || 'auto'),
    Number(record.customKasBelumSetor) || 0,
    denomStr,
    String(record.catatan || ''),
    record.updatedAt || new Date().toISOString()
  ];

  var dataRows = sheet.getDataRange().getValues();
  var rowIndex = -1;
  var targetId = String(record.id || 'kas-opname-latest').trim();

  if (dataRows.length > 1) {
    for (var ko = 1; ko < dataRows.length; ko++) {
      var rowId = String(dataRows[ko][0] || '').trim();
      if (targetId && rowId === targetId) {
        rowIndex = ko + 1;
        break;
      }
    }
  }

  if (rowIndex > 1) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function writeSimulasiAtkToSheet(ss, records) {
  var sheet = ss.getSheetByName('SimulasiAtkPerkara') || ss.getSheetByName('SimulasiATK');
  if (!sheet) {
    sheet = ss.insertSheet('SimulasiAtkPerkara');
  }
  sheet.clearContents();
  sheet.appendRow([
    'ID', 'Tanggal', 'Nomor Perkara', 'Uraian / Jenis ATK', 'Penerimaan / Debet',
    'Pengeluaran / Kredit', 'Kategori', 'Keterangan', 'AI Generated', 'Created At'
  ]);
  sheet.getRange('A1:J1').setFontWeight('bold').setBackground('#e9d5ff');
  if (!records || records.length === 0) return;

  var newRows = [];
  records.forEach(function(r) {
    var tglStr = '';
    if (r.tanggal instanceof Date) {
      tglStr = Utilities.formatDate(r.tanggal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else if (r.tanggal) {
      var s = String(r.tanggal).trim();
      tglStr = s.length >= 10 ? s.substring(0, 10) : s;
    }
    newRows.push([
      r.id || ('sim-atk-' + Date.now()),
      tglStr,
      r.nomorPerkara || '-',
      r.uraian || r.jenisAtk || '',
      Number(r.penerimaan || r.debet) || 0,
      Number(r.pengeluaran || r.kredit || r.jumlah) || 0,
      r.kategori || 'ATK',
      r.keterangan || '',
      r.isAiGenerated !== false ? 'TRUE' : 'FALSE',
      r.createdAt || ''
    ]);
  });
  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, 10).setValues(newRows);
  }
}
