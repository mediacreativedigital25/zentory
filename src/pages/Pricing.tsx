import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Star, Shield, Building2, ChevronRight, Sparkles } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  icon: string;
}

export default function Pricing() {
  const { plan: currentPlan } = usePermissions();
  const navigate = useNavigate();
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

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
            Zentory hadir dengan berbagai pilihan paket yang fleksibel sesuai dengan skala usaha Anda. Mulai dari gratis hingga skala enterprise.
          </motion.p>
        </div>

        {/* Duration Selector */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-4 pt-4"
        >
          <div className="flex p-1 bg-gray-100 rounded-md w-fit">
            {durations.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDuration(d)}
                className={`px-6 py-2.5 rounded-md text-xs font-black transition-all ${
                  selectedDuration === d 
                    ? 'bg-white text-indigo-600 shadow-md' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {d} HARI
              </button>
            ))}
          </div>
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest animate-pulse">
            🔥 Pilih durasi lebih lama untuk diskon hingga 20%
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-gray-500 font-bold animate-pulse">Memuat pilihan paket layanan...</div>
        ) : services.length > 0 ? services.map((p, index) => {
          const isCurrent = currentPlan === p.id || (currentPlan === 'free' && p.pricingList?.[0]?.price === 0);
          const isRecommended = index === 1 || p.name.toLowerCase().includes('pro');
          
          const pList = p.pricingList?.length ? p.pricingList : [{ duration: 30, price: (p as any).price || 0 }];
          const sortedPricing = [...pList].sort((a,b) => a.duration - b.duration);
          const currentPricing = pList.find(pr => pr.duration === selectedDuration) || sortedPricing[0];
          
          if (!currentPricing) return null;

          const displayPrice = `Rp${currentPricing.price.toLocaleString()}`;

          // Calculate End Date Today + Selected Duration
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + (currentPricing.duration || selectedDuration));
          const expiryDateStr = expiryDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

          const IconComp = p.icon === 'Zap' ? Zap : p.icon === 'Star' ? Star : p.icon === 'Building2' ? Building2 : p.icon === 'Shield' ? Shield : Sparkles;

          let discountPercent = 0;
          if (selectedDuration > 30 && sortedPricing[0]?.price > 0 && selectedDuration === currentPricing.duration) {
            const basePrice30 = sortedPricing[0].price;
            const normalPriceForDuration = Math.round((basePrice30 / sortedPricing[0].duration) * selectedDuration);
            discountPercent = Math.round(((normalPriceForDuration - currentPricing.price) / normalPriceForDuration) * 100);
          }

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative flex flex-col p-8 rounded-md border-2 transition-all duration-500 ${
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

              {discountPercent > 0 && (
                <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-sm animate-pulse">
                  Hemat {discountPercent}%
                </div>
              )}

              <div className="mb-8">
                <div className={`w-12 h-12 rounded-md flex items-center justify-center mb-6 ${
                  isRecommended ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  <IconComp className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">{p.name}</h3>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900">{displayPrice}</span>
                  </div>
                  {currentPricing.price > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        / {currentPricing.duration} Hari
                      </span>
                      <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                        Hingga {expiryDateStr}
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-4 text-sm text-gray-500 font-medium leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fitur & Keunggulan:</p>
                <ul className="space-y-3 font-sans">
                  {p.features?.map((feat, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5 stroke-[3]" />
                      <span className="text-sm font-bold text-gray-600">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleUpgrade(p.id)}
                disabled={isCurrent}
                className={`mt-auto w-full py-4 rounded-md font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
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
        }) : (
           <div className="col-span-full py-20 text-center text-gray-500 font-bold">Harap tambahkan layanan via Superadmin</div>
        )}
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
