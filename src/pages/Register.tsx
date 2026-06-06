import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { UserPlus, Mail, Lock, Building, User, ArrowRight, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useBrand } from '../hooks/useBrand';
import { getDocs, query, where } from 'firebase/firestore';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { brand } = useBrand();

  const generateUniqueSalesCode = (uid: string): string => {
    return uid.substring(0, 4).toUpperCase();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // 1. Create user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Create tenant
      const tenantSlug = businessName.toLowerCase().replace(/\s+/g, '-');
      
      // Generate 3-character code
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let tenantCode = '';
      for (let i = 0; i < 3; i++) {
        tenantCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const tenantRef = await addDoc(collection(db, 'tenants'), {
        name: businessName,
        slug: tenantSlug,
        code: tenantCode,
        ownerId: user.uid,
        subscription: 'free',
        createdAt: serverTimestamp(),
      });

      const salesCode = generateUniqueSalesCode(user.uid);

      // 3. Create user profile
      const isSuperAdminEmail = email === 'mediacreativedigital25@gmail.com';
      await setDoc(doc(db, 'users', user.uid), {
        email,
        displayName,
        role: isSuperAdminEmail ? 'superadmin' : 'admin',
        tenantId: isSuperAdminEmail ? null : tenantRef.id,
        salesCode,
        createdAt: serverTimestamp(),
      });

      navigate('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Email ini sudah terdaftar. Silakan login atau gunakan email lain.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password terlalu lemah. Gunakan minimal 6 karakter.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Banner */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-950 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-24 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
          <div className="absolute bottom-1/4 -right-12 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <img src={brand.faviconUrl} alt={`${brand.appName} Logo`} className="w-12 h-12 rounded-[14px] shadow-lg" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-0">{brand.appName}</h1>
            <p className="text-gray-400 text-sm font-medium">Business Management System</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" /> Scale Your Business
          </div>
          <h2 className="text-4xl font-light leading-tight">
            Start your journey to <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">smarter operations.</span>
          </h2>
          <p className="text-gray-400 leading-relaxed font-light">
            Create an account in minutes and get access to powerful tools designed to simplify your inventory, sales, and financial tracking.
          </p>
        </div>

        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url(${brand.loginImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', mixBlendMode: 'luminosity' }}></div>

        <div className="relative z-10 text-xs text-gray-500 font-mono">
          &copy; {new Date().getFullYear()} {brand.appName} Inc.
        </div>
      </div>

      {/* Right Register Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 sm:p-12 lg:p-24 relative z-20 bg-white">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="w-full max-w-[400px] mx-auto"
        >
          <div className="lg:hidden mb-8 flex items-center gap-2">
             <img src={brand.faviconUrl} alt={brand.appName} className="w-8 h-8 rounded-lg" />
             <h1 className="text-2xl font-bold tracking-tight text-gray-800">{brand.appName}</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Adventure starts here 🚀</h2>
            <p className="text-gray-500 text-sm">Make your app management easy and fun!</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Business Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all"
                  placeholder="Acme Corp"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-1 pb-2">
              <input type="checkbox" id="terms" required className="rounded text-indigo-600 focus:ring-indigo-600 border-gray-300 w-4 h-4 cursor-pointer" />
              <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer">
                I agree to <span className="text-indigo-600 hover:text-indigo-700">privacy policy & terms</span>
              </label>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-lg border border-red-100 flex items-start gap-2">
                <div className="mt-0.5"><Lock className="w-3 h-3" /></div>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 flex items-center justify-center gap-1.5">
            <span>Already have an account?</span>
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700">
              Sign in instead
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
