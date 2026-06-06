import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, MapPin, CreditCard, CheckCircle2, ChevronRight, Minus, Plus, Trash2, ArrowLeft, Tag, Gift, X, MessageSquare, Copy, CheckCheck } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, runTransaction } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../hooks/useAuth';
import { Tenant } from '../../types';
import { sendCatalogOrderNotification } from '../../lib/fonnte';

const STEPS = [
  { id: 1, label: 'Cart', icon: ShoppingCart },
  { id: 2, label: 'Address', icon: MapPin },
  { id: 3, label: 'Payment', icon: CreditCard },
  { id: 4, label: 'Confirmation', icon: CheckCircle2 }
];

export default function MarketplaceCheckout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { cart, cartTotal, totalItems, updateQuantity, removeFromCart, clearCart, isCartOpen, setIsCartOpen } = useCart();
  const { user, profile } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  
  // Form State
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressData, setAddressData] = useState({
    name: profile?.displayName || '',
    phone: '',
    address: profile?.addressDetails?.detail || profile?.address || '',
    province: profile?.addressDetails?.province || '',
    city: profile?.addressDetails?.city || '',
    district: profile?.addressDetails?.district || '',
    village: profile?.addressDetails?.village || '',
    postalCode: profile?.addressDetails?.postalCode || ''
  });

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
          postalCode: prev.postalCode || profile.addressDetails?.postalCode || ''
        };
      });
    }
  }, [profile]);
  
  const [paymentMethod, setPaymentMethod] = useState('whatsapp');
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

  const hasAddress = !!addressData.address && !!addressData.city && !!addressData.province && !!addressData.district && !!addressData.village;

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
      if (!addressData.name || !addressData.phone || !addressData.address || !addressData.district || !addressData.village || !addressData.city || !addressData.province) {
        alert('Mohon lengkapi seluruh field alamat yang wajib diisi.');
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
          if (pInfo.data.type !== 'service') {
            const currentStock = pInfo.data.stock || 0;
            if (currentStock < pInfo.requestedQty) {
              throw new Error(`Stok ${pInfo.requestedQty} tidak mencukupi (Tersisa: ${currentStock}).`);
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
          paymentType: 'cash',
          paymentStatus: 'unpaid',
          totalAmount: cartTotal,
          totalItems,
          status: 'pending',
          type: 'catalog',
          userId: profile?.uid || null,
          createdAt: serverTimestamp(),
          date: serverTimestamp()
        });
      });
      
      // Post transaction actions
      setOrderId(generatedOrderNumber);
      setFinalOrderTotal(cartTotal);

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
            profile?.uid || 'CUSTOMER',
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
          message += `*Detail Pengiriman:*\nNama: ${addressData.name}\nNo. HP: ${addressData.phone}\nAlamat: ${addressData.address}, Desa/Kel ${addressData.village}, Kec. ${addressData.district}, ${addressData.city}, ${addressData.province} ${addressData.postalCode}\n\n`;
          message += `*Pesanan:*\n`;
          cart.forEach((item, index) => {
             message += `${index + 1}. *${item.product.name}* (${item.quantity}x)\n`;
          });
          message += `\n*Total Tagihan: Rp ${cartTotal.toLocaleString('id-ID')}*\n\n`;
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
      alert('Terjadi kesalahan saat membuat pesanan.');
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center">
          <Link to={`/marketplace/${tenantSlug}`} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold hidden sm:inline">Kembali ke Toko</span>
          </Link>
          <div className="flex-1 text-center font-bold text-lg text-gray-900">
            {tenant?.name || 'Checkout'}
          </div>
          <div className="w-8 sm:w-32" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderStepIndicator()}
        
        {currentStep === 1 && (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-100 flex items-start gap-3 mb-6">
                 <Tag className="w-5 h-5 shrink-0 mt-0.5" />
                 <div>
                   <h4 className="font-semibold">Available Offer</h4>
                   <p className="text-sm mt-1">Dapatkan diskon ongkos kirim ke seluruh Indonesia untuk pembelian pertama.</p>
                 </div>
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 mb-4">My Shopping Bag ({totalItems} Items)</h2>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {cart.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Keranjang kosong. <Link to={`/marketplace/${tenantSlug}`} className="text-indigo-600 underline">Ayo belanja!</Link>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 relative group">
                      <div className="w-24 h-24 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center overflow-hidden">
                         {item.product.image || item.product.imageUrl ? (
                            <img src={item.product.image || item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                         ) : (
                            <ShoppingCart className="w-8 h-8 text-gray-300" />
                         )}
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                         <div className="pr-8">
                           <h3 className="font-semibold text-gray-900 text-lg leading-snug mb-1">{item.product.name}</h3>
                           <p className="text-sm text-gray-500 mb-2">Sold by: <span className="text-indigo-600 font-medium">{tenant?.name}</span></p>
                           <div className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">In Stock</div>
                         </div>
                         <div className="mt-4 flex items-center gap-4">
                            <div className="flex items-center gap-1 bg-white border border-gray-300 rounded overflow-hidden">
                              <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600"><Minus className="w-4 h-4" /></button>
                              <input type="number" readOnly value={item.quantity} className="w-10 text-center text-sm font-semibold text-gray-900 bg-white" />
                              <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600"><Plus className="w-4 h-4" /></button>
                            </div>
                         </div>
                      </div>
                      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 text-right flex flex-col items-end gap-2">
                        <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                           <Trash2 className="w-5 h-5" />
                        </button>
                        <div className="text-lg font-bold text-indigo-600 mt-2">Rp {item.product.price.toLocaleString('id-ID')}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-6">
               <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-gray-900 font-bold mb-4 flex items-center gap-2"><Gift className="w-4 h-4 text-gray-500" /> Offer</h3>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Enter Promo Code" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    <button className="bg-indigo-100 text-indigo-700 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-indigo-200 transition-colors">Apply</button>
                  </div>
               </div>
               
               <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Price Details</h3>
                  <div className="space-y-3 text-sm">
                     <div className="flex justify-between text-gray-600">
                       <span>Bag Total</span>
                       <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
                     </div>
                     <div className="flex justify-between text-gray-600">
                       <span>Coupon Discount</span>
                       <span className="text-indigo-600 font-semibold cursor-pointer">Apply Coupon</span>
                     </div>
                     <div className="flex justify-between text-gray-600">
                       <span>Delivery Charges</span>
                       <span className="text-green-600 font-semibold">TBD</span>
                     </div>
                  </div>
                  <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between font-bold text-lg text-gray-900">
                     <span>Order Total</span>
                     <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
                  </div>
                  
                  <button 
                    onClick={handleNextStep}
                    disabled={cart.length === 0}
                    className="w-full mt-6 bg-indigo-600 text-white font-bold py-3.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Place Order
                  </button>
               </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
               <h2 className="text-xl font-bold text-gray-900 mb-6">Delivery Address</h2>
               <div className="space-y-4 max-w-2xl">
                 {hasAddress ? (
                  <div className="border border-gray-300 rounded-lg p-4 mb-4">
                     <div className="grid grid-cols-[120px_10px_1fr] gap-2 mb-2 text-sm text-gray-800">
                        <div className="font-semibold">Nama Penerima</div><div>:</div><div>{addressData.name}</div>
                        <div className="font-semibold">No Hp</div><div>:</div><div>{addressData.phone}</div>
                        <div className="font-semibold">Alamat</div><div>:</div><div>{addressData.address}, Desa/Kel {addressData.village}, Kec. {addressData.district}, {addressData.city}, {addressData.province} {addressData.postalCode}</div>
                     </div>
                     <div className="mt-4 flex justify-end">
                       <button onClick={() => setIsAddressModalOpen(true)} className="text-indigo-600 font-semibold text-sm hover:text-indigo-700">Ubah Alamat</button>
                     </div>
                  </div>
                 ) : (
                  <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg mb-6">
                    <p className="text-gray-500 mb-4">Belum ada alamat pengiriman</p>
                    <button onClick={() => setIsAddressModalOpen(true)} className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                      Tambah Alamat
                    </button>
                  </div>
                 )}
               </div>
               
               <div className="mt-8 flex items-center justify-between">
                 <button onClick={handlePrevStep} className="text-gray-500 hover:text-gray-900 font-semibold px-4 py-2 rounded-lg transition-colors border border-gray-200">
                   Back to Cart
                 </button>
                 <button onClick={handleNextStep} className="bg-indigo-600 text-white font-bold px-8 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-md">
                   Continue
                 </button>
               </div>
            </div>
            
            {/* Same Sidebar for Order Summary */}
            <div className="w-full lg:w-80 xl:w-96 shrink-0">
               <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
                  <div className="space-y-4 mb-6">
                    {cart.map(item => (
                      <div key={item.id} className="flex gap-3">
                         <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden shrink-0">
                            {item.product.image || item.product.imageUrl ? (
                              <img src={item.product.image || item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                <ShoppingCart className="w-5 h-5 text-gray-300" />
                              </div>
                            )}
                         </div>
                         <div className="flex-1">
                           <h4 className="text-sm font-semibold text-gray-800 line-clamp-1">{item.product.name}</h4>
                           <div className="text-xs text-gray-500 mt-0.5">Qty: {item.quantity}</div>
                           <div className="text-sm font-bold text-indigo-600 mt-0.5">Rp {item.product.price.toLocaleString('id-ID')}</div>
                         </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-gray-100 pt-4 flex justify-between font-bold text-lg text-gray-900">
                     <span>Total</span>
                     <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
                  </div>
               </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
               <h2 className="text-xl font-bold text-gray-900 mb-6">Payment Options</h2>
               
               <div className="space-y-4 max-w-2xl">
                 <div 
                   onClick={() => setPaymentMethod('whatsapp')}
                   className={`border-2 rounded-xl p-4 cursor-pointer transition-colors flex items-center gap-4 ${paymentMethod === 'whatsapp' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                 >
                   <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'whatsapp' ? 'border-indigo-600' : 'border-gray-300'}`}>
                     {paymentMethod === 'whatsapp' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                   </div>
                   <div className="flex-1">
                     <h4 className="font-semibold text-gray-900">WhatsApp Checkout</h4>
                     <p className="text-sm text-gray-500 mt-1">Selesaikan pembayaran & konfirmasi via chat WhatsApp ke penjual.</p>
                   </div>
                 </div>
                 
                 <div 
                   className="border-2 border-gray-100 rounded-xl p-4 flex items-center gap-4 bg-gray-50 opacity-60 relative overflow-hidden"
                 >
                   <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center"></div>
                   <div className="flex-1">
                     </div>
                  </div>
                  {tenant?.paymentMethods?.manual?.isEnabled && tenant?.paymentMethods?.manual?.accounts?.length > 0 && (
                    <div 
                      onClick={() => setPaymentMethod('manual')}
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-colors flex items-center gap-4 ${paymentMethod === 'manual' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'manual' ? 'border-indigo-600' : 'border-gray-300'}`}>
                        {paymentMethod === 'manual' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">Transfer Bank / Manual</h4>
                        <p className="text-sm text-gray-500 mt-1">Transfer langsung ke rekening toko dan konfirmasi manual.</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-8 flex items-center justify-between max-w-2xl">
                 <button onClick={handlePrevStep} className="text-gray-500 hover:text-gray-900 font-semibold px-4 py-2 rounded-lg transition-colors border border-gray-200">
                   Back to Address
                 </button>
               </div>
            </div>
            
            <div className="w-full lg:w-80 xl:w-96 shrink-0">
               <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Final Summary</h3>
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">Kirim Ke:</h4>
                    <p className="text-sm text-gray-600 font-medium">{addressData.name} ({addressData.phone})</p>
                    <p className="text-sm text-gray-600 mt-1">{addressData.address}</p>
                    <p className="text-sm text-gray-600">Desa/Kel {addressData.village}, Kec. {addressData.district}</p>
                    <p className="text-sm text-gray-600">{addressData.city}, {addressData.province}</p>
                    <p className="text-sm text-gray-600">{addressData.postalCode && `Kode Pos: ${addressData.postalCode}`}</p>
                  </div>
                  
                  <div className="border-t border-gray-100 pt-4 flex justify-between font-bold text-lg text-gray-900">
                     <span>Total</span>
                     <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
                  </div>
                  
                  <button 
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting}
                    className="w-full mt-6 bg-indigo-600 text-white font-bold py-3.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Memproses...' : 'Confirm Order'}
                  </button>
               </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
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
                       className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-600 transition-colors"
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
                 to={`/marketplace/${tenantSlug}`}
                 className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors w-full sm:w-auto"
               >
                 Kembali Belanja
               </Link>
            </div>
          </div>
        )}
      </main>

      {/* Address Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Alamat Pengiriman</h3>
              <button 
                onClick={() => setIsAddressModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap *</label>
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
                 
                 <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-1">Alamat Lengkap *</label>
                   <textarea 
                     rows={3}
                     required
                     value={addressData.address}
                     onChange={e => setAddressData({...addressData, address: e.target.value})}
                     className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" 
                     placeholder="Jalan, RT/RW, Patokan"
                   />
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Kota / Kabupaten *</label>
                     <input 
                       type="text"
                       required
                       value={addressData.city}
                       onChange={e => setAddressData({...addressData, city: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                       placeholder="Misal: Jakarta Selatan"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Provinsi *</label>
                     <input 
                       type="text"
                       required
                       value={addressData.province}
                       onChange={e => setAddressData({...addressData, province: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                       placeholder="Misal: DKI Jakarta"
                     />
                   </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Kecamatan *</label>
                     <input 
                       type="text"
                       required
                       value={addressData.district}
                       onChange={e => setAddressData({...addressData, district: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                       placeholder="Misal: Kebayoran Baru"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Desa / Kelurahan *</label>
                     <input 
                       type="text"
                       required
                       value={addressData.village}
                       onChange={e => setAddressData({...addressData, village: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" 
                       placeholder="Misal: Senayan"
                     />
                   </div>
                 </div>
                 
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
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
               <button 
                 onClick={() => setIsAddressModalOpen(false)}
                 className="px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300"
               >
                 Batal
               </button>
               <button 
                 onClick={() => {
                   if (!addressData.name || !addressData.phone || !addressData.address || !addressData.district || !addressData.village || !addressData.city || !addressData.province) {
                       alert('Mohon lengkapi seluruh field alamat yang wajib diisi.');
                       return;
                   }
                   setIsAddressModalOpen(false);
                 }}
                 className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
               >
                 Simpan Alamat
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
