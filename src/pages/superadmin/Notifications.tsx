import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Smartphone, Mail, Save, Loader2, Info } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export default function SuperAdminNotifications() {
  const [token, setToken] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isEmailActive, setIsEmailActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const snap = await getDoc(doc(db, 'global_settings', 'fonnte'));
      if (snap.exists()) {
        setToken(snap.data().token || '');
        setIsActive(!!snap.data().isActive);
      }
      const emailSnap = await getDoc(doc(db, 'global_settings', 'email_settings'));
      if (emailSnap.exists()) {
        setIsEmailActive(!!emailSnap.data().isActive);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'global_settings', 'fonnte'), {
        token,
        isActive
      }, { merge: true });
      await setDoc(doc(db, 'global_settings', 'email_settings'), {
        isActive: isEmailActive
      }, { merge: true });
      alert('Pengaturan Notifikasi berhasil disimpan!');
    } catch (error) {
      // @ts-ignore
      handleFirestoreError(error, OperationType.WRITE, 'global_settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center gap-2">
          <Smartphone className="w-8 h-8" />
          <Mail className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Pengaturan Notifikasi</h1>
          <p className="text-sm text-gray-500 font-medium">Pengaturan integrasi Fonnte (WA) & Notifikasi Email via Firebase</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">Notifikasi WhatsApp (Fonnte)</h2>
          <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
            />
            <div>
              <label htmlFor="isActive" className="font-bold text-gray-900 cursor-pointer">
                Aktifkan Notifikasi WhatsApp
              </label>
              <p className="text-xs text-indigo-700 font-medium">Jika diaktifkan, sistem akan mengirimkan notifikasi WA ke tenant</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Token Fonnte</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              placeholder="Masukkan token dari Fonnte..."
            />
            <p className="text-xs text-gray-500 flex items-center mt-2">
              <Info className="w-4 h-4 mr-1 text-blue-500" />
              Dapatkan token dari dashboard Fonnte (app.fonnte.com). Token ini digunakan untuk mengirim pesan.
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">Notifikasi Email</h2>
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border border-green-100">
            <input
              type="checkbox"
              id="isEmailActive"
              checked={isEmailActive}
              onChange={e => setIsEmailActive(e.target.checked)}
              className="w-5 h-5 text-green-600 rounded focus:ring-green-500 border-gray-300"
            />
            <div>
              <label htmlFor="isEmailActive" className="font-bold text-gray-900 cursor-pointer">
                Aktifkan Notifikasi Email
              </label>
              <p className="text-xs text-green-700 font-medium">
                Sistem akan memicu penambahan dokumen ke koleksi 'mail', diproses oleh Firebase Extension 'Trigger Email'. (Pastikan Extension sudah ter-install di project Firebase Anda)
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center shadow-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
            Simpan Semua Pengaturan
          </button>
        </div>
      </form>
    </div>
  );
}
