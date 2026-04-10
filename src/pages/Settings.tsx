import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ShieldAlert
} from 'lucide-react';

export const Settings: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Password tidak cocok.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, newPassword);
        setSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Silakan login ulang untuk mengubah password demi keamanan.');
      } else {
        setError('Gagal memperbarui password.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan Keamanan</h1>
        <p className="text-gray-500 text-sm">Kelola password dan keamanan akun Anda.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="flex items-center gap-4 mb-8 p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-700">
          <ShieldAlert size={24} className="shrink-0" />
          <p className="text-xs font-medium">
            Pastikan password Anda kuat dan tidak mudah ditebak. Gunakan kombinasi huruf, angka, dan simbol.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-6">
          {success && (
            <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 text-green-600 text-sm">
              <CheckCircle2 size={20} />
              <span>Password berhasil diperbarui!</span>
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password Baru</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Konfirmasi Password Baru</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
