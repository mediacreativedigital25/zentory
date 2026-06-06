import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Palette, Link as LinkIcon, Save, Image as ImageIcon, Loader2 } from 'lucide-react';

export default function BrandSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const [brandData, setBrandData] = useState({
    faviconUrl: 'https://storage.googleapis.com/aistudio-production-bucket-12/1748962804245-Zyvora_App_Icon_Large.png',
    headerLogoUrl: 'https://storage.googleapis.com/aistudio-production-bucket-12/1748962804245-Zyvora_Landscape_NoBG_Medium.png',
    loginImageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80',
    appName: 'Zyvora'
  });

  useEffect(() => {
    fetchBrandSettings();
  }, []);

  const fetchBrandSettings = async () => {
    try {
      const docRef = doc(db, 'system', 'brand');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBrandData(prev => ({
          ...prev,
          ...data
        }));
      }
    } catch (error) {
      console.error("Error fetching brand settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      await setDoc(doc(db, 'system', 'brand'), {
        ...brandData,
        updatedAt: serverTimestamp()
      });
      setMessage({ text: 'Pengaturan brand berhasil disimpan!', type: 'success' });
      
      // Update local DOM to reflect immediately for super admin
      updateBrandInDOM(brandData);
    } catch (error) {
      console.error("Error saving brand settings:", error);
      setMessage({ text: 'Gagal menyimpan pengaturan.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const updateBrandInDOM = (data: typeof brandData) => {
    // Update Document Title
    document.title = data.appName + " POS";
    
    // Update Favicon
    let iconLinks = document.querySelectorAll("link[rel~='icon']");
    iconLinks.forEach(link => {
      (link as HTMLLinkElement).href = data.faviconUrl;
    });
    
    let appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (appleTouchIcon) {
      (appleTouchIcon as HTMLLinkElement).href = data.faviconUrl;
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Brand &amp; Tampilan</h2>
            <p className="text-gray-500 text-sm mt-1">Ubah logo, favicon, dan gambar halaman login aplikasi.</p>
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-20 pointer-events-none hidden md:block" style={{ background: 'radial-gradient(circle at 100% 50%, #6366f1 0%, transparent 70%)' }}></div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-8">
        
        {/* App Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Aplikasi</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">Aa</span>
            </div>
            <input
              type="text"
              value={brandData.appName}
              onChange={(e) => setBrandData({...brandData, appName: e.target.value})}
              className="pl-10 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 py-2.5"
              placeholder="Contoh: Zyvora"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 my-4 pt-6"></div>

        {/* Favicon Settings */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">Favicon Aplikasi (Pavicon)</h3>
          <p className="text-sm text-gray-500 mb-4">Ikon kecil yang muncul di tab browser Anda (rekomendasi: 192x192 atau 512x512 pixel, format PNG/ICO).</p>
          
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center p-2 flex-shrink-0">
              <img src={brandData.faviconUrl} alt="Favicon Preview" className="w-full h-full object-contain" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/192')} />
            </div>
            <div className="flex-1 space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LinkIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={brandData.faviconUrl}
                  onChange={(e) => setBrandData({...brandData, faviconUrl: e.target.value})}
                  className="pl-10 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 py-2.5"
                  placeholder="URL Gambar Favicon"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 my-4 pt-6"></div>

        {/* Header Logo Settings */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">Gambar Header (Logo Utama)</h3>
          <p className="text-sm text-gray-500 mb-4">Logo utama yang muncul di pojok kiri atas dashboard (rekomendasi SVG atau PNG background transparan).</p>
          
          <div className="flex items-start gap-6 flex-wrap md:flex-nowrap">
            <div className="w-48 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center p-3 flex-shrink-0">
              <img src={brandData.headerLogoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/200x60')} />
            </div>
            <div className="flex-1 space-y-3 w-full">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LinkIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={brandData.headerLogoUrl}
                  onChange={(e) => setBrandData({...brandData, headerLogoUrl: e.target.value})}
                  className="pl-10 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 py-2.5"
                  placeholder="URL Gambar Logo Header"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 my-4 pt-6"></div>

        {/* Login Background Image */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">Gambar Background Login &amp; Register</h3>
          <p className="text-sm text-gray-500 mb-4">Gambar ilustrasi atau foto latar belakang di halaman form login. Akan ditampilkan di sebelah kiri form pada layar besar.</p>
          
          <div className="flex items-start gap-6 flex-col md:flex-row">
            <div className="w-full md:w-[300px] h-40 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 relative">
               <img src={brandData.loginImageUrl} alt="Login Background" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
               <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 -z-10 text-gray-400 font-medium">Gambar Tidak Valid</div>
            </div>
            <div className="flex-1 space-y-3 w-full">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={brandData.loginImageUrl}
                  onChange={(e) => setBrandData({...brandData, loginImageUrl: e.target.value})}
                  className="pl-10 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 py-2.5"
                  placeholder="URL Gambar Login"
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          Simpan Perubahan
        </button>
      </div>

    </div>
  );
}
