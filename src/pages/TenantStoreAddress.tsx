import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Tenant } from '../types';
import { Save, MapPin, CheckCircle2, Loader2, Building } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function TenantStoreAddress() {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [addressData, setAddressData] = useState({
    province: '',
    city: '',
    district: '',
    village: '',
    detail: '',
    postalCode: ''
  });

  useEffect(() => {
    const fetchTenant = async () => {
      if (!profile?.tenantId) return;
      try {
        const tenantDoc = await getDoc(doc(db, 'tenants', profile.tenantId));
        if (tenantDoc.exists()) {
          const data = { id: tenantDoc.id, ...tenantDoc.data() } as Tenant;
          setTenant(data);
          if (data.storeAddress) {
            setAddressData({ ...addressData, ...data.storeAddress });
          } else if (data.address) {
            // Backup from old general address if storeAddress not set
             setAddressData(prev => ({ ...prev, detail: data.address || '' }));
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
        storeAddress: addressData,
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
          <h2 className="text-2xl font-bold text-gray-900">Alamat Toko</h2>
          <p className="text-gray-500">Alamat pengiriman toko Anda, rincian ini akan digunakan untuk marketplace.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              Detail Alamat Pengiriman
            </h3>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Provinsi *</label>
              <input
                type="text"
                required
                value={addressData.province || ''}
                onChange={(e) => setAddressData({ ...addressData, province: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Provinsi tempat toko"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Kota / Kabupaten *</label>
              <input
                type="text"
                required
                value={addressData.city || ''}
                onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Kota atau Kabupaten tempat toko"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Kecamatan *</label>
              <input
                type="text"
                required
                value={addressData.district || ''}
                onChange={(e) => setAddressData({ ...addressData, district: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Kecamatan tempat toko"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Desa / Kelurahan *</label>
              <input
                type="text"
                required
                value={addressData.village || ''}
                onChange={(e) => setAddressData({ ...addressData, village: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Desa / Kelurahan tempat toko"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-gray-600">Alamat Lengkap (Jalan, No Rumah, RT/RW) *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea
                  required
                  value={addressData.detail || ''}
                  onChange={(e) => setAddressData({ ...addressData, detail: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                  placeholder="Detail jalan, nomor bangunan, dan petunjuk lokasi..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Kode Pos</label>
              <input
                type="text"
                value={addressData.postalCode || ''}
                onChange={(e) => setAddressData({ ...addressData, postalCode: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Misal: 12345"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-4">
          {success && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center text-green-600 font-bold text-sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Alamat berhasil disimpan!
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
                Simpan Alamat
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
