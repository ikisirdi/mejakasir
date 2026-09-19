import React from 'react';
import { 
  Scale,
  PlusCircle, 
  Bell, 
  RefreshCw, 
  Sun,
  Moon,
  Printer
} from 'lucide-react';
import { ActiveTabType } from '../types';

interface NavbarProps {
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenForm: () => void;
  onRefreshLive?: () => void;
  isRefreshing?: boolean;
  onToggleNotifPopover: () => void;
  unreadNotifCount: number;
  activeTab: ActiveTabType;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenCetakLaporanAtk?: () => void;
  countKasKuning?: number;
  totalPerkara?: number;
  totalSaldoPerkara?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  isSidebarCollapsed,
  onToggleCollapse,
  onOpenForm,
  onRefreshLive,
  isRefreshing = false,
  onToggleNotifPopover,
  unreadNotifCount,
  activeTab,
  theme,
  onToggleTheme,
  onOpenCetakLaporanAtk,
  countKasKuning = 0
}) => {
  const isLight = theme === 'light';

  const tabLabels: Record<ActiveTabType, { title: string; icon: string }> = {
    'table': { title: 'Daftar Perkara', icon: '📋' },
    'jurnal-skum': { title: 'Jurnal Keuangan SKUM', icon: '📖' },
    'buku-biaya-proses': { title: 'Buku Bantu Biaya Proses', icon: '💼' },
    'simulasi-atk-ai': { title: 'Buku Pembantu ATK (AI)', icon: '🤖' },
    'kas-kuning': { title: 'Titipan Kas Belum Disetor', icon: '⏳' }
  };

  const currentTab = tabLabels[activeTab] || { title: 'Keuangan Perkara', icon: '⚖️' };

  return (
    <nav className={`h-[62px] px-3 sm:px-4 flex items-center justify-between border-b sticky top-0 z-30 transition-colors ${
      isLight 
        ? 'bg-white/95 border-slate-200 text-slate-900 backdrop-blur-xs shadow-2xs' 
        : 'bg-slate-900/95 border-slate-800 text-white backdrop-blur-xs shadow-md'
    }`}>
      
      {/* Left Section: Sidebar Toggle & Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
        
        {/* Mobile Toggle Button using System Logo */}
        <button
          id="btn-sidebar-mobile-toggle"
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-xl border lg:hidden transition-colors flex items-center gap-1.5 ${
            isLight 
              ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100' 
              : 'border-slate-800 bg-slate-800/80 text-slate-200 hover:bg-slate-800'
          }`}
          title="Buka Menu Navigasi"
          aria-label="Toggle Sidebar Menu"
        >
          <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Scale className="w-3.5 h-3.5" />
          </div>
        </button>

        {/* Desktop Collapse / Expand Toggle with System Logo */}
        <button
          id="btn-sidebar-desktop-collapse"
          onClick={onToggleCollapse}
          className={`hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 group ${
            isLight 
              ? 'border-slate-200 bg-slate-50/80 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 shadow-2xs' 
              : 'border-slate-800 bg-slate-800/60 hover:bg-slate-800 hover:border-emerald-700 text-slate-100'
          }`}
          title={isSidebarCollapsed ? "Klik logo sistem untuk memperluas sidebar" : "Klik logo sistem untuk menciutkan sidebar"}
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:bg-emerald-500 transition-all duration-200">
            <Scale className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-xs tracking-tight text-slate-900 dark:text-white">
            SI-PERKARA
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            PA Paniai
          </span>
        </button>

        {/* Breadcrumb Navigation Trail */}
        <div className="flex items-center gap-1.5 text-xs truncate">
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
          <span className="hidden md:inline font-medium text-slate-400">
            Kepaniteraan
          </span>
          <span className="text-slate-300 dark:text-slate-700 hidden md:inline">/</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-700">
            <span>{currentTab.icon}</span>
            <span className="truncate">{currentTab.title}</span>
          </div>
          {countKasKuning > 0 && (
            <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning-subtle text-warning-emphasis border border-warning-subtle text-[11px] font-semibold">
              ⚠️ {countKasKuning} Belum Setor
            </span>
          )}
        </div>

      </div>

      {/* Right Section: Actions & Utilities */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        
        {/* Sinkronkan Data Terkini Button */}
        {onRefreshLive && (
          <button
            id="btn-sync-live-data"
            onClick={onRefreshLive}
            disabled={isRefreshing}
            className={`btn btn-sm flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold text-xs border transition-all ${
              isRefreshing 
                ? 'btn-light opacity-70' 
                : isLight 
                  ? 'btn-outline-success' 
                  : 'btn-outline-success text-emerald-400 border-emerald-700 hover:bg-emerald-950'
            }`}
            title="Sinkronkan data terkini dari Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-success' : ''}`} />
            <span className="hidden md:inline">{isRefreshing ? 'Sinkron...' : 'Sinkronkan'}</span>
          </button>
        )}

        {/* Cetak Lap. Resmi ATK Shortcut */}
        {onOpenCetakLaporanAtk && (
          <button
            id="btn-cetak-atk-quick"
            onClick={onOpenCetakLaporanAtk}
            className={`btn btn-sm hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-semibold text-xs border transition-all ${
              isLight 
                ? 'btn-outline-primary' 
                : 'btn-outline-primary text-sky-400 border-sky-700 hover:bg-sky-950'
            }`}
            title="Cetak Laporan Resmi ATK Perkara"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak ATK</span>
          </button>
        )}

        {/* Notifikasi Bell with Badge */}
        <button
          id="btn-toggle-notif"
          onClick={onToggleNotifPopover}
          className={`btn btn-sm relative p-2 rounded-xl border transition-colors ${
            isLight 
              ? 'btn-light text-slate-600 border-slate-200 hover:bg-slate-100' 
              : 'btn-dark text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="Pusat Notifikasi Sistem"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifCount > 0 && (
            <span className="absolute -top-1 -right-1 badge rounded-pill bg-danger border border-white dark:border-slate-900 px-1.5 py-0.5 text-[9px] font-bold">
              {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
            </span>
          )}
        </button>

        {/* Theme Toggle (Light / Dark) */}
        <button
          id="btn-toggle-theme"
          onClick={onToggleTheme}
          className={`btn btn-sm p-2 rounded-xl border transition-colors ${
            isLight 
              ? 'btn-light text-amber-600 border-slate-200 hover:bg-slate-100' 
              : 'btn-dark text-amber-400 border-slate-700 hover:bg-slate-800'
          }`}
          title={isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
        >
          {isLight ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-amber-400" />}
        </button>

        {/* Primary Action Button: + Input Perkara */}
        <button
          id="btn-add-case-primary"
          onClick={onOpenForm}
          className="btn btn-sm btn-success flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Input Perkara</span>
          <span className="sm:hidden">Input</span>
        </button>

      </div>

    </nav>
  );
};
