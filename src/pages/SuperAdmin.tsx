import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, addDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tenant, TenantStatus, TenantPlan, BusinessType } from '../types';
import { 
  Building2, 
  Plus, 
  Search, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  X,
  ShieldCheck,
  Globe,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Lock,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export const SuperAdmin: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    email: '',
    phone: '',
    address: '',
    status: 'Active' as TenantStatus,
    plan: 'Free' as TenantPlan,
    businessType: 'Retail' as BusinessType,
    password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setTenants(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant)));
    } catch (err) {
      console.error('Error fetching tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCopyLogin = (tenant: Tenant) => {
    const text = `Zentory Login Info\n\nURL: https://${tenant.subdomain}.my.id\nEmail: ${tenant.email}\nPassword: ${tenant.password || 'N/A'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(tenant.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const tenantData = {
        ...formData,
        updatedAt: new Date().toISOString()
      };

      if (editingTenant) {
        await updateDoc(doc(db, 'tenants', editingTenant.id), tenantData);
        setSuccess('Tenant berhasil diperbarui.');
      } else {
        await addDoc(collection(db, 'tenants'), {
          ...tenantData,
          createdAt: new Date().toISOString()
        });
        setSuccess('Tenant baru berhasil ditambahkan.');
      }

      setFormData({
        name: '',
        subdomain: '',
        email: '',
        phone: '',
        address: '',
        status: 'Active',
        plan: 'Free',
        businessType: 'Retail',
        password: ''
      });
      setTimeout(() => {
        setShowModal(false);
        setEditingTenant(null);
        fetchTenants();
      }, 1000);
    } catch (err) {
      setError('Gagal menyimpan tenant.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTenants = tenants.filter(t => 
    (t.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (t.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (t.subdomain?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
              <ShieldCheck size={28} />
            </div>
            Super Admin
          </h1>
          <p className="text-gray-500 mt-2">Manajemen pusat seluruh penyewa Zentory.</p>
        </div>
        <button
          onClick={() => {
            setEditingTenant(null);
            setFormData({
              name: '',
              subdomain: '',
              email: '',
              phone: '',
              address: '',
              status: 'Active',
              plan: 'Free',
              businessType: 'Retail',
              password: ''
            });
            setShowModal(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
        >
          <Plus size={20} />
          <span>Tambah Tenant</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Tenant</p>
              <h3 className="text-3xl font-black text-gray-900">{tenants.length}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Tenant Aktif</p>
              <h3 className="text-3xl font-black text-gray-900">
                {tenants.filter(t => t.status === 'Active').length}
              </h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Globe size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Enterprise</p>
              <h3 className="text-3xl font-black text-gray-900">
                {tenants.filter(t => t.plan === 'Enterprise').length}
              </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/30">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Cari nama, email, atau subdomain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm shadow-sm transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-[0.15em]">
              <tr>
                <th className="px-8 py-5">Tenant / Bisnis</th>
                <th className="px-8 py-5">Kontak</th>
                <th className="px-8 py-5">Plan & Tipe</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <Loader2 className="animate-spin inline-block text-indigo-600" size={40} />
                    <p className="mt-4 text-gray-400 font-medium">Memuat data tenant...</p>
                  </td>
                </tr>
              ) : filteredTenants.length > 0 ? filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm">
                        {tenant.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{tenant.name || 'Unnamed'}</p>
                        <p className="text-xs font-bold text-indigo-600 mt-0.5">{tenant.subdomain}.my.id</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                        <Mail size={14} className="text-gray-400" />
                        {tenant.email}
                      </div>
                      {tenant.phone && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                          <Phone size={14} className="text-gray-400" />
                          {tenant.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-2">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider w-fit",
                        tenant.plan === 'Enterprise' ? "bg-purple-100 text-purple-700" :
                        tenant.plan === 'Pro' ? "bg-indigo-100 text-indigo-700" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {tenant.plan}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                        <Briefcase size={10} />
                        {tenant.businessType}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 w-fit shadow-sm",
                      tenant.status === 'Active' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                      tenant.status === 'Inactive' ? "bg-gray-50 text-gray-600 border border-gray-100" :
                      "bg-rose-50 text-rose-700 border border-rose-100"
                    )}>
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        tenant.status === 'Active' ? "bg-emerald-500" :
                        tenant.status === 'Inactive' ? "bg-gray-400" :
                        "bg-rose-500"
                      )} />
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopyLogin(tenant)}
                        className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Salin Info Login"
                      >
                        {copiedId === tenant.id ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
                      </button>
                      <a 
                        href={`/?tenant=${tenant.subdomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Kunjungi Toko"
                      >
                        <Globe size={20} />
                      </a>
                      <button
                        onClick={() => {
                          setEditingTenant(tenant);
                          setFormData({
                            name: tenant.name,
                            subdomain: tenant.subdomain || '',
                            email: tenant.email,
                            phone: tenant.phone || '',
                            address: tenant.address || '',
                            status: tenant.status,
                            plan: tenant.plan,
                            businessType: tenant.businessType || 'Retail',
                            password: tenant.password || ''
                          });
                          setShowModal(true);
                        }}
                        className="p-2.5 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                        title="Edit Tenant"
                      >
                        <Edit2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic">
                    Tidak ada tenant yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                  {editingTenant ? 'Edit Tenant' : 'Tenant Baru'}
                </h3>
                <p className="text-sm text-gray-500 font-medium">Lengkapi informasi bisnis di bawah ini.</p>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all text-gray-400 hover:text-gray-900"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
              {error && (
                <div className="p-4 bg-rose-50 text-rose-700 text-sm font-bold rounded-2xl flex items-center gap-3 border border-rose-100">
                  <AlertCircle size={20} />
                  {error}
                </div>
              )}
              {success && (
                <div className="p-4 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-2xl flex items-center gap-3 border border-emerald-100">
                  <CheckCircle2 size={20} />
                  {success}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Informasi Dasar</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">Nama Bisnis</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-medium transition-all"
                          placeholder="Zentory Store"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">Subdomain</label>
                      <div className="relative flex items-center">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="text"
                          required
                          value={formData.subdomain}
                          onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                          className="w-full pl-12 pr-20 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-medium transition-all"
                          placeholder="duodesain"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-indigo-600 font-black">.my.id</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">Tipe Bisnis</label>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <select
                          value={formData.businessType}
                          onChange={(e) => setFormData({ ...formData, businessType: e.target.value as BusinessType })}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-medium appearance-none transition-all"
                        >
                          <option value="Retail">Retail (Produk)</option>
                          <option value="Service">Service (Booking)</option>
                          <option value="Mixed">Mixed (Keduanya)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Kontak & Akses</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">Email Utama</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-medium transition-all"
                          placeholder="admin@bisnis.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">Password Setup</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="text"
                          required
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-medium transition-all"
                          placeholder="Password awal"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">Telepon</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-medium transition-all"
                          placeholder="0812..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">Plan Langganan</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Free', 'Pro', 'Enterprise'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormData({ ...formData, plan: p as TenantPlan })}
                        className={cn(
                          "py-3 rounded-2xl text-xs font-black transition-all border",
                          formData.plan === p 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                            : "bg-white text-gray-400 border-gray-100 hover:border-indigo-200"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">Status Akun</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Active', 'Inactive', 'Suspended'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData({ ...formData, status: s as TenantStatus })}
                        className={cn(
                          "py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border",
                          formData.status === s 
                            ? s === 'Active' ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100" :
                              s === 'Inactive' ? "bg-gray-600 text-white border-gray-600 shadow-lg shadow-gray-100" :
                              "bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-100"
                            : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">Alamat Lengkap</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 text-gray-400" size={20} />
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-medium min-h-[100px] transition-all"
                    placeholder="Alamat lengkap perusahaan..."
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-8 py-4 border-2 border-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-50 transition-all uppercase tracking-widest text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      <ShieldCheck size={20} />
                      Simpan Tenant
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
