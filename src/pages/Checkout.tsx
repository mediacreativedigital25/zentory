import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  CreditCard, 
  Building2, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Info, 
  ArrowRight,
  Copy,
  Check,
  QrCode,
  Wallet
} from 'lucide-react';
import { PLANS } from '../constants/plans';
import { useAuth } from '../hooks/useAuth';
import { SubscriptionPlan } from '../types';
import { db } from '../lib/firebase';
import { doc, onSnapshot, addDoc, collection, serverTimestamp, query, where, getDocs, orderBy, limit, getDoc, updateDoc, increment } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { auth } from '../lib/firebase';
import { sendInvoiceCreatedNotification } from '../lib/fonnte';
import { sendInvoiceCreatedEmail } from '../lib/email';

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  
  const serviceId = searchParams.get('serviceId');
  const durationParam = parseInt(searchParams.get('duration') || '30');

  const [isLoadingService, setIsLoadingService] = useState(true);
  const [planInfo, setPlanInfo] = useState<any>(null);
  const [currentPricing, setCurrentPricing] = useState<any>(null);
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [selectedPriceDisplay, setSelectedPriceDisplay] = useState('Rp 0');

  useEffect(() => {
    const fetchService = async () => {
      if (!serviceId) {
        navigate('/pricing');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'system_services', serviceId));
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setPlanInfo(data);
          
          const pricingList = data.pricingList || [];
          const pricing = pricingList.find((p: any) => p.duration === durationParam) || pricingList[0] || { duration: 30, price: 0 };
          
          setCurrentPricing(pricing);
          setSelectedAmount(pricing.price);
          setSelectedPriceDisplay(`Rp ${pricing.price.toLocaleString()}`);
        } else {
          try {
            // maybe it was a hardcoded PLAN like 'starter', etc.
            if(PLANS[serviceId as SubscriptionPlan]) {
              const oldPlan = PLANS[serviceId as SubscriptionPlan];
              setPlanInfo(oldPlan);
              const pricing = oldPlan.pricing.find(p => p.duration === durationParam) || oldPlan.pricing[0];
              setCurrentPricing(pricing);
              setSelectedAmount(pricing.price);
              setSelectedPriceDisplay(pricing.priceDisplay);
            } else {
              navigate('/pricing');
            }
          } catch(e) {
            navigate('/pricing');
          }
        }
      } catch (err) {
        console.error(err);
        navigate('/pricing');
      } finally {
        setIsLoadingService(false);
      }
    };
    fetchService();
  }, [serviceId, durationParam, navigate]);

  // Calculate Expiry Preview
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + durationParam);
  const expiryDateStr = expiryDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'qris' | 'tripay'>('bank');
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState('');
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [isLoadingCoupon, setIsLoadingCoupon] = useState(false);

  const calculateTotalBeforeDiscount = () => selectedAmount;
  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percentage') {
      return Math.floor(selectedAmount * (appliedCoupon.value / 100));
    }
    if (appliedCoupon.type === 'nominal') {
      return appliedCoupon.value > selectedAmount ? selectedAmount : appliedCoupon.value;
    }
    return 0; // free_days doesn't reduce price necessarily, maybe it adds duration
  };
  
  const calculateFinalTotal = () => {
    return calculateTotalBeforeDiscount() - calculateDiscount();
  };

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) return;
    setIsLoadingCoupon(true);
    setCouponError('');
    setCouponSuccess('');
    try {
      const code = couponCodeInput.toUpperCase().replace(/\s/g, '');
      const docRef = doc(db, 'tenant_coupons', code);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (!data.isActive) {
          setCouponError('Kupon tidak aktif.');
          setAppliedCoupon(null);
        } else if (data.maxUses > 0 && data.usedCount >= data.maxUses) {
          setCouponError('Kupon sudah mencapai batas maksimal penggunaan.');
          setAppliedCoupon(null);
        } else {
          setAppliedCoupon({ id: snap.id, ...data });
          setCouponSuccess('Kupon berhasil diterapkan!');
        }
      } else {
        setCouponError('Kupon tidak ditemukan.');
        setAppliedCoupon(null);
      }
    } catch(err) {
      setCouponError('Gagal memeriksa kupon.');
    } finally {
      setIsLoadingCoupon(false);
    }
  };

  const generateInvoiceNumber = async () => {
    const now = new Date();
    const yearMonth = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0');
    const tenantCode = tenant?.code || 'TNT';
    
    try {
      const q = query(
        collection(db, 'finance_invoices'),
        where('tenantId', '==', tenant?.id),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      
      let nextNumber = 1;
      if (!snap.empty) {
        const lastInvoice = snap.docs[0].data();
        const lastNumberStr = lastInvoice.invoiceNumber?.slice(-6);
        if (lastNumberStr && !isNaN(parseInt(lastNumberStr))) {
          nextNumber = parseInt(lastNumberStr) + 1;
        }
      }
      
      const sequential = nextNumber.toString().padStart(6, '0');
      return `${tenantCode}${yearMonth}${sequential}`;
    } catch (err) {
      console.error('Error generating invoice number:', err);
      return `${tenantCode}${yearMonth}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGlobalSettings(data);
        // Set default method based on what's enabled
        if (data.paymentMethods?.manual?.isEnabled) {
          setPaymentMethod('bank');
        } else if (data.paymentMethods?.tripay?.isEnabled) {
          setPaymentMethod('tripay');
        }
      }
    });

    return () => unsub();
  }, [planInfo, navigate]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async () => {
    if (!tenant || !profile) return;
    setIsProcessing(true);
    try {
      const invoiceNumber = await generateInvoiceNumber();
      setGeneratedInvoiceNumber(invoiceNumber);

      let usedDuration = durationParam;
      if (appliedCoupon?.type === 'free_days') {
        usedDuration += appliedCoupon.value;
      }

      const invoiceData: any = {
        tenantId: tenant.id,
        tenantName: tenant.name,
        userId: profile.uid,
        userEmail: profile.email,
        planId: serviceId || 'unknown',
        planName: planInfo.name,
        duration: usedDuration,
        amount: selectedAmount,
        discount: calculateDiscount(),
        total: calculateFinalTotal(),
        status: 'pending',
        paymentMethod: paymentMethod,
        invoiceNumber: invoiceNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (appliedCoupon) {
        invoiceData.couponCode = appliedCoupon.code;
        invoiceData.couponType = appliedCoupon.type;
        invoiceData.couponValue = appliedCoupon.value;
        
        // Update coupon used count if coupon used
        await updateDoc(doc(db, 'tenant_coupons', appliedCoupon.id), {
          usedCount: increment(1)
        });
      }

      await addDoc(collection(db, 'finance_invoices'), invoiceData);
      
      try {
        const emailVarData = {
          nama_tenant: tenant.name,
          plan_name: planInfo.name,
          amount: `Rp ${calculateFinalTotal().toLocaleString('id-ID')}`,
          invoice_url: `${window.location.origin}/layanan/invoice?id=${invoiceNumber}`,
          invoice_number: invoiceNumber
        };

        if (tenant.phone) {
          await sendInvoiceCreatedNotification(tenant.phone, emailVarData);
        }
        if (tenant.email) {
          await sendInvoiceCreatedEmail(tenant.email, emailVarData);
        }
      } catch (e) {
        console.error("Failed to send Notification", e);
      }

      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'finance_invoices', auth, profile);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoadingService || !planInfo) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="text-gray-500 font-bold animate-pulse">Memuat data layanan...</div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-[3rem] shadow-2xl border border-gray-100 max-w-lg w-full text-center space-y-8"
        >
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-[2rem] flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Pesanan Diterima!</h2>
            <p className="text-gray-500 font-medium leading-relaxed">
              Terima kasih telah memilih paket <span className="text-indigo-600 font-black">{planInfo.name}</span>. Tim kami akan memverifikasi pembayaran Anda dalam waktu maksimal 1x24 jam.
            </p>
          </div>
          <div className="p-6 bg-white rounded-md border border-gray-100 text-left space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-bold">Order ID</span>
              <span className="text-gray-900 font-black font-mono">#{generatedInvoiceNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-bold">Status</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-black uppercase">Menunggu Verifikasi</span>
            </div>
          </div>
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
          >
            KEMBALI KE DASHBOARD
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-400 hover:text-gray-600 font-bold transition-colors group"
      >
        <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
        Kembali ke Pilihan Paket
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Payment & Info */}
        <div className="lg:col-span-2 space-y-8">
          {/* Business Info */}
          <div className="bg-white p-8 rounded-md shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-md">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Informasi Bisnis</h3>
                <p className="text-sm text-gray-500 font-medium">Detail akun yang akan di-upgrade</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-md border border-gray-100">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nama Bisnis</p>
                <p className="font-bold text-gray-900">{tenant?.name || '---'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Email Terdaftar</p>
                <p className="font-bold text-gray-900">{profile?.email || '---'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ID Tenant</p>
                <p className="font-mono text-xs font-bold text-indigo-600">{tenant?.id || '---'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Paket Saat Ini</p>
                <p className="font-bold text-gray-900 uppercase">{tenant?.plan || tenant?.subscription || 'FREE'}</p>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white p-8 rounded-md shadow-sm border border-gray-100 space-y-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-md">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Metode Pembayaran</h3>
                <p className="text-sm text-gray-500 font-medium">Pilih cara pembayaran yang Anda inginkan</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {globalSettings?.paymentMethods?.manual?.isEnabled !== false && (
                <>
                  <button 
                    onClick={() => setPaymentMethod('bank')}
                    className={`flex items-center p-6 rounded-md border-2 transition-all text-left ${
                      paymentMethod === 'bank' 
                        ? 'border-indigo-600 bg-indigo-50/30' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-md flex items-center justify-center mr-4 ${
                      paymentMethod === 'bank' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-gray-900">Transfer Bank</p>
                      <p className="text-xs text-gray-500 font-medium">Manual Verification</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setPaymentMethod('qris')}
                    className={`flex items-center p-6 rounded-md border-2 transition-all text-left ${
                      paymentMethod === 'qris' 
                        ? 'border-indigo-600 bg-indigo-50/30' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-md flex items-center justify-center mr-4 ${
                      paymentMethod === 'qris' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-gray-900">QRIS Manual</p>
                      <p className="text-xs text-gray-500 font-medium">Upload Bukti</p>
                    </div>
                  </button>
                </>
              )}

              {globalSettings?.paymentMethods?.tripay?.isEnabled && (
                <button 
                  onClick={() => setPaymentMethod('tripay')}
                  className={`flex items-center p-6 rounded-md border-2 transition-all text-left ${
                    paymentMethod === 'tripay' 
                      ? 'border-indigo-600 bg-indigo-50/30' 
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-md flex items-center justify-center mr-4 ${
                    paymentMethod === 'tripay' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-black text-gray-900">Otomatis (TriPay)</p>
                    <p className="text-xs text-gray-500 font-medium">Virtual Account, Retail</p>
                  </div>
                </button>
              )}
            </div>

            <AnimatePresence mode="wait">
              {paymentMethod === 'bank' ? (
                <motion.div 
                  key="bank"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100 space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-md border border-gray-200 flex items-center justify-center font-medium text-indigo-600 uppercase">
                        {globalSettings?.paymentMethods?.manual?.bankName || 'BCA'}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Nomor Rekening</p>
                        <p className="text-lg font-black text-gray-900">{globalSettings?.paymentMethods?.manual?.accountNumber || '1234 5678 90'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleCopy(globalSettings?.paymentMethods?.manual?.accountNumber || '1234567890')}
                      className="p-3 hover:bg-white rounded-md transition-colors text-indigo-600"
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Atas Nama</p>
                    <p className="font-bold text-gray-900">{globalSettings?.paymentMethods?.manual?.accountHolder || 'PT ZENTORY DIGITAL INDONESIA'}</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-md border border-amber-100 flex items-start gap-3">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                      Mohon sertakan <span className="font-black">ID Tenant</span> Anda pada berita transfer untuk mempercepat proses verifikasi.
                    </p>
                  </div>
                </motion.div>
              ) : paymentMethod === 'qris' ? (
                <motion.div 
                  key="qris"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100 flex flex-col items-center text-center space-y-6"
                >
                  <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100">
                    {globalSettings?.paymentMethods?.manual?.qrisUrl ? (
                      <img src={globalSettings.paymentMethods.manual.qrisUrl} alt="QRIS" className="w-48 h-48 object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <QrCode className="w-48 h-48 text-gray-900" />
                    )}
                  </div>
                  <div>
                    <p className="font-black text-gray-900">Scan QRIS Zentory</p>
                    <p className="text-xs text-gray-500 font-medium">Mendukung semua aplikasi pembayaran digital</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="tripay"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-8 bg-indigo-600 rounded-[2rem] text-white space-y-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-md">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-xl">Pembayaran Otomatis</p>
                      <p className="text-sm text-indigo-100 font-medium">Virtual Account & Retail</p>
                    </div>
                  </div>
                  <p className="text-sm text-indigo-50 leading-relaxed">
                    Anda akan diarahkan ke gerbang pembayaran aman TriPay. Pembayaran akan terverifikasi secara otomatis dalam hitungan detik setelah transaksi berhasil.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['BCA', 'MANDIRI', 'BNI', 'BRI', 'ALFAMART', 'INDOMARET'].map(bank => (
                      <span key={bank} className="px-2 py-1 bg-white/10 rounded text-[10px] font-black">{bank}</span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="space-y-6 lg:sticky lg:top-8">
          <div className="bg-white p-8 rounded-md shadow-xl border border-gray-100 space-y-8">
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Ringkasan Pesanan</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white rounded-md border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${planInfo.color}`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">{planInfo.name}</p>
                    <div className="flex flex-col">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Langganan {durationParam} Hari</p>
                      <p className="text-[9px] text-indigo-600 font-black uppercase">Hingga {expiryDateStr}</p>
                    </div>
                  </div>
                </div>
                <p className="font-black text-gray-900">{selectedPriceDisplay}</p>
              </div>

              {/* Coupon Section */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-gray-600">Kupon Diskon (Gunakan jika ada)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="KODE KUPON"
                    value={couponCodeInput}
                    onChange={e => setCouponCodeInput(e.target.value)}
                    disabled={!!appliedCoupon || isLoadingCoupon}
                    className="flex-1 p-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 uppercase font-mono font-medium text-sm"
                  />
                  {!appliedCoupon ? (
                    <button 
                      onClick={handleApplyCoupon}
                      disabled={isLoadingCoupon || !couponCodeInput}
                      className="px-4 py-2 bg-gray-900 text-white rounded-md font-bold w-24 flex items-center justify-center disabled:opacity-50"
                    >
                      {isLoadingCoupon ? 'Cek...' : 'Terapkan'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => setAppliedCoupon(null)}
                      className="px-4 py-2 bg-red-100 text-red-600 rounded-md font-bold hover:bg-red-200"
                    >
                      Hapus
                    </button>
                  )}
                </div>
                {couponError && <p className="text-xs text-red-600 font-bold">{couponError}</p>}
                {couponSuccess && <p className="text-xs text-green-600 font-bold">{couponSuccess}</p>}
              </div>

              <div className="space-y-3 px-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Subtotal</span>
                  <span className="text-gray-900 font-bold">{selectedPriceDisplay}</span>
                </div>
                
                {calculateDiscount() > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-bold flex items-center gap-1">Diskon Kupon</span>
                    <span className="text-green-600 font-bold">-Rp {calculateDiscount().toLocaleString('id-ID')}</span>
                  </div>
                )}
                {appliedCoupon?.type === 'free_days' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-indigo-600 font-bold">Gratis Langganan</span>
                    <span className="text-indigo-600 font-bold">+{appliedCoupon.value} Hari</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Biaya Layanan</span>
                  <span className="text-gray-900 font-bold">Rp0</span>
                </div>
                <div className="pt-4 border-t border-gray-100 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Bayar</p>
                    <p className="text-2xl font-black text-indigo-600">Rp {calculateFinalTotal().toLocaleString('id-ID')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-md border border-indigo-100">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-indigo-700 font-medium leading-relaxed">
                  Pembayaran Anda aman dan terenkripsi. Dengan melanjutkan, Anda menyetujui <span className="font-black underline">Syarat & Ketentuan</span> Zentory.
                </p>
              </div>

              <button 
                onClick={handleConfirm}
                disabled={isProcessing}
                className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                    MEMPROSES...
                  </>
                ) : (
                  <>
                    KONFIRMASI PEMBAYARAN
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-6 text-center">
            <p className="text-xs text-gray-400 font-medium">
              Butuh bantuan? <span className="text-indigo-600 font-black cursor-pointer">Hubungi Support</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
