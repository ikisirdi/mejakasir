import { CaseRecord, NotificationItem, SyncSettings, CacheMetadata, BiayaProsesRecord, JurnalBiayaSkumRecord, PinjamanSkumRecord } from '../types';
import { INITIAL_CASE_RECORDS } from '../data/initialData';

const STORAGE_KEYS = {
  CASES: 'pa_perkara_data_v2',
  NOTIFICATIONS: 'pa_perkara_notifications_v2',
  SYNC_SETTINGS: 'pa_perkara_sync_settings_v1',
  CACHE_META: 'pa_perkara_cache_meta_v2',
  BIAYA_PROSES: 'pa_perkara_biaya_proses_v2',
  JURNAL_SKUM: 'pa_perkara_jurnal_skum_v1',
  PINJAMAN_SKUM: 'pa_perkara_pinjaman_skum_v1',
};

export const INITIAL_BIAYA_PROSES_RECORDS: BiayaProsesRecord[] = [];
export const INITIAL_JURNAL_SKUM_RECORDS: JurnalBiayaSkumRecord[] = [];
export const INITIAL_PINJAMAN_SKUM_RECORDS: PinjamanSkumRecord[] = [];

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
      const raw = localStorage.getItem(STORAGE_KEYS.BIAYA_PROSES);
      if (raw) {
        return JSON.parse(raw);
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
}
