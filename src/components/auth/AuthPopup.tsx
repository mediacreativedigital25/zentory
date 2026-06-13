import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, serverTimestamp, query, where, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { LogIn, UserPlus, Mail, Lock, User, MapPin, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AuthPopup({ 
  isOpen, 
  onClose, 
  tenant, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  tenant: any;
  onSuccess?: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    address: '',
  });

  if (!isOpen) return null;

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
        
        const generateUniqueSalesCode = (uid: string) => uid.substring(0, 4).toUpperCase();
        const salesCode = generateUniqueSalesCode(userCred.user.uid);

        await setDoc(doc(db, 'users', userCred.user.uid), {
          email: formData.email,
          displayName: formData.name,
          address: formData.address,
          role: 'customer',
          tenantId: tenant?.id || null,
          salesCode,
          createdAt: serverTimestamp(),
        });

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
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(mode === 'login' ? 'Email atau sandi salah.' : 'Gagal mendaftar, email mungkin sudah digunakan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 overflow-y-auto">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-8 pr-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
              Maaf, Anda Harus Login
            </h2>
            <p className="text-gray-500 text-sm">
              Silakan login atau register terlebih dahulu untuk melanjutkan checkout pesanan Anda.
            </p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === 'register' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Register
            </button>
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
                    <label className="block mb-1.5 text-sm font-medium text-gray-700">Nama Lengkap</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                        placeholder="Contoh: Budi Santoso"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-gray-700">Alamat Pengiriman</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                      <textarea
                        required
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all min-h-[80px] text-sm resize-none"
                        placeholder="Contoh: Jl. Sudirman No 123"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block mb-1.5 text-sm font-medium text-gray-700">Alamat Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                  placeholder="email@contoh.com"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1.5 text-sm font-medium text-gray-700">Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 font-medium flex items-start">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow-md hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-70 mt-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                mode === 'login' ? 'Masuk' : 'Daftar'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
