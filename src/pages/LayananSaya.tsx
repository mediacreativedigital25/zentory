import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { PLANS } from '../constants/plans';
import { Zap, Check, Star, Shield, Building2, Sparkles, ChevronRight, Calendar, Clock, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function LayananSaya() {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile?.tenantId) return;
    const unsub = onSnapshot(doc(db, 'tenants', profile.tenantId), (snap) => {
      if (snap.exists()) {
        setTenant(snap.data());
      }
    });
    return () => unsub();
  }, [profile]);

  const currentPlanId = tenant?.plan || tenant?.subscription || 'free';
  const currentPlan = PLANS[currentPlanId];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Layanan Saya</h2>
          <p className="text-gray-500">Informasi paket langganan dan status akun Anda.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Current Plan Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden relative">
            <div className={`absolute top-0 right-0 p-8 opacity-5`}>
              {currentPlanId === 'free' && <Zap className="w-48 h-48" />}
              {currentPlanId === 'starter' && <Shield className="w-48 h-48" />}
              {currentPlanId === 'lite' && <Star className="w-48 h-48" />}
              {currentPlanId === 'pro' && <Building2 className="w-48 h-48" />}
              {currentPlanId === 'business' && <Sparkles className="w-48 h-48" />}
            </div>

            <div className="p-8 md:p-12 relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-6">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg ${
                    currentPlanId === 'free' ? 'bg-gray-100 text-gray-600' :
                    currentPlanId === 'starter' ? 'bg-blue-100 text-blue-600' :
                    currentPlanId === 'lite' ? 'bg-indigo-100 text-indigo-600' :
                    currentPlanId === 'pro' ? 'bg-purple-100 text-purple-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {currentPlanId === 'free' && <Zap className="w-10 h-10" />}
                    {currentPlanId === 'starter' && <Shield className="w-10 h-10" />}
                    {currentPlanId === 'lite' && <Star className="w-10 h-10" />}
                    {currentPlanId === 'pro' && <Building2 className="w-10 h-10" />}
                    {currentPlanId === 'business' && <Sparkles className="w-10 h-10" />}
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900 tracking-tight">{currentPlan?.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                        AKTIF
                      </span>
                      <span className="text-sm text-gray-400 font-bold">Terdaftar sejak {tenant?.createdAt ? new Date(tenant.createdAt.seconds * 1000).toLocaleDateString('id-ID') : '-'}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/pricing')}
                  className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl active:scale-95 flex items-center gap-2"
                >
                  UPGRADE PAKET
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Masa Berlaku</span>
                  </div>
                  <p className="text-lg font-black text-gray-900">
                    {currentPlanId === 'free' ? 'Selamanya' : 
                     tenant?.subscriptionEndDate ? new Date(tenant.subscriptionEndDate.seconds * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </p>
                </div>
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Siklus Tagihan</span>
                  </div>
                  <p className="text-lg font-black text-gray-900">
                    {currentPlanId === 'free' ? 'Gratis' : (tenant?.billingCycle || '30 Hari')}
                  </p>
                </div>
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Metode Bayar</span>
                  </div>
                  <p className="text-lg font-black text-gray-900">
                    {currentPlanId === 'free' ? 'N/A' : (tenant?.lastPaymentMethod || 'Manual Transfer')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 md:p-12">
            <h4 className="text-xl font-black text-gray-900 mb-8">Fitur Paket Anda</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              {currentPlan?.features.map((feature: string, index: number) => (
                <div key={index} className="flex items-center gap-4 py-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-green-600 stroke-[4px]" />
                  </div>
                  <span className="text-sm font-bold text-gray-700 capitalize">
                    {feature.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Usage Stats / Limits */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
            <h4 className="text-lg font-black text-gray-900 mb-6">Limit Penggunaan</h4>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-gray-400 uppercase tracking-widest">Produk</span>
                  <span className="text-gray-900">
                    {currentPlan?.limits.maxProducts >= 1000000 ? 'Unlimited' : `${currentPlan?.limits.maxProducts.toLocaleString()} Produk`}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: currentPlan?.limits.maxProducts >= 1000000 ? '100%' : '10%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-gray-400 uppercase tracking-widest">Transaksi</span>
                  <span className="text-gray-900">
                    {currentPlan?.limits.maxTransactionsPerMonth >= 1000000 ? 'Unlimited' : `${currentPlan?.limits.maxTransactionsPerMonth.toLocaleString()} / bln`}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: currentPlan?.limits.maxTransactionsPerMonth >= 1000000 ? '100%' : '5%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-gray-400 uppercase tracking-widest">User Staff</span>
                  <span className="text-gray-900">
                    {currentPlan?.limits.maxUsers >= 100 ? 'Enterprise' : `${currentPlan?.limits.maxUsers} User`}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: currentPlan?.limits.maxUsers >= 100 ? '100%' : '20%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 rounded-[2.5rem] shadow-xl shadow-indigo-100 p-8 text-white relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Zap className="w-32 h-32" />
            </div>
            <h4 className="text-lg font-black mb-4">Butuh Lebih Banyak?</h4>
            <p className="text-indigo-100 text-sm font-medium mb-6 leading-relaxed">
              Dapatkan fitur lanjutan seperti Multi-Gudang, Laporan Keuangan Detail, dan Prioritas Support dengan upgrade ke paket yang lebih tinggi.
            </p>
            <button 
              onClick={() => navigate('/pricing')}
              className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-50 transition-all active:scale-95"
            >
              LIHAT PILIHAN PAKET
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
