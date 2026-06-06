import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Star, Shield, Building2, ChevronRight, Sparkles, X, Info } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MENU_GROUPS } from '../constants/plans';

interface ServicePricing {
  duration: number;
  price: number;
}

interface Service {
  id: string;
  name: string;
  description: string;
  pricingList: ServicePricing[];
  features: string[];
  menuPermissions?: string[];
  icon: string;
}

export default function Pricing() {
  const { plan: currentPlan } = usePermissions();
  const navigate = useNavigate();
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailService, setDetailService] = useState<Service | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const q = query(collection(db, 'system_services'), orderBy('createdAt', 'asc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)).filter(s => (s as any).isEnabled !== false);
        setServices(list);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const handleUpgrade = (serviceId: string) => {
    navigate(`/checkout?serviceId=${serviceId}&duration=${selectedDuration}`);
  };

  const durations = [30, 90, 180, 365];

  return (
    <div className="space-y-12 pb-20">
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Pilih Paket Terbaik Untuk Bisnis Anda
        </motion.div>
        
        <div className="space-y-4">
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
            Zyvora hadir dengan berbagai pilihan paket yang fleksibel sesuai dengan skala usaha Anda. Mulai dari gratis hingga skala enterprise.
          </motion.p>
        </div>
      </div>

      <div className="bg-white border text-left border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="py-5 px-6 text-xs font-black text-gray-500 uppercase tracking-widest min-w-[200px]">Nama Paket</th>
              <th className="py-5 px-6 text-xs font-black text-gray-500 uppercase tracking-widest hidden md:table-cell w-1/3">Keterangan</th>
              <th className="py-5 px-6 text-xs font-black text-gray-500 uppercase tracking-widest text-right whitespace-nowrap">Harga</th>
              <th className="py-5 px-6 text-xs font-black text-gray-500 uppercase tracking-widest text-center whitespace-nowrap">Durasi</th>
              <th className="py-5 px-6 text-xs font-black text-gray-500 uppercase tracking-widest text-center min-w-[200px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20 text-center text-gray-500 font-bold animate-pulse">
                  Memuat pilihan paket layanan...
                </td>
              </tr>
            ) : services.length > 0 ? services.map((p, index) => {
              const isCurrent = currentPlan === p.id || (currentPlan === 'free' && p.pricingList?.[0]?.price === 0);
              const isRecommended = index === 1 || p.name.toLowerCase().includes('pro');
              
              const pList = p.pricingList?.length ? p.pricingList : [{ duration: 30, price: (p as any).price || 0 }];
              const sortedPricing = [...pList].sort((a,b) => a.duration - b.duration);
              const currentPricing = pList.find(pr => pr.duration === selectedDuration) || sortedPricing[0];
              
              if (!currentPricing) return null;

              const displayPrice = currentPricing.price > 0 ? `Rp ${currentPricing.price.toLocaleString('id-ID')}` : 'Gratis';
              const IconComp = p.icon === 'Zap' ? Zap : p.icon === 'Star' ? Star : p.icon === 'Building2' ? Building2 : p.icon === 'Shield' ? Shield : Sparkles;

              return (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-6 px-6">
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                        isRecommended ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <IconComp className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900">{p.name}</h3>
                        {isRecommended && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold uppercase tracking-widest">
                            <Star className="w-3 h-3" /> Paling Populer
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-6 px-6 hidden md:table-cell">
                    <p className="text-sm text-gray-500 font-medium leading-relaxed">
                      {p.description}
                    </p>
                  </td>
                  <td className="py-6 px-6 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xl font-black text-gray-900">{displayPrice}</span>
                    </div>
                  </td>
                  <td className="py-6 px-6 text-center font-bold text-gray-700">
                    {currentPricing.duration} Hari
                  </td>
                  <td className="py-6 px-6">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setDetailService(p)}
                        className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
                      >
                        <Info className="w-4 h-4" />
                        Detail
                      </button>
                      <button
                        onClick={() => handleUpgrade(p.id)}
                        disabled={isCurrent}
                        className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all shadow-sm ${
                          isCurrent 
                            ? 'bg-gray-100 text-gray-400 cursor-default shadow-none' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:shadow-md active:scale-95'
                        }`}
                      >
                        {isCurrent ? 'Saat Ini' : 'Pilih'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} className="py-20 text-center text-gray-500 font-bold">
                  Harap tambahkan layanan via Superadmin
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {detailService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg bg-white rounded-xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => setDetailService(null)}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mb-6 pr-10">
              <h3 className="text-2xl font-black text-gray-900">{detailService.name}</h3>
              <p className="mt-2 text-sm text-gray-500 font-medium leading-relaxed">
                {detailService.description}
              </p>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Fitur & Keunggulan:</p>
              <ul className="space-y-4 font-sans max-h-64 overflow-y-auto pr-2">
                {detailService.features?.map((feat, i) => (
                  <li key={`feat-${i}`} className="flex items-start gap-4">
                    <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <span className="text-sm font-bold text-gray-700">{feat}</span>
                  </li>
                ))}
                
                {/* Dynamically grouped module access based on menuPermissions */}
                {MENU_GROUPS.map((group, gIdx) => {
                  const allowedItems = group.items.filter(item => 
                    detailService.menuPermissions?.includes(item.key)
                  );
                  if (allowedItems.length === 0) return null;
                  return (
                    <li key={`group-${gIdx}`} className="pt-2">
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-9 mb-2">
                        {group.name}
                      </div>
                      <ul className="space-y-3">
                        {allowedItems.map(item => (
                          <li key={item.key} className="flex items-start gap-4">
                            <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span className="text-sm font-bold text-gray-700">{item.label}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  )
                })}

                {!detailService.features?.length && (!detailService.menuPermissions || detailService.menuPermissions.length === 0) && (
                  <li className="text-sm text-gray-500 italic">Tidak ada detail fitur.</li>
                )}
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3">
               <button
                onClick={() => setDetailService(null)}
                className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold text-xs uppercase tracking-widest transition-colors"
               >
                 Tutup
               </button>
               <button
                onClick={() => {
                  setDetailService(null);
                  handleUpgrade(detailService.id);
                }}
                disabled={currentPlan === detailService.id || (currentPlan === 'free' && detailService.pricingList?.[0]?.price === 0)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold text-xs uppercase tracking-widest transition-colors shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50 disabled:grayscale"
               >
                 Pilih Paket Ini
               </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="bg-white p-12 rounded-xl border border-gray-100 shadow-sm overflow-hidden relative">
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
              <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-md border border-gray-100">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm font-bold text-gray-700">Custom Features</span>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-md border border-gray-100">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm font-bold text-gray-700">Dedicated Support</span>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-md border border-gray-100">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm font-bold text-gray-700">SLA Guarantee</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <button 
              onClick={() => window.open('https://wa.me/6281234567890?text=Halo%20Admin%20Zyvora,%20saya%20ingin%20konsultasi%20paket%20Enterprise', '_blank')}
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
