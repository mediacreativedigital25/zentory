import { useState, useEffect } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Image as ImageIcon, Save, Zap, Lock, Unlock, CreditCard, Plus, Trash2, Building2 } from 'lucide-react';
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
        const data = snap.data();
        if (data.paymentMethods && data.paymentMethods.manual) {
          const manualData = data.paymentMethods.manual;
          let accounts = manualData.accounts || [];
          if (accounts.length === 0 && (manualData.bankName || manualData.accountNumber)) {
            accounts = [{
              id: Date.now().toString(),
              bankName: manualData.bankName || '',
              accountNumber: manualData.accountNumber || '',
              accountHolder: manualData.accountHolder || ''
            }];
          } else if (accounts.length === 0) {
            accounts = [{ id: Date.now().toString(), bankName: '', accountNumber: '', accountHolder: '' }];
          }
          data.paymentMethods.manual.accounts = accounts;
        } else if (!data.paymentMethods) {
          data.paymentMethods = { manual: { isEnabled: false, accounts: [{ id: Date.now().toString(), bankName: '', accountNumber: '', accountHolder: '' }] } };
        }
        setGlobalSettings(data);
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
            accounts: globalSettings.paymentMethods?.manual?.accounts || [],
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

            <div className="space-y-4">
              {globalSettings.paymentMethods?.manual?.accounts?.map((account: any, index: number) => (
                <div key={account.id || index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-gray-900">Rekening {index + 1}</h4>
                    {(globalSettings.paymentMethods?.manual?.accounts?.length || 0) > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newAccounts = globalSettings.paymentMethods.manual.accounts.filter((_: any, i: number) => i !== index);
                          setGlobalSettings({
                            ...globalSettings,
                            paymentMethods: {
                              ...globalSettings.paymentMethods,
                              manual: { ...globalSettings.paymentMethods?.manual, accounts: newAccounts }
                            }
                          });
                        }}
                        className="text-red-500 hover:text-red-700 transition-colors p-1"
                        title="Hapus Rekening"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block mb-1 text-xs font-semibold text-gray-600">Nama Bank / E-Wallet</label>
                      <select
                        value={account.bankName || ''}
                        onChange={(e) => {
                          const newAccounts = [...(globalSettings.paymentMethods?.manual?.accounts || [])];
                          newAccounts[index].bankName = e.target.value;
                          setGlobalSettings({
                            ...globalSettings,
                            paymentMethods: {
                              ...globalSettings.paymentMethods,
                              manual: { ...globalSettings.paymentMethods?.manual, accounts: newAccounts }
                            }
                          });
                        }}
                        className="w-full p-2 border border-gray-200 bg-white rounded-md outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                      >
                        <option value="" disabled>Pilih Bank / E-Wallet</option>
                        {['BCA', 'Mandiri', 'BNI', 'BRI', 'BSI', 'CIMB Niaga', 'Permata Bank', 'Bank Danamon', 'Bank Mega', 'Bank Jago', 'Seabank', 'GoPay', 'OVO', 'DANA', 'ShopeePay', 'LinkAja', 'Lainnya...'].map(bank => (
                          <option key={bank} value={bank}>{bank}</option>
                        ))}
                      </select>
                      {account.bankName === 'Lainnya...' && (
                        <input
                          type="text"
                          required
                          value={account.customBankName || ''}
                          onChange={(e) => {
                            const newAccounts = [...(globalSettings.paymentMethods?.manual?.accounts || [])];
                            newAccounts[index].customBankName = e.target.value;
                            setGlobalSettings({
                              ...globalSettings,
                              paymentMethods: {
                                ...globalSettings.paymentMethods,
                                manual: { ...globalSettings.paymentMethods?.manual, accounts: newAccounts }
                              }
                            });
                          }}
                          className="w-full p-2 mt-2 border border-gray-200 bg-white rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Masukkan nama bank/e-wallet"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block mb-1 text-xs font-semibold text-gray-600">Nomor Rekening</label>
                      <input
                        type="text"
                        value={account.accountNumber || ''}
                        onChange={(e) => {
                          const newAccounts = [...(globalSettings.paymentMethods?.manual?.accounts || [])];
                          newAccounts[index].accountNumber = e.target.value;
                          setGlobalSettings({
                            ...globalSettings,
                            paymentMethods: {
                              ...globalSettings.paymentMethods,
                              manual: { ...globalSettings.paymentMethods?.manual, accounts: newAccounts }
                            }
                          });
                        }}
                        placeholder="Contoh: 1234567890"
                        className="w-full p-2 border border-gray-200 bg-white rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-2">
                      <label className="block mb-1 text-xs font-semibold text-gray-600">Nama Pemilik Rekening</label>
                      <input
                        type="text"
                        value={account.accountHolder || ''}
                        onChange={(e) => {
                          const newAccounts = [...(globalSettings.paymentMethods?.manual?.accounts || [])];
                          newAccounts[index].accountHolder = e.target.value;
                          setGlobalSettings({
                            ...globalSettings,
                            paymentMethods: {
                              ...globalSettings.paymentMethods,
                              manual: { ...globalSettings.paymentMethods?.manual, accounts: newAccounts }
                            }
                          });
                        }}
                        placeholder="Contoh: PT Zyvora Indonesia"
                        className="w-full p-2 border border-gray-200 bg-white rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {(globalSettings.paymentMethods?.manual?.accounts?.length || 0) < 3 && (
                <button
                  type="button"
                  onClick={() => {
                    const newAccounts = [
                      ...(globalSettings.paymentMethods?.manual?.accounts || []),
                      { id: Date.now().toString(), bankName: '', accountNumber: '', accountHolder: '' }
                    ];
                    setGlobalSettings({
                      ...globalSettings,
                      paymentMethods: {
                        ...globalSettings.paymentMethods,
                        manual: { ...globalSettings.paymentMethods?.manual, accounts: newAccounts }
                      }
                    });
                  }}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:text-indigo-600 hover:border-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Rekening Baru
                </button>
              )}
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
