import React, { useState, useMemo } from 'react';
import { 
  CaseRecord, 
  FilterState, 
  JenisPerkara, 
  KategoriPerkara, 
  StatusPerkara 
} from '../types';
import { 
  Search, 
  Plus, 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  AlertCircle, 
  ArrowUpDown, 
  FileSpreadsheet, 
  Filter, 
  CheckCircle, 
  Clock, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Table,
  User,
  Calendar,
  Layers
} from 'lucide-react';
import { StorageService } from '../services/storage';

interface CaseTableProps {
  cases: CaseRecord[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onOpenForm: (recordToEdit?: CaseRecord) => void;
  onSelectCase: (record: CaseRecord) => void;
  onDeleteCase: (id: string) => void;
  onOpenJurnal?: (record: CaseRecord) => void;
  theme?: 'light' | 'dark';
}

export const CaseTable: React.FC<CaseTableProps> = ({
  cases,
  filters,
  setFilters,
  onOpenForm,
  onSelectCase,
  onDeleteCase,
  onOpenJurnal,
  theme = 'light'
}) => {
  const isLight = theme === 'light';
  const [sortField, setSortField] = useState<keyof CaseRecord>('nomorPerkara');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // View Mode: otomatis 'mobile' pada layar HP (< 768px), atau switchable 'table'
  const [viewMode, setViewMode] = useState<'mobile' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'mobile' : 'table';
    }
    return 'table';
  });

  // Search & Filter Logic
  const filteredCases = useMemo(() => {
    return cases.filter(item => {
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matchNomor = item.nomorPerkara.toLowerCase().includes(q);
        const matchNama = item.namaPihak.toLowerCase().includes(q);
        const matchJenis = item.jenisPerkara.toLowerCase().includes(q);
        const matchCatatan = (item.catatan || '').toLowerCase().includes(q);
        if (!matchNomor && !matchNama && !matchJenis && !matchCatatan) return false;
      }
      if (filters.jenisPerkara !== 'ALL' && item.jenisPerkara !== filters.jenisPerkara) {
        return false;
      }
      if (filters.kategoriPerkara !== 'ALL' && item.kategoriPerkara !== filters.kategoriPerkara) {
        return false;
      }
      if (filters.status !== 'ALL' && item.status !== filters.status) {
        return false;
      }
      if (filters.tahun !== 'ALL') {
        const year = item.tanggalRegister ? item.tanggalRegister.split('-')[0] : '';
        if (year !== filters.tahun) return false;
      }
      return true;
    });
  }, [cases, filters]);

  // Sort Logic
  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCases, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedCases.length / itemsPerPage) || 1;
  const paginatedCases = sortedCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (field: keyof CaseRecord) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleExportCsv = () => {
    const csvData = StorageService.exportAsCsv();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `data_perkara_spreadsheet_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    const jsonData = StorageService.exportAsJson();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `data_perkara_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`border rounded-2xl shadow-sm p-5 space-y-4 transition-colors ${
      isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800 shadow-xl'
    }`}>
      
      {/* HEADER & SEARCH BAR */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b ${
        isLight ? 'border-slate-200' : 'border-slate-800'
      }`}>
        <div>
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className={`text-base font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Tabel Data Perkara (Sesuai Spreadsheet)
            </h2>
          </div>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Menampilkan data perkara terstruktur dengan kolom utama: Nomor Perkara, Nama Pihak, Jenis Perkara, dan Saldo Perkara (Rp).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* CSV Export */}
          <button
            onClick={handleExportCsv}
            className={`flex items-center space-x-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-colors ${
              isLight 
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Ekspor sebagai spreadsheet CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ekspor CSV</span>
          </button>

          {/* JSON Export */}
          <button
            onClick={handleExportJson}
            className={`flex items-center space-x-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-colors ${
              isLight 
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Ekspor sebagai JSON ringan untuk static host"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Ekspor JSON</span>
          </button>

          {/* Jurnal SKUM Modal Trigger */}
          {onOpenJurnal && (
            <button
              onClick={() => onOpenJurnal(cases[0])}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Catat Jurnal SKUM Biaya Perkara"
            >
              <span>🧮 Jurnal SKUM</span>
            </button>
          )}

          {/* Add New */}
          <button
            onClick={() => onOpenForm()}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Record</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE TOGGLE & QUICK CATEGORY FILTER */}
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700/60'
      }`}>
        
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="search-input-field"
            type="text"
            placeholder="Cari nomor perkara, nama pihak, jenis..."
            value={filters.searchQuery}
            onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            className={`w-full border rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors ${
              isLight 
                ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400' 
                : 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500'
            }`}
          />
        </div>

        {/* View Mode Switcher + Kategori Filters */}
        <div className="flex flex-wrap items-center justify-between w-full sm:w-auto gap-2">
          {/* View Mode Pill Toggle */}
          <div className="flex items-center space-x-1 p-1 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('mobile')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                viewMode === 'mobile'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Tampilan Khusus Mobile / HP (Bebas Geser, Mudah Dibaca)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>📱 Kartu HP</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                viewMode === 'table'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Tampilan Tabel Standar Lebar"
            >
              <Table className="w-3.5 h-3.5" />
              <span>🖥️ Tabel</span>
            </button>
          </div>

          {/* Quick Kategori Filter Pills */}
          <div className="flex items-center space-x-1 text-xs overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilters(prev => ({ ...prev, kategoriPerkara: 'ALL' }))}
              className={`px-3 py-1 rounded-lg transition-colors font-semibold ${
                filters.kategoriPerkara === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : isLight 
                    ? 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-100' 
                    : 'text-slate-400 bg-slate-900 border border-slate-700 hover:text-white'
              }`}
            >
              Semua ({cases.length})
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, kategoriPerkara: 'Gugatan' }))}
              className={`px-3 py-1 rounded-lg transition-colors font-semibold ${
                filters.kategoriPerkara === 'Gugatan'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : isLight 
                    ? 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-100' 
                    : 'text-slate-400 bg-slate-900 border border-slate-700 hover:text-white'
              }`}
            >
              Pdt.G
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, kategoriPerkara: 'Permohonan' }))}
              className={`px-3 py-1 rounded-lg transition-colors font-semibold ${
                filters.kategoriPerkara === 'Permohonan'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : isLight 
                    ? 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-100' 
                    : 'text-slate-400 bg-slate-900 border border-slate-700 hover:text-white'
              }`}
            >
              Pdt.P
            </button>
          </div>
        </div>

      </div>

      {/* TAMPILAN KHUSUS MOBILE (HP) */}
      {viewMode === 'mobile' ? (
        <div className="space-y-3">
          {paginatedCases.length === 0 ? (
            <div className={`p-8 rounded-2xl border text-center ${
              isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}>
              <p className="text-sm font-bold">Tidak ada data perkara yang sesuai dengan filter.</p>
              <button
                onClick={() => setFilters({ searchQuery: '', jenisPerkara: 'ALL', kategoriPerkara: 'ALL', status: 'ALL', tahun: 'ALL' })}
                className="mt-2 text-xs text-emerald-600 hover:underline font-bold"
              >
                Reset semua filter
              </button>
            </div>
          ) : (
            paginatedCases.map((item, idx) => (
              <div 
                key={`mobile-case-${item.id}-${idx}`}
                className={`p-4 rounded-2xl border transition-all shadow-xs ${
                  isLight 
                    ? 'bg-white border-slate-200 hover:border-emerald-300' 
                    : 'bg-slate-900 border-slate-800 hover:border-emerald-700'
                }`}
              >
                {/* Header Card: Nomor Perkara & Badges */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="space-y-0.5">
                    <span className="font-mono text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 block">
                      {item.nomorPerkara}
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                      isLight 
                        ? 'bg-slate-100 text-slate-700 border-slate-200' 
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {item.kategoriPerkara || item.jenisPerkara}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border shrink-0 ${
                    item.status === 'Putus' || item.status === 'Selesai'
                      ? isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : item.status === 'Minutasi'
                      ? isLight ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-blue-950 text-blue-300 border-blue-800'
                      : item.status === 'Diperiksa'
                      ? isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-950 text-amber-300 border-amber-800'
                      : isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {item.status}
                  </span>
                </div>

                {/* Nama Pihak & Detail Info */}
                <div className="py-2.5 space-y-2">
                  <div className="flex items-start space-x-2">
                    <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Pihak</div>
                      <div className={`font-bold text-sm leading-snug ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        {item.namaPihak}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-slate-500 dark:text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.jenisPerkara}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{item.tanggalRegister || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Saldo Panjar Highlight Box */}
                <div className={`p-3 rounded-xl mb-3 flex items-center justify-between border ${
                  item.saldoPerkara === 0 
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60' 
                    : isLight 
                    ? 'bg-emerald-50/70 border-emerald-200/80' 
                    : 'bg-emerald-950/20 border-emerald-900/50'
                }`}>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Sisa Saldo Panjar
                    </div>
                    {item.saldoPerkara === 0 && (
                      <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400">
                        ⚠️ Saldo Panjar Habis
                      </span>
                    )}
                  </div>
                  <div className={`font-mono text-base font-black ${
                    item.saldoPerkara === 0 
                      ? 'text-rose-600 dark:text-rose-400' 
                      : isLight ? 'text-emerald-800' : 'text-emerald-300'
                  }`}>
                    {formatRupiah(item.saldoPerkara)}
                  </div>
                </div>

                {/* Touch-Friendly Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {onOpenJurnal && (
                    <button
                      type="button"
                      onClick={() => onOpenJurnal(item)}
                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-xs active:scale-95 transition-all"
                    >
                      <span>🧮 Jurnal SKUM</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectCase(item)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1 transition-all ${
                      isLight 
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                    title="Lihat Detail Kartu Perkara"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Rincian</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenForm(item)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1 transition-all ${
                      isLight 
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' 
                        : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
                    }`}
                    title="Edit Data Perkara"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Apakah Anda yakin ingin menghapus perkara ${item.nomorPerkara}?`)) {
                        onDeleteCase(item.id);
                      }
                    }}
                    className="min-h-[38px] px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl border border-rose-200 dark:border-rose-800 transition-all flex items-center justify-center"
                    title="Hapus Perkara"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            ))
          )}
        </div>
      ) : (
        /* DATA TABLE (STANDAR LEBAR) */
        <div className={`overflow-x-auto border rounded-2xl transition-colors ${
          isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900'
        }`}>
          <table className="w-full text-left text-xs">
            <thead className={`border-b font-bold uppercase tracking-wider ${
              isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-200 border-slate-700'
            }`}>
              <tr>
                
                {/* Nomor Perkara */}
                <th 
                  onClick={() => handleSort('nomorPerkara')}
                  className={`px-4 py-3 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-200/60' : 'hover:bg-slate-700/50'}`}
                >
                  <div className="flex items-center space-x-1">
                    <span>Nomor Perkara</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Nama Pihak */}
                <th 
                  onClick={() => handleSort('namaPihak')}
                  className={`px-4 py-3 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-200/60' : 'hover:bg-slate-700/50'}`}
                >
                  <div className="flex items-center space-x-1">
                    <span>Nama Pihak</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Jenis Perkara */}
                <th 
                  onClick={() => handleSort('jenisPerkara')}
                  className={`px-4 py-3 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-200/60' : 'hover:bg-slate-700/50'}`}
                >
                  <div className="flex items-center space-x-1">
                    <span>Jenis Perkara</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Saldo Perkara (Rp) */}
                <th 
                  onClick={() => handleSort('saldoPerkara')}
                  className={`px-4 py-3 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-200/60' : 'hover:bg-slate-700/50'}`}
                >
                  <div className="flex items-center space-x-1">
                    <span>Saldo Perkara (Rp)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Tanggal Register */}
                <th 
                  onClick={() => handleSort('tanggalRegister')}
                  className={`px-4 py-3 cursor-pointer transition-colors hidden md:table-cell ${isLight ? 'hover:bg-slate-200/60' : 'hover:bg-slate-700/50'}`}
                >
                  <div className="flex items-center space-x-1">
                    <span>Tgl Register</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Status Perkara */}
                <th 
                  onClick={() => handleSort('status')}
                  className={`px-4 py-3 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-200/60' : 'hover:bg-slate-700/50'}`}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Aksi */}
                <th className="px-4 py-3 text-right">Aksi</th>

              </tr>
            </thead>

            <tbody className={`divide-y ${isLight ? 'divide-slate-200 bg-white' : 'divide-slate-800 bg-slate-900/50'}`}>
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`text-center py-12 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    <p className="text-sm">Tidak ada data perkara yang sesuai dengan filter.</p>
                    <button
                      onClick={() => setFilters({ searchQuery: '', jenisPerkara: 'ALL', kategoriPerkara: 'ALL', status: 'ALL', tahun: 'ALL' })}
                      className="mt-2 text-xs text-emerald-600 hover:underline font-semibold"
                    >
                      Reset semua filter
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedCases.map((item, idx) => (
                  <tr key={`${item.id}-${idx}`} className={`transition-colors group ${isLight ? 'hover:bg-emerald-50/30' : 'hover:bg-slate-800/60'}`}>
                    
                    {/* Nomor Perkara */}
                    <td className="px-4 py-3 font-mono font-extrabold text-emerald-700 whitespace-nowrap">
                      {item.nomorPerkara}
                    </td>

                    {/* Nama Pihak */}
                    <td className={`px-4 py-3 font-semibold max-w-xs truncate ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      {item.namaPihak}
                    </td>

                    {/* Jenis Perkara */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                        isLight 
                          ? 'bg-slate-100 text-slate-700 border-slate-200' 
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {item.jenisPerkara}
                      </span>
                    </td>

                    {/* Saldo Perkara (Rp) */}
                    <td className="px-4 py-3 font-bold whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span className={item.saldoPerkara === 0 ? 'text-rose-600 font-extrabold' : isLight ? 'text-slate-900' : 'text-slate-100'}>
                          {formatRupiah(item.saldoPerkara)}
                        </span>
                        {item.saldoPerkara === 0 && (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[9px] px-1.5 py-0.5 rounded font-bold" title="Saldo Panjar Habis">
                            Rp0
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Tanggal Register */}
                    <td className={`px-4 py-3 whitespace-nowrap hidden md:table-cell ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {item.tanggalRegister}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        item.status === 'Putus' || item.status === 'Selesai'
                          ? isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : item.status === 'Minutasi'
                          ? isLight ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-blue-950 text-blue-400 border-blue-800'
                          : item.status === 'Diperiksa'
                          ? isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-950 text-amber-400 border-amber-800'
                          : isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      {onOpenJurnal && (
                        <button
                          onClick={() => onOpenJurnal(item)}
                          className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-[10px] border border-amber-500/30 transition-colors"
                          title="Catat Jurnal SKUM Perkara Ini"
                        >
                          🧮 Jurnal
                        </button>
                      )}
                      <button
                        onClick={() => onSelectCase(item)}
                        className={`p-1.5 rounded border transition-colors ${
                          isLight 
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                        }`}
                        title="Lihat Detail Kartu Perkara"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onOpenForm(item)}
                        className={`p-1.5 rounded border transition-colors ${
                          isLight 
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' 
                            : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
                        }`}
                        title="Edit Data Perkara"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Apakah Anda yakin ingin menghapus perkara ${item.nomorPerkara}?`)) {
                            onDeleteCase(item.id);
                          }
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded border border-slate-700 transition-colors"
                        title="Hapus Perkara"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PAGINATION FOOTER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-400">
        <div>
          Menampilkan <span className="font-semibold text-slate-200">{paginatedCases.length}</span> dari{' '}
          <span className="font-semibold text-slate-200">{filteredCases.length}</span> total perkara
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-2 font-medium">
            Halaman {currentPage} dari {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
