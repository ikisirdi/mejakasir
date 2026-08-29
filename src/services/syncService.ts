import { CaseRecord, BiayaProsesRecord, JurnalBiayaSkumRecord, PinjamanSkumRecord, JenisPerkara, KategoriPerkara, StatusPerkara } from '../types';

export const DEFAULT_SPREADSHEET_ID = '11YqzoHesVzx3jn_Fw_x76cs7xqpwzqazd6YP4RO5nBw';

export class SyncService {

  /**
   * Helper to extract Google Spreadsheet ID from any URL
   */
  static extractSpreadsheetId(url?: string): string {
    if (!url) return DEFAULT_SPREADSHEET_ID;
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return match[1];
    return DEFAULT_SPREADSHEET_ID;
  }

  /**
   * Reconstruct PinjamanSkumRecord items from JurnalBiayaSkum records if sheet is legacy
   */
  static reconstructPinjamanFromJurnal(jurnalRecords: JurnalBiayaSkumRecord[]): PinjamanSkumRecord[] {
    const pinjamMap = new Map<string, PinjamanSkumRecord>();
    const returnNames = new Set<string>();

    // First find repayments
    jurnalRecords.forEach(j => {
      const uraianLower = (j.uraian || '').toLowerCase();
      if (uraianLower.includes('pengembalian pinjaman') || uraianLower.includes('pelunasan pinjaman') || uraianLower.includes('pengembalian saldo skum')) {
        const namePart = (j.uraian || '').split(':').slice(1).join(':').trim();
        if (namePart) returnNames.add(namePart.toLowerCase());
      }
    });

    // Then find loans
    jurnalRecords.forEach(j => {
      const uraianLower = (j.uraian || '').toLowerCase();
      const isPinjam = j.kategori === 'Pinjaman' || 
                       uraianLower.includes('peminjaman saldo') || 
                       uraianLower.includes('pinjam saldo');

      if (isPinjam && (Number(j.pengeluaran) || 0) > 0) {
        const namePart = (j.uraian || '').split(':').slice(1).join(':').trim() || 'Kepaniteraan';
        const isPaid = returnNames.has(namePart.toLowerCase());
        
        pinjamMap.set(j.id, {
          id: `pinjam-${j.id.replace(/[^a-zA-Z0-9]/g, '')}`,
          tanggal: j.tanggal,
          nomorPerkara: j.nomorPerkara || 'Kepaniteraan Umum',
          peminjam: namePart,
          jumlah: Number(j.pengeluaran) || 0,
          keterangan: j.keterangan || 'Peminjaman Saldo SKUM Kepaniteraan',
          status: isPaid ? 'SUDAH_DIBAYAR' : 'BELUM_DIBAYAR',
          tanggalBayar: isPaid ? j.tanggal : undefined,
          createdAt: j.createdAt || new Date().toISOString(),
          skumPengeluaranId: j.id
        });
      }
    });

    return Array.from(pinjamMap.values());
  }

  /**
   * Parse CSV content into CaseRecord objects.
   * Flexibly matches Indonesian header titles and handles column 11 status fallback.
   */
  static parseCsv(csvText: string): CaseRecord[] {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    
    // Find column indexes
    const getIdx = (...possibleNames: string[]): number => {
      for (const name of possibleNames) {
        const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const idIdx = getIdx('id');
    const nomorIdx = getIdx('nomor perkara', 'nomor', 'no perkara', 'no');
    const namaIdx = getIdx('nama pihak', 'pihak', 'nama', 'pemohon', 'penggugat');
    const jenisIdx = getIdx('jenis perkara', 'jenis', 'perkara');
    const kategoriIdx = getIdx('kategori perkara', 'kategori');
    const saldoIdx = getIdx('saldo perkara', 'saldo', 'sisa panjar');
    const panjarIdx = getIdx('panjar awal', 'panjar', 'penerimaan');
    const pengeluaranIdx = getIdx('pengeluaran', 'biaya', 'pakai');
    const tglRegIdx = getIdx('tanggal register', 'tgl register', 'tanggal', 'tgl reg');
    const statusIdx = getIdx('status perkara', 'status');
    const hakimIdx = getIdx('hakim ketua', 'hakim');
    const paniteraIdx = getIdx('panitera');
    const catatanIdx = getIdx('catatan', 'keterangan');
    const updatedIdx = getIdx('updated at', 'updated', 'terakhir diupdate');

    const records: CaseRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length === 0 || !cols.some(c => c.length > 0)) continue;

      const rowId = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `imported-${Date.now()}-${i}`;
      const nomorPerkara = nomorIdx !== -1 && cols[nomorIdx] ? cols[nomorIdx] : `${i}/Pdt.G/2026/PA.Pan`;
      const namaPihak = namaIdx !== -1 && cols[namaIdx] ? cols[namaIdx] : 'Pihak Berperkara';
      const jenisRaw = jenisIdx !== -1 && cols[jenisIdx] ? cols[jenisIdx] : 'Cerai Gugat';
      
      const cleanMoney = (val?: string): number => {
        if (!val) return 0;
        const cleaned = val.replace(/[^0-9,-]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : Math.abs(num);
      };

      const saldoPerkara = saldoIdx !== -1 ? cleanMoney(cols[saldoIdx]) : 0;
      const panjarAwal = panjarIdx !== -1 ? cleanMoney(cols[panjarIdx]) : 1000000;
      const pengeluaran = pengeluaranIdx !== -1 ? cleanMoney(cols[pengeluaranIdx]) : (panjarAwal - saldoPerkara);

      // Infer Jenis Perkara
      let jenisPerkara: JenisPerkara = 'Cerai Gugat';
      if (/talak/i.test(jenisRaw)) jenisPerkara = 'Cerai Talak';
      else if (/waris/i.test(jenisRaw)) jenisPerkara = 'Penetapan Ahli Waris';
      else if (/harta/i.test(jenisRaw)) jenisPerkara = 'Harta Bersama';
      else if (/hibah/i.test(jenisRaw)) jenisPerkara = 'Hibah';
      else if (/wasiat/i.test(jenisRaw)) jenisPerkara = 'Wasiat';
      else if (/asuh/i.test(jenisRaw)) jenisPerkara = 'Hak Asuh Anak';
      else if (/nafkah/i.test(jenisRaw)) jenisPerkara = 'Nafkah Anak';
      else if (/dispensasi/i.test(jenisRaw)) jenisPerkara = 'Dispensasi Nikah';
      else if (/adhal/i.test(jenisRaw)) jenisPerkara = 'Wali Adhal';

      const katRaw = kategoriIdx !== -1 ? cols[kategoriIdx] : '';
      let katPerkara: KategoriPerkara = nomorPerkara.includes('/Pdt.P/') || /Pdt\.P/i.test(nomorPerkara) ? 'Permohonan' : 'Gugatan';
      if (/permohonan/i.test(katRaw)) katPerkara = 'Permohonan';
      else if (/gugatan/i.test(katRaw)) katPerkara = 'Gugatan';

      // Status extraction: check statusIdx, or check column 11 if header was empty
      let statusRaw = statusIdx !== -1 ? cols[statusIdx] : '';
      if (!statusRaw && cols.length >= 12 && cols[11]) {
        statusRaw = cols[11];
      }

      let status: StatusPerkara = 'Diperiksa';
      if (/putus/i.test(statusRaw)) status = 'Putus';
      else if (/minut/i.test(statusRaw)) status = 'Minutasi';
      else if (/selesai/i.test(statusRaw)) status = 'Selesai';
      else if (/arsip/i.test(statusRaw)) status = 'Arsip';
      else if (/daftar/i.test(statusRaw)) status = 'Pendaftaran';

      records.push({
        id: rowId,
        nomorPerkara,
        namaPihak,
        jenisPerkara,
        kategoriPerkara: katPerkara,
        saldoPerkara,
        panjarAwal,
        pengeluaran,
        tanggalRegister: tglRegIdx !== -1 && cols[tglRegIdx] ? cols[tglRegIdx] : new Date().toISOString().split('T')[0],
        status,
        hakimKetua: hakimIdx !== -1 ? cols[hakimIdx] : undefined,
        panitera: paniteraIdx !== -1 ? cols[paniteraIdx] : undefined,
        catatan: catatanIdx !== -1 ? cols[catatanIdx] : undefined,
        updatedAt: updatedIdx !== -1 && cols[updatedIdx] ? cols[updatedIdx] : new Date().toISOString()
      });
    }

    return records;
  }

  /**
   * Parse CSV content into BiayaProsesRecord objects (Buku Bantu Biaya Proses).
   */
  static parseBiayaProsesCsv(csvText: string): BiayaProsesRecord[] {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    const getIdx = (...possibleNames: string[]): number => {
      for (const name of possibleNames) {
        const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const tglIdx = getIdx('tanggal', 'tgl');
    const nomorIdx = getIdx('nomor perkara', 'nomor', 'no perkara', 'no');
    const uraianIdx = getIdx('uraian', 'rincian', 'transaksi');
    const penerimaanIdx = getIdx('penerimaan', 'masuk', 'debet');
    const pengeluaranIdx = getIdx('pengeluaran', 'keluar', 'kredit');
    const kategoriIdx = getIdx('kategori', 'jenis');
    const ketIdx = getIdx('keterangan', 'catatan');

    const cleanMoney = (val?: string): number => {
      if (!val) return 0;
      const cleaned = val.replace(/[^0-9,-]/g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : Math.abs(num);
    };

    const records: BiayaProsesRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length === 0 || !cols.some(c => c.length > 0)) continue;

      const tanggal = tglIdx !== -1 && cols[tglIdx] ? cols[tglIdx] : new Date().toISOString().split('T')[0];
      const nomorPerkara = nomorIdx !== -1 && cols[nomorIdx] ? cols[nomorIdx] : '-';
      const uraian = uraianIdx !== -1 && cols[uraianIdx] ? cols[uraianIdx] : 'Transaksi Biaya Proses';
      const penerimaan = penerimaanIdx !== -1 ? cleanMoney(cols[penerimaanIdx]) : 0;
      const pengeluaran = pengeluaranIdx !== -1 ? cleanMoney(cols[pengeluaranIdx]) : 0;
      const katRaw = kategoriIdx !== -1 ? cols[kategoriIdx] : 'ATK';
      const keterangan = ketIdx !== -1 && cols[ketIdx] ? cols[ketIdx] : '-';

      let kategori: 'ATK' | 'Proses' | 'Meterai' | 'Redaksi' | 'Panggilan' | 'Lainnya' = 'ATK';
      if (/proses/i.test(katRaw)) kategori = 'Proses';
      else if (/meterai/i.test(katRaw)) kategori = 'Meterai';
      else if (/redaksi/i.test(katRaw)) kategori = 'Redaksi';
      else if (/panggil/i.test(katRaw)) kategori = 'Panggilan';
      else if (/lain/i.test(katRaw)) kategori = 'Lainnya';

      records.push({
        id: `imported-bp-${Date.now()}-${i}`,
        tanggal,
        nomorPerkara,
        uraian,
        penerimaan,
        pengeluaran,
        kategori,
        keterangan,
        createdAt: new Date().toISOString()
      });
    }

    return records;
  }

  /**
   * Parse CSV content into PinjamanSkumRecord objects (Sheet PinjamanSaldo / PinjamanSKUM)
   * Headers: ID, Tanggal, Peminjam, Jumlah (Rp), Keterangan, Status Lunas, Tanggal Lunas, Created At
   */
  static parsePinjamanSaldoCsv(csvText: string): PinjamanSkumRecord[] {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    const getIdx = (...possibleNames: string[]): number => {
      for (const name of possibleNames) {
        const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const idIdx = getIdx('id');
    const tglIdx = getIdx('tanggal', 'tgl pinjam', 'tgl');
    const peminjamIdx = getIdx('peminjam', 'nama peminjam', 'nama');
    const jumlahIdx = getIdx('jumlah (rp)', 'jumlah', 'nominal');
    const ketIdx = getIdx('keterangan', 'alasan', 'catatan');
    const statusIdx = getIdx('status lunas', 'status', 'lunas');
    const tglLunasIdx = getIdx('tanggal lunas', 'tgl lunas', 'tanggal bayar', 'tgl bayar');
    const createdIdx = getIdx('created at', 'created');

    const cleanMoney = (val?: string): number => {
      if (!val) return 0;
      const cleaned = val.replace(/[^0-9,-]/g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : Math.abs(num);
    };

    const records: PinjamanSkumRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length === 0 || !cols.some(c => c.length > 0)) continue;

      const rawJumlah = jumlahIdx !== -1 ? cleanMoney(cols[jumlahIdx]) : 0;
      if (rawJumlah <= 0 && (!cols[peminjamIdx] || cols[peminjamIdx].trim() === '')) continue;

      const rawStatus = statusIdx !== -1 ? String(cols[statusIdx] || '').toLowerCase() : '';
      const isLunas = rawStatus.includes('lunas') || rawStatus.includes('sudah') || rawStatus === 'sudah_dibayar';

      records.push({
        id: idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `pinjam-${Date.now()}-${i}`,
        tanggal: tglIdx !== -1 && cols[tglIdx] ? cols[tglIdx] : new Date().toISOString().split('T')[0],
        nomorPerkara: 'Kepaniteraan Umum',
        peminjam: peminjamIdx !== -1 && cols[peminjamIdx] ? cols[peminjamIdx] : 'Kepaniteraan',
        jumlah: rawJumlah,
        keterangan: ketIdx !== -1 && cols[ketIdx] ? cols[ketIdx] : 'Peminjaman Saldo SKUM',
        status: isLunas ? 'SUDAH_DIBAYAR' : 'BELUM_DIBAYAR',
        tanggalBayar: tglLunasIdx !== -1 && cols[tglLunasIdx] ? cols[tglLunasIdx] : undefined,
        createdAt: createdIdx !== -1 && cols[createdIdx] ? cols[createdIdx] : new Date().toISOString()
      });
    }

    return records;
  }

  /**
   * Parse CSV content into JurnalBiayaSkumRecord objects (Sheet JurnalBiayaSKUM)
   */
  static parseJurnalBiayaSkumCsv(csvText: string): JurnalBiayaSkumRecord[] {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    const getIdx = (...possibleNames: string[]): number => {
      for (const name of possibleNames) {
        const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const idIdx = getIdx('id');
    const tglIdx = getIdx('tanggal', 'tgl');
    const nomorIdx = getIdx('nomor perkara', 'nomor', 'no perkara', 'no');
    const uraianIdx = getIdx('uraian', 'rincian', 'keterangan transaksi');
    const debetIdx = getIdx('penerimaan / debet', 'penerimaan', 'debet', 'masuk');
    const kreditIdx = getIdx('pengeluaran / kredit', 'pengeluaran', 'kredit', 'keluar');
    const katIdx = getIdx('kategori');
    const ketIdx = getIdx('keterangan', 'catatan');
    const warnaIdx = getIdx('warna baris', 'warna', 'status warna');
    const createdIdx = getIdx('created at', 'created');

    const cleanMoney = (val?: string): number => {
      if (!val) return 0;
      const cleaned = val.replace(/[^0-9,-]/g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : Math.abs(num);
    };

    const records: JurnalBiayaSkumRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length === 0 || !cols.some(c => c.length > 0)) continue;

      let pen = debetIdx !== -1 ? cleanMoney(cols[debetIdx]) : 0;
      let peng = kreditIdx !== -1 ? cleanMoney(cols[kreditIdx]) : 0;
      const uraian = uraianIdx !== -1 && cols[uraianIdx] ? cols[uraianIdx] : '';
      const uraianLower = uraian.toLowerCase();

      // Loan and repayment detection
      const isPengembalianPinjaman = uraianLower.includes('pengembalian pinjaman') || 
                                     uraianLower.includes('pelunasan pinjaman') ||
                                     uraianLower.includes('pengembalian saldo skum');
      const isPeminjamanPinjaman = uraianLower.includes('peminjaman saldo') || 
                                   uraianLower.includes('pinjam saldo');

      if (isPeminjamanPinjaman) {
        peng = peng > 0 ? peng : pen;
        pen = 0;
      } else if (isPengembalianPinjaman) {
        pen = pen > 0 ? pen : peng;
        peng = 0;
      }

      let kategori = katIdx !== -1 && cols[katIdx] ? cols[katIdx] : '';
      if (!kategori || kategori === '-') {
        if (isPeminjamanPinjaman || isPengembalianPinjaman) kategori = 'Pinjaman';
        else if (pen > 0 && peng === 0) kategori = 'Panjar';
        else kategori = 'Panggilan';
      }

      let rawWarna = (warnaIdx !== -1 && cols[warnaIdx] ? cols[warnaIdx] : '').toLowerCase().trim();
      let parsedWarna: 'hijau' | 'kuning' | 'merah' | 'oranye' | 'default' = 'default';
      if (rawWarna.includes('hijau') || rawWarna.includes('disetor') || rawWarna.includes('green') || rawWarna.includes('lunas')) {
        parsedWarna = 'hijau';
      } else if (rawWarna.includes('kuning') || rawWarna.includes('yellow') || rawWarna.includes('belum setor') || rawWarna.includes('titipan')) {
        parsedWarna = 'kuning';
      } else if (rawWarna.includes('merah') || rawWarna.includes('red') || rawWarna.includes('pinjam') || rawWarna.includes('perhatian')) {
        parsedWarna = 'merah';
      } else if (rawWarna.includes('oranye') || rawWarna.includes('orange') || rawWarna.includes('proses')) {
        parsedWarna = 'oranye';
      }

      let rawKet = ketIdx !== -1 && cols[ketIdx] ? cols[ketIdx] : '';
      const tagMatch = rawKet.match(/\[WARNA:(hijau|kuning|merah|oranye|default)\]/i) || 
                       uraian.match(/\[WARNA:(hijau|kuning|merah|oranye|default)\]/i);
      if (tagMatch && parsedWarna === 'default') {
        parsedWarna = tagMatch[1].toLowerCase() as any;
      }
      const cleanKeterangan = rawKet.replace(/\[WARNA:(hijau|kuning|merah|oranye|default)\]/gi, '').trim();

      records.push({
        id: idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `skum-${Date.now()}-${i}`,
        tanggal: tglIdx !== -1 && cols[tglIdx] ? cols[tglIdx] : new Date().toISOString().split('T')[0],
        nomorPerkara: nomorIdx !== -1 && cols[nomorIdx] ? cols[nomorIdx] : '-',
        uraian,
        penerimaan: pen,
        pengeluaran: peng,
        kategori: kategori as any,
        keterangan: cleanKeterangan,
        warnaBaris: parsedWarna,
        createdAt: createdIdx !== -1 && cols[createdIdx] ? cols[createdIdx] : new Date().toISOString()
      });
    }

    return records;
  }

  /**
   * Fetch structured JSON directly from Google Apps Script Web App (doGet)
   * Always attaches anti-cache query param so updates from other devices appear immediately.
   */
  static async fetchFromAppsScript(url: string): Promise<{ 
    cases: CaseRecord[]; 
    jurnalSkum: JurnalBiayaSkumRecord[];
    biayaProses: BiayaProsesRecord[];
    pinjamanSkum?: PinjamanSkumRecord[];
  } | null> {
    const targetUrl = url.trim();
    if (!targetUrl || !targetUrl.includes('script.google.com')) return null;

    try {
      // Append cache buster to bypass browser & CDN cache
      const cacheBustUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + `_t=${Date.now()}`;
      const response = await fetch(cacheBustUrl, { cache: 'no-store' });
      if (!response.ok) return null;
      const json = await response.json();

      let rawCases: any[] = [];
      let rawJurnal: any[] = [];
      let rawBiaya: any[] = [];
      let rawPinjaman: any[] = [];

      if (Array.isArray(json)) {
        rawCases = json;
      } else if (json && typeof json === 'object') {
        if (Array.isArray(json.cases)) rawCases = json.cases;
        else if (Array.isArray(json.data)) rawCases = json.data;
        else if (Array.isArray(json.records)) rawCases = json.records;

        if (Array.isArray(json.jurnalSkum)) rawJurnal = json.jurnalSkum;
        else if (Array.isArray(json.jurnal)) rawJurnal = json.jurnal;

        if (Array.isArray(json.bukuBiayaProses)) rawBiaya = json.bukuBiayaProses;
        else if (Array.isArray(json.biayaProses)) rawBiaya = json.biayaProses;
        else if (Array.isArray(json.biaya)) rawBiaya = json.biaya;

        if (Array.isArray(json.pinjamanSaldo)) rawPinjaman = json.pinjamanSaldo;
        else if (Array.isArray(json.pinjamanSkum)) rawPinjaman = json.pinjamanSkum;
        else if (Array.isArray(json.pinjaman)) rawPinjaman = json.pinjaman;
      }

      if (rawCases.length > 0 || rawJurnal.length > 0 || rawBiaya.length > 0 || rawPinjaman.length > 0) {
        const mappedCases: CaseRecord[] = rawCases.map((c, idx) => {
          let panjar = Number(c.panjarAwal || c.panjar_awal || c.panjar || c.penerimaan || 0);
          let saldo = Number(c.saldoPerkara || c.saldo_perkara || c.saldo || 0);
          let pengeluaran = Number(c.pengeluaran || c.biaya || (panjar > saldo ? panjar - saldo : 0));
          let namaPihak = String(c.namaPihak || c.nama_pihak || c.nama || c.pihak || '');

          // Handle legacy Apps Script column misalignment if c.biayaPanggilan was filled instead of panjarAwal
          if (panjar === 0 && Number(c.biayaPanggilan) > 0) {
            panjar = Number(c.biayaPanggilan);
            pengeluaran = Number(c.biayaPnbp) || 0;
            saldo = Number(c.biayaMaterai) || 0;
          }
          if (!namaPihak && c.penerimaanPanjar && typeof c.penerimaanPanjar === 'string') {
            namaPihak = c.penerimaanPanjar;
          }

          let statusPerkara: StatusPerkara = 'Diperiksa';
          const rawStatus = String(c.status || c.statusPerkara || c.keteranganKasir || '').toLowerCase();
          if (rawStatus.includes('putus')) statusPerkara = 'Putus';
          else if (rawStatus.includes('minut')) statusPerkara = 'Minutasi';
          else if (rawStatus.includes('selesai')) statusPerkara = 'Selesai';
          else if (rawStatus.includes('arsip')) statusPerkara = 'Arsip';
          else if (rawStatus.includes('daftar')) statusPerkara = 'Pendaftaran';

          return {
            id: String(c.id || `appscript-case-${idx + 1}`),
            nomorPerkara: String(c.nomorPerkara || c.nomor_perkara || c.no_perkara || c.nomor || `${idx + 1}/Pdt.G/2026/PA.Pan`),
            namaPihak: namaPihak || 'Pihak Berperkara',
            jenisPerkara: String(c.jenisPerkara || c.jenis_perkara || c.jenis || 'Cerai Gugat') as any,
            kategoriPerkara: String(c.kategoriPerkara || c.kategori || 'Gugatan') as any,
            saldoPerkara: saldo,
            panjarAwal: panjar || saldo || 1000000,
            pengeluaran: pengeluaran,
            tanggalRegister: String(c.tanggalRegister || c.tanggal_register || c.tanggal || new Date().toISOString().split('T')[0]),
            tanggalPutus: c.tanggalPutus || c.tanggal_putus ? String(c.tanggalPutus || c.tanggal_putus) : undefined,
            status: statusPerkara,
            hakimKetua: c.hakimKetua || c.hakim ? String(c.hakimKetua || c.hakim) : undefined,
            panitera: c.panitera ? String(c.panitera) : undefined,
            ruangSidang: c.ruangSidang ? String(c.ruangSidang) : undefined,
            catatan: c.catatan ? String(c.catatan) : undefined,
            updatedAt: c.updatedAt ? String(c.updatedAt) : new Date().toISOString()
          };
        });

        const mappedJurnal: JurnalBiayaSkumRecord[] = rawJurnal.map((j, idx) => {
          let pen = Number(j.penerimaan) || 0;
          let peng = Number(j.pengeluaran) || 0;
          const uraianLower = String(j.uraian || '').toLowerCase();

          // Loan and repayment classification
          const isPengembalianPinjaman = uraianLower.includes('pengembalian pinjaman') || 
                                         uraianLower.includes('pelunasan pinjaman') ||
                                         uraianLower.includes('pengembalian saldo skum');
          const isPeminjamanPinjaman = (j.kategori === 'Pinjaman' && !isPengembalianPinjaman) ||
                                       uraianLower.includes('peminjaman saldo') || 
                                       uraianLower.includes('pinjam saldo');

          if (pen > 0 && peng > 0) {
            const isPanjarAwal = j.kategori === 'Panjar' || uraianLower.includes('panjar awal');
            if (isPanjarAwal || isPengembalianPinjaman) {
              peng = 0;
            } else {
              pen = 0;
            }
          }

          if (isPeminjamanPinjaman) {
            peng = peng > 0 ? peng : pen;
            pen = 0;
          } else if (isPengembalianPinjaman) {
            pen = pen > 0 ? pen : peng;
            peng = 0;
          }

          const isDebet = pen > 0 && peng === 0;
          let finalKategori = j.kategori;
          if (!finalKategori || finalKategori === 'undefined') {
            if (isPeminjamanPinjaman || isPengembalianPinjaman) {
              finalKategori = 'Pinjaman';
            } else {
              finalKategori = isDebet ? 'Panjar' : 'Panggilan';
            }
          }

          let rawWarna = String(j.warnaBaris || j.warna_baris || j.warna || j.statusWarna || j.status_warna || j.statusSetor || '').toLowerCase().trim();
          let parsedWarna: 'hijau' | 'kuning' | 'merah' | 'oranye' | 'default' = 'default';
          if (rawWarna === 'hijau' || rawWarna === 'disetor' || rawWarna === 'green' || rawWarna === 'sudah disetor' || rawWarna === 'lunas') {
            parsedWarna = 'hijau';
          } else if (rawWarna === 'kuning' || rawWarna === 'yellow' || rawWarna === 'belum setor' || rawWarna === 'belum setor cash' || rawWarna === 'titipan') {
            parsedWarna = 'kuning';
          } else if (rawWarna === 'merah' || rawWarna === 'perhatian' || rawWarna === 'red' || rawWarna === 'pinjaman' || rawWarna === 'belum' || rawWarna === 'belum disetor') {
            parsedWarna = 'merah';
          } else if (rawWarna === 'oranye' || rawWarna === 'orange' || rawWarna === 'proses' || rawWarna === 'dalam proses') {
            parsedWarna = 'oranye';
          }

          let rawKet = String(j.keterangan || '');
          const tagMatch = rawKet.match(/\[WARNA:(hijau|kuning|merah|oranye|default)\]/i) || 
                           String(j.uraian || '').match(/\[WARNA:(hijau|kuning|merah|oranye|default)\]/i);
          if (tagMatch && parsedWarna === 'default') {
            parsedWarna = tagMatch[1].toLowerCase() as any;
          }
          const cleanKeterangan = rawKet.replace(/\[WARNA:(hijau|kuning|merah|oranye|default)\]/gi, '').trim();

          return {
            id: String(j.id || `skum-${idx + 1}`),
            tanggal: String(j.tanggal || new Date().toISOString().split('T')[0]),
            nomorPerkara: String(j.nomorPerkara || '-'),
            uraian: String(j.uraian || ''),
            penerimaan: pen,
            pengeluaran: peng,
            kategori: String(finalKategori) as any,
            keterangan: cleanKeterangan,
            warnaBaris: parsedWarna,
            createdAt: String(j.createdAt || new Date().toISOString())
          };
        });

        let mappedPinjaman: PinjamanSkumRecord[] = [];
        if (rawPinjaman.length > 0) {
          mappedPinjaman = rawPinjaman.map((p, idx) => {
            const rawStatus = String(p.status || p.statusLunas || 'BELUM_DIBAYAR').toLowerCase();
            const isLunas = rawStatus.includes('lunas') || rawStatus.includes('sudah') || rawStatus === 'sudah_dibayar';
            return {
              id: String(p.id || `pinjam-${idx + 1}`),
              tanggal: String(p.tanggal || new Date().toISOString().split('T')[0]),
              nomorPerkara: String(p.nomorPerkara || 'Kepaniteraan Umum'),
              peminjam: String(p.peminjam || 'Kepaniteraan'),
              jumlah: Number(p.jumlah || p.jumlahRp) || 0,
              keterangan: String(p.keterangan || ''),
              status: isLunas ? 'SUDAH_DIBAYAR' : 'BELUM_DIBAYAR',
              tanggalBayar: p.tanggalBayar || p.tanggalLunas ? String(p.tanggalBayar || p.tanggalLunas) : undefined,
              skumPengeluaranId: p.skumPengeluaranId ? String(p.skumPengeluaranId) : undefined,
              skumPengembalianId: p.skumPengembalianId ? String(p.skumPengembalianId) : undefined,
              createdAt: String(p.createdAt || new Date().toISOString())
            };
          });
        } else if (mappedJurnal.length > 0) {
          mappedPinjaman = SyncService.reconstructPinjamanFromJurnal(mappedJurnal);
        }

        return {
          cases: mappedCases,
          jurnalSkum: mappedJurnal,
          biayaProses: rawBiaya,
          pinjamanSkum: mappedPinjaman
        };
      }
    } catch (err) {
      console.warn('Gagal membaca data dari Apps Script Web App:', err);
    }
    return null;
  }

  /**
   * Unified live fetcher: Reads live data directly from Google Sheets tabs with cache-busting _t
   * so that updates from any device (phone/other PC) are reflected immediately without manual cache clearing!
   */
  static async fetchAllLiveSpreadsheetData(options: {
    spreadsheetUrl?: string;
    appsScriptUrl?: string;
  }): Promise<{
    cases: CaseRecord[];
    jurnalSkum: JurnalBiayaSkumRecord[];
    biayaProses: BiayaProsesRecord[];
    pinjamanSkum: PinjamanSkumRecord[];
    source: 'appsscript' | 'direct_sheet';
  } | null> {
    const timestamp = Date.now();
    const sheetId = this.extractSpreadsheetId(options.spreadsheetUrl);

    // 1. First attempt: Direct Google Sheets GViz CSV (Guarantees exact column layout of sheets)
    try {
      const gvizBase = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&_t=${timestamp}`;

      const [resCases, resJurnal, resBiaya, resPinjam] = await Promise.allSettled([
        fetch(`${gvizBase}&sheet=DataPerkara`, { cache: 'no-store' }).then(r => r.ok ? r.text() : ''),
        fetch(`${gvizBase}&sheet=JurnalBiayaSKUM`, { cache: 'no-store' }).then(r => r.ok ? r.text() : ''),
        fetch(`${gvizBase}&sheet=BukuBiayaProses`, { cache: 'no-store' }).then(r => r.ok ? r.text() : ''),
        fetch(`${gvizBase}&sheet=PinjamanSaldo`, { cache: 'no-store' }).then(r => r.ok ? r.text() : '')
      ]);

      const casesCsv = resCases.status === 'fulfilled' ? resCases.value : '';
      const jurnalCsv = resJurnal.status === 'fulfilled' ? resJurnal.value : '';
      const biayaCsv = resBiaya.status === 'fulfilled' ? resBiaya.value : '';
      const pinjamCsv = resPinjam.status === 'fulfilled' ? resPinjam.value : '';

      const cases = casesCsv ? this.parseCsv(casesCsv) : [];
      const jurnalSkum = jurnalCsv ? this.parseJurnalBiayaSkumCsv(jurnalCsv) : [];
      const biayaProses = biayaCsv ? this.parseBiayaProsesCsv(biayaCsv) : [];
      let pinjamanSkum = pinjamCsv ? this.parsePinjamanSaldoCsv(pinjamCsv) : [];

      // If PinjamanSaldo sheet was empty, reconstruct loans from Jurnal SKUM
      if (pinjamanSkum.length === 0 && jurnalSkum.length > 0) {
        pinjamanSkum = this.reconstructPinjamanFromJurnal(jurnalSkum);
      }

      if (cases.length > 0 || jurnalSkum.length > 0 || biayaProses.length > 0) {
        return {
          cases,
          jurnalSkum,
          biayaProses,
          pinjamanSkum,
          source: 'direct_sheet'
        };
      }
    } catch (sheetErr) {
      console.warn('Gviz fetch attempt encountered an error, falling back to Apps Script:', sheetErr);
    }

    // 2. Fallback attempt: Google Apps Script Web App
    if (options.appsScriptUrl) {
      const appsScriptData = await this.fetchFromAppsScript(options.appsScriptUrl);
      if (appsScriptData) {
        let pinjam = appsScriptData.pinjamanSkum || [];
        if (pinjam.length === 0 && appsScriptData.jurnalSkum.length > 0) {
          pinjam = this.reconstructPinjamanFromJurnal(appsScriptData.jurnalSkum);
        }
        return {
          cases: appsScriptData.cases,
          jurnalSkum: appsScriptData.jurnalSkum,
          biayaProses: appsScriptData.biayaProses,
          pinjamanSkum: pinjam,
          source: 'appsscript'
        };
      }
    }

    return null;
  }

  /**
   * Fetch Google Sheet CSV data for Cases
   */
  static async fetchGoogleSheetCsv(url: string): Promise<CaseRecord[]> {
    let csvUrl = url.trim();
    
    // If Apps Script Web App URL, fetch structured JSON
    if (csvUrl.includes('script.google.com')) {
      const appsScriptData = await this.fetchFromAppsScript(csvUrl);
      if (appsScriptData && appsScriptData.cases.length > 0) {
        return appsScriptData.cases;
      }
    }

    // Transform pubhtml or view URL to published CSV format
    if (csvUrl.includes('/pubhtml')) {
      csvUrl = csvUrl.replace('/pubhtml', '/pub');
      if (!csvUrl.includes('output=csv')) {
        csvUrl += (csvUrl.includes('?') ? '&' : '?') + 'output=csv';
      }
    } else if (csvUrl.includes('docs.google.com/spreadsheets/d/') && !csvUrl.includes('/pub')) {
      const match = csvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        const sheetId = match[1];
        csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      }
    }

    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Gagal mengambil data spreadsheet (HTTP ${response.status})`);
    }

    const text = await response.text();
    return this.parseCsv(text);
  }

  /**
   * Fetch Google Sheet CSV data for LogTransaksi / Buku Biaya Proses
   */
  static async fetchGoogleSheetBiayaProsesCsv(url: string): Promise<BiayaProsesRecord[]> {
    let csvUrl = url.trim();

    if (csvUrl.includes('script.google.com')) {
      const appsScriptData = await this.fetchFromAppsScript(csvUrl);
      if (appsScriptData && appsScriptData.biayaProses.length > 0) {
        return appsScriptData.biayaProses;
      }
    }
    
    // Check if sheet=LogTransaksi can be requested
    if (csvUrl.includes('docs.google.com/spreadsheets/d/')) {
      const match = csvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        const sheetId = match[1];
        // Try fetching LogTransaksi tab
        csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=LogTransaksi`;
      }
    }

    try {
      const response = await fetch(csvUrl);
      if (!response.ok) return [];
      const text = await response.text();
      return this.parseBiayaProsesCsv(text);
    } catch {
      return [];
    }
  }

  /**
   * Post data payload to Google Apps Script Webhook
   */
  static async postToWebhook(webhookUrl: string, action: string, record: any): Promise<boolean> {
    if (!webhookUrl || !webhookUrl.startsWith('http')) return false;
    try {
      const payloadData = {
        action,
        payload: record,
        record: record,
        rec: record,
        timestamp: new Date().toISOString()
      };
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payloadData)
      });
      return true;
    } catch (err) {
      console.warn('Google Sheets webhook post warning:', err);
      return false;
    }
  }

  /**
   * Synchronize all colored Jurnal SKUM records to Google Sheets across devices.
   * Uses both embedded [WARNA:...] tag in keterangan and dedicated warnaBaris field.
   */
  static async syncColoredRecordsToCloud(webhookUrl: string, records: JurnalBiayaSkumRecord[]): Promise<{ success: boolean; total: number; synced: number }> {
    if (!webhookUrl || !webhookUrl.startsWith('http') || !records || records.length === 0) {
      return { success: false, total: 0, synced: 0 };
    }

    const coloredRecords = records.filter(r => {
      const match = (r.keterangan || '').match(/\[WARNA:(hijau|kuning|merah|oranye|default)\]/i);
      const tagColor = match ? match[1].toLowerCase() : null;
      const effectiveWarna = (r.warnaBaris && r.warnaBaris !== 'default') ? r.warnaBaris : tagColor;
      return effectiveWarna && effectiveWarna !== 'default';
    });

    if (coloredRecords.length === 0) {
      return { success: true, total: 0, synced: 0 };
    }

    let synced = 0;
    for (const r of coloredRecords) {
      const match = (r.keterangan || '').match(/\[WARNA:(hijau|kuning|merah|oranye|default)\]/i);
      const tagColor = match ? match[1].toLowerCase() : null;
      const effectiveWarna = (r.warnaBaris && r.warnaBaris !== 'default') ? r.warnaBaris : (tagColor || 'default');

      const cleanKet = (r.keterangan || '').replace(/\[WARNA:(hijau|kuning|merah|oranye|default)\]/gi, '').trim();
      const taggedKet = cleanKet ? `${cleanKet} [WARNA:${effectiveWarna}]` : `[WARNA:${effectiveWarna}]`;

      const payload = {
        ...r,
        keterangan: taggedKet,
        warnaBaris: effectiveWarna
      };

      const success = await this.postToWebhook(webhookUrl, 'update_jurnal_skum', payload);
      if (success) synced++;
    }

    return { success: synced > 0 || coloredRecords.length === 0, total: coloredRecords.length, synced };
  }

  /**
   * Push pinjaman records to Google Sheets / Webhook (into PinjamanSaldo sheet)
   */
  static async pushPinjamanToSheet(webhookUrl: string, records: PinjamanSkumRecord[]): Promise<{ success: boolean; total: number; synced: number }> {
    if (!webhookUrl || !webhookUrl.startsWith('http') || !records || records.length === 0) {
      return { success: false, total: 0, synced: 0 };
    }

    let synced = 0;
    for (const p of records) {
      const payload = {
        ...p,
        jumlahRp: p.jumlah,
        statusLunas: p.status === 'SUDAH_DIBAYAR' ? 'Lunas' : 'Belum Lunas',
        tanggalLunas: p.tanggalBayar || ''
      };
      const success = await this.postToWebhook(webhookUrl, 'add_pinjaman_skum', payload);
      if (success) synced++;
    }

    return { success: synced > 0, total: records.length, synced };
  }
}

