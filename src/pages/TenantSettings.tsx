import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Tenant } from '../types';
import { Building2, Save, User, Mail, Phone, MapPin, Briefcase, FileText, CheckCircle2, Loader2, Image as ImageIcon, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import ImageUpload from '../components/ImageUpload';

export default function TenantSettings() {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<Partial<Tenant>>({});

  useEffect(() => {
    const fetchTenant = async () => {
      if (!profile?.tenantId) return;
      try {
        const tenantDoc = await getDoc(doc(db, 'tenants', profile.tenantId));
        if (tenantDoc.exists()) {
          const data = { id: tenantDoc.id, ...tenantDoc.data() } as Tenant;
          setTenant(data);
          setFormData(data);
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
        ...formData,
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
          <h2 className="text-2xl font-bold text-gray-900">Profil Bisnis</h2>
          <p className="text-gray-500">Lengkapi data bisnis Anda untuk keperluan kerja sama dan administrasi.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-indigo-600" />
              Status Langganan
            </h3>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Paket Aktif</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-gray-900 uppercase">{tenant?.plan || tenant?.subscription || 'FREE'}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  tenant?.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {tenant?.subscriptionStatus || 'TRIAL'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Masa Aktif Hingga</p>
              <p className={`text-lg font-black ${
                tenant?.subscriptionEndDate && new Date(tenant.subscriptionEndDate.seconds * 1000) < new Date()
                  ? 'text-red-600'
                  : 'text-indigo-600'
              }`}>
                {tenant?.subscriptionEndDate 
                  ? new Date(tenant.subscriptionEndDate.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'Tanpa Batas (FREE)'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-indigo-600" />
              Informasi Dasar
            </h3>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-gray-600">Logo Bisnis</label>
              <div className="w-48">
                <ImageUpload
                  value={formData.settings?.logoUrl || ''}
                  onChange={(url) => setFormData({ 
                    ...formData, 
                    settings: { ...(formData.settings || {}), logoUrl: url } 
                  })}
                  label="Upload Logo (Maks 2MB)"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Logo ini akan ditampilkan pada seluruh bukti transaksi, struk, dan dokumen resmi bisnis Anda.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Nama Bisnis</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Nama Toko / Perusahaan"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Nama Owner / Penanggung Jawab</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.ownerName || ''}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Nama Lengkap"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Email Bisnis</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="email@bisnis.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Nomor Telepon / WA</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="0812..."
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-gray-600">Alamat Lengkap</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                  placeholder="Alamat Kantor / Toko"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Briefcase className="w-5 h-5 mr-2 text-indigo-600" />
              Detail Bisnis & Legalitas
            </h3>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Jenis Usaha</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.businessType || ''}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Contoh: Retail, Kuliner, Jasa"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">NPWP / Tax ID</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.taxId || ''}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Nomor NPWP"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <ImageIcon className="w-5 h-5 mr-2 text-indigo-600" />
              Konfigurasi Cloudinary (Penyimpanan Gambar)
            </h3>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Cloud Name</label>
              <input
                type="text"
                value={formData.cloudinaryCloudName || ''}
                onChange={(e) => setFormData({ ...formData, cloudinaryCloudName: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Cloud Name dari Cloudinary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Upload Preset</label>
              <input
                type="text"
                value={formData.cloudinaryUploadPreset || ''}
                onChange={(e) => setFormData({ ...formData, cloudinaryUploadPreset: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Unsigned Upload Preset"
              />
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 italic">
                * Cloudinary digunakan untuk menyimpan foto produk dan bukti transaksi. 
                Dapatkan Cloud Name dan Upload Preset (Unsigned) dari dashboard Cloudinary Anda.
                Jika dikosongkan, sistem akan menggunakan pengaturan default dari Super Admin.
              </p>
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
              Data berhasil disimpan!
            </motion.div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Simpan Profil
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
