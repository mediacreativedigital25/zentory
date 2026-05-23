import { useState, useEffect } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Image as ImageIcon, Save, Zap, Lock, Unlock, CreditCard } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import ConfirmModal from '../../components/ConfirmModal';

export default function SuperAdminGlobalSettings() {
  const { profile } = useAuth();
  const [globalSettings, setGlobalSettings] = useState<any>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; showCancel?: boolean } | null>(null);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'system', 'config'), (snap) => {
      if (snap.exists()) {
        setGlobalSettings(snap.data());
      }
    });

    return () => unsubSettings();
  }, [profile]);

  const handleSaveGlobalSettings = async () => {
    setIsSavingSettings(true);
    try {
      const settingsToSave = {
        ...globalSettings,
        paymentMethods: {
          manual: {
            bankName: globalSettings.paymentMethods?.manual?.bankName || '',
            accountNumber: globalSettings.paymentMethods?.manual?.accountNumber || '',
            accountHolder: globalSettings.paymentMethods?.manual?.accountHolder || '',
            qrisUrl: globalSettings.paymentMethods?.manual?.qrisUrl || '',
            logoUrl: globalSettings.paymentMethods?.manual?.logoUrl || '',
            isEnabled: globalSettings.paymentMethods?.manual?.isEnabled ?? true
          },
          tripay: {
            apiKey: globalSettings.paymentMethods?.tripay?.apiKey || '',
            privateKey: globalSettings.paymentMethods?.tripay?.privateKey || '',
            merchantCode: globalSettings.paymentMethods?.tripay?.merchantCode || '',
            mode: globalSettings.paymentMethods?.tripay?.mode || 'sandbox',
            isEnabled: globalSettings.paymentMethods?.tripay?.isEnabled ?? false
          }
        },
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'system', 'config'), settingsToSave, { merge: true });
      setConfirmConfig({
        isOpen: true,
        title: 'Berhasil',
        message: 'Pengaturan global berhasil disimpan.',
        onConfirm: () => setConfirmConfig(null),
        showCancel: false
      });
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, 'system/config', auth, profile);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Global Settings</h2>
          <p className="text-gray-500">Configure system-wide parameters and integrations.</p>
        </div>
        <button
          onClick={handleSaveGlobalSettings}
          disabled={isSavingSettings}
          className="px-8 py-3 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center disabled:opacity-50"
        >
          {isSavingSettings ? 'Menyimpan...' : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Simpan Semua Perubahan
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Manual Payment Settings */}
        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-indigo-600" />
              Metode Pembayaran Manual
            </h3>
            <button
              onClick={() => setGlobalSettings({
                ...globalSettings,
                paymentMethods: {
                  ...globalSettings.paymentMethods,
                  manual: {
                    ...globalSettings.paymentMethods?.manual,
                    isEnabled: !globalSettings.paymentMethods?.manual?.isEnabled
                  }
                }
              })}
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                globalSettings.paymentMethods?.manual?.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {globalSettings.paymentMethods?.manual?.isEnabled ? 'AKTIF' : 'NONAKTIF'}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-600">Logo Bank (URL Gambar) - Opsional</label>
              <input
                type="text"
                value={globalSettings.paymentMethods?.manual?.logoUrl || ''}
                onChange={(e) => setGlobalSettings({
                  ...globalSettings,
                  paymentMethods: {
                    ...globalSettings.paymentMethods,
                    manual: { ...globalSettings.paymentMethods?.manual, logoUrl: e.target.value }
                  }
                })}
                placeholder="Contoh: https://example.com/logo-bca.png"
                className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {globalSettings.paymentMethods?.manual?.logoUrl && (
                <div className="mt-2 p-4 bg-gray-50 rounded-md border border-gray-200 flex items-center justify-center">
                  <img 
                    src={globalSettings.paymentMethods.manual.logoUrl} 
                    alt="Logo Preview" 
                    className="max-h-12 object-contain" 
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-600">Nama Bank</label>
              <input
                type="text"
                value={globalSettings.paymentMethods?.manual?.bankName || ''}
                onChange={(e) => setGlobalSettings({
                  ...globalSettings,
                  paymentMethods: {
                    ...globalSettings.paymentMethods,
                    manual: { ...globalSettings.paymentMethods?.manual, bankName: e.target.value }
                  }
                })}
                placeholder="Contoh: Bank BCA"
                className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-600">Nomor Rekening</label>
              <input
                type="text"
                value={globalSettings.paymentMethods?.manual?.accountNumber || ''}
                onChange={(e) => setGlobalSettings({
                  ...globalSettings,
                  paymentMethods: {
                    ...globalSettings.paymentMethods,
                    manual: { ...globalSettings.paymentMethods?.manual, accountNumber: e.target.value }
                  }
                })}
                placeholder="Contoh: 1234567890"
                className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-600">Nama Pemilik Rekening</label>
              <input
                type="text"
                value={globalSettings.paymentMethods?.manual?.accountHolder || ''}
                onChange={(e) => setGlobalSettings({
                  ...globalSettings,
                  paymentMethods: {
                    ...globalSettings.paymentMethods,
                    manual: { ...globalSettings.paymentMethods?.manual, accountHolder: e.target.value }
                  }
                })}
                placeholder="Contoh: PT Zentory Indonesia"
                className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-600">URL QRIS (Opsional)</label>
              <input
                type="text"
                value={globalSettings.paymentMethods?.manual?.qrisUrl || ''}
                onChange={(e) => setGlobalSettings({
                  ...globalSettings,
                  paymentMethods: {
                    ...globalSettings.paymentMethods,
                    manual: { ...globalSettings.paymentMethods?.manual, qrisUrl: e.target.value }
                  }
                })}
                placeholder="https://example.com/qris.jpg"
                className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* TriPay Settings */}
        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-indigo-600" />
              Integrasi TriPay Gateway
            </h3>
            <button
              onClick={() => setGlobalSettings({
                ...globalSettings,
                paymentMethods: {
                  ...globalSettings.paymentMethods,
                  tripay: {
                    ...globalSettings.paymentMethods?.tripay,
                    isEnabled: !globalSettings.paymentMethods?.tripay?.isEnabled
                  }
                }
              })}
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                globalSettings.paymentMethods?.tripay?.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {globalSettings.paymentMethods?.tripay?.isEnabled ? 'AKTIF' : 'NONAKTIF'}
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-xs font-semibold text-gray-600">Mode</label>
                <select
                  value={globalSettings.paymentMethods?.tripay?.mode || 'sandbox'}
                  onChange={(e) => setGlobalSettings({
                    ...globalSettings,
                    paymentMethods: {
                      ...globalSettings.paymentMethods,
                      tripay: { ...globalSettings.paymentMethods?.tripay, mode: e.target.value }
                    }
                  })}
                  className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="production">Production (Live)</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-gray-600">Merchant Code</label>
                <input
                  type="text"
                  value={globalSettings.paymentMethods?.tripay?.merchantCode || ''}
                  onChange={(e) => setGlobalSettings({
                    ...globalSettings,
                    paymentMethods: {
                      ...globalSettings.paymentMethods,
                      tripay: { ...globalSettings.paymentMethods?.tripay, merchantCode: e.target.value }
                    }
                  })}
                  placeholder="T12345"
                  className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-600">API Key</label>
              <div className="relative">
                <input
                  type="password"
                  value={globalSettings.paymentMethods?.tripay?.apiKey || ''}
                  onChange={(e) => setGlobalSettings({
                    ...globalSettings,
                    paymentMethods: {
                      ...globalSettings.paymentMethods,
                      tripay: { ...globalSettings.paymentMethods?.tripay, apiKey: e.target.value }
                    }
                  })}
                  className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              </div>
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold text-gray-600">Private Key</label>
              <div className="relative">
                <input
                  type="password"
                  value={globalSettings.paymentMethods?.tripay?.privateKey || ''}
                  onChange={(e) => setGlobalSettings({
                    ...globalSettings,
                    paymentMethods: {
                      ...globalSettings.paymentMethods,
                      tripay: { ...globalSettings.paymentMethods?.tripay, privateKey: e.target.value }
                    }
                  })}
                  className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                />
                <Unlock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
          showCancel={confirmConfig.showCancel}
        />
      )}
    </div>
  );
}
