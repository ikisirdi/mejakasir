import { CaseRecord, BiayaProsesRecord, JurnalBiayaSkumRecord, JenisPerkara, KategoriPerkara, StatusPerkara } from '../types';

export class SyncService {

  /**
   * Parse CSV content into CaseRecord objects.
   * Flexibly matches Indonesian header titles.
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

    const nomorIdx = getIdx('nomor perkara', 'nomor', 'no perkara', 'no');
    const namaIdx = getIdx('nama pihak', 'pihak', 'nama', 'pemohon', 'penggugat');
    const jenisIdx = getIdx('jenis perkara', 'jenis', 'perkara');
    const saldoIdx = getIdx('saldo perkara', 'saldo', 'sisa panjar');
    const panjarIdx = getIdx('panjar awal', 'panjar', 'penerimaan');
    const pengeluaranIdx = getIdx('pengeluaran', 'biaya', 'pakai');
    const tglRegIdx = getIdx('tanggal register', 'tgl register', 'tanggal', 'tgl reg');
    const statusIdx = getIdx('status perkara', 'status');
    const hakimIdx = getIdx('hakim ketua', 'hakim');
    const paniteraIdx = getIdx('panitera');
    const catatanIdx = getIdx('catatan', 'keterangan');

    const records: CaseRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length === 0 || !cols.some(c => c.length > 0)) continue;

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

      const kategoriPerkara: KategoriPerkara = nomorPerkara.includes('/Pdt.P/') || /Pdt\.P/i.test(nomorPerkara) ? 'Permohonan' : 'Gugatan';

      let status: StatusPerkara = 'Diperiksa';
      const statusRaw = statusIdx !== -1 ? cols[statusIdx] : '';
      if (/putus/i.test(statusRaw)) status = 'Putus';
      else if (/minut/i.test(statusRaw)) status = 'Minutasi';
      else if (/selesai/i.test(statusRaw)) status = 'Selesai';
      else if (/daftar/i.test(statusRaw)) status = 'Pendaftaran';

      records.push({
        id: `imported-${Date.now()}-${i}`,
        nomorPerkara,
        namaPihak,
        jenisPerkara,
        kategoriPerkara,
        saldoPerkara,
        panjarAwal,
        pengeluaran,
        tanggalRegister: tglRegIdx !== -1 && cols[tglRegIdx] ? cols[tglRegIdx] : new Date().toISOString().split('T')[0],
        status,
        hakimKetua: hakimIdx !== -1 ? cols[hakimIdx] : undefined,
        panitera: paniteraIdx !== -1 ? cols[paniteraIdx] : undefined,
        catatan: catatanIdx !== -1 ? cols[catatanIdx] : undefined,
        updatedAt: new Date().toISOString()
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
   * Fetch structured JSON directly from Google Apps Script Web App (doGet)
   */
  static async fetchFromAppsScript(url: string): Promise<{ 
    cases: CaseRecord[]; 
    jurnalSkum: JurnalBiayaSkumRecord[];
    biayaProses: BiayaProsesRecord[];
  } | null> {
    const targetUrl = url.trim();
    if (!targetUrl || !targetUrl.includes('script.google.com')) return null;

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) return null;
      const json = await response.json();

      let rawCases: any[] = [];
      let rawJurnal: any[] = [];
      let rawBiaya: any[] = [];

      if (Array.isArray(json)) {
        rawCases = json;
      } else if (json && typeof json === 'object') {
        if (Array.isArray(json.cases)) rawCases = json.cases;
        else if (Array.isArray(json.data)) rawCases = json.data;
        else if (Array.isArray(json.records)) rawCases = json.records;

        if (Array.isArray(json.jurnalSkum)) rawJurnal = json.jurnalSkum;
        else if (Array.isArray(json.jurnal)) rawJurnal = json.jurnal;

        if (Array.isArray(json.biayaProses)) rawBiaya = json.biayaProses;
        else if (Array.isArray(json.biaya)) rawBiaya = json.biaya;
      }

      if (rawCases.length > 0 || rawJurnal.length > 0 || rawBiaya.length > 0) {
        const mappedCases: CaseRecord[] = rawCases.map((c, idx) => {
          const panjar = Number(c.panjarAwal || c.panjar_awal || c.panjar || c.penerimaan || 0);
          const saldo = Number(c.saldoPerkara || c.saldo_perkara || c.saldo || 0);
          const pengeluaran = Number(c.pengeluaran || c.biaya || (panjar > saldo ? panjar - saldo : 0));

          return {
            id: String(c.id || `appscript-case-${idx + 1}`),
            nomorPerkara: String(c.nomorPerkara || c.nomor_perkara || c.no_perkara || c.nomor || `Perkara ${idx + 1}`),
            namaPihak: String(c.namaPihak || c.nama_pihak || c.nama || c.pihak || 'Pihak Berperkara'),
            jenisPerkara: String(c.jenisPerkara || c.jenis_perkara || c.jenis || 'Cerai Gugat') as any,
            kategoriPerkara: String(c.kategoriPerkara || c.kategori || 'Gugatan') as any,
            saldoPerkara: saldo,
            panjarAwal: panjar || saldo || 1000000,
            pengeluaran: pengeluaran,
            tanggalRegister: String(c.tanggalRegister || c.tanggal_register || c.tanggal || new Date().toISOString().split('T')[0]),
            tanggalPutus: c.tanggalPutus || c.tanggal_putus ? String(c.tanggalPutus || c.tanggal_putus) : undefined,
            status: String(c.status || c.statusPerkara || 'Pendaftaran') as any,
            hakimKetua: c.hakimKetua || c.hakim ? String(c.hakimKetua || c.hakim) : undefined,
            panitera: c.panitera ? String(c.panitera) : undefined,
            ruangSidang: c.ruangSidang ? String(c.ruangSidang) : undefined,
            catatan: c.catatan ? String(c.catatan) : undefined,
            updatedAt: c.updatedAt ? String(c.updatedAt) : new Date().toISOString()
          };
        });

        const mappedJurnal: JurnalBiayaSkumRecord[] = rawJurnal.map((j, idx) => {
          const pen = Number(j.penerimaan) || 0;
          const peng = Number(j.pengeluaran) || 0;
          const isPanjar = j.kategori === 'Panjar' || 
                           (j.uraian && (
                             String(j.uraian).toLowerCase().includes('panjar') || 
                             String(j.uraian).toLowerCase().includes('penerimaan')
                           ));
          const isDebet = isPanjar || (pen > 0 && peng === 0);
          return {
            id: String(j.id || `skum-${idx + 1}`),
            tanggal: String(j.tanggal || new Date().toISOString().split('T')[0]),
            nomorPerkara: String(j.nomorPerkara || '-'),
            uraian: String(j.uraian || ''),
            penerimaan: isDebet ? (pen > 0 ? pen : peng) : pen,
            pengeluaran: isDebet ? 0 : peng,
            kategori: String(j.kategori || (isDebet ? 'Panjar' : 'Panggilan')) as any,
            keterangan: String(j.keterangan || ''),
            createdAt: String(j.createdAt || new Date().toISOString())
          };
        });

        return {
          cases: mappedCases,
          jurnalSkum: mappedJurnal,
          biayaProses: rawBiaya
        };
      }
    } catch (err) {
      console.warn('Gagal membaca data dari Apps Script Web App:', err);
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
}

