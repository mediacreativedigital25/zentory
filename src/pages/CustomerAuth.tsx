import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, serverTimestamp, query, where, getDocs, getDoc } from 'firebase/firestore';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { LogIn, UserPlus, Mail, Lock, User, MapPin, ArrowLeft, ChevronRight } from 'lucide-react';
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

  const generateUniqueSalesCode = (uid: string): string => {
    return uid.substring(0, 4).toUpperCase();
  };

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
        
        const salesCode = generateUniqueSalesCode(userCred.user.uid);

        // Create user profile
        await setDoc(doc(db, 'users', userCred.user.uid), {
          email: formData.email,
          displayName: formData.name,
          address: formData.address,
          role: 'customer',
          tenantId: tenant?.id || null,
          salesCode,
          createdAt: serverTimestamp(),
        });

        // Add to customers collection for admin view
        if (tenant) {
          const customersRef = collection(db, 'customers');
          const cq = query(customersRef, where('tenantId', '==', tenant.id));
          const csnap = await getDocs(cq);
          const sequence = (csnap.size + 1).toString().padStart(4, '0');
          const newCode = `A${sequence}`;

          await addDoc(collection(db, 'customers'), {
            uid: userCred.user.uid,
            name: formData.name,
            code: newCode,
            email: formData.email,
            address: formData.address,
            phone: '-',
            tenantId: tenant.id,
            createdAt: serverTimestamp(),
          });
        }
      }
      const basePath = tenant?.catalogTheme === 'booking-v1' ? 'booking' : tenant?.catalogTheme === 'v1' ? 'marketplace' : 'catalog';
      navigate(`/${basePath}/${tenantSlug}/dashboard`);
    } catch (err: any) {
      setError('Email atau sandi salah.');
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <motion.div
           animate={{ rotate: 360 }}
           transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
           className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"
        />
      </div>
    );
  }

  const basePath = tenant.catalogTheme === 'booking-v1' ? 'booking' : tenant.catalogTheme === 'v1' ? 'marketplace' : 'catalog';

  return (
    <div className="min-h-screen bg-white flex font-sans">
      {/* Left Panel - Image & Branding (Hidden on mobile) */}
      <div className="hidden md:flex md:w-5/12 lg:w-1/2 bg-gray-900 relative flex-col justify-end p-12 overflow-hidden">
        {tenant.settings?.heroImageUrls?.[0] ? (
          <img 
            src={tenant.settings.heroImageUrls[0]} 
            alt={tenant.name} 
            className="absolute inset-0 w-full h-full object-cover opacity-40 hover:scale-105 transition-transform duration-[10s] ease-out" 
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-gray-900"></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent"></div>
        
        <div className="relative z-10 w-full max-w-md">
          <button 
            onClick={() => navigate(`/${basePath}/${tenantSlug}`)}
            className="absolute -top-64 left-0 flex items-center text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Beranda
          </button>
          
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl font-bold text-white mb-8 border border-white/20 overflow-hidden shadow-2xl">
            {tenant.settings?.logoUrl ? (
              <img src={tenant.settings.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
            ) : (
              tenant.name.substring(0, 1).toUpperCase()
            )}
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Belanja Mudah di <br />
            <span className="text-indigo-400">{tenant.name}</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed">
            {mode === 'login' 
              ? 'Masuk untuk mengelola pesanan, melihat riwayat transaksi, dan mendapatkan penawaran eksklusif.'
              : 'Bergabunglah menjadi member dan nikmati pengalaman belanja yang lebih personal dan cepat.'}
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full md:w-7/12 lg:w-1/2 flex flex-col justify-center px-6 py-12 lg:px-24 relative overflow-y-auto">
        <button 
          onClick={() => navigate(`/${basePath}/${tenantSlug}`)}
          className="md:hidden flex items-center text-gray-500 hover:text-gray-900 transition-colors mb-8 text-sm font-medium absolute top-6 flex"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </button>

        <div className="max-w-md w-full mx-auto">
          <div className="md:hidden w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center text-xl font-bold text-white mb-6 overflow-hidden">
            {tenant.settings?.logoUrl ? (
              <img src={tenant.settings.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
            ) : (
              tenant.name.substring(0, 1).toUpperCase()
            )}
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
              {mode === 'login' ? 'Selamat Datang Kembali' : 'Buat Akun Anda'}
            </h2>
            <p className="text-gray-500">
              {mode === 'login' 
                ? 'Masukkan email dan sandi Anda untuk melanjutkan.' 
                : 'Lengkapi form di bawah ini untuk mendaftar.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  key="register-fields"
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="space-y-6 overflow-hidden"
                >
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Nama Lengkap</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm shadow-sm"
                        placeholder="Contoh: Budi Santoso"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Alamat Pengiriman</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                      <textarea
                        required
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all min-h-[100px] text-sm resize-none shadow-sm"
                        placeholder="Contoh: Jl. Sudirman No 123, Rt 1/2, Jakarta Pusat"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Alamat Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm shadow-sm"
                  placeholder="email@contoh.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Kata Sandi</label>
                {mode === 'login' && (
                  <a href="#" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
                    Lupa sandi?
                  </a>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm shadow-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50/50 text-red-600 text-sm rounded-xl border border-red-100 font-medium flex items-start">
                <div className="mt-0.5 mr-3 flex-shrink-0 bg-red-100 p-1 rounded-full">
                  <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                </div>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center justify-center disabled:opacity-70 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Masuk' : 'Daftar Akun'}
                </>
              )}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-gray-500 text-sm">
              {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
              <button 
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="ml-2 text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
              >
                {mode === 'login' ? 'Daftar sekarang' : 'Masuk di sini'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
