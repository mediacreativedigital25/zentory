import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, serverTimestamp, query, where, getDocs, getDoc } from 'firebase/firestore';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { LogIn, UserPlus, Mail, Lock, User, MapPin, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tenant } from '../types';

export default function CustomerAuth() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'register'>(location.state?.mode || 'login');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    address: '',
  });

  useEffect(() => {
    const fetchTenant = async () => {
      if (!tenantSlug) return;
      const q = query(collection(db, 'tenants'), where('slug', '==', tenantSlug));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setTenant({ id: snap.docs[0].id, ...snap.docs[0].data() } as Tenant);
      }
    };
    fetchTenant();
  }, [tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        const userCred = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        
        // Check if user belongs to this tenant
        const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role !== 'superadmin' && userData.tenantId !== tenant?.id) {
            await auth.signOut();
            setError('Akun Anda tidak terdaftar di toko ini. Silakan gunakan email lain atau daftar akun baru.');
            setLoading(false);
            return;
          }
        }
      } else {
        // Register
        const userCred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        // Create user profile
        await setDoc(doc(db, 'users', userCred.user.uid), {
          email: formData.email,
          displayName: formData.name,
          address: formData.address,
          role: 'customer',
          tenantId: tenant?.id || null,
          createdAt: serverTimestamp(),
        });

        // Add to customers collection for admin view
        if (tenant) {
          await addDoc(collection(db, 'customers'), {
            uid: userCred.user.uid,
            name: formData.name,
            email: formData.email,
            address: formData.address,
            phone: '-',
            tenantId: tenant.id,
            createdAt: serverTimestamp(),
          });
        }
      }
      navigate(`/catalog/${tenantSlug}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <button 
        onClick={() => navigate(`/catalog/${tenantSlug}`)}
        className="mb-8 flex items-center text-gray-600 hover:text-indigo-600 font-bold transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Kembali ke {tenant.name}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-4">
            {mode === 'login' ? <LogIn className="w-8 h-8" /> : <UserPlus className="w-8 h-8" />}
          </div>
          <h1 className="text-2xl font-black text-gray-900">
            {mode === 'login' ? 'Masuk Akun' : 'Daftar Akun'}
          </h1>
          <p className="text-gray-500 mt-2">
            {mode === 'login' 
              ? `Selamat datang kembali di ${tenant.name}` 
              : `Bergabunglah dengan ${tenant.name} sekarang`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                key="register-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Nama Lengkap</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      placeholder="Nama Anda"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Alamat Pengiriman</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <textarea
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all min-h-[100px]"
                      placeholder="Alamat Lengkap"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="email@contoh.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'login' ? <LogIn className="w-5 h-5 mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />}
                {mode === 'login' ? 'Masuk Sekarang' : 'Daftar Sekarang'}
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
            <button 
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="ml-2 text-indigo-600 font-black hover:underline"
            >
              {mode === 'login' ? 'Daftar di sini' : 'Masuk di sini'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
