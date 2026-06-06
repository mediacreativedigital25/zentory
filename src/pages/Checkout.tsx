import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft,
  ChevronRight,
  CreditCard, 
  Building2, 
  CheckCircle2, 
  AlertCircle,
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
          
          const pricingList = (data as any).pricingList || [];
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
  const [copied, setCopied] = useState<string | null>(null);
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
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
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

        const tenantPhone = tenant.phone || tenant.settings?.phone || (tenant as any).whatsapp;
        if (tenantPhone) {
          await sendInvoiceCreatedNotification(tenantPhone, emailVarData);
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
          className="bg-white p-12 rounded-xl shadow-2xl border border-gray-100 max-w-lg w-full text-center space-y-8"
        >
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mx-auto animate-bounce">
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
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-500 hover:text-gray-900 font-bold transition-colors group"
      >
        <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
        Kembali ke Pilihan Paket
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Payment & Info */}
        <div className="lg:col-span-2 space-y-8">
          {/* Business Info */}
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200/80 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Informasi Bisnis</h3>
                <p className="text-sm text-gray-500 font-medium">Detail akun yang akan di-upgrade</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 p-6 bg-gray-50/70 rounded-xl border border-gray-200/50">
              <div>
                <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Nama Bisnis</p>
                <p className="font-black text-gray-900 text-lg leading-tight">{tenant?.name || '---'}</p>
              </div>
              <div>
                <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Email Terdaftar</p>
                <p className="font-bold text-gray-900 text-base leading-tight">{profile?.email || '---'}</p>
              </div>
              <div>
                <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5">ID Tenant</p>
                <p className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-block">{tenant?.id || '---'}</p>
              </div>
              <div>
                <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Paket Saat Ini</p>
                <div className="inline-flex items-center px-2.5 py-1 bg-white border border-gray-200 rounded-md shadow-sm">
                  <p className="font-black text-gray-700 uppercase tracking-widest text-xs">{tenant?.plan || tenant?.subscription || 'FREE'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200/80 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Metode Pembayaran</h3>
                  <p className="text-sm text-gray-500 font-medium">Pilih cara pembayaran yang Anda inginkan</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {globalSettings?.paymentMethods?.manual?.isEnabled !== false && (
                <>
                  <button 
                    onClick={() => setPaymentMethod('bank')}
                    className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden group ${
                      paymentMethod === 'bank' 
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100/50' 
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                    }`}
                  >
                    {paymentMethod === 'bank' && <div className="absolute top-3 right-3 w-3 h-3 bg-indigo-600 rounded-full"></div>}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                      paymentMethod === 'bank' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                    }`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-gray-900 text-sm leading-tight">Transfer Bank</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Verifikasi Manual</p>
                    </div>
                  </button>

                  {!!globalSettings?.paymentMethods?.manual?.qrisUrl && (
                    <button 
                      onClick={() => setPaymentMethod('qris')}
                      className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden group ${
                        paymentMethod === 'qris' 
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100/50' 
                          : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                      }`}
                    >
                      {paymentMethod === 'qris' && <div className="absolute top-3 right-3 w-3 h-3 bg-indigo-600 rounded-full"></div>}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                        paymentMethod === 'qris' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                      }`}>
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-gray-900 text-sm leading-tight">QRIS Manual</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Upload Bukti</p>
                      </div>
                    </button>
                  )}
                </>
              )}

              {globalSettings?.paymentMethods?.tripay?.isEnabled && (
                <button 
                  onClick={() => setPaymentMethod('tripay')}
                  className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden group ${
                    paymentMethod === 'tripay' 
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-md shadow-emerald-100/50' 
                      : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                  }`}
                >
                  {paymentMethod === 'tripay' && <div className="absolute top-3 right-3 w-3 h-3 bg-emerald-600 rounded-full"></div>}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                    paymentMethod === 'tripay' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-emerald-100 group-hover:text-emerald-600'
                  }`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-sm leading-tight">Otomatis (TriPay)</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">VA & Retail</p>
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
                  className="space-y-4"
                >
                  {(globalSettings?.paymentMethods?.manual?.accounts?.length > 0 ? globalSettings.paymentMethods.manual.accounts : [{
                    bankName: globalSettings?.paymentMethods?.manual?.bankName || 'BCA',
                    accountNumber: globalSettings?.paymentMethods?.manual?.accountNumber || '1234 5678 90',
                    accountHolder: globalSettings?.paymentMethods?.manual?.accountHolder || 'PT ZENTORY DIGITAL INDONESIA'
                  }]).map((account: any, index: number) => (
                    <div key={index} className="p-6 md:p-8 bg-gray-50 rounded-xl border border-gray-200/60 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-white rounded-xl border border-gray-200 flex items-center justify-center font-black text-xl text-indigo-700 uppercase shadow-sm shrink-0 overflow-hidden">
                            {(globalSettings?.bankLogos?.[account.bankName === 'Lainnya...' ? account.customBankName : account.bankName] || (globalSettings?.paymentMethods?.manual?.logoUrl && index === 0)) ? (
                              <img src={globalSettings?.bankLogos?.[account.bankName === 'Lainnya...' ? account.customBankName : account.bankName] || globalSettings.paymentMethods.manual.logoUrl} alt={account.bankName === 'Lainnya...' ? account.customBankName : account.bankName} className="w-full h-full object-contain p-2" />
                            ) : (
                              <span className="text-center px-1 text-sm font-bold text-gray-800 leading-tight">
                                {account.bankName === 'Lainnya...' ? account.customBankName : account.bankName}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Nomor Rekening</p>
                            <p className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight break-all">{account.accountNumber}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleCopy(account.accountNumber)}
                          className="p-3 bg-white hover:bg-indigo-50 border border-gray-200 rounded-xl transition-colors text-indigo-600 hover:text-indigo-700 shadow-sm shrink-0 self-start sm:self-center"
                          title="Salin nomor rekening"
                        >
                          {copied === account.accountNumber ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                      <div className="pt-6 border-t border-gray-200/80">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Atas Nama</p>
                        <p className="text-lg font-bold text-gray-900">{account.accountHolder}</p>
                      </div>
                    </div>
                  ))}
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 font-medium leading-relaxed">
                      Mohon sertakan <span className="font-black bg-amber-200/50 px-1 rounded">ID Tenant</span> Anda pada berita transfer untuk mempercepat proses verifikasi.
                    </p>
                  </div>
                </motion.div>
              ) : paymentMethod === 'qris' ? (
                <motion.div 
                  key="qris"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-6 md:p-8 bg-gray-50 rounded-xl border border-gray-200/60 flex flex-col items-center text-center space-y-6"
                >
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200/80">
                    {globalSettings?.paymentMethods?.manual?.qrisUrl ? (
                      <img src={globalSettings.paymentMethods.manual.qrisUrl} alt="QRIS" className="w-56 h-56 object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-56 h-56 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-xl">
                        <QrCode className="w-24 h-24 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-gray-900 tracking-tight mb-2">Scan QRIS Zyvora</h4>
                    <p className="text-sm text-gray-500 font-medium max-w-sm mx-auto">Mendukung semua aplikasi pembayaran digital yang memiliki fitur scan QRIS</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="tripay"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-6 md:p-8 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl text-white space-y-6 relative overflow-hidden shadow-lg shadow-emerald-900/20"
                >
                  <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                    <ShieldCheck className="w-48 h-48" />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6 relative z-10">
                    <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm self-start">
                      <Zap className="w-8 h-8 text-emerald-50" />
                    </div>
                    <div>
                      <h4 className="font-black text-2xl mb-1 text-white">Pembayaran Otomatis</h4>
                      <p className="text-sm text-emerald-100 font-medium">Virtual Account & Retail Terintegrasi</p>
                    </div>
                  </div>
                  <p className="text-sm text-emerald-50 leading-relaxed max-w-xl relative z-10 font-medium">
                    Anda akan diarahkan ke gerbang pembayaran aman TriPay. Pembayaran akan terverifikasi secara otomatis dalam hitungan detik setelah transaksi berhasil tanpa perlu konfirmasi manual.
                  </p>
                  <div className="flex flex-wrap gap-2 relative z-10 pt-4 border-t border-emerald-500/50">
                    {['BCA VA', 'MANDIRI VA', 'BNI VA', 'BRI VA', 'PERMATA', 'ALFAMART', 'INDOMARET'].map(bank => (
                      <span key={bank} className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg text-xs font-black text-emerald-50 border border-white/20">{bank}</span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="space-y-6 lg:sticky lg:top-8">
          <div className="bg-white p-6 md:p-8 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200/80 space-y-8 relative overflow-hidden">
            <div className="absolute h-1 w-full top-0 left-0 bg-gray-900" />
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Ringkasan Pesanan</h3>
            
            <div className="space-y-6">
              <div className="flex items-start justify-between p-5 bg-gray-50 rounded-xl border border-gray-200/60">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${planInfo.color} shadow-sm mt-0.5`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-gray-900 mb-1 leading-none">{planInfo.name}</h4>
                    <div className="flex flex-col gap-1 mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 w-fit">
                        {durationParam} HARI
                      </span>
                      <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Berlaku Sampai: <span className="text-gray-900">{expiryDateStr}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coupon Section */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center justify-between">
                  <span>Kupon Diskon</span>
                  <span className="text-gray-400 font-medium normal-case text-[10px]">(Opsional)</span>
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="MABARBARENG"
                    value={couponCodeInput}
                    onChange={e => setCouponCodeInput(e.target.value)}
                    disabled={!!appliedCoupon || isLoadingCoupon}
                    className="flex-1 min-w-0 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 uppercase font-mono font-bold text-sm transition-all focus:bg-white"
                  />
                  {!appliedCoupon ? (
                    <button 
                      onClick={handleApplyCoupon}
                      disabled={isLoadingCoupon || !couponCodeInput}
                      className="px-4 py-3 bg-gray-900 text-white rounded-xl font-bold border border-gray-900 hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all disabled:opacity-50 flex items-center justify-center shrink-0"
                    >
                      {isLoadingCoupon ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      ) : 'Terapkan'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => setAppliedCoupon(null)}
                      className="px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold border border-red-200 hover:bg-red-100 transition-all shrink-0"
                    >
                      Hapus
                    </button>
                  )}
                </div>
                {couponError && <p className="text-xs text-red-600 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {couponError}</p>}
                {couponSuccess && <p className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {couponSuccess}</p>}
              </div>

              <div className="space-y-4 pt-4 border-t border-dashed border-gray-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Subtotal</span>
                  <span className="text-gray-900 font-bold">{selectedPriceDisplay}</span>
                </div>
                
                {calculateDiscount() > 0 && (
                  <div className="flex justify-between items-center text-sm bg-emerald-50 p-2 rounded-lg -mx-2 px-2">
                    <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Diskon Kupon
                    </span>
                    <span className="text-emerald-700 font-black">- Rp {calculateDiscount().toLocaleString('id-ID')}</span>
                  </div>
                )}
                {appliedCoupon?.type === 'free_days' && (
                  <div className="flex justify-between items-center text-sm bg-indigo-50 p-2 rounded-lg -mx-2 px-2">
                    <span className="text-indigo-700 font-bold flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      Bonus Free Days
                    </span>
                    <span className="text-indigo-700 font-black">+{appliedCoupon.value} Hari</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Biaya Layanan</span>
                  <span className="text-gray-900 font-bold">Rp 0</span>
                </div>
                
                <div className="pt-4 mt-2 border-t border-gray-200 flex justify-between items-end">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest pb-1">Total Pembayaran</p>
                  <div className="text-right">
                    <p className="text-3xl font-black text-gray-900 tracking-tighter">Rp {calculateFinalTotal().toLocaleString('id-ID')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 pt-4">
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <ShieldCheck className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                  Pembayaran aman dan terenkripsi. Dengan melanjutkan, Anda menyetujui <span className="font-bold text-gray-900 underline underline-offset-2">Syarat & Ketentuan</span> Zyvora.
                </p>
              </div>

              <button 
                onClick={handleConfirm}
                disabled={isProcessing}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-black text-lg hover:bg-gray-800 focus:ring-4 focus:ring-gray-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-3 shadow-lg shadow-gray-300/50"
              >
                {isProcessing ? (
                  <>
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                    <span>MEMPROSES...</span>
                  </>
                ) : (
                  <>
                    <span>KONFIRMASI BAYAR</span>
                    <ChevronRight className="w-5 h-5" />
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
