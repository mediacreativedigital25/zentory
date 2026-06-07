import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Tenant } from '../types';
import { Building2, Save, User, Mail, Phone, MapPin, Briefcase, FileText, CheckCircle2, Loader2, Image as ImageIcon, Zap, Plus, Trash2 } from 'lucide-react';
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
        <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
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

        <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                  placeholder="Alamat Kantor / Toko"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Nomor NPWP"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Tema Katalog</label>
              <select
                value={formData.catalogTheme || 'default'}
                onChange={(e) => setFormData({ ...formData, catalogTheme: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="default">Default</option>
                <option value="v1">Tema V1 (Katalog)</option>
                <option value="booking-v1">Tema Booking V1</option>
              </select>
            </div>
          </div>
        </div>

        {formData.catalogTheme === 'booking-v1' && (
          <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden mt-6">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <ImageIcon className="w-5 h-5 mr-2 text-indigo-600" />
                Visual & Tampilan Katalog Booking
              </h3>
            </div>
            
            <div className="p-6 grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">Tagline / Deskripsi Hero</label>
                <textarea
                  value={formData.settings?.tagline || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    settings: { ...(formData.settings || {}), tagline: e.target.value } 
                  })}
                  className="w-full p-3 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                  placeholder="Contoh: Jadwalkan waktu Anda dan serahkan sisanya pada layanan profesional kami."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">Gambar Hero Banner (Background)</label>
                <div className="flex gap-4">
                  <div className="w-48">
                    <ImageUpload
                      value={formData.settings?.heroImageUrls?.[0] || ''}
                      onChange={(url) => {
                        const urls = [...(formData.settings?.heroImageUrls || [])];
                        urls[0] = url;
                        setFormData({ 
                          ...formData, 
                          settings: { ...(formData.settings || {}), heroImageUrls: urls.filter(Boolean) } 
                        });
                      }}
                      label="Upload Hero Image"
                    />
                  </div>
                  <div className="flex-1 text-xs text-gray-500">
                    Ini akan digunakan sebagai banner besar di halaman depan katalog pemesanan.
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">Gallery Hasil / Kategori</label>
                <p className="text-xs text-gray-500 mb-2">Tambahkan foto-foto hasil kerja (portofolio) atau suasana layanan untuk membangun kepercayaan pelanggan.</p>
                <div className="flex flex-wrap gap-4">
                  {(formData.settings?.galleryUrls || []).map((url, index) => (
                    <div key={index} className="w-32">
                      <ImageUpload
                        value={url}
                        onChange={(newUrl) => {
                          const urls = [...(formData.settings?.galleryUrls || [])];
                          if (newUrl) {
                            urls[index] = newUrl;
                          } else {
                            urls.splice(index, 1);
                          }
                          setFormData({ 
                            ...formData, 
                            settings: { ...(formData.settings || {}), galleryUrls: urls } 
                          });
                        }}
                        label={`Foto ${index + 1}`}
                      />
                    </div>
                  ))}
                  <div className="w-32">
                    <ImageUpload
                      value={""}
                      onChange={(newUrl) => {
                        if (newUrl) {
                          const urls = [...(formData.settings?.galleryUrls || []), newUrl];
                          setFormData({ 
                            ...formData, 
                            settings: { ...(formData.settings || {}), galleryUrls: urls } 
                          });
                        }
                      }}
                      label="Tambah Foto"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-gray-100 pt-6 mt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-sm font-bold text-gray-900">Mengapa Memilih Kami?</label>
                    <p className="text-xs text-gray-500">Maksimal 5 kartu. Digunakan untuk menampilkan keunggulan layanan.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const current = formData.settings?.whyChooseUs || [];
                      if (current.length < 5) {
                        setFormData({
                          ...formData,
                          settings: {
                            ...(formData.settings || {}),
                            whyChooseUs: [...current, { icon: 'Star', title: '', description: '' }]
                          }
                        });
                      }
                    }}
                    disabled={(formData.settings?.whyChooseUs?.length || 0) >= 5}
                    className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md hover:bg-indigo-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Tambah Card
                  </button>
                </div>

                <div className="space-y-3">
                  {(formData.settings?.whyChooseUs || []).map((item, index) => (
                    <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="w-1/4">
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Icon (Key)</label>
                        <select
                          value={item.icon}
                          onChange={(e) => {
                            const newItems = [...(formData.settings?.whyChooseUs || [])];
                            newItems[index].icon = e.target.value;
                            setFormData({ ...formData, settings: { ...(formData.settings || {}), whyChooseUs: newItems } });
                          }}
                          className="w-full p-2 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="Star">Star</option>
                          <option value="Shield">Shield</option>
                          <option value="Clock">Clock</option>
                          <option value="Heart">Heart</option>
                          <option value="CheckCircle">CheckCircle</option>
                          <option value="ThumbsUp">ThumbsUp</option>
                          <option value="Award">Award</option>
                          <option value="Zap">Zap</option>
                        </select>
                      </div>
                      <div className="w-1/4">
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Judul</label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const newItems = [...(formData.settings?.whyChooseUs || [])];
                            newItems[index].title = e.target.value;
                            setFormData({ ...formData, settings: { ...(formData.settings || {}), whyChooseUs: newItems } });
                          }}
                          placeholder="Misi Kami"
                          className="w-full p-2 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Deskripsi</label>
                        <textarea
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...(formData.settings?.whyChooseUs || [])];
                            newItems[index].description = e.target.value;
                            setFormData({ ...formData, settings: { ...(formData.settings || {}), whyChooseUs: newItems } });
                          }}
                          placeholder="Penjelasan detail..."
                          className="w-full p-2 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-[38px] min-h-[38px]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = [...(formData.settings?.whyChooseUs || [])];
                          newItems.splice(index, 1);
                          setFormData({ ...formData, settings: { ...(formData.settings || {}), whyChooseUs: newItems } });
                        }}
                        className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!formData.settings?.whyChooseUs || formData.settings.whyChooseUs.length === 0) && (
                    <div className="text-center p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500">
                      Belum ada keunggulan yang ditambahkan. Data dummy akan ditampilkan di katalog jika kosong.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t border-gray-100 pt-6 mt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-sm font-bold text-gray-900">Pertanyaan yang Sering Diajukan (FAQ)</label>
                    <p className="text-xs text-gray-500">Maksimal 5 FAQ. Akan ditampilkan di bawah bagian ulasan pada halaman katalog.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const current = formData.settings?.faqs || [];
                      if (current.length < 5) {
                        setFormData({
                          ...formData,
                          settings: {
                            ...(formData.settings || {}),
                            faqs: [...current, { question: '', answer: '' }]
                          }
                        });
                      }
                    }}
                    disabled={(formData.settings?.faqs?.length || 0) >= 5}
                    className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md hover:bg-indigo-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Tambah FAQ
                  </button>
                </div>

                <div className="space-y-3">
                  {(formData.settings?.faqs || []).map((faq, index) => (
                    <div key={index} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Pertanyaan</label>
                          <input
                            type="text"
                            value={faq.question}
                            onChange={(e) => {
                              const newFaqs = [...(formData.settings?.faqs || [])];
                              newFaqs[index].question = e.target.value;
                              setFormData({ ...formData, settings: { ...(formData.settings || {}), faqs: newFaqs } });
                            }}
                            placeholder="Tuliskan pertanyaan di sini..."
                            className="w-full p-2 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Jawaban</label>
                          <textarea
                            value={faq.answer}
                            onChange={(e) => {
                              const newFaqs = [...(formData.settings?.faqs || [])];
                              newFaqs[index].answer = e.target.value;
                              setFormData({ ...formData, settings: { ...(formData.settings || {}), faqs: newFaqs } });
                            }}
                            placeholder="Tuliskan jawaban yang informatif..."
                            className="w-full p-2 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-20"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newFaqs = [...(formData.settings?.faqs || [])];
                          newFaqs.splice(index, 1);
                          setFormData({ ...formData, settings: { ...(formData.settings || {}), faqs: newFaqs } });
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded mt-5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!formData.settings?.faqs || formData.settings.faqs.length === 0) && (
                    <div className="text-center p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500">
                      Belum ada FAQ yang ditambahkan. Data dummy akan ditampilkan di katalog jika kosong.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
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
                className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Cloud Name dari Cloudinary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600">Upload Preset</label>
              <input
                type="text"
                value={formData.cloudinaryUploadPreset || ''}
                onChange={(e) => setFormData({ ...formData, cloudinaryUploadPreset: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
                Simpan Profil
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
