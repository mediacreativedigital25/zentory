import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Tenant } from '../types';
import { Building2, Save, CreditCard, CheckCircle2, Loader2, Link, Copy, ExternalLink, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function TenantPaymentSettings() {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<any>({
    paymentMethods: {
      manual: {
        isEnabled: false,
        accounts: [{ id: Date.now().toString(), bankName: '', accountNumber: '', accountHolder: '' }],
      },
      paymentGateway: {
        isEnabled: false,
        mode: 'sandbox',
        merchantCode: '',
        apiKey: '',
        privateKey: '',
      }
    }
  });

  useEffect(() => {
    const fetchTenant = async () => {
      if (!profile?.tenantId) return;
      try {
        const tenantDoc = await getDoc(doc(db, 'tenants', profile.tenantId));
        if (tenantDoc.exists()) {
          const data = { id: tenantDoc.id, ...tenantDoc.data() } as Tenant;
          setTenant(data);
          if (data.paymentMethods) {
            const manualData = (data.paymentMethods.manual || {}) as any;
            // Migrate old data pattern if accounts array doesn't exist but old fields do
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

            setFormData({ 
               paymentMethods: { 
                 ...formData.paymentMethods, 
                 ...data.paymentMethods,
                 manual: {
                   ...data.paymentMethods.manual,
                   isEnabled: manualData.isEnabled || false,
                   accounts: accounts
                 }
               } 
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `tenants/${profile.tenantId}`, auth, profile);
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    setSaving(true);
    setSuccess(false);

    try {
      const tenantRef = doc(db, 'tenants', profile.tenantId);
      await updateDoc(tenantRef, {
        paymentMethods: formData.paymentMethods,
        updatedAt: serverTimestamp()
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tenants/${profile.tenantId}`, auth, profile);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Metode Pembayaran</h2>
          <p className="text-gray-500">Atur metode pembayaran yang tersedia untuk pelanggan Anda melalui marketplace.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bank Transfer Manual */}
        <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-indigo-600" />
              Bank Transfer Manual
            </h3>
            <button
              type="button"
              onClick={() => setFormData({
                ...formData,
                paymentMethods: {
                  ...formData.paymentMethods,
                  manual: {
                    ...formData.paymentMethods.manual,
                    isEnabled: !formData.paymentMethods.manual.isEnabled
                  }
                }
              })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.paymentMethods.manual.isEnabled ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.paymentMethods.manual.isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          
          {formData.paymentMethods.manual.isEnabled && (
            <div className="p-6 space-y-6">
              {formData.paymentMethods.manual.accounts.map((account: any, index: number) => (
                <div key={account.id || index} className="relative bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-gray-900">Rekening {index + 1}</h4>
                    {formData.paymentMethods.manual.accounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newAccounts = formData.paymentMethods.manual.accounts.filter((_: any, i: number) => i !== index);
                          setFormData({
                            ...formData,
                            paymentMethods: {
                              ...formData.paymentMethods,
                              manual: { ...formData.paymentMethods.manual, accounts: newAccounts }
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
                      <label className="text-xs font-semibold text-gray-600">Nama Bank / E-Wallet *</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                          required
                          value={account.bankName || ''}
                          onChange={(e) => {
                            const newAccounts = [...formData.paymentMethods.manual.accounts];
                            newAccounts[index].bankName = e.target.value;
                            setFormData({
                              ...formData,
                              paymentMethods: {
                                ...formData.paymentMethods,
                                manual: { ...formData.paymentMethods.manual, accounts: newAccounts }
                              }
                            });
                          }}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-white rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                        >
                          <option value="" disabled>Pilih Bank / E-Wallet</option>
                          {['BCA', 'Mandiri', 'BNI', 'BRI', 'BSI', 'CIMB Niaga', 'Permata Bank', 'Bank Danamon', 'Bank Mega', 'Bank Jago', 'Seabank', 'GoPay', 'OVO', 'DANA', 'ShopeePay', 'LinkAja', 'Lainnya...'].map(bank => (
                            <option key={bank} value={bank}>{bank}</option>
                          ))}
                        </select>
                      </div>
                      {account.bankName === 'Lainnya...' && (
                        <input
                          type="text"
                          required
                          value={account.customBankName || ''}
                          onChange={(e) => {
                            const newAccounts = [...formData.paymentMethods.manual.accounts];
                            newAccounts[index].customBankName = e.target.value;
                            setFormData({
                              ...formData,
                              paymentMethods: {
                                ...formData.paymentMethods,
                                manual: { ...formData.paymentMethods.manual, accounts: newAccounts }
                              }
                            });
                          }}
                          className="w-full px-4 py-2 mt-2 border border-gray-200 bg-white rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          placeholder="Masukkan nama bank/e-wallet"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-600">Nomor Rekening *</label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={account.accountNumber || ''}
                          onChange={(e) => {
                            const newAccounts = [...formData.paymentMethods.manual.accounts];
                            newAccounts[index].accountNumber = e.target.value;
                            setFormData({
                              ...formData,
                              paymentMethods: {
                                ...formData.paymentMethods,
                                manual: { ...formData.paymentMethods.manual, accounts: newAccounts }
                              }
                            });
                          }}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-white rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          placeholder="Nomor rekening"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-semibold text-gray-600">Atas Nama Rekening *</label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={account.accountHolder || ''}
                          onChange={(e) => {
                            const newAccounts = [...formData.paymentMethods.manual.accounts];
                            newAccounts[index].accountHolder = e.target.value;
                            setFormData({
                              ...formData,
                              paymentMethods: {
                                ...formData.paymentMethods,
                                manual: { ...formData.paymentMethods.manual, accounts: newAccounts }
                              }
                            });
                          }}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-white rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          placeholder="Nama pemilik rekening"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {formData.paymentMethods.manual.accounts.length < 3 && (
                <button
                  type="button"
                  onClick={() => {
                    const newAccounts = [
                      ...formData.paymentMethods.manual.accounts,
                      { id: Date.now().toString(), bankName: '', accountNumber: '', accountHolder: '' }
                    ];
                    setFormData({
                      ...formData,
                      paymentMethods: {
                        ...formData.paymentMethods,
                        manual: { ...formData.paymentMethods.manual, accounts: newAccounts }
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
          )}
        </div>

        {/* Payment Gateway */}
        <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Payment Gateway <span className="bg-amber-100 text-amber-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">BETA</span>
            </h3>
            <button
              type="button"
              onClick={() => setFormData({
                ...formData,
                paymentMethods: {
                  ...formData.paymentMethods,
                  paymentGateway: {
                    ...formData.paymentMethods.paymentGateway,
                    isEnabled: !formData.paymentMethods.paymentGateway.isEnabled
                  }
                }
              })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.paymentMethods.paymentGateway.isEnabled ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.paymentMethods.paymentGateway.isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          
          {formData.paymentMethods.paymentGateway.isEnabled && (
            <div className="p-6 grid grid-cols-1 gap-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="pg_mode" 
                      value="sandbox" 
                      checked={formData.paymentMethods.paymentGateway.mode === 'sandbox'}
                      onChange={(e) => setFormData({
                        ...formData,
                        paymentMethods: {
                          ...formData.paymentMethods,
                          paymentGateway: { ...formData.paymentMethods.paymentGateway, mode: e.target.value }
                        }
                      })}
                      className="text-indigo-600 focus:ring-indigo-500" 
                    />
                    <span className="text-sm font-semibold">Sandbox (Testing)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="pg_mode" 
                      value="production"
                      checked={formData.paymentMethods.paymentGateway.mode === 'production'}
                      onChange={(e) => setFormData({
                        ...formData,
                        paymentMethods: {
                          ...formData.paymentMethods,
                          paymentGateway: { ...formData.paymentMethods.paymentGateway, mode: e.target.value }
                        }
                      })}
                      className="text-indigo-600 focus:ring-indigo-500" 
                    />
                    <span className="text-sm font-semibold text-red-600">Production (Live)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">Merchant Code *</label>
                <input
                  type="text"
                  required
                  value={formData.paymentMethods.paymentGateway.merchantCode || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    paymentMethods: {
                      ...formData.paymentMethods,
                      paymentGateway: { ...formData.paymentMethods.paymentGateway, merchantCode: e.target.value }
                    }
                  })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                  placeholder="Misal: T1234"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">API Key *</label>
                <input
                  type="text"
                  required
                  value={formData.paymentMethods.paymentGateway.apiKey || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    paymentMethods: {
                      ...formData.paymentMethods,
                      paymentGateway: { ...formData.paymentMethods.paymentGateway, apiKey: e.target.value }
                    }
                  })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                  placeholder="API Key dari platform payment"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">Private Key *</label>
                <input
                  type="password"
                  required
                  value={formData.paymentMethods.paymentGateway.privateKey || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    paymentMethods: {
                      ...formData.paymentMethods,
                      paymentGateway: { ...formData.paymentMethods.paymentGateway, privateKey: e.target.value }
                    }
                  })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                  placeholder="Private Key dari platform payment"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-4">
          {success && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center text-green-600 font-bold text-sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Sistem Pembayaran berhasil diperbarui!
            </motion.div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Simpan Perubahan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
