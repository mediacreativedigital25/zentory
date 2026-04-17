import React from 'react';
import { motion } from 'motion/react';
import { Lock, Zap, ChevronRight, Sparkles } from 'lucide-react';
import { PLANS } from '../../constants/plans';
import { SubscriptionPlan } from '../../types';

interface UpgradePromptProps {
  featureName: string;
  requiredPlan?: SubscriptionPlan;
  onClose?: () => void;
}

export default function UpgradePrompt({ featureName, requiredPlan = 'lite', onClose }: UpgradePromptProps) {
  const planInfo = PLANS[requiredPlan];

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full border border-indigo-50">
      <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Zap className="w-32 h-32 rotate-12" />
        </div>
        <div className="relative z-10">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-2xl font-black mb-2 tracking-tight">Fitur Terkunci</h3>
          <p className="text-indigo-100 font-medium leading-relaxed">
            Fitur <span className="text-white font-black underline decoration-indigo-300 underline-offset-4">{featureName}</span> tersedia di paket <span className="text-white font-black">{planInfo.name}</span> ke atas.
          </p>
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-1" />
            <div>
              <p className="text-sm font-black text-amber-900 mb-1">Kenapa Harus Upgrade?</p>
              <p className="text-xs text-amber-700 leading-relaxed font-medium">
                Dapatkan akses penuh ke fitur profesional, kapasitas data lebih besar, dan dukungan prioritas untuk membantu bisnis Anda tumbuh lebih cepat.
              </p>
            </div>
          </div>

          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Mulai Dari</p>
              <p className="text-2xl font-black text-gray-900">{planInfo.price}<span className="text-sm text-gray-500 font-bold">/bulan</span></p>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${planInfo.color}`}>
              {planInfo.name}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => window.open('https://wa.me/6281234567890?text=Halo%20Admin%20Zentory,%20saya%20ingin%20upgrade%20ke%20paket%20' + planInfo.name, '_blank')}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            UPGRADE SEKARANG
            <ChevronRight className="w-5 h-5" />
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="w-full py-4 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors"
            >
              Mungkin Nanti
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
