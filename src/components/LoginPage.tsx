import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Sun, 
  Moon, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound,
  Building2,
  Sparkles,
  Info
} from 'lucide-react';
import { AuthUser } from '../types';
import { StorageService, STATIC_AUTH_CONFIG } from '../services/storage';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  theme,
  onToggleTheme
}) => {
  const isLight = theme === 'light';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  // Detect CapsLock for user convenience
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.getModifierState('CapsLock')) {
      setIsCapsLockOn(true);
    } else {
      setIsCapsLockOn(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim();
    const cleanPwd = password.trim();

    if (!cleanUser || !cleanPwd) {
      setErrorMessage('Mohon lengkapi username dan kata sandi Anda.');
      return;
    }

    setIsLoading(true);

    // Verify against configured credentials (default: idris, broken_dot or user-customized)
    setTimeout(() => {
      const validCreds = StorageService.getAuthCredentials();
      const isValidUser = cleanUser.toLowerCase() === validCreds.username.toLowerCase();
      const isValidPwd = cleanPwd === validCreds.password;

      if (isValidUser && isValidPwd) {
        setIsSuccess(true);
        const authUser: AuthUser = {
          username: cleanUser,
          name: STATIC_AUTH_CONFIG.DEFAULT_USER_NAME,
          role: STATIC_AUTH_CONFIG.DEFAULT_ROLE,
          institution: STATIC_AUTH_CONFIG.INSTITUTION,
          loginTime: new Date().toISOString()
        };

        StorageService.saveAuthUser(authUser, rememberMe);

        setTimeout(() => {
          onLoginSuccess(authUser);
        }, 500);
      } else {
        setIsLoading(false);
        setErrorMessage('Username atau kata sandi tidak valid. Silakan periksa kembali kredensial Anda.');
      }
    }, 450);
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between relative overflow-hidden transition-colors selection:bg-emerald-500 selection:text-white ${
      isLight 
        ? 'bg-gradient-to-br from-slate-50 via-emerald-50/25 to-slate-100 text-slate-900' 
        : 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100'
    }`}>
      
      {/* Background Decorative Radial Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] pointer-events-none opacity-40 dark:opacity-20">
        <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-[-10%] right-[20%] w-[450px] h-[450px] rounded-full bg-teal-500/20 blur-3xl" />
      </div>

      {/* Top Header Bar */}
      <header className="w-full px-4 sm:px-8 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base tracking-tight leading-tight">
              SI-PERKARA
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Pengadilan Agama Paniai Kelas II
            </p>
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          type="button"
          className={`p-2 rounded-xl border transition-all duration-200 flex items-center gap-1.5 text-xs font-medium ${
            isLight
              ? 'bg-white/80 hover:bg-slate-100 border-slate-200 text-slate-700 shadow-2xs'
              : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700 text-slate-200 shadow-sm'
          }`}
          title={isLight ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
        >
          {isLight ? (
            <>
              <Moon className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Mode Gelap</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Mode Terang</span>
            </>
          )}
        </button>
      </header>

      {/* Main Center Login Container */}
      <main className="w-full flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-md mx-auto">
          
          {/* Card Wrapper */}
          <div className={`rounded-3xl border shadow-xl backdrop-blur-md overflow-hidden transition-all duration-300 ${
            isLight 
              ? 'bg-white/95 border-slate-200/80 shadow-slate-200/50' 
              : 'bg-slate-900/90 border-slate-800 shadow-black/40'
          }`}>
            
            {/* Card Header Banner */}
            <div className="p-6 sm:p-8 pb-4 text-center">
              
              {/* Institution Seal / Icon */}
              <div className="relative inline-flex items-center justify-center mb-4">
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 ring-4 ring-emerald-500/10">
                  <Scale className="w-8 h-8 sm:w-9 sm:h-9" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs border-2 border-white dark:border-slate-900">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Title & Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase mb-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Portal Autentikasi Pengguna</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Masuk ke Sistem Perkara
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Silakan masukkan kredensial akun untuk mengakses Jurnal SKUM, Buku Biaya Proses & Register Perkara
              </p>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="px-6 sm:px-8 pt-2">
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/70 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="flex-1 font-medium">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Caps Lock Alert */}
            {isCapsLockOn && (
              <div className="px-6 sm:px-8 pt-2">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>Peringatan: <strong>Caps Lock</strong> dalam keadaan aktif!</span>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 pt-4 space-y-4">
              
              {/* Username Input Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Pengguna (Username)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Masukkan username..."
                    autoComplete="username"
                    autoFocus
                    disabled={isLoading || isSuccess}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm font-medium border transition-all duration-200 outline-none ${
                      isLight
                        ? 'bg-slate-50/80 border-slate-200 text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                        : 'bg-slate-800/80 border-slate-700 text-white focus:bg-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20'
                    }`}
                  />
                  {username && !isLoading && (
                    <button
                      type="button"
                      onClick={() => setUsername('')}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>

              {/* Password Input Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Kata Sandi (Password)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {showPassword ? 'Sembunyikan' : 'Perlihatkan'}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Masukkan kata sandi..."
                    autoComplete="current-password"
                    disabled={isLoading || isSuccess}
                    className={`w-full pl-10 pr-11 py-2.5 rounded-2xl text-sm font-medium border transition-all duration-200 outline-none ${
                      isLight
                        ? 'bg-slate-50/80 border-slate-200 text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                        : 'bg-slate-800/80 border-slate-700 text-white focus:bg-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title={showPassword ? "Sembunyikan Sandi" : "Lihat Sandi"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading || isSuccess}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Ingat saya di perangkat ini
                  </span>
                </label>
                
                <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                  Sesi Terlindungi
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || isSuccess}
                className={`w-full py-3 px-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${
                  isSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] shadow-emerald-600/25'
                } disabled:opacity-80 disabled:cursor-not-allowed`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi Akses...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white animate-bounce" />
                    <span>Akses Diterima! Masuk...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Sistem</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>

            {/* Card Footer Security Indicator */}
            <div className={`px-6 py-3.5 border-t text-center text-[11px] transition-colors ${
              isLight ? 'bg-slate-50/60 border-slate-100 text-slate-500' : 'bg-slate-900/60 border-slate-800/80 text-slate-400'
            }`}>
              <div className="flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Terotentikasi & Tersinkronisasi Otomatis Google Sheets</span>
              </div>
            </div>

          </div>

          {/* Bottom Info & Help Notice */}
          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p className="font-medium">
              Sistem Manajemen Perkara & Keuangan Perkara (SI-PERKARA)
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Pengadilan Agama Paniai • Kepaniteraan Hukum & Kas Keuangan Perkara
            </p>
          </div>

        </div>
      </main>

      {/* Footer System Credits */}
      <footer className="w-full px-4 py-3 text-center text-[11px] text-slate-400 dark:text-slate-500 z-10">
        © 2026 Pengadilan Agama Paniai. Hak Cipta Dilindungi Undang-Undang.
      </footer>

    </div>
  );
};
