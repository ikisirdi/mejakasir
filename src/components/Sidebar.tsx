import React from 'react';
import { 
  Scale, 
  FileSpreadsheet, 
  BookOpen, 
  FileText, 
  Sparkles, 
  Clock, 
  Printer, 
  Database,
  X,
  ExternalLink
} from 'lucide-react';
import { ActiveTabType, CacheMetadata } from '../types';

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  countKasKuning?: number;
  pendingSimulasiAtkCount?: number;
  totalPerkara: number;
  totalSaldoPerkara: number;
  cacheMeta: CacheMetadata;
  onOpenSyncModal: () => void;
  onOpenCacheModal: () => void;
  onOpenCetakLaporanAtk?: () => void;
  theme: 'light' | 'dark';
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isCollapsed,
  onCloseMobile,
  onToggleCollapse,
  activeTab,
  setActiveTab,
  countKasKuning = 0,
  pendingSimulasiAtkCount = 0,
  totalPerkara,
  totalSaldoPerkara,
  cacheMeta,
  onOpenSyncModal,
  onOpenCacheModal,
  onOpenCetakLaporanAtk,
  theme
}) => {
  const isLight = theme === 'light';

  const menuItems = [
    {
      id: 'table' as ActiveTabType,
      label: 'Daftar Perkara',
      shortLabel: 'Perkara',
      icon: FileSpreadsheet,
      badge: null,
      color: 'text-emerald-500',
      activeBg: isLight ? 'bg-success text-white shadow-sm' : 'bg-success text-white shadow-sm'
    },
    {
      id: 'jurnal-skum' as ActiveTabType,
      label: 'Jurnal Keuangan SKUM',
      shortLabel: 'SKUM',
      icon: BookOpen,
      badge: null,
      color: 'text-blue-500',
      activeBg: isLight ? 'bg-primary text-white shadow-sm' : 'bg-primary text-white shadow-sm'
    },
    {
      id: 'buku-biaya-proses' as ActiveTabType,
      label: 'Buku Biaya Proses',
      shortLabel: 'Biaya Proses',
      icon: FileText,
      badge: null,
      color: 'text-amber-500',
      activeBg: isLight ? 'bg-warning text-dark font-bold shadow-sm' : 'bg-warning text-dark font-bold shadow-sm'
    },
    {
      id: 'simulasi-atk-ai' as ActiveTabType,
      label: 'Buku Bantu ATK (AI)',
      shortLabel: 'Bantu ATK',
      icon: Sparkles,
      badge: pendingSimulasiAtkCount > 0 ? (
        <span className="badge rounded-pill bg-danger ms-auto px-1.5 py-0.5 text-[10px] font-bold">
          {pendingSimulasiAtkCount}
        </span>
      ) : null,
      color: 'text-indigo-500',
      activeBg: isLight ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-600 text-white shadow-sm'
    },
    {
      id: 'kas-kuning' as ActiveTabType,
      label: 'Titipan Kas Belum Setor',
      shortLabel: 'Kas Kuning',
      icon: Clock,
      badge: countKasKuning > 0 ? (
        <span className="badge rounded-pill bg-warning text-dark ms-auto px-1.5 py-0.5 text-[10px] font-bold">
          {countKasKuning}
        </span>
      ) : null,
      color: 'text-amber-500',
      activeBg: isLight ? 'bg-amber-500 text-dark font-bold shadow-sm' : 'bg-amber-500 text-dark font-bold shadow-sm'
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-50 lg:static lg:z-auto
          flex flex-col border-r transition-all duration-300 ease-in-out
          ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-[260px] w-[280px]'}
          shadow-lg lg:shadow-none
        `}
      >
        {/* Sidebar Header / Brand Identity - System Logo Toggle */}
        <div className={`h-[62px] px-3 flex items-center border-b transition-colors ${
          isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900'
        } ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <button
            type="button"
            id="btn-sidebar-system-logo"
            onClick={onToggleCollapse}
            className={`flex items-center gap-2.5 rounded-xl p-1.5 transition-all duration-200 group text-left ${
              isLight 
                ? 'hover:bg-slate-100/90 active:bg-slate-200' 
                : 'hover:bg-slate-800/90 active:bg-slate-800'
            } ${isCollapsed ? 'justify-center w-full' : 'flex-1 overflow-hidden'}`}
            title={isCollapsed ? "Klik logo sistem untuk memperluas sidebar" : "Klik logo sistem untuk menyembunyikan/menciutkan sidebar"}
          >
            {/* Judicial Court System Logo */}
            <div className="relative flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-xl shadow-sm w-9 h-9 group-hover:scale-105 group-hover:shadow-md transition-all duration-200 ring-2 ring-emerald-500/20 group-hover:ring-emerald-500/50">
              <Scale className="w-5 h-5 transition-transform duration-300 group-hover:rotate-[-6deg]" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 border border-white dark:border-slate-900 rounded-full"></span>
            </div>

            {!isCollapsed && (
              <div className="truncate flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold text-sm tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    SI-PERKARA
                  </span>
                  <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-1.5 py-0.5 text-[9px] font-semibold">
                    PA Paniai
                  </span>
                </div>
                <p className={`text-[10px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Keuangan Perkara
                </p>
              </div>
            )}
          </button>

          {/* Mobile close button (only visible on mobile drawer) */}
          <button
            onClick={onCloseMobile}
            className={`p-1.5 rounded-lg lg:hidden ${
              isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="Tutup Menu"
            aria-label="Tutup Menu Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 custom-scrollbar">
          
          {/* Main Navigation Section */}
          <div>
            {!isCollapsed && (
              <p className={`px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider ${
                isLight ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Menu Utama
              </p>
            )}
            <nav className="space-y-1">
              {menuItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-item-${item.id}`}
                    onClick={() => {
                      setActiveTab(item.id);
                      onCloseMobile();
                    }}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold
                      transition-all duration-150 relative group
                      ${isActive 
                        ? item.activeBg 
                        : isLight 
                          ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900' 
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }
                      ${isCollapsed ? 'justify-center px-2' : ''}
                    `}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : item.color}`} />
                    {!isCollapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.badge}
                      </>
                    )}
                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                        {item.label}
                        {item.badge && <span className="ms-1.5 font-bold">({item.id === 'kas-kuning' ? countKasKuning : pendingSimulasiAtkCount})</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Tools & Utilities */}
          <div>
            {!isCollapsed && (
              <p className={`px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider ${
                isLight ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Alat & Integrasi
              </p>
            )}
            <div className="space-y-1">
              {onOpenCetakLaporanAtk && (
                <button
                  onClick={() => {
                    onOpenCetakLaporanAtk();
                    onCloseMobile();
                  }}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium
                    transition-colors relative group
                    ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'}
                    ${isCollapsed ? 'justify-center px-2' : ''}
                  `}
                  title="Cetak Laporan Resmi ATK Perkara"
                >
                  <Printer className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  {!isCollapsed && <span className="truncate">Cetak Lap. ATK</span>}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                      Cetak Laporan ATK
                    </div>
                  )}
                </button>
              )}

              <button
                onClick={() => {
                  onOpenSyncModal();
                  onCloseMobile();
                }}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium
                  transition-colors relative group
                  ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'}
                  ${isCollapsed ? 'justify-center px-2' : ''}
                `}
                title="Integrasi Google Sheets"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                {!isCollapsed && <span className="truncate">Google Spreadsheet</span>}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                    Google Spreadsheet
                  </div>
                )}
              </button>

              <button
                onClick={() => {
                  onOpenCacheModal();
                  onCloseMobile();
                }}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium
                  transition-colors relative group
                  ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'}
                  ${isCollapsed ? 'justify-center px-2' : ''}
                `}
                title="Status Cache Database Lokal"
              >
                <Database className="w-4 h-4 text-violet-500 flex-shrink-0" />
                {!isCollapsed && (
                  <div className="flex items-center justify-between w-full overflow-hidden">
                    <span className="truncate">Status Cache</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      {cacheMeta.cacheHitCount} hits
                    </span>
                  </div>
                )}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                    Status Cache ({cacheMeta.cacheHitCount})
                  </div>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Sidebar Footer: Summary Card when Expanded */}
        {!isCollapsed && (
          <div className={`p-3 m-2.5 rounded-xl border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700'
          }`}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-500 font-medium">Total Perkara</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{totalPerkara}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Sisa Saldo</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                Rp {totalSaldoPerkara.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        )}

      </aside>
    </>
  );
};
