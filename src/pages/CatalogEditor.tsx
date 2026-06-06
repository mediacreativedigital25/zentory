import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Tenant } from '../types';
import { Store, Palette, Globe, Save, ExternalLink, Image as ImageIcon, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import ImageUpload from '../components/ImageUpload';

export default function CatalogEditor() {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    logoUrl: '',
    heroImageUrls: [] as string[],
    themeColor: '#6366f1',
    address: '',
    phone: '',
    operationalHours: '',
    receiptFooter: '',
  });

  useEffect(() => {
    if (!profile?.tenantId) return;
    const fetchTenant = async () => {
      const snap = await getDoc(doc(db, 'tenants', profile.tenantId!));
      if (snap.exists()) {
        const data = snap.data() as Tenant;
        setTenant(data);
        setFormData({
          name: data.name,
          slug: data.slug,
          description: data.settings?.description || '',
          logoUrl: data.settings?.logoUrl || '',
          heroImageUrls: data.settings?.heroImageUrls || (data.settings?.heroImageUrl ? [data.settings.heroImageUrl] : []),
          themeColor: data.settings?.themeColor || '#6366f1',
          address: data.settings?.address || data.address || '',
          phone: data.settings?.phone || data.phone || '',
          operationalHours: data.settings?.operationalHours || '',
          receiptFooter: data.settings?.receiptFooter || '',
        });
      }
      setLoading(false);
    };
    fetchTenant();
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.tenantId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'tenants', profile.tenantId), {
        name: formData.name,
        slug: formData.slug,
        address: formData.address, // updated root level
        phone: formData.phone, // updated root level
        settings: {
          description: formData.description,
          logoUrl: formData.logoUrl,
          heroImageUrls: formData.heroImageUrls,
          themeColor: formData.themeColor,
          address: formData.address,
          phone: formData.phone,
          operationalHours: formData.operationalHours,
          receiptFooter: formData.receiptFooter,
        }
      });
      alert('Settings saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading Editor...</div>;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Catalog Editor</h2>
        <p className="text-gray-500">Customize your public store's appearance and branding.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Settings Form */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Store className="w-5 h-5 mr-2 text-indigo-600" />
              General Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-xs font-semibold text-gray-600">Store Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-gray-600">Store URL Slug</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-xs">
                    /catalog/
                  </span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    className="w-full p-2 border border-gray-200 rounded-r-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <label className="block mb-1 text-xs font-semibold text-gray-600">Store Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                  placeholder="Describe your store to your customers..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Store className="w-5 h-5 mr-2 text-indigo-600" />
              Contact & Operation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-xs font-semibold text-gray-600">WhatsApp / Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 628123456789"
                  className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-gray-600">Operational Hours</label>
                <input
                  type="text"
                  value={formData.operationalHours}
                  onChange={(e) => setFormData({ ...formData, operationalHours: e.target.value })}
                  placeholder="e.g. Mon-Fri, 09:00 - 17:00"
                  className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block mb-1 text-xs font-semibold text-gray-600">Store Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 h-20"
                  placeholder="Complete store address..."
                />
              </div>
              <div className="col-span-2">
                <label className="block mb-1 text-xs font-semibold text-gray-600">Receipt / Catalog Footer Text</label>
                <input
                  type="text"
                  value={formData.receiptFooter}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  placeholder="e.g. Thanks for shopping with us!"
                  className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Palette className="w-5 h-5 mr-2 text-indigo-600" />
              Branding & Style
            </h3>
            <div className="space-y-6">
              <div>
                <ImageUpload
                  value={formData.logoUrl}
                  onChange={(url) => setFormData({ ...formData, logoUrl: url })}
                  label="Logo Toko"
                />
              </div>
              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-600">Hero Banner Slides (Max 5)</label>
                  {formData.heroImageUrls.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, heroImageUrls: [...formData.heroImageUrls, ''] })}
                      className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
                    >
                      + Tambah Slide
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {formData.heroImageUrls.map((url, index) => (
                    <div key={index} className="relative bg-gray-50 p-4 rounded-md border border-gray-100">
                      <div className="absolute top-2 right-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newUrls = [...formData.heroImageUrls];
                            newUrls.splice(index, 1);
                            setFormData({ ...formData, heroImageUrls: newUrls });
                          }}
                          className="text-red-500 hover:text-red-700 text-xs font-medium bg-red-50 px-2 py-1 rounded"
                        >
                          Hapus
                        </button>
                      </div>
                      <ImageUpload
                        value={url}
                        onChange={(newUrl) => {
                          const newUrls = [...formData.heroImageUrls];
                          newUrls[index] = newUrl;
                          setFormData({ ...formData, heroImageUrls: newUrls });
                        }}
                        label={`Slide ${index + 1}`}
                      />
                    </div>
                  ))}
                  {formData.heroImageUrls.length === 0 && (
                    <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-md">
                      <p className="text-sm text-gray-500 mb-2">Belum ada banner</p>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, heroImageUrls: [''] })}
                        className="text-sm text-indigo-600 font-medium hover:text-indigo-700"
                      >
                        Tambah Banner Pertama
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-2">Disarankan gambar dengan rasio lebar (misal 1200x400).</p>
              </div>
              <div className="border-t border-gray-100 pt-6">
                <label className="block mb-1 text-xs font-semibold text-gray-600">Theme Color</label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={formData.themeColor}
                    onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                    className="w-12 h-12 border-none rounded-md cursor-pointer"
                  />
                  <span className="text-sm font-mono text-gray-500 uppercase">{formData.themeColor}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 text-white px-8 py-3 rounded-md font-bold hover:bg-indigo-700 transition-all flex items-center shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Preview Card */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 sticky top-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Globe className="w-5 h-5 mr-2 text-indigo-600" />
              Live Preview
            </h3>
            <div className="border border-gray-100 rounded-md overflow-hidden shadow-inner bg-gray-50 p-4">
              <div className="bg-white rounded-md shadow-sm overflow-hidden">
                <div className="h-12 border-b border-gray-50 flex items-center px-4 justify-between">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded bg-indigo-600 mr-2" style={{ backgroundColor: formData.themeColor }}>
                       {formData.logoUrl && <img src={formData.logoUrl} className="w-full h-full object-cover rounded" alt="" />}
                    </div>
                    <span className="text-xs font-bold truncate max-w-[100px]">{formData.name || 'Store Name'}</span>
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-gray-200" />
                    <div className="w-2 h-2 rounded-full bg-gray-200" />
                  </div>
                </div>
                {formData.heroImageUrls.length > 0 && formData.heroImageUrls[0] && (
                  <div className="h-20 w-full relative">
                    <img src={formData.heroImageUrls[0]} className="w-full h-full object-cover" alt="Hero" />
                    <div className="absolute inset-0 bg-black/20" />
                  </div>
                )}
                <div className="p-4 space-y-3" flex-1 overflow-y-auto auto-rows-max>
                  <div className="h-24 bg-gray-50 rounded-md flex items-center justify-center">
                    <p className="text-[10px] text-gray-400 text-center px-4">{formData.description || 'Store description will appear here...'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-20 bg-gray-50 rounded-md" />
                    <div className="h-20 bg-gray-50 rounded-md" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <a
                href={`/catalog/${formData.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 border border-indigo-600 text-indigo-600 rounded-md text-sm font-medium flex items-center justify-center hover:bg-indigo-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Public Store
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
