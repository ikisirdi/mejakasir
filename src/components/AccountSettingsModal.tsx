import React, { useState } from 'react';
import { 
  KeyRound, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  RotateCcw, 
  ShieldCheck, 
  FileCode2,
  Save
} from 'lucide-react';
import { AuthUser } from '../types';
import { StorageService, STATIC_AUTH_CONFIG } from '../services/storage';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onCredentialsUpdated: (newUsername: string) => void;
  theme: 'light' | 'dark';
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onCredentialsUpdated,
  theme
}) => {
  if (!isOpen) return null;

  const isLight = theme === 'light';
  const currentCredentials = StorageService.getAuthCredentials();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(currentCredentials.username);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const cleanCurrentPwd = currentPassword.trim();
    const cleanNewUser = newUsername.trim();
    const cleanNewPwd = newPassword.trim();
    const cleanConfirmPwd = confirmPassword.trim();

    // Verify current password
    if (cleanCurrentPwd !== currentCredentials.password) {
      setStatusMessage({
        type: 'error',
        text: 'Kata sandi saat ini yang Anda masukkan salah. Mohon periksa kembali.'
      });
      return;
    }

    if (!cleanNewUser) {
      setStatusMessage({
        type: 'error',
        text: 'Nama pengguna (username) tidak boleh kosong.'
      });
      return;
    }

    if (cleanNewPwd.length < 4) {
      setStatusMessage({
        type: 'error',
        text: 'Kata sandi baru minimal 4 karakter.'
      });
      return;
    }

    if (cleanNewPwd !== cleanConfirmPwd) {
      setStatusMessage({
        type: 'error',
        text: 'Konfirmasi kata sandi baru tidak cocok dengan kata sandi baru.'
      });
      return;
    }

    // Save credentials
    StorageService.saveAuthCredentials(cleanNewUser, cleanNewPwd);

    // Update active session user if username changed
    if (currentUser) {
      const updatedUser: AuthUser = {
        ...currentUser,
        username: cleanNewUser
      };
      StorageService.saveAuthUser(updatedUser);
    }

    setStatusMessage({
      type: 'success',
      text: 'Kredensial berhasil diperbarui! Gunakan username & password baru saat login berikutnya.'
    });

    onCredentialsUpdated(cleanNewUser);

    setTimeout(() => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    }, 1500);
  };

  const handleResetToDefault = () => {
    StorageService.resetAuthCredentials();
    if (currentUser) {
      const resetUser: AuthUser = {
        ...currentUser,
        username: STATIC_AUTH_CONFIG.STATIC_USERNAME
      };
      StorageService.saveAuthUser(resetUser);
    }
    setNewUsername(STATIC_AUTH_CONFIG.STATIC_USERNAME);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsResetConfirmOpen(false);
    setStatusMessage({
      type: 'success',
      text: `Kredensial berhasil dikembalikan ke pengaturan awal (${STATIC_AUTH_CONFIG.STATIC_USERNAME}).`
    });
    onCredentialsUpdated(STATIC_AUTH_CONFIG.STATIC_USERNAME);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        {/* Modal Header */}
        <div className={`px-5 sm:px-6 py-4 border-b flex items-center justify-between ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight text-slate-900 dark:text-white">
                Pengaturan Akun & Kata Sandi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ubah username dan password untuk login ke sistem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl border transition-colors ${
              isLight ? 'border-slate-200 hover:bg-slate-200 text-slate-600' : 'border-slate-700 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Status Alert Banner */}
          {statusMessage && (
            <div className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Current Password Verification */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Kata Sandi Saat Ini <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan kata sandi lama Anda..."
                  className={`w-full pl-9 pr-10 py-2 rounded-xl text-sm border outline-none font-medium transition-colors ${
                    isLight 
                      ? 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20' 
                      : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-3">
                Kredensial Baru
              </span>

              {/* New Username */}
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Pengguna Baru (Username) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Contoh: idris atau nama_baru"
                    className={`w-full pl-9 pr-4 py-2 rounded-xl text-sm border outline-none font-medium transition-colors ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20' 
                        : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                    }`}
                  />
                </div>
              </div>

              {/* New Password */}
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kata Sandi Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan kata sandi baru (min 4 karakter)..."
                    className={`w-full pl-9 pr-10 py-2 rounded-xl text-sm border outline-none font-medium transition-colors ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20' 
                        : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ulangi Kata Sandi Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang kata sandi baru..."
                    className={`w-full pl-9 pr-4 py-2 rounded-xl text-sm border outline-none font-medium transition-colors ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20' 
                        : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className={`w-full sm:w-auto px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  isLight 
                    ? 'border-slate-200 text-slate-600 hover:bg-slate-100' 
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
                title="Kembalikan username dan kata sandi ke bawaan pabrik (idris / broken_dot)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ke Default</span>
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`w-1/2 sm:w-auto px-4 py-2 rounded-xl border text-xs font-medium transition-colors ${
                    isLight ? 'border-slate-200 hover:bg-slate-100 text-slate-700' : 'border-slate-700 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-1/2 sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </div>

          </form>

          {/* Reset Confirmation Sub-Dialog */}
          {isResetConfirmOpen && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Konfirmasi Reset Kredensial</span>
              </div>
              <p>
                Apakah Anda yakin ingin mengembalikan kredensial ke default sistem (Username: <code>{STATIC_AUTH_CONFIG.STATIC_USERNAME}</code>)?
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px]"
                >
                  Ya, Reset Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 font-medium text-[11px]"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Developer / Administrator Guide Box */}
          <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-800/40 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
              <FileCode2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Informasi Pengembang / File Konfigurasi:</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Jika ingin merubah username dan kata sandi statis secara permanen pada kode sumber untuk semua pengguna/perangkat, ubah nilai di file:
            </p>
            <div className="font-mono text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-200 select-all">
              src/services/storage.ts &rarr; STATIC_AUTH_CONFIG
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
