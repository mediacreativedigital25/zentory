import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { Store, Mail, Lock, User, Phone, MapPin, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

export const Register: React.FC = () => {
  const { currentTenant } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    role: 'Customer' as any
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Check if email is already associated with a tenant
      const tenantsQuery = query(collection(db, 'tenants'), where('email', '==', formData.email));
      const tenantsSnap = await getDocs(tenantsQuery);
      let autoTenantId = null;
      let autoRole = formData.role;

      if (!tenantsSnap.empty) {
        autoTenantId = tenantsSnap.docs[0].id;
        autoRole = 'Administrator'; // Force Administrator role if they own the tenant email
      }

      const { user } = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      
      let role = autoRole;
      if (formData.email === 'mediacreativedigital25@gmail.com') {
        role = 'SuperAdmin';
      }

      const userProfile = {
        uid: user.uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        role: role,
        tenantId: currentTenant ? currentTenant.id : autoTenantId,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', user.uid), userProfile);
      
      if (currentTenant) {
        navigate(`/catalog?tenant=${currentTenant.subdomain}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Email ini sudah terdaftar. Silakan masuk menggunakan akun yang ada.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password terlalu lemah. Gunakan minimal 6 karakter.');
      } else {
        setError('Gagal mendaftar. Silakan coba lagi nanti.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4">
            <Store size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {currentTenant ? currentTenant.name : 'Zentory'}
          </h1>
          <p className="text-gray-500 text-sm">
            {currentTenant ? `Daftar sebagai Pelanggan ${currentTenant.name}` : 'Buat akun baru Anda'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <User size={18} />
              </div>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                placeholder="Nama Lengkap"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                placeholder="nama@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">No. HP</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Phone size={18} />
              </div>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                placeholder="0812..."
              />
            </div>
          </div>

          {!currentTenant && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role (Demo)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <ShieldCheck size={18} />
                </div>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm appearance-none"
                >
                  <option value="Customer">Customer</option>
                  <option value="Administrator">Administrator (Business Owner)</option>
                  <option value="Admin 01 Manager Bisnis">Manager Bisnis</option>
                  <option value="Admin 02 Kasir">Kasir</option>
                </select>
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat</label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none text-gray-400">
                <MapPin size={18} />
              </div>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm min-h-[100px]"
                placeholder="Alamat Lengkap"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="md:col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Daftar Sekarang'}
          </button>

          <div className="md:col-span-2 relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Atau</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              try {
                const { user } = await signInWithPopup(auth, googleProvider);
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) {
                  const role = user.email === '64.iklas@gmail.com' ? 'Administrator' : 'Customer';
                  await setDoc(docRef, {
                    uid: user.uid,
                    name: user.displayName || 'User',
                    email: user.email,
                    role: role,
                    createdAt: new Date().toISOString()
                  });
                }
                navigate('/dashboard');
              } catch (err) {
                console.error(err);
                setError('Gagal daftar dengan Google.');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="md:col-span-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Daftar dengan Google
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
};
