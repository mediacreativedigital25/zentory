import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, where, addDoc, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile, UserRole } from '../types';
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ShieldCheck, 
  Mail, 
  Phone, 
  AlertCircle,
  Loader2,
  X,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';

export const Staff: React.FC = () => {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Admin 02 Kasir' as UserRole
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchStaff = async () => {
    if (!profile?.tenantId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'), 
        where('tenantId', '==', profile.tenantId),
        where('role', 'in', ['Administrator', 'Admin 01 Manager Bisnis', 'Admin 02 Kasir'])
      );
      const snap = await getDocs(q);
      setStaff(snap.docs.map(doc => doc.data() as UserProfile));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      // Note: In a real app, you'd use Firebase Admin SDK or a Cloud Function 
      // to create user accounts with passwords. For this demo, we'll just 
      // update the profile if it exists or explain the limitation.
      
      if (editingStaff) {
        await updateDoc(doc(db, 'users', editingStaff.uid), {
          name: formData.name,
          phone: formData.phone,
          role: formData.role
        });
        setSuccess('Data staff berhasil diperbarui.');
      } else {
        setError('Untuk keamanan, staff baru harus mendaftar sendiri menggunakan email yang Anda tentukan di sini.');
        // In a real flow, you'd send an invite email.
      }

      setFormData({ name: '', email: '', phone: '', role: 'Admin 02 Kasir' });
      setShowModal(false);
      setEditingStaff(null);
      fetchStaff();
    } catch (err) {
      setError('Gagal menyimpan data staff.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Team & Staff</h1>
          <p className="text-gray-500 text-sm">Kelola akses dan peran anggota tim bisnis Anda.</p>
        </div>
        <button
          onClick={() => {
            setEditingStaff(null);
            setFormData({ name: '', email: '', phone: '', role: 'Admin 02 Kasir' });
            setShowModal(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          <span>Tambah Staff</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Cari nama atau email staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Nama & Email</th>
                <th className="px-6 py-4">Peran / Role</th>
                <th className="px-6 py-4">Telepon</th>
                <th className="px-6 py-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin inline-block text-indigo-600" size={32} />
                  </td>
                </tr>
              ) : filteredStaff.map((s) => (
                <tr key={s.uid} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                        {s.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit",
                      s.role === 'Administrator' ? "bg-purple-50 text-purple-600" :
                      s.role === 'Admin 01 Manager Bisnis' ? "bg-blue-50 text-blue-600" :
                      "bg-gray-50 text-gray-600"
                    )}>
                      <ShieldCheck size={14} />
                      {s.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.phone || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingStaff(s);
                          setFormData({
                            name: s.name,
                            email: s.email,
                            phone: s.phone || '',
                            role: s.role
                          });
                          setShowModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                {editingStaff ? 'Edit Data Staff' : 'Tambah Staff Baru'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 text-green-600 text-sm rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="Nama Staff"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  disabled={!!editingStaff}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-50"
                  placeholder="email@staff.com"
                />
                {!editingStaff && (
                  <p className="text-[10px] text-gray-400 mt-1">Staff akan mendaftar sendiri menggunakan email ini.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. HP</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="0812..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peran / Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="Admin 01 Manager Bisnis">Manager Bisnis</option>
                  <option value="Admin 02 Kasir">Kasir</option>
                  <option value="Administrator">Administrator (Co-Owner)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
