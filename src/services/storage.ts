import { CaseRecord, NotificationItem, SyncSettings, CacheMetadata, BiayaProsesRecord, JurnalBiayaSkumRecord, PinjamanSkumRecord, KasOpnameData, SimulasiAtkRecord, AuthUser } from '../types';
import { INITIAL_CASE_RECORDS } from '../data/initialData';

const STORAGE_KEYS = {
  CASES: 'pa_perkara_data_v2',
  NOTIFICATIONS: 'pa_perkara_notifications_v2',
  SYNC_SETTINGS: 'pa_perkara_sync_settings_v1',
  CACHE_META: 'pa_perkara_cache_meta_v2',
  BIAYA_PROSES: 'pa_perkara_biaya_proses_v2',
  JURNAL_SKUM: 'pa_perkara_jurnal_skum_v1',
  PINJAMAN_SKUM: 'pa_perkara_pinjaman_skum_v1',
  KAS_OPNAME: 'pa_perkara_kas_opname_v1',
  SIMULASI_ATK: 'pa_perkara_simulasi_atk_v1',
  AUTH_USER: 'pa_perkara_auth_user_v1',
  AUTH_CREDENTIALS: 'pa_perkara_auth_credentials_v1',
};

export const STATIC_AUTH_CONFIG = {
  STATIC_USERNAME: 'idris',
  STATIC_PASSWORD: 'broken_dot',
  DEFAULT_USER_NAME: 'Idris Albasyir',
  DEFAULT_ROLE: 'Petugas Meja I & Administrator Kas Perkara',
  INSTITUTION: 'Pengadilan Agama Paniai Kelas II',
};

export const INITIAL_BIAYA_PROSES_RECORDS: BiayaProsesRecord[] = [];
export const INITIAL_JURNAL_SKUM_RECORDS: JurnalBiayaSkumRecord[] = [];
export const INITIAL_PINJAMAN_SKUM_RECORDS: PinjamanSkumRecord[] = [];
export const INITIAL_SIMULASI_ATK_RECORDS: SimulasiAtkRecord[] = [];

export const TARGET_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx_N2FEFTTruxZzyR5BzVRted8jpgE-qTSABwivhx0_s7v8aDR1VIpIsxhlABbY6jQs/exec';
export const TARGET_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/11YqzoHesVzx3jn_Fw_x76cs7xqpwzqazd6YP4RO5nBw/edit?usp=drive_link';

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  autoSyncEnabled: true,
  googleSheetUrl: TARGET_APPS_SCRIPT_URL,
  syncIntervalMinutes: 15,
  syncStatus: 'idle',
};


export class StorageService {
  private static cacheHitCount = 0;

  static getCases(): CaseRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CASES);
      if (raw) {
        this.cacheHitCount++;
        this.updateCacheMetaHit();
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error loading cases from storage:', e);
    }
    // Seed with initial data if empty
    this.saveCases(INITIAL_CASE_RECORDS);
    return INITIAL_CASE_RECORDS;
  }

  static saveCases(cases: CaseRecord[]): void {
    try {
      const jsonString = JSON.stringify(cases);
      localStorage.setItem(STORAGE_KEYS.CASES, jsonString);
      
      // Update Cache Metadata
      const meta: CacheMetadata = {
        lastUpdated: new Date().toISOString(),
        recordCount: cases.length,
        sizeBytes: new Blob([jsonString]).size,
        ttlMinutes: 60,
        cacheHitCount: this.cacheHitCount,
      };
      localStorage.setItem(STORAGE_KEYS.CACHE_META, JSON.stringify(meta));
    } catch (e) {
      console.error('Error saving cases to storage:', e);
    }
  }

  static getNotifications(): NotificationItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error loading notifications:', e);
    }
    const defaultNotifs: NotificationItem[] = [];
    this.saveNotifications(defaultNotifs);
    return defaultNotifs;
  }

  static saveNotifications(notifications: NotificationItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch (e) {
      console.error('Error saving notifications:', e);
    }
  }

  static getSyncSettings(): SyncSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SYNC_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.googleSheetUrl || parsed.googleSheetUrl.trim() === '') {
          parsed.googleSheetUrl = TARGET_APPS_SCRIPT_URL;
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error loading sync settings:', e);
    }
    return DEFAULT_SYNC_SETTINGS;
  }

  static saveSyncSettings(settings: SyncSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving sync settings:', e);
    }
  }

  static getCacheMeta(): CacheMetadata {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CACHE_META);
      if (raw) {
        const meta = JSON.parse(raw);
        return {
          ...meta,
          cacheHitCount: this.cacheHitCount || meta.cacheHitCount || 0
        };
      }
    } catch (e) {
      console.error('Error loading cache meta:', e);
    }
    const cases = this.getCases();
    const jsonString = JSON.stringify(cases);
    return {
      lastUpdated: new Date().toISOString(),
      recordCount: cases.length,
      sizeBytes: new Blob([jsonString]).size,
      ttlMinutes: 60,
      cacheHitCount: this.cacheHitCount,
    };
  }

  private static updateCacheMetaHit(): void {
    try {
      const meta = this.getCacheMeta();
      meta.cacheHitCount = this.cacheHitCount;
      localStorage.setItem(STORAGE_KEYS.CACHE_META, JSON.stringify(meta));
    } catch (e) {
      // ignore
    }
  }

  static resetToDefault(): void {
    // Clean all storage keys including legacy keys
    const legacyKeys = [
      'pa_perkara_data',
      'pa_perkara_data_v1',
      'pa_perkara_data_v2',
      'pa_perkara_biaya_proses_v1',
      'pa_perkara_biaya_proses_v2',
      'pa_perkara_jurnal_skum_v1',
      'pa_perkara_cache_meta_v1',
      'pa_perkara_cache_meta_v2',
      'pa_perkara_notifications_v1',
      'pa_perkara_notifications_v2',
      STORAGE_KEYS.CASES,
      STORAGE_KEYS.NOTIFICATIONS,
      STORAGE_KEYS.CACHE_META,
      STORAGE_KEYS.BIAYA_PROSES,
      STORAGE_KEYS.JURNAL_SKUM,
      STORAGE_KEYS.PINJAMAN_SKUM,
      'pa_perkara_deleted_bp_ids_v1',
    ];
    legacyKeys.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
    });

    this.saveCases(INITIAL_CASE_RECORDS);
    this.saveBiayaProsesRecords(INITIAL_BIAYA_PROSES_RECORDS);
    this.saveJurnalSkumRecords(INITIAL_JURNAL_SKUM_RECORDS);
    this.savePinjamanSkumRecords(INITIAL_PINJAMAN_SKUM_RECORDS);
  }

  static getJurnalSkumRecords(): JurnalBiayaSkumRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.JURNAL_SKUM);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error loading jurnal skum records:', e);
    }
    this.saveJurnalSkumRecords(INITIAL_JURNAL_SKUM_RECORDS);
    return INITIAL_JURNAL_SKUM_RECORDS;
  }

  static saveJurnalSkumRecords(records: JurnalBiayaSkumRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.JURNAL_SKUM, JSON.stringify(records));
    } catch (e) {
      console.error('Error saving jurnal skum records:', e);
    }
  }

  static getBiayaProsesRecords(): BiayaProsesRecord[] {
    try {
      let raw = localStorage.getItem(STORAGE_KEYS.BIAYA_PROSES);
      if (!raw) {
        raw = localStorage.getItem('pa_perkara_biaya_proses_v1');
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading biaya proses records:', e);
    }
    this.saveBiayaProsesRecords(INITIAL_BIAYA_PROSES_RECORDS);
    return INITIAL_BIAYA_PROSES_RECORDS;
  }

  static saveBiayaProsesRecords(records: BiayaProsesRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.BIAYA_PROSES, JSON.stringify(records));
    } catch (e) {
      console.error('Error saving biaya proses records:', e);
    }
  }

  static getDeletedBiayaProsesIds(): string[] {
    try {
      const raw = localStorage.getItem('pa_perkara_deleted_bp_ids_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return [];
  }

  static addDeletedBiayaProsesId(id: string): void {
    try {
      const list = this.getDeletedBiayaProsesIds();
      if (!list.includes(id)) {
        list.push(id);
        localStorage.setItem('pa_perkara_deleted_bp_ids_v1', JSON.stringify(list));
      }
    } catch (e) {
      // ignore
    }
  }

  static removeDeletedBiayaProsesId(id: string): void {
    try {
      const list = this.getDeletedBiayaProsesIds().filter(i => i !== id);
      localStorage.setItem('pa_perkara_deleted_bp_ids_v1', JSON.stringify(list));
    } catch (e) {
      // ignore
    }
  }

  static getPinjamanSkumRecords(): PinjamanSkumRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PINJAMAN_SKUM);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error loading pinjaman skum records:', e);
    }
    this.savePinjamanSkumRecords(INITIAL_PINJAMAN_SKUM_RECORDS);
    return INITIAL_PINJAMAN_SKUM_RECORDS;
  }

  static savePinjamanSkumRecords(records: PinjamanSkumRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PINJAMAN_SKUM, JSON.stringify(records));
    } catch (e) {
      console.error('Error saving pinjaman skum records:', e);
    }
  }

  static getKasOpname(): KasOpnameData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.KAS_OPNAME);
      if (raw) {
        return JSON.parse(raw);
      }
      // Fallback to legacy key if existing
      const legacySaved = localStorage.getItem('jurnal_skum_aktual_kasir');
      if (legacySaved !== null && !isNaN(Number(legacySaved))) {
        return {
          tanggal: new Date().toISOString().split('T')[0],
          saldoFisikKasir: Number(legacySaved),
          saldoStandarBuku: 0,
          selisih: 0,
          statusSelisih: 'PAS',
          modeKasBelumSetor: 'auto',
          customKasBelumSetor: 0,
          updatedAt: new Date().toISOString()
        };
      }
    } catch (e) {
      console.error('Error loading kas opname data:', e);
    }
    return null;
  }

  static saveKasOpname(data: KasOpnameData): void {
    try {
      localStorage.setItem(STORAGE_KEYS.KAS_OPNAME, JSON.stringify(data));
      if (data.saldoFisikKasir !== undefined) {
        localStorage.setItem('jurnal_skum_aktual_kasir', data.saldoFisikKasir.toString());
      }
    } catch (e) {
      console.error('Error saving kas opname data:', e);
    }
  }

  static getSimulasiAtkRecords(): SimulasiAtkRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SIMULASI_ATK);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error loading simulasi atk records:', e);
    }
    this.saveSimulasiAtkRecords(INITIAL_SIMULASI_ATK_RECORDS);
    return INITIAL_SIMULASI_ATK_RECORDS;
  }

  static saveSimulasiAtkRecords(records: SimulasiAtkRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SIMULASI_ATK, JSON.stringify(records));
    } catch (e) {
      console.error('Error saving simulasi atk records:', e);
    }
  }

  static exportAsJson(): string {
    const cases = this.getCases();
    return JSON.stringify(cases, null, 2);
  }

  static exportAsCsv(): string {
    const cases = this.getCases();
    const headers = [
      'Nomor Perkara',
      'Nama Pihak',
      'Jenis Perkara',
      'Saldo Perkara (Rp)',
      'Kategori',
      'Panjar Awal (Rp)',
      'Pengeluaran (Rp)',
      'Tanggal Register',
      'Tanggal Putus',
      'Status Perkara',
      'Hakim Ketua',
      'Panitera',
      'Ruang Sidang',
      'Catatan'
    ];

    const rows = cases.map(c => [
      `"${c.nomorPerkara || ''}"`,
      `"${c.namaPihak || ''}"`,
      `"${c.jenisPerkara || ''}"`,
      c.saldoPerkara || 0,
      `"${c.kategoriPerkara || ''}"`,
      c.panjarAwal || 0,
      c.pengeluaran || 0,
      `"${c.tanggalRegister || ''}"`,
      `"${c.tanggalPutus || ''}"`,
      `"${c.status || ''}"`,
      `"${c.hakimKetua || ''}"`,
      `"${c.panitera || ''}"`,
      `"${c.ruangSidang || ''}"`,
      `"${(c.catatan || '').replace(/"/g, '""')}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // --- Auth Session Management ---
  static getAuthUser(): AuthUser | null {
    try {
      // Check localStorage first (remember me)
      const localRaw = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
      if (localRaw) {
        return JSON.parse(localRaw);
      }
      // Check sessionStorage (temporary session)
      const sessionRaw = sessionStorage.getItem(STORAGE_KEYS.AUTH_USER);
      if (sessionRaw) {
        return JSON.parse(sessionRaw);
      }
    } catch (e) {
      console.error('Error reading auth user from storage:', e);
    }
    return null;
  }

  static saveAuthUser(user: AuthUser, rememberMe: boolean = true): void {
    try {
      const userJson = JSON.stringify(user);
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEYS.AUTH_USER, userJson);
        sessionStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      } else {
        sessionStorage.setItem(STORAGE_KEYS.AUTH_USER, userJson);
        localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      }
    } catch (e) {
      console.error('Error saving auth user:', e);
    }
  }

  static clearAuthUser(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      sessionStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    } catch (e) {
      console.error('Error clearing auth user:', e);
    }
  }

  // --- Auth Credentials Management (Username & Password) ---
  static getAuthCredentials(): { username: string; password: string } {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUTH_CREDENTIALS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.username && parsed.password) {
          return { username: parsed.username, password: parsed.password };
        }
      }
    } catch (e) {
      console.error('Error reading auth credentials:', e);
    }
    return {
      username: STATIC_AUTH_CONFIG.STATIC_USERNAME,
      password: STATIC_AUTH_CONFIG.STATIC_PASSWORD
    };
  }

  static saveAuthCredentials(username: string, password: string): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.AUTH_CREDENTIALS,
        JSON.stringify({ username, password })
      );
    } catch (e) {
      console.error('Error saving auth credentials:', e);
    }
  }

  static resetAuthCredentials(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_CREDENTIALS);
    } catch (e) {
      console.error('Error resetting auth credentials:', e);
    }
  }
}

