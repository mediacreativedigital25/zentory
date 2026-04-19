import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CreditCard, ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function SubscriptionExpired() {
  const { tenant } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(auth);
    navigate('/login');
  };

  const expiryDate = tenant?.subscriptionEndDate?.seconds 
    ? new Date(tenant.subscriptionEndDate.seconds * 1000).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : '-';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100"
      >
        <div className="p-10 text-center">
          <div className="w-24 h-24 bg-red-50 rounded-[2rem] flex items-center justify-center text-red-600 mx-auto mb-8">
            <Calendar className="w-12 h-12" />
          </div>
          
          <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Masa Aktif Berakhir</h1>
          <p className="text-gray-500 font-medium leading-relaxed mb-6">
            Masa berlaku langganan bisnis <span className="text-indigo-600 font-bold uppercase">{tenant?.name}</span> telah berakhir pada <span className="text-red-600 font-bold">{expiryDate}</span>.
          </p>

          <div className="bg-gray-50 rounded-2xl p-6 mb-8 text-left space-y-3 border border-gray-100">
            <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-gray-400">
              <span>Status Paket</span>
              <span className="text-red-500">EXPIRED</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-700">
              <span>Paket Terakhir</span>
              <span className="uppercase">{tenant?.plan || tenant?.subscription}</span>
            </div>
            <p className="text-[10px] text-gray-400 italic">
              * Silakan lakukan perpanjangan langganan untuk dapat mengakses kembali dashboard dan data Anda.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/pricing')}
              className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              PERPANJANG SEKARANG
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-4 text-gray-400 font-bold hover:text-gray-600 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Keluar Sesi
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
