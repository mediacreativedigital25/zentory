import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'motion/react';
import { Save, PiggyBank, Receipt, Settings, Users, Search } from 'lucide-react';
import { Customer } from '../../types';

export default function CustomerSavings() {
  const { tenant } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    enabled: false,
    savingsType: 'nominal' as 'nominal' | 'percent',
    savingsValue: 0
  });

  useEffect(() => {
    if (tenant?.customerSavingsSettings) {
      setFormData(tenant.customerSavingsSettings);
    }
  }, [tenant]);

  useEffect(() => {
    if (!tenant?.id) return;
    
    // Listen to customers on this tenant
    const q = query(
      collection(db, 'customers'),
      where('tenantId', '==', tenant.id),
      where('hasSavingsProgram', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(customersData);
    });

    return () => unsubscribe();
  }, [tenant?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'tenants', tenant.id), {
        customerSavingsSettings: formData
      });
      alert('Pengaturan tabungan berhasil disimpan');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan pengaturan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="flex justify-between items-center bg-white p-6 rounded-md shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <PiggyBank className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-sans text-gray-900">Pengaturan Tabungan Pelanggan</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Atur global tabungan/berkah untuk semua pelanggan secara otomatis
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-gray-900">Konfigurasi Tabungan</h3>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-md border border-gray-100 bg-gray-50">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Aktifkan Tabungan Pelanggan (Global)</p>
                  <p className="text-xs text-gray-500 mt-1">Jika aktif, semua pelanggan tanpa settingan khusus akan terkena potongan tabungan.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {formData.enabled && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  className="space-y-4 pt-4 border-t border-gray-100"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Tipe Potongan</label>
                      <select
                        value={formData.savingsType}
                        onChange={(e) => setFormData({ ...formData, savingsType: e.target.value as 'nominal' | 'percent' })}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                      >
                        <option value="nominal">Nominal (Rp)</option>
                        <option value="percent">Persentase (%)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Nilai Potongan</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.savingsValue || ''}
                          onChange={(e) => setFormData({ ...formData, savingsValue: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-4 pr-12 py-2.5 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                          placeholder="0"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-[45%] text-gray-500 font-bold text-sm">
                          {formData.savingsType === 'percent' ? '%' : 'Rp'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-md">
                    <p className="text-sm text-indigo-800 flex items-start gap-2">
                      <span>💡</span>
                      <span>Potongan tabungan ini hanya akan berlaku bagi pelanggan yang opsi "Ikut Program Tabungan" nya diaktifkan di menu Data Pelanggan.</span>
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-md font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Simpan Pengaturan
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                Simulasi Pemotongan
              </h3>
             </div>
             <div className="p-6 space-y-4">
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Tagihan (Contoh)</span>
                    <span className="font-bold text-gray-900">Rp 100.000</span>
                  </div>
                  {formData.enabled ? (
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                      <span className="font-medium">Potongan Tabungan</span>
                      <span className="font-bold text-emerald-600">
                        {formData.savingsType === 'percent' ? `${formData.savingsValue}% (Rp ${Math.round(100000 * formData.savingsValue / 100).toLocaleString('id-ID')})` : `Rp ${Math.round(formData.savingsValue || 0).toLocaleString('id-ID')}`}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                      <span className="font-medium">Potongan Tabungan</span>
                      <span className="font-bold text-gray-400">Rp 0 (Status Mati)</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-gray-900">Dana Diterima Toko</span>
                    <span className="font-bold text-indigo-600 text-lg">
                      Rp {formData.enabled ? (formData.savingsType === 'percent' ? Math.round(100000 - (100000 * formData.savingsValue / 100)).toLocaleString('id-ID') : Math.round(100000 - (formData.savingsValue || 0)).toLocaleString('id-ID')) : '100.000'}
                    </span>
                  </div>
                </div>
             </div>
          </div>
        </div>

      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">Daftar Pelanggan Terdaftar</h3>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari pelanggan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Kode Pelanggan</th>
                <th className="px-6 py-4">Nama Pelanggan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Saldo Tabungan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers
                .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code?.toLowerCase().includes(search.toLowerCase()))
                .map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-gray-500">{customer.code || '-'}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{customer.name}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">Aktif</span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">
                    Rp {Math.round(customer.savingsBalance || 0).toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Belum ada pelanggan yang mengikuti program tabungan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
