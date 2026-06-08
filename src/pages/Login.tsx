import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LogIn, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useBrand } from '../hooks/useBrand';
import { sendLoginNotification } from '../lib/fonnte';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { brand } = useBrand();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Fetch profile to check role
      const profileDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (profileDoc.exists()) {
        const profileData = profileDoc.data();
        
        try {
          let ip_address = 'Tidak diketahui';
          let lokasi = 'Tidak diketahui';
          try {
             const res = await fetch('https://ipapi.co/json/');
             if (res.ok) {
               const data = await res.json();
               ip_address = data.ip || 'Tidak diketahui';
               lokasi = `${data.city || ''}, ${data.region || ''}, ${data.country_name || ''}`.replace(/^,\s+/, '').replace(/,\s+$/, '');
             }
          } catch (e) {
             console.log("Failed to fetch IP details");
          }

          const now = new Date();
          const tanggal_jam = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
          let nama_tenant = 'Tidak ada tenant';
          if (profileData.tenantId) {
             const tenantDoc = await getDoc(doc(db, 'tenants', profileData.tenantId));
             if (tenantDoc.exists()) {
                nama_tenant = tenantDoc.data().name || profileData.tenantId;
             }
          }
          
          await sendLoginNotification({
            nama_user: profileData.name || 'Admin',
            email_user: email,
            no_hp: profileData.phone || '-',
            nama_tenant,
            tanggal_jam,
            ip_address,
            lokasi
          });
        } catch (e) {
          console.error("Failed sending login notification:", e);
        }

        if (profileData.role === 'kasir') {
          navigate('/sales/order');
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
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
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
          <div className="absolute bottom-0 left-12 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <img src={brand.faviconUrl} alt={`${brand.appName} Logo`} className="w-12 h-12 rounded-[14px] shadow-lg" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-0">{brand.appName}</h1>
            <p className="text-gray-400 text-sm font-medium">Business Management System</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Secure Access
          </div>
          <h2 className="text-4xl font-light leading-tight">
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">One Platform</span> for Every Business.
          </h2>
          <p className="text-gray-400 leading-relaxed font-light">
            Streamline operations, manage customers, handle bookings, track sales, and monitor business growth in one place.
          </p>
        </div>

        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url(${brand.loginImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', mixBlendMode: 'luminosity' }}></div>

        <div className="relative z-10 text-xs text-gray-500 font-mono">
          &copy; {new Date().getFullYear()} {brand.appName} Inc.
        </div>
      </div>

      {/* Right Login Form */}
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
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Welcome to {brand.appName}! 👋</h2>
            <p className="text-gray-500 text-sm">Please sign-in to your account and start the adventure</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600">Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all"
                  placeholder="admin@demo.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600">Password</label>
                <a href="#" className="text-sm text-indigo-600 hover:text-indigo-700">Forgot Password?</a>
              </div>
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
              <input type="checkbox" id="remember" className="rounded text-indigo-600 focus:ring-indigo-600 border-gray-300 w-4 h-4 cursor-pointer" />
              <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">Remember me</label>
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
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 flex items-center justify-center gap-1.5">
            <span>New on our platform?</span>
            <Link to="/register" className="text-indigo-600 hover:text-indigo-700">
              Create an account
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
