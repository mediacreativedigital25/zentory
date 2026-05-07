import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CustomDomain, Tenant } from '../../types';
import { 
  Globe, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Building2, 
  ExternalLink,
  RefreshCw,
  MoreVertical,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function DomainManagement() {
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);
  
  const [formData, setFormData] = useState({
    domain: '',
    tenantId: '',
    isPrimary: false
  });

  useEffect(() => {
    setLoading(true);
    const unsubDomains = onSnapshot(collection(db, 'custom_domains'), (snap) => {
      setDomains(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomDomain)));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching domains:', err);
      setLoading(false);
    });

    const unsubTenants = onSnapshot(collection(db, 'tenants'), (snap) => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
    }, (err) => {
      console.error('Error fetching tenants:', err);
    });

    return () => {
      unsubDomains();
      unsubTenants();
    };
  }, []);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.domain || !formData.tenantId) return;
    if (isAdding) return;

    setIsAdding(true);
    try {
      // Relaxed domain validation (allows subdomains and multiple dots)
      const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
      if (!domainRegex.test(formData.domain)) {
        alert('Format domain tidak valid. Gunakan format seperti: toko.com, shop.toko.id, atau app.zyvora.my.id');
        setIsAdding(false);
        return;
      }

      const normalizedDomain = formData.domain.toLowerCase().trim();

      // Check for duplicates in local state first (faster)
      if (domains.some(d => d.domain === normalizedDomain)) {
        alert('Domain ini sudah terdaftar dalam sistem.');
        setIsAdding(false);
        return;
      }

      // Double check in Firestore
      const duplicateQuery = query(collection(db, 'custom_domains'), where('domain', '==', normalizedDomain));
      const duplicateSnap = await getDocs(duplicateQuery);
      
      if (!duplicateSnap.empty) {
        alert('Domain ini sudah terdaftar dalam sistem (Firestore).');
        setIsAdding(false);
        return;
      }

      await addDoc(collection(db, 'custom_domains'), {
        domain: normalizedDomain,
        tenantId: formData.tenantId,
        status: 'pending',
        sslStatus: 'pending',
        isPrimary: formData.isPrimary,
        createdAt: serverTimestamp()
      });

      setIsModalOpen(false);
      setFormData({ domain: '', tenantId: '', isPrimary: false });
    } catch (err) {
      console.error('Error adding domain:', err);
      if (err instanceof Error && err.message.includes('permission-denied')) {
        alert('Gagal menambahkan domain: Izin ditolak. Pastikan Anda adalah Superadmin.');
      } else {
        alert('Gagal menambahkan domain. Silakan coba lagi.');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteDomain = async (id: string) => {
    if (!confirm('Hapus domain ini?')) return;
    try {
      await deleteDoc(doc(db, 'custom_domains', id));
    } catch (err) {
      console.error('Error deleting domain:', err);
    }
  };

  const handleVerify = async (domain: CustomDomain) => {
    if (!confirm(`Verifikasi domain ${domain.domain}? Pastikan DNS sudah diarahkan ke server kami.`)) return;
    setIsVerifying(domain.id);
    try {
      await updateDoc(doc(db, 'custom_domains', domain.id), {
        status: 'active',
        sslStatus: 'valid',
        verifiedAt: serverTimestamp()
      });
      alert('Domain berhasil diverifikasi dan diaktifkan!');
    } catch (err) {
      console.error('Error verifying domain:', err);
      alert('Gagal memverifikasi domain.');
    } finally {
      setIsVerifying(null);
    }
  };

  const appHostname = window.location.hostname;

  const filteredDomains = domains.filter(d => 
    d.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenants.find(t => t.id === d.tenantId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTenantName = (id: string) => tenants.find(t => t.id === id)?.name || 'Unknown Tenant';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Domain Management</h2>
          <p className="text-gray-500">Kelola custom domain untuk semua tenant.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah Domain
        </button>
      </div>

      {/* DNS Instructions & Worker Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-indigo-900">1. Konfigurasi DNS</h3>
              <p className="text-sm text-indigo-700">Tambahkan record berikut di panel DNS (Cloudflare/Provider):</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-white p-4 rounded-lg border border-indigo-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Type</p>
              <p className="font-mono font-bold text-indigo-600 text-sm">CNAME</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-indigo-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Name (Host)</p>
              <p className="font-mono font-bold text-indigo-600 text-sm">@ atau subdomain (misal: shop)</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-indigo-100 relative group">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Target (Value)</p>
              <p className="font-mono font-bold text-indigo-600 text-xs truncate pr-8">{appHostname}</p>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(appHostname);
                  alert('Target DNS disalin!');
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-400 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-indigo-500 italic">Catatan: Jika menggunakan Cloudflare, pastikan Proxy (Awan Oranye) AKTIF.</p>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600 text-white rounded-xl flex items-center justify-center">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-900">2. Setup Cloudflare Worker (Cukup 1x Saja)</h3>
              <p className="text-sm text-amber-700">Gunakan Worker sebagai jembatan. Satu Worker bisa digunakan untuk banyak domain.</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-amber-100 space-y-3">
            <p className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md inline-block">TIPS: Jika sudah punya Worker proxy, cukup tambahkan domain baru di tab "Domains & Routes".</p>
            <ol className="text-xs text-gray-600 space-y-2 list-decimal ml-4 font-medium">
              <li>Buat Worker baru di Cloudflare (Start with Hello World).</li>
              <li>Klik <b>Edit Code</b> dan masukkan script proxy Zentory.</li>
              <li>Di tab <b>Settings &gt; Domains & Routes</b>, klik <b>Add Custom Domain</b>.</li>
              <li>Masukkan domain (misal: shop.zyvora.my.id).</li>
              <li><b>PENTING:</b> Hapus record CNAME lama di menu DNS sebelum add domain di Worker.</li>
            </ol>
            <button 
              onClick={() => {
                const script = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const targetHost = "${appHostname}";
    const targetUrl = \`https://\${targetHost}\`;
    const proxyUrl = new URL(url.pathname + url.search, targetUrl);
    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", targetHost);
    newHeaders.set("X-Forwarded-Host", url.hostname);
    const response = await fetch(proxyUrl.toString(), {
      method: request.method,
      headers: newHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.blob() : null,
      redirect: 'follow'
    });
    return response;
  }
}`;
                navigator.clipboard.writeText(script);
                alert('Script Worker disalin!');
              }}
              className="w-full py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all"
            >
              Salin Script Worker
            </button>
          </div>
        </div>
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cari domain atau tenant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Domain</p>
            <p className="text-xl font-bold text-gray-900">{domains.length}</p>
          </div>
          <Globe className="w-8 h-8 text-indigo-100" />
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aktif</p>
            <p className="text-xl font-bold text-green-600">{domains.filter(d => d.status === 'active').length}</p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-green-100" />
        </div>
      </div>

      {/* Domains Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Domain</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tenant Owner</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">SSL Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredDomains.map((domain) => (
                <tr key={domain.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{domain.domain}</p>
                        {domain.isPrimary && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase">Primary</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-gray-600">
                      <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-sm font-medium">{getTenantName(domain.tenantId)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${
                      domain.status === 'active' 
                        ? 'bg-green-50 text-green-700 border-green-100' 
                        : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                    }`}>
                      {domain.status === 'active' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                      {domain.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${
                      domain.sslStatus === 'valid' 
                        ? 'bg-blue-50 text-blue-700 border-blue-100' 
                        : domain.sslStatus === 'pending'
                        ? 'bg-gray-50 text-gray-600 border-gray-100'
                        : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      {domain.sslStatus === 'valid' ? <ShieldCheck className="w-3 h-3 mr-1" /> : <ShieldAlert className="w-3 h-3 mr-1" />}
                      SSL {domain.sslStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {domain.status === 'pending' && (
                        <button
                          onClick={() => handleVerify(domain)}
                          disabled={isVerifying === domain.id}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                        >
                          {isVerifying === domain.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Verify & Activate
                        </button>
                      )}
                      {domain.status === 'active' && (
                        <a
                          href={`http://${domain.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Buka Domain"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteDomain(domain.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDomains.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Tidak ada domain ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Domain Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">Tambah Custom Domain</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddDomain} className="p-6 space-y-4">
                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Domain Name</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      required
                      placeholder="contoh: toko-saya.com"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Pilih Tenant</label>
                  <select
                    required
                    value={formData.tenantId}
                    onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium appearance-none bg-white"
                  >
                    <option value="">Pilih Tenant Owner</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={formData.isPrimary}
                    onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded-lg border-gray-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="isPrimary" className="text-xs font-semibold text-gray-600">Set sebagai Domain Utama</label>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 p-2 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center"
                  >
                    {isAdding ? (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      'Simpan Domain'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
