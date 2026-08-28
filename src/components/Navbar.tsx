import React from 'react';
import { 
  Scale, 
  PlusCircle, 
  FileSpreadsheet, 
  Github, 
  HardDrive, 
  Bell, 
  RefreshCw, 
  Database,
  Sun,
  Moon
} from 'lucide-react';
import { SyncSettings, CacheMetadata } from '../types';

interface NavbarProps {
  onOpenForm: () => void;
  onOpenSyncModal: () => void;
  onOpenGithubModal: () => void;
  onOpenCacheModal: () => void;
  onToggleNotifPopover: () => void;
  unreadNotifCount: number;
  syncSettings: SyncSettings;
  cacheMeta: CacheMetadata;
  activeTab: 'table' | 'buku-biaya-proses' | 'jurnal-skum' | 'kas-kuning';
  setActiveTab: (tab: 'table' | 'buku-biaya-proses' | 'jurnal-skum' | 'kas-kuning') => void;
  countKasKuning?: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenForm,
  onOpenSyncModal,
  onOpenGithubModal,
  onOpenCacheModal,
  onToggleNotifPopover,
  unreadNotifCount,
  syncSettings,
  cacheMeta,
  activeTab,
  setActiveTab,
  countKasKuning = 0,
  theme,
  onToggleTheme
}) => {
  const isLight = theme === 'light';

  return (
    <header className={`sticky top-0 z-30 w-full transition-colors ${
      isLight 
        ? 'bg-white border-b border-slate-200 text-slate-800 shadow-sm' 
        : 'bg-slate-900 border-b border-slate-800 text-white shadow-lg'
    }`}>
      <div className="max-w-[100%] xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/30">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`font-extrabold text-lg tracking-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  SI-PERKARA
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isLight 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                }`}>
                  PA Paniai
                </span>
              </div>
              <p className={`text-xs hidden sm:block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Sistem Manajemen Perkara & Buku Bantu Biaya Proses
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className={`hidden md:flex items-center space-x-1 p-1 rounded-xl border ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/80 border-slate-700/60'
          }`}>
            <button
              id="tab-table-btn"
              onClick={() => setActiveTab('table')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
                activeTab === 'table'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isLight 
                    ? 'text-emerald-800 hover:bg-emerald-100/80' 
                    : 'text-emerald-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span>⚖️ Daftar Saldo & Perkara</span>
            </button>
            <button
              id="tab-jurnal-skum-btn"
              onClick={() => setActiveTab('jurnal-skum')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
                activeTab === 'jurnal-skum'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : isLight 
                    ? 'text-sky-800 hover:bg-sky-100/80' 
                    : 'text-sky-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span>📖 Jurnal Perkara (SKUM)</span>
            </button>
            <button
              id="tab-buku-biaya-btn"
              onClick={() => setActiveTab('buku-biaya-proses')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
                activeTab === 'buku-biaya-proses'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : isLight 
                    ? 'text-amber-800 hover:bg-amber-100/80' 
                    : 'text-amber-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span>💼 Buku Bantu Biaya Proses</span>
            </button>
            <button
              id="tab-kas-kuning-btn"
              onClick={() => setActiveTab('kas-kuning')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
                activeTab === 'kas-kuning'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-400'
                  : isLight 
                    ? 'text-amber-900 hover:bg-amber-100/80' 
                    : 'text-amber-300 hover:text-white hover:bg-slate-700/50'
              }`}
              title="Menu Khusus: Titipan Uang Cash Belum Disetor ke Bendahara Penerimaan (Kuitansi)"
            >
              <span>🟡 Kas Belum Disetor</span>
              {countKasKuning > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-600 text-white font-mono shadow-xs">
                  {countKasKuning}
                </span>
              )}
            </button>
          </div>

          {/* Action Tools & Badges */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            
            {/* Theme Toggle Button (Cerah / Gelap) */}
            <button
              id="theme-toggle-btn"
              onClick={onToggleTheme}
              title={isLight ? 'Ubah ke Mode Gelap (Dark Mode)' : 'Ubah ke Mode Cerah (Light Mode)'}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isLight 
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' 
                  : 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isLight ? <Sun className="w-4 h-4 text-amber-600" /> : <Moon className="w-4 h-4 text-amber-300" />}
              <span className="hidden lg:inline">{isLight ? 'Tampilan Cerah' : 'Mode Gelap'}</span>
            </button>

            {/* Live Cache Status Badge */}
            <button
              id="cache-status-btn"
              onClick={onOpenCacheModal}
              title="Lihat status sistem caching & memori"
              className={`hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-colors border ${
                isLight 
                  ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' 
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cache: {cacheMeta.cacheHitCount} hits</span>
            </button>

            {/* Notification Bell Button */}
            <button
              id="notif-bell-btn"
              onClick={onToggleNotifPopover}
              className={`relative p-2 rounded-xl transition-colors ${
                isLight 
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Notifikasi Otomatis Status Data"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>

            {/* Input Data Button */}
            <button
              id="add-new-case-btn"
              onClick={onOpenForm}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all transform active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Input Perkara</span>
            </button>

          </div>

        </div>
      </div>

      {/* Mobile Tab Switching Bar */}
      <div className={`md:hidden flex border-t px-2 py-2 space-x-1 ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <button
          onClick={() => setActiveTab('table')}
          className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg ${
            activeTab === 'table' 
              ? 'bg-emerald-600 text-white font-extrabold shadow-xs' 
              : isLight ? 'text-emerald-800 bg-emerald-50 border border-emerald-200' : 'text-emerald-400 bg-slate-800'
          }`}
        >
          ⚖️ Saldo & Perkara
        </button>
        <button
          onClick={() => setActiveTab('jurnal-skum')}
          className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg ${
            activeTab === 'jurnal-skum' 
              ? 'bg-sky-600 text-white shadow-xs' 
              : isLight ? 'text-sky-800 bg-sky-50 border border-sky-200' : 'text-sky-300 bg-slate-800'
          }`}
        >
          📖 Jurnal SKUM
        </button>
        <button
          onClick={() => setActiveTab('buku-biaya-proses')}
          className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg ${
            activeTab === 'buku-biaya-proses' 
              ? 'bg-amber-600 text-white shadow-xs' 
              : isLight ? 'text-amber-800 bg-amber-50 border border-amber-200' : 'text-amber-400 bg-slate-800'
          }`}
        >
          💼 Buku Bantu
        </button>
        <button
          onClick={() => setActiveTab('kas-kuning')}
          className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg ${
            activeTab === 'kas-kuning' 
              ? 'bg-amber-500 text-slate-950 font-black shadow-xs' 
              : isLight ? 'text-amber-900 bg-amber-50 border border-amber-200' : 'text-amber-400 bg-slate-800'
          }`}
        >
          🟡 Kas Kuning {countKasKuning > 0 ? `(${countKasKuning})` : ''}
        </button>
      </div>
    </header>
  );
};
