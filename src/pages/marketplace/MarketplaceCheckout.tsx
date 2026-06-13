import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, MapPin, CreditCard, CheckCircle2, ChevronRight, Minus, Plus, Trash2, ArrowLeft, Tag, Gift, X, MessageSquare, Copy, CheckCheck } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, runTransaction } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../hooks/useAuth';
import { Tenant } from '../../types';
import { sendCatalogOrderNotification } from '../../lib/fonnte';

export default function MarketplaceCheckout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { cart, cartTotal, totalItems, updateQuantity, removeFromCart, clearCart, isCartOpen, setIsCartOpen } = useCart();
  const { user, profile, loading } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  
  const isBookingTheme = tenant?.catalogTheme === 'booking-v1';

  const STEPS = [
    { id: 1, label: 'Cart', icon: ShoppingCart },
    { id: 2, label: isBookingTheme ? 'Order Details' : 'Address', icon: MapPin },
    { id: 3, label: 'Payment', icon: CreditCard },
    { id: 4, label: 'Confirmation', icon: CheckCircle2 }
  ];

  const getBasePath = () => {
    if (tenant?.catalogTheme === 'booking-v1') return 'booking';
    if (tenant?.catalogTheme === 'v1') return 'marketplace';
    return 'catalog';
  };

  useEffect(() => {
    if (!loading && (!user || user.isAnonymous)) {
      const basePath = getBasePath();
      navigate(`/${basePath}/${tenantSlug}/auth?redirect=${encodeURIComponent(`/${basePath}/${tenantSlug}/checkout`)}`);
    }
  }, [user, loading, navigate, tenantSlug, tenant]);
  
  // Form State
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressData, setAddressData] = useState(() => {
    const saved = localStorage.getItem('checkout_customer_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          bookingDate: parsed.bookingDate || new Date().toISOString().split('T')[0],
          bookingTime: parsed.bookingTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
        };
      } catch (e) {
        console.error('Failed to parse checkout_customer_data', e);
      }
    }
    return {
      name: profile?.displayName || '',
      phone: '',
      address: profile?.addressDetails?.detail || profile?.address || '',
      province: profile?.addressDetails?.province || '',
      city: profile?.addressDetails?.city || '',
      district: profile?.addressDetails?.district || '',
      village: profile?.addressDetails?.village || '',
      postalCode: profile?.addressDetails?.postalCode || '',
      shareLocation: '',
      pack: '',
      bookingDate: new Date().toISOString().split('T')[0],
      bookingTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
    };
  });

  useEffect(() => {
    localStorage.setItem('checkout_customer_data', JSON.stringify(addressData));
  }, [addressData]);

  // Region API States
  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);

  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [selectedVillageId, setSelectedVillageId] = useState('');

  useEffect(() => {
    fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json')
      .then(res => res.json())
      .then(data => setProvinces(data))
      .catch(console.error);
  }, []);

  const fetchCities = (provinceId: string) => {
    if (!provinceId) return;
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provinceId}.json`)
      .then(res => res.json())
      .then(data => setCities(data))
      .catch(console.error);
  };

  const fetchDistricts = (cityId: string) => {
    if (!cityId) return;
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${cityId}.json`)
      .then(res => res.json())
      .then(data => setDistricts(data))
      .catch(console.error);
  };

  const fetchVillages = (districtId: string) => {
    if (!districtId) return;
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${districtId}.json`)
      .then(res => res.json())
      .then(data => setVillages(data))
      .catch(console.error);
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const name = e.target.options[e.target.selectedIndex].text;
    setSelectedProvinceId(id);
    setSelectedCityId('');
    setSelectedDistrictId('');
    setSelectedVillageId('');
    setCities([]);
    setDistricts([]);
    setVillages([]);
    
    setAddressData({ ...addressData, province: id ? name : '', city: '', district: '', village: '' });
    
    if (id) {
      fetchCities(id);
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const name = e.target.options[e.target.selectedIndex].text;
    setSelectedCityId(id);
    setSelectedDistrictId('');
    setSelectedVillageId('');
    setDistricts([]);
    setVillages([]);
    
    setAddressData({ ...addressData, city: id ? name : '', district: '', village: '' });
    
    if (id) {
      fetchDistricts(id);
    }
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const name = e.target.options[e.target.selectedIndex].text;
    setSelectedDistrictId(id);
    setSelectedVillageId('');
    setVillages([]);
    
    setAddressData({ ...addressData, district: id ? name : '', village: '' });
    
    if (id) {
      fetchVillages(id);
    }
  };

  const handleVillageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const name = e.target.options[e.target.selectedIndex].text;
    setSelectedVillageId(id);
    
    setAddressData({ ...addressData, village: id ? name : '' });
  };

  // Sync province -> cities initialization
  useEffect(() => {
    if (addressData.province && provinces.length > 0 && cities.length === 0 && !selectedProvinceId) {
      const p = provinces.find(x => x.name.toLowerCase() === addressData.province.toLowerCase());
      if (p) {
        setSelectedProvinceId(p.id);
        fetchCities(p.id);
      }
    }
  }, [addressData.province, provinces]);

  // Sync city -> districts initialization
  useEffect(() => {
    if (addressData.city && cities.length > 0 && districts.length === 0 && !selectedCityId) {
      const c = cities.find(x => x.name.toLowerCase() === addressData.city.toLowerCase());
      if (c) {
        setSelectedCityId(c.id);
        fetchDistricts(c.id);
      }
    }
  }, [addressData.city, cities]);

  // Sync district -> villages initialization
  useEffect(() => {
    if (addressData.district && districts.length > 0 && villages.length === 0 && !selectedDistrictId) {
      const d = districts.find(x => x.name.toLowerCase() === addressData.district.toLowerCase());
      if (d) {
        setSelectedDistrictId(d.id);
        fetchVillages(d.id);
      }
    }
  }, [addressData.district, districts]);

  useEffect(() => {
    if (addressData.village && villages.length > 0 && !selectedVillageId) {
      const v = villages.find(x => x.name.toLowerCase() === addressData.village.toLowerCase());
      if (v) {
        setSelectedVillageId(v.id);
      }
    }
  }, [addressData.village, villages]);

  useEffect(() => {
    if (profile) {
      setAddressData(prev => {
        let defaultName = profile.displayName || '';
        let defaultPhone = '';
        
        // Try to get exact details from main address if available in profile.addresses
        if (profile.addresses && profile.addresses.length > 0) {
          const mainAddress = profile.addresses.find(a => a.isMain) || profile.addresses[0];
          defaultName = mainAddress.receiverName || defaultName;
          defaultPhone = mainAddress.phone || defaultPhone;
        }

        return {
          ...prev,
          name: prev.name || defaultName,
          phone: prev.phone || defaultPhone,
          address: prev.address || profile.addressDetails?.detail || profile.address || '',
          province: prev.province || profile.addressDetails?.province || '',
          city: prev.city || profile.addressDetails?.city || '',
          district: prev.district || profile.addressDetails?.district || '',
          village: prev.village || profile.addressDetails?.village || '',
          postalCode: prev.postalCode || profile.addressDetails?.postalCode || '',
          pack: (prev as any).pack || ''
        };
      });
    }
  }, [profile]);
  
  const [paymentMethod, setPaymentMethod] = useState('whatsapp');
  const [paymentType, setPaymentType] = useState<'dp' | 'full'>('dp');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [finalOrderTotal, setFinalOrderTotal] = useState(0);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  const handleCopyAccount = (accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber);
    setCopiedAccount(accountNumber);
    setTimeout(() => {
      setCopiedAccount(null);
    }, 2000);
  };

  const hasAddress = !!addressData.address && !!addressData.city && !!addressData.province && !!addressData.district && !!addressData.village && (!isBookingTheme || !!addressData.shareLocation);

  // Down Payment Logic
  const downPaymentSettings = tenant?.paymentMethods?.downPayment;
  const isDownPaymentOptionAvailable = isBookingTheme && downPaymentSettings?.isEnabled;
  let downPaymentAmount = 0;
  
  if (isDownPaymentOptionAvailable && downPaymentSettings) {
    if (downPaymentSettings.type === 'percentage') {
      downPaymentAmount = (cartTotal * (downPaymentSettings.amount || 0)) / 100;
    } else if (downPaymentSettings.type === 'fixed') {
      downPaymentAmount = downPaymentSettings.amount || 0;
    }
  }
  
  const isDownPaymentApplied = isDownPaymentOptionAvailable && paymentType === 'dp';
  const paymentAmountToProcess = isDownPaymentApplied ? downPaymentAmount : cartTotal;

  useEffect(() => {
    fetchTenant();
    // Pre-close drawer if it was open
    if (isCartOpen) setIsCartOpen(false);
  }, [tenantSlug]);

  React.useEffect(() => {
    // If cart is empty and we are on step 1, redirect back after a delay
    if (cart.length === 0 && currentStep === 1) {
       // do nothing or show empty cart
    }
  }, [cart, currentStep]);

  const fetchTenant = async () => {
    try {
      const q = query(collection(db, 'tenants'), where('slug', '==', tenantSlug));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setTenant({ id: snap.docs[0].id, ...snap.docs[0].data() } as Tenant);
      }
    } catch (error) {
      console.error('Error fetching tenant:', error);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 2) {
      if (!addressData.name || !addressData.phone || !addressData.address || !addressData.district || !addressData.village || !addressData.city || !addressData.province || (isBookingTheme && !addressData.shareLocation)) {
        alert(isBookingTheme ? 'Mohon lengkapi seluruh field yang wajib diisi termasuk Link Google Maps.' : 'Mohon lengkapi seluruh field alamat yang wajib diisi.');
        return;
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handlePlaceOrder = async () => {
    if (!tenant) return;
    
    setIsSubmitting(true);
    let generatedOrderNumber = '';
    let finalOrderId = '';
    const stockLogsToProcess: any[] = [];

    try {
      await runTransaction(db, async (transaction) => {
        // 1. READS
        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const counterRef = doc(db, 'counters', `${tenant.id}_orders_${yearMonth}`);
        const counterDoc = await transaction.get(counterRef);
        
        const productDocs: { ref: any, productName: string, productId: string, requestedQty: number, data: any }[] = [];
        for (const item of cart) {
          const productRef = doc(db, 'products', item.product.id);
          const pDoc = await transaction.get(productRef);
          if (!pDoc.exists()) throw new Error(`Produk ${item.product.name} tidak ditemukan.`);
          productDocs.push({
            ref: productRef,
            productId: item.product.id,
            productName: item.product.name,
            requestedQty: item.quantity,
            data: pDoc.data()
          });
        }

        // 2. CALCULATIONS
        let sequence = 1;
        if (counterDoc.exists()) {
          sequence = (counterDoc.data().sequence || 0) + 1;
        }

        generatedOrderNumber = `IN${yearMonth}${String(sequence).padStart(6, '0')}`;

        const productsToUpdate: { ref: any, currentStock: number, newStock: number, name: string, productId: string }[] = [];
        for (const pInfo of productDocs) {
          if (pInfo.data.type !== 'service' && !isBookingTheme && pInfo.data.type !== 'booking') {
            const currentStock = pInfo.data.stock || 0;
            if (currentStock < pInfo.requestedQty) {
              throw new Error(`Stok produk ${pInfo.productName} tidak mencukupi (Tersisa: ${currentStock}).`);
            }
            productsToUpdate.push({
              ref: pInfo.ref,
              productId: pInfo.productId,
              name: pInfo.productName,
              currentStock: currentStock,
              newStock: currentStock - pInfo.requestedQty
            });
            
            stockLogsToProcess.push({
              productId: pInfo.productId,
              name: pInfo.productName,
              qty: pInfo.requestedQty,
              prev: currentStock,
              curr: currentStock - pInfo.requestedQty
            });
          }
        }

        // 3. WRITES
        if (counterDoc.exists()) {
          transaction.update(counterRef, {
            sequence,
            updatedAt: serverTimestamp()
          });
        } else {
          transaction.set(counterRef, {
            tenantId: tenant.id,
            prefix: yearMonth,
            sequence: 1,
            updatedAt: serverTimestamp()
          });
        }

        for (const pUpdate of productsToUpdate) {
          transaction.update(pUpdate.ref, { stock: pUpdate.newStock });
        }

        const newOrderRef = doc(collection(db, 'orders'));
        finalOrderId = newOrderRef.id;
        
        transaction.set(newOrderRef, {
          tenantId: tenant.id,
          orderNumber: generatedOrderNumber,
          customerName: addressData.name,
          customerInfo: addressData,
          items: cart.map(item => ({
            productId: item.product.id,
            name: item.product.name,
            price: item.product.price,
            quantity: item.quantity,
            hpp: item.product.hpp || 0
          })),
          paymentMethod,
          paymentType: isDownPaymentOptionAvailable ? paymentType : 'full',
          paymentStatus: 'unpaid',
          totalAmount: cartTotal,
          downPaymentAmount: isDownPaymentApplied ? downPaymentAmount : 0,
          totalItems,
          status: 'pending',
          type: 'catalog',
          userId: profile?.uid || auth.currentUser?.uid || null,
          createdAt: serverTimestamp(),
          date: serverTimestamp()
        });

        if (isBookingTheme) {
          const bookingRef = doc(collection(db, 'payment_corrections'));
          transaction.set(bookingRef, {
            tenantId: tenant.id,
            docType: 'booking',
            customerName: addressData.name,
            customerPhone: addressData.phone,
            customerInfo: addressData,     
            invoiceNumber: generatedOrderNumber,
            totalAmount: cartTotal,
            paymentType: isDownPaymentOptionAvailable ? paymentType : 'full',
            paymentStatus: 'unpaid',
            downPaymentAmount: isDownPaymentApplied ? downPaymentAmount : 0,
            bookingDate: addressData.bookingDate || new Date().toISOString().split('T')[0],
            bookingTime: addressData.bookingTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }),
            serviceName: cart.length > 0 ? cart[0].product.name : 'Booking Layanan',
            items: cart.map(item => ({
              productId: item.product.id,
              name: item.product.name,
              price: item.product.price,
              quantity: item.quantity
            })),
            status: 'pending',
            userId: profile?.uid || auth.currentUser?.uid || null,
            createdAt: serverTimestamp()
          });
        }
      });
      
      // Post transaction actions
      setOrderId(generatedOrderNumber);
      // Set final order total depending on down payment
      setFinalOrderTotal(isDownPaymentApplied ? paymentAmountToProcess : cartTotal);

      // Async stock logging (doesn't block UI progression)
      import('../../lib/stock-logger').then(({ logStockChange }) => {
        for (const log of stockLogsToProcess) {
          logStockChange(
            tenant.id,
            log.productId,
            log.name,
            'SALE',
            log.qty,
            log.prev,
            log.curr,
            profile?.uid || auth.currentUser?.uid || 'CUSTOMER',
            profile?.displayName || addressData.name || 'System',
            { id: finalOrderId, number: generatedOrderNumber },
            `Checkout Marketplace V1`
          ).catch(e => console.error("Error logging stock", e));
        }
      }).catch(e => console.error("Error importing stock logger", e));
      
      if (paymentMethod === 'whatsapp') {
        const phoneNumber = tenant?.settings?.phone || tenant?.phone;
        if (phoneNumber) {
          let message = `Halo ${tenant?.name},\nSaya telah membuat pesanan dengan Nomor: *${generatedOrderNumber}*\n\n`;
          message += `*Detail Pengiriman:*\nNama: ${addressData.name}\nNo. HP: ${addressData.phone}\n`;
          if (isBookingTheme && addressData.bookingDate) {
             message += `Jadwal: ${new Date(addressData.bookingDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})} ${addressData.bookingTime}\n`;
          }
          message += `Alamat: ${addressData.address}, Desa/Kel ${addressData.village}, Kec. ${addressData.district}, ${addressData.city}, ${addressData.province} ${addressData.postalCode}\n\n`;
          message += `*Pesanan:*\n`;
          cart.forEach((item, index) => {
             message += `${index + 1}. *${item.product.name}* (${item.quantity}x)\n`;
          });
          if (isDownPaymentApplied) {
             message += `\n*Total Layanan: Rp ${cartTotal.toLocaleString('id-ID')}*\n`;
             message += `*Uang Muka (DP): Rp ${paymentAmountToProcess.toLocaleString('id-ID')}*\n\n`;
          } else {
             message += `\n*Total Tagihan: Rp ${cartTotal.toLocaleString('id-ID')}*\n\n`;
          }
          message += `Mohon info pembayarannya. Terima kasih!`;
          window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
        }
      }
      
      const tenantPhone = (tenant as any)?.whatsapp || tenant?.settings?.phone || tenant?.phone;
      if (tenantPhone) {
         let productsStr = cart.map(item => item.product.name).join(', ');
         let qtyStr = cart.map(item => item.quantity).join(', ');
         sendCatalogOrderNotification(tenantPhone, {
           nama_tenant: tenant?.name || '',
           nama_customer: addressData.name,
           produk: productsStr,
           qty: qtyStr,
           total: `Rp ${cartTotal.toLocaleString('id-ID')}`,
           tanggal_order: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
           nomor_customer: addressData.phone,
           link_dashboard: `${window.location.origin}/dashboard`
         }).catch(err => console.error("Fonnte order notification error:", err));
      }
      
      clearCart();
      setCurrentStep(4);
    } catch (error) {
      console.error('Error placing order:', error);
      alert(error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat pesanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Steps
  const renderStepIndicator = () => (
    <div className="w-full max-w-4xl mx-auto mb-8 px-4">
      <div className="flex items-center justify-between relative">
        {/* Connecting Lines */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-200 -z-10" />
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-600 -z-10 transition-all duration-300"
          style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
        />
        
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep >= step.id;
          const isCurrent = currentStep === step.id;
          
          return (
            <div key={step.id} className="flex flex-col items-center gap-2 bg-gray-50 px-2 sm:px-4">
              <div 
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                  isActive 
                    ? 'bg-indigo-600 border-indigo-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className={`text-xs sm:text-sm font-semibold ${
                isCurrent ? 'text-indigo-600' : isActive ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (loading || !user || user.isAnonymous) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center">
          <Link to={`/${getBasePath()}/${tenantSlug}`} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold hidden sm:inline">Kembali ke Toko</span>
          </Link>
          <div className="flex-1 text-center font-bold text-lg text-gray-900">
            {tenant?.name || 'Checkout'}
          </div>
          <div className="w-8 sm:w-32" />
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentStep === 4 ? (
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-8 sm:p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Pesanan Anda dengan nomor {orderId && <span className="font-bold text-indigo-600">#{orderId}</span>} telah diterima. 
            </p>

            {paymentMethod === 'manual' && tenant?.paymentMethods?.manual?.accounts && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8 text-left max-w-xl mx-auto">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  Informasi Pembayaran
                </h3>
                <p className="text-sm text-gray-600 mb-4">Silakan transfer sejumlah <strong className="text-indigo-600 text-lg">Rp {finalOrderTotal.toLocaleString('id-ID')}</strong> ke salah satu rekening berikut:</p>
                <div className="space-y-3">
                   {tenant.paymentMethods.manual.accounts.map((acc: any, idx: number) => (
                     <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900 text-lg">{acc.bankName}</p>
                          <p className="text-sm text-gray-500">a.n. {acc.accountHolder}</p>
                        </div>
                        <div className="text-right flex items-center justify-end gap-2">
                          <p className="font-mono font-bold text-gray-800 text-lg">{acc.accountNumber}</p>
                          <button
                            onClick={() => handleCopyAccount(acc.accountNumber)}
                            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500 hover:text-indigo-600"
                            title="Salin Nomor Rekening"
                          >
                            {copiedAccount === acc.accountNumber ? (
                              <CheckCheck className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                     </div>
                   ))}
                </div>
                {(tenant?.settings?.phone || tenant?.phone) && (
                   <div className="mt-6 flex flex-col items-center">
                     <p className="text-sm text-gray-500 mb-3 text-center">Setelah melakukan transfer, silakan konfirmasi pesanan Anda via WhatsApp.</p>
                     <a 
                       href={`https://wa.me/${tenant?.settings?.phone || tenant?.phone}?text=${encodeURIComponent(`Halo ${tenant.name},\nSaya telah melakukan pembayaran untuk pesanan nomor *${orderId}* sebesar Rp ${finalOrderTotal.toLocaleString('id-ID')}.\n\nBerikut bukti transfernya:`)}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-600 transition-colors"
                     >
                       <MessageSquare className="w-4 h-4" />
                       Konfirmasi Pembayaran
                     </a>
                   </div>
                )}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
               <Link 
                 to={`/${getBasePath()}/${tenantSlug}`}
                 className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors w-full sm:w-auto"
               >
                 Kembali Belanja
               </Link>
            </div>
          </div>
        ) : cart.length === 0 ? (
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
             <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingCart className="w-10 h-10 text-gray-400" />
             </div>
             <h2 className="text-2xl font-bold text-gray-900 mb-4">Keranjang Kosong</h2>
             <p className="text-gray-500 mb-8">Anda belum menambahkan produk ke dalam keranjang belanja.</p>
             <Link 
               to={`/${getBasePath()}/${tenantSlug}`}
               className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors inline-block"
             >
               Mulai Belanja
             </Link>
           </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-6">
              {/* Form Section */}
              <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-6">{isBookingTheme ? 'Detail Pemesan' : 'Detail Tagihan'}</h2>
                
                <div className="space-y-5">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">{isBookingTheme ? 'Nama' : 'Nama Lengkap'} *</label>
                       <input 
                         type="text" 
                         required
                         value={addressData.name}
                         onChange={e => setAddressData({...addressData, name: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                         placeholder="Misal: Budi Santoso"
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">No. Handphone / WhatsApp *</label>
                       <input 
                         type="text" 
                         required
                         value={addressData.phone}
                         onChange={e => setAddressData({...addressData, phone: e.target.value})}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                         placeholder="Misal: 08123456789"
                       />
                     </div>
                   </div>
                   
                   {isBookingTheme && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                       <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Pelaksanaan *</label>
                         <input 
                           type="date" 
                           required
                           value={addressData.bookingDate || ''}
                           onChange={e => setAddressData({...addressData, bookingDate: e.target.value})}
                           className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white" 
                         />
                       </div>
                       <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Waktu Pelaksanaan *</label>
                         <input 
                           type="time" 
                           required
                           value={addressData.bookingTime || ''}
                           onChange={e => setAddressData({...addressData, bookingTime: e.target.value})}
                           className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white" 
                         />
                       </div>
                     </div>
                   )}

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Provinsi *</label>
                       <select
                         required
                         value={selectedProvinceId || (provinces.find(p => p.name === addressData.province)?.id || '')}
                         onChange={handleProvinceChange}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                       >
                         <option value="">Pilih Provinsi</option>
                         {provinces.map(p => (
                           <option key={p.id} value={p.id}>{p.name}</option>
                         ))}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Kota / Kabupaten *</label>
                       <select
                         required
                         value={selectedCityId || (cities.find(c => c.name === addressData.city)?.id || '')}
                         onChange={handleCityChange}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                         disabled={!selectedProvinceId && !addressData.province}
                       >
                         <option value="">Pilih Kota/Kabupaten</option>
                         {cities.map(c => (
                           <option key={c.id} value={c.id}>{c.name}</option>
                         ))}
                       </select>
                     </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Kecamatan *</label>
                       <select
                         required
                         value={selectedDistrictId || (districts.find(d => d.name === addressData.district)?.id || '')}
                         onChange={handleDistrictChange}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                         disabled={!selectedCityId && !addressData.city}
                       >
                         <option value="">Pilih Kecamatan</option>
                         {districts.map(d => (
                           <option key={d.id} value={d.id}>{d.name}</option>
                         ))}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Desa / Kelurahan *</label>
                       <select
                         required
                         value={selectedVillageId || (villages.find(v => v.name === addressData.village)?.id || '')}
                         onChange={handleVillageChange}
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                         disabled={!selectedDistrictId && !addressData.district}
                       >
                         <option value="">Pilih Desa/Kelurahan</option>
                         {villages.map(v => (
                           <option key={v.id} value={v.id}>{v.name}</option>
                         ))}
                       </select>
                     </div>
                   </div>
                   
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">{isBookingTheme ? 'Alamat Pelaksanaan' : 'Alamat Jalan'} *</label>
                     <textarea 
                       rows={3}
                       required
                       value={addressData.address}
                       onChange={e => setAddressData({...addressData, address: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" 
                       placeholder="Nama jalan, RT/RW, Patokan"
                     />
                   </div>

                   {!isBookingTheme && (
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Kode Pos</label>
                       <input 
                         type="text"
                         value={addressData.postalCode}
                         onChange={e => setAddressData({...addressData, postalCode: e.target.value})} 
                         className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                         placeholder="Misal: 12345"
                       />
                     </div>
                   )}

                   {isBookingTheme && (
                     <>
                       <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Share Location (URL/Link Google Maps) *</label>
                         <input 
                           type="url"
                           required
                           value={addressData.shareLocation || ''}
                           onChange={e => setAddressData({...addressData, shareLocation: e.target.value})} 
                           className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                           placeholder="https://maps.google.com/..."
                         />
                       </div>
                       <div>
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Catatan Pesanan / Keterangan (Opsional)</label>
                         <textarea
                           rows={2}
                           value={(addressData as any).pack || ''}
                           onChange={e => setAddressData({...addressData, pack: e.target.value})} 
                           className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" 
                           placeholder="Catatan untuk penjual"
                         />
                       </div>
                     </>
                   )}
                </div>
              </div>
            </div>
            
            {/* Right Sidebar: Order Summary & Payment */}
            <div className="w-full lg:w-96 xl:w-[400px] shrink-0 space-y-6">
               <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900">Pesanan Anda</h3>
                  </div>

                  {/* Cart Items Summary */}
                  <div className="p-6 bg-gray-50/50 border-b border-gray-100">
                    <div className="space-y-4">
                      {cart.map(item => (
                        <div key={item.id} className="flex gap-4">
                           <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative shadow-sm">
                              {item.product.image || item.product.imageUrl ? (
                                <img src={item.product.image || item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                              ) : (
                                <ShoppingCart className="w-6 h-6 text-gray-300" />
                              )}
                              <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                {item.quantity}
                              </div>
                           </div>
                           <div className="flex-1 min-w-0 flex flex-col justify-center">
                             <div className="flex justify-between items-start gap-2">
                               <h4 className="text-sm font-semibold text-gray-800 line-clamp-2">{item.product.name}</h4>
                             </div>
                             <div className="text-sm font-bold text-gray-900 mt-1">Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}</div>
                           </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200 space-y-3 font-semibold text-sm text-gray-600">
                       <div className="flex justify-between">
                         <span>Subtotal</span>
                         <span className="text-gray-900">Rp {cartTotal.toLocaleString('id-ID')}</span>
                       </div>
                       <div className="flex justify-between">
                         <span>Pengiriman</span>
                         <span className="text-gray-900 text-right">Sesuai Alamat</span>
                       </div>
                       <div className="flex justify-between text-lg font-bold text-indigo-700 pt-3 border-t border-gray-200">
                         <span>Total</span>
                         <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
                       </div>
                       {isDownPaymentApplied && (
                         <div className="flex justify-between items-center text-sm font-bold text-indigo-700 bg-indigo-50 p-3 rounded-lg">
                           <span>Down Payment (DP)</span>
                           <span>Rp {paymentAmountToProcess.toLocaleString('id-ID')}</span>
                         </div>
                       )}
                    </div>
                  </div>

                  {/* Booking Payment Options */}
                  {isDownPaymentOptionAvailable && (
                    <div className="p-6 border-b border-gray-100">
                       <h4 className="font-bold text-gray-900 mb-4">Opsi Pembayaran Booking</h4>
                       <div className="grid grid-cols-2 gap-3">
                         <label className={`border flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-colors text-center ${paymentType === 'dp' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                           <input type="radio" name="payment_type" className="sr-only" checked={paymentType === 'dp'} onChange={() => setPaymentType('dp')} />
                           <span className="font-bold text-sm text-gray-900 mb-1 leading-tight">Down Payment</span>
                           <span className="text-sm text-indigo-600 font-bold">Rp {downPaymentAmount.toLocaleString('id-ID')}</span>
                         </label>
                         <label className={`border flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-colors text-center ${paymentType === 'full' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                           <input type="radio" name="payment_type" className="sr-only" checked={paymentType === 'full'} onChange={() => setPaymentType('full')} />
                           <span className="font-bold text-sm text-gray-900 mb-1 leading-tight">Bayar Penuh</span>
                           <span className="text-sm text-indigo-600 font-bold">Rp {cartTotal.toLocaleString('id-ID')}</span>
                         </label>
                       </div>
                    </div>
                  )}

                  {/* Payment Options */}
                  <div className="p-6">
                     <h4 className="font-bold text-gray-900 mb-4">Metode Pembayaran</h4>
                     <div className="space-y-3">
                       <label className={`border flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'whatsapp' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                         <div className="pt-0.5">
                           <input 
                             type="radio" 
                             name="payment_method" 
                             className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-600" 
                             checked={paymentMethod === 'whatsapp'} 
                             onChange={() => setPaymentMethod('whatsapp')} 
                           />
                         </div>
                         <div>
                           <div className="font-semibold text-gray-900 text-sm">WhatsApp / Langsung</div>
                           {paymentMethod === 'whatsapp' && (
                             <div className="text-xs text-gray-500 mt-1">Selesaikan pesanan dan konfirmasi lewat chat WhatsApp dengan toko.</div>
                           )}
                         </div>
                       </label>

                       {tenant?.paymentMethods?.manual?.isEnabled && tenant?.paymentMethods?.manual?.accounts?.length > 0 && (
                         <label className={`border flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'manual' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                           <div className="pt-0.5">
                             <input 
                               type="radio" 
                               name="payment_method" 
                               className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-600" 
                               checked={paymentMethod === 'manual'} 
                               onChange={() => setPaymentMethod('manual')} 
                             />
                           </div>
                           <div>
                             <div className="font-semibold text-gray-900 text-sm">Transfer Bank Pribadi</div>
                             {paymentMethod === 'manual' && (
                               <div className="text-xs text-gray-500 mt-1">Lakukan transfer bank ke rekening yang dipilih di langkah berikutnya.</div>
                             )}
                           </div>
                         </label>
                       )}
                     </div>

                     <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-500 mb-6">
                       Data pribadi Anda akan digunakan untuk memproses pesanan Anda, mendukung pengalaman Anda di situs web ini, dan tujuan lain yang wajar.
                     </div>

                     <button 
                       onClick={() => {
                          if (!addressData.name || !addressData.phone || !addressData.address || !addressData.district || !addressData.village || !addressData.city || !addressData.province || (isBookingTheme && !addressData.shareLocation)) {
                             alert(isBookingTheme ? 'Mohon lengkapi seluruh field yang wajib diisi termasuk Link Google Maps.' : 'Mohon lengkapi seluruh field alamat yang wajib diisi.');
                             return;
                          }
                          handlePlaceOrder();
                       }}
                       disabled={isSubmitting || cart.length === 0}
                       className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 text-base flex justify-center items-center gap-2"
                     >
                       {isSubmitting ? 'Memproses...' : 'Buat pesanan'}
                     </button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
