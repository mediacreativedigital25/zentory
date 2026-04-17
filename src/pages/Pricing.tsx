import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Star, Shield, Building2, ChevronRight, Sparkles } from 'lucide-react';
import { PLANS } from '../constants/plans';
import { usePermissions } from '../hooks/usePermissions';

export default function Pricing() {
  const { plan: currentPlan } = usePermissions();
  const navigate = useNavigate();

  const handleUpgrade = (planId: string) => {
    navigate(`/checkout?plan=${planId}`);
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Pilih Paket Terbaik Untuk Bisnis Anda
        </motion.div>
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight"
        >
          Investasi Kecil, <span className="text-indigo-600">Dampak Besar</span>
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-gray-500 font-medium leading-relaxed"
        >
          Zentory hadir dengan berbagai pilihan paket yang fleksibel sesuai dengan skala usaha Anda. Mulai dari gratis hingga skala enterprise.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {Object.values(PLANS).map((p, index) => {
          const isCurrent = currentPlan === p.id;
          const isRecommended = p.id === 'lite';

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative flex flex-col p-8 rounded-[2.5rem] border-2 transition-all duration-500 ${
                isRecommended 
                  ? 'border-indigo-600 bg-white shadow-2xl shadow-indigo-100 scale-105 z-10' 
                  : 'border-gray-100 bg-white hover:border-indigo-200 hover:shadow-xl'
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                  <Star className="w-3 h-3 fill-white" />
                  Paling Populer
                </div>
              )}

              <div className="mb-8">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${
                  p.id === 'free' ? 'bg-gray-100 text-gray-600' :
                  p.id === 'starter' ? 'bg-blue-100 text-blue-600' :
                  p.id === 'lite' ? 'bg-indigo-100 text-indigo-600' :
                  p.id === 'pro' ? 'bg-purple-100 text-purple-600' :
                  'bg-amber-100 text-amber-600'
                }`}>
                  {p.id === 'free' && <Zap className="w-6 h-6" />}
                  {p.id === 'starter' && <Shield className="w-6 h-6" />}
                  {p.id === 'lite' && <Star className="w-6 h-6" />}
                  {p.id === 'pro' && <Building2 className="w-6 h-6" />}
                  {p.id === 'business' && <Sparkles className="w-6 h-6" />}
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">{p.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-gray-900">{p.price}</span>
                  {p.id !== 'free' && <span className="text-sm text-gray-500 font-bold">/bln</span>}
                </div>
                <p className="mt-4 text-sm text-gray-500 font-medium leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fitur Utama:</p>
                <ul className="space-y-3">
                  {p.features.slice(0, 6).map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-1 w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-green-600 stroke-[4px]" />
                      </div>
                      <span className="text-xs font-bold text-gray-700 capitalize">
                        {f.replace(/_/g, ' ')}
                      </span>
                    </li>
                  ))}
                  {p.features.length > 6 && (
                    <li className="text-xs font-bold text-indigo-600 pl-7">
                      + {p.features.length - 6} Fitur Lainnya
                    </li>
                  )}
                </ul>
              </div>

              <button
                onClick={() => handleUpgrade(p.id)}
                disabled={isCurrent}
                className={`w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                  isCurrent 
                    ? 'bg-gray-100 text-gray-400 cursor-default' 
                    : isRecommended
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95'
                      : 'bg-gray-900 text-white hover:bg-black active:scale-95'
                }`}
              >
                {isCurrent ? 'PAKET SAAT INI' : 'PILIH PAKET'}
                {!isCurrent && <ChevronRight className="w-4 h-4" />}
              </button>
            </motion.div>
          );
        })}
      </div>

      <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-12 opacity-5">
          <Building2 className="w-64 h-64" />
        </div>
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">Butuh Solusi Custom?</h3>
            <p className="text-lg text-gray-500 font-medium leading-relaxed">
              Kami memahami bahwa setiap bisnis memiliki kebutuhan yang unik. Jika Anda memerlukan fitur khusus, integrasi API, atau skala yang lebih besar dari paket Business, tim kami siap membantu.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm font-bold text-gray-700">Custom Features</span>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm font-bold text-gray-700">Dedicated Support</span>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm font-bold text-gray-700">SLA Guarantee</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <button 
              onClick={() => window.open('https://wa.me/6281234567890?text=Halo%20Admin%20Zentory,%20saya%20ingin%20konsultasi%20paket%20Enterprise', '_blank')}
              className="px-10 py-5 bg-gray-900 text-white rounded-[1.5rem] font-black text-lg hover:bg-black transition-all shadow-2xl active:scale-95 flex items-center gap-3"
            >
              KONSULTASI SEKARANG
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
