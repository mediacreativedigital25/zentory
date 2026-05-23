import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot, limit, orderBy, runTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useAuth } from '../hooks/useAuth';
import { Product, Customer, BankAccount } from '../types';
import { logStockChange } from '../lib/stock-logger';
import { 
  Package, 
  User, 
  Calendar, 
  Plus, 
  Minus,
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowLeft,
  Save,
  ShoppingBag,
  Landmark,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function SalesOrderV1() {
  const { profile, domainTenantId } = useAuth();
  const navigate = useNavigate();
  const targetTenantId = domainTenantId || profile?.tenantId;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerCodeSearch, setCustomerCodeSearch] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [remark, setRemark] = useState('');
  const [salesName, setSalesName] = useState(profile?.displayName || profile?.email || 'N/A');
  const [poNumber, setPoNumber] = useState('');
  const [cartItems, setCartItems] = useState<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    hpp: number;
  }[]>([]);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [isLoadingCoupon, setIsLoadingCoupon] = useState(false);
  
  const [productSearch, setProductSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');

  useEffect(() => {
    if (!targetTenantId) return;

    const customersQuery = query(collection(db, 'customers'), where('tenantId', '==', targetTenantId));
    const productsQuery = query(collection(db, 'products'), where('tenantId', '==', targetTenantId));
    const banksQuery = query(
      collection(db, 'bank_accounts'), 
      where('tenantId', '==', targetTenantId),
      where('isActive', '==', true)
    );
    const couponsQuery = query(
      collection(db, 'coupons'), 
      where('tenantId', '==', targetTenantId),
      where('isActive', '==', true)
    );

    const unsubCustomers = onSnapshot(customersQuery, (snap) => {
      const customerData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
      setCustomers(customerData);
    });

    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubBanks = onSnapshot(banksQuery, (snap) => {
      setBankAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
      setLoading(false);
    });

    const unsubCoupons = onSnapshot(couponsQuery, (snap) => {
      setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubCustomers();
      unsubProducts();
      unsubBanks();
      unsubCoupons();
    };
  }, [targetTenantId]);

  const addToCart = (product: Product) => {
    if (product.type !== 'service' && (product.stock || 0) <= 0) {
      alert(`Stok ${product.name} kosong.`);
      return;
    }

    const existing = cartItems.find(item => item.productId === product.id);
    if (existing) {
      const newQty = existing.quantity + 1;
      if (product.type !== 'service' && (product.stock || 0) < newQty) {
        alert(`Stok ${product.name} tidak mencukupi.`);
        return;
      }
      setCartItems(cartItems.map(item => 
        item.productId === product.id ? { ...item, quantity: newQty } : item
      ));
    } else {
      setCartItems([...cartItems, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price,
        hpp: product.hpp || 0
      }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCartItems(cartItems.filter(item => item.productId !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) return;
    const product = products.find(p => p.id === id);
    if (product && product.type !== 'service' && (product.stock || 0) < qty) {
      alert(`Stok ${product.name} tidak mencukupi.`);
      return;
    }
    setCartItems(cartItems.map(item => 
      item.productId === id ? { ...item, quantity: qty } : item
    ));
  };

  const handleCustomerCodeSearch = (code: string) => {
    setCustomerCodeSearch(code);
    const customer = customers.find(c => c.code?.toLowerCase() === code.toLowerCase());
    if (customer) {
      setSelectedCustomerId(customer.id);
    }
  };

  const handleCustomerSelect = (id: string, name: string = '') => {
    setSelectedCustomerId(id);
    const customer = customers.find(c => c.id === id);
    if (customer) {
      setCustomerCodeSearch(customer.code || '');
      setCustomerSearchTerm(name || customer.name);
    } else {
      setCustomerCodeSearch('');
      setCustomerSearchTerm('');
    }
    setIsCustomerDropdownOpen(false);
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const isTempoAllowed = selectedCustomer?.allowTempo || false;
  const tempoDays = selectedCustomer?.tempoLimitDays || 0;

  useEffect(() => {
    if (isTempoAllowed && tempoDays > 0) {
      const date = new Date();
      date.setDate(date.getDate() + tempoDays);
      setDueDate(date.toISOString().split('T')[0]);
    } else {
      setDueDate('');
    }
  }, [selectedCustomerId, isTempoAllowed, tempoDays]);

  
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const customerDiscountAmount = useMemo(() => {
    if (!selectedCustomer?.discount) return 0;
    return (subtotal * selectedCustomer.discount) / 100;
  }, [subtotal, selectedCustomer?.discount]);

  const couponDiscountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percentage') {
      return (subtotal * appliedCoupon.value) / 100;
    }
    return appliedCoupon.value;
  }, [appliedCoupon, subtotal]);

  const discountAmount = customerDiscountAmount + couponDiscountAmount;
  const totalAmount = Math.round(Math.max(0, subtotal - discountAmount));

  
  const handleApplyCoupon = async () => {
    const ptId = profile?.tenantId || '';
    if (!couponCodeInput.trim() || !ptId) return;
    setIsLoadingCoupon(true);
    setCouponError('');
    setCouponSuccess('');
    try {
      const code = couponCodeInput.toUpperCase().replace(/\s/g, '');
      const q = query(
        collection(db, 'coupons'),
        where('tenantId', '==', ptId),
        where('code', '==', code),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setCouponError('Kupon tidak valid atau sudah tidak aktif.');
        return;
      }

      const couponData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      
      // Validations
      const now = new Date();
      if (couponData.startDate && now < new Date(couponData.startDate)) {
        setCouponError('Kupon belum dimulai.');
        return;
      }
      if (couponData.endDate && now > new Date(couponData.endDate)) {
        setCouponError('Kupon sudah kadaluarsa.');
        return;
      }
      if (couponData.usageLimit > 0 && couponData.usedCount >= couponData.usageLimit) {
        setCouponError('Kupon sudah mencapai batas penggunaan.');
        return;
      }
      
      const currentSubtotal = cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

      if (currentSubtotal < couponData.minPurchase) {
        setCouponError(`Minimal pembelian Rp ${Math.round(couponData.minPurchase).toLocaleString('id-ID')}`);
        return;
      }
      
      if (couponData.category !== 'all') {
        const itemArray = cartItems;
        const hasValidCategory = itemArray.some((item: any) => (item.product?.category || item.category) === couponData.category);
        if (!hasValidCategory) {
          setCouponError('Kupon tidak berlaku untuk produk di keranjang Anda.');
          return;
        }
      }

      setAppliedCoupon(couponData);
      setCouponSuccess('Kupon berhasil diterapkan!');
    } catch (err) {
      console.error('Error applying coupon:', err);
      setCouponError('Gagal memeriksa kupon.');
    } finally {
      setIsLoadingCoupon(false);
    }
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTenantId || !profile) return;
    if (!selectedCustomerId) { alert('Pilih pelanggan terlebih dahulu.'); return; }
    if (cartItems.length === 0) { alert('Keranjang belanja masih kosong.'); return; }

    const isCash = !selectedCustomer?.allowTempo;
    if (isCash) {
      if (bankAccounts.length === 0) {
        alert('Harap atur akun bank/kas di menu Finance > Bank Accounts terlebih dahulu.');
        return;
      }
      setIsBankModalOpen(true);
    } else {
      processSubmit();
    }
  };

  const processSubmit = async (bankId?: string) => {
    if (!targetTenantId || !profile) return;

    const finalPaymentType = isTempoAllowed ? 'credit' : 'cash';
    let finalPaymentStatus = finalPaymentType === 'cash' ? 'paid' : 'unpaid';
    let actualPaidAmount = finalPaymentType === 'cash' ? totalAmount : 0;
    let finalStatus = finalPaymentType === 'cash' ? 'completed' : 'pending';

    setIsSubmitting(true);
    let generatedOrderNumber = '';
    const stockLogsToProcess: any[] = [];
    const orderRef = doc(collection(db, 'orders'));

    try {
      await runTransaction(db, async (transaction) => {
        // 1. READS FIRST
        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const counterRef = doc(db, 'counters', `${targetTenantId}_orders_${yearMonth}`);
        const counterDoc = await transaction.get(counterRef);
        
        const productDocs: { ref: any, productName: string, productId: string, requestedQty: number, data: Product }[] = [];
        for (const item of cartItems) {
          const productRef = doc(db, 'products', item.productId);
          const pDoc = await transaction.get(productRef);
          if (!pDoc.exists()) throw new Error(`Produk ${item.productName} tidak ditemukan.`);
          productDocs.push({
            ref: productRef,
            productId: item.productId,
            productName: item.productName,
            requestedQty: item.quantity,
            data: pDoc.data() as Product
          });
        }

        // 2. CALCULATIONS
        let sequence = 1;
        if (counterDoc.exists()) {
          sequence = (counterDoc.data().sequence || 0) + 1;
        }
        
        generatedOrderNumber = `IN${yearMonth}${String(sequence).padStart(6, '0')}`;
        const customer = customers.find(c => c.id === selectedCustomerId);

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

        // 3. WRITES LAST
        if (counterDoc.exists()) {
          transaction.update(counterRef, { 
            sequence,
            updatedAt: serverTimestamp()
          });
        } else {
          transaction.set(counterRef, { 
            tenantId: targetTenantId,
            prefix: yearMonth,
            sequence: 1,
            updatedAt: serverTimestamp()
          });
        }

        for (const pUpdate of productsToUpdate) {
          transaction.update(pUpdate.ref, { stock: pUpdate.newStock });
        }

        if (appliedCoupon) {
          const couponRef = doc(db, 'coupons', appliedCoupon.id);
          const cDoc = await transaction.get(couponRef);
          if (cDoc.exists()) {
            transaction.update(couponRef, { usedCount: (cDoc.data().usedCount || 0) + 1 });
          }
        }

        transaction.set(orderRef, {
          tenantId: targetTenantId,
          orderNumber: generatedOrderNumber,
          poNumber: poNumber || null,
          salesName: salesName,
          customerId: selectedCustomerId,
          customerName: customer?.name || 'Unknown',
          customerCode: customer?.code || '',
          type: 'manual',
          items: cartItems.map(item => ({
            productId: item.productId,
            name: item.productName,
            quantity: item.quantity,
            price: item.price,
            hpp: item.hpp
          })),
          totalAmount,
          discountAmount: discountAmount || 0,
          customerDiscountAmount: customerDiscountAmount || 0,
          couponDiscountAmount: couponDiscountAmount || 0,
          couponId: appliedCoupon?.id || null,
          couponCode: appliedCoupon?.code || null,
          paidAmount: actualPaidAmount,
          paymentStatus: finalPaymentStatus,
          paymentType: finalPaymentType,
          bankAccountId: bankId || null,
          status: finalStatus,
          remark: remark.trim().substring(0, 50),
          date: new Date(orderDate),
          dueDate: finalPaymentType === 'credit' && dueDate ? new Date(dueDate) : null,
          userId: profile.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      if (finalPaymentStatus === 'paid') {
         import('../lib/savings').then(({ processCustomerSavings }) => {
            processCustomerSavings({
               orderId: orderRef.id,
               orderTotal: totalAmount,
               customerId: selectedCustomerId,
               tenantId: targetTenantId || ''
            }).catch(err => console.error("Error processing savings", err));
         });
      }

      // 4. AFTER TRANSACTION: SLOGGING
      for (const log of stockLogsToProcess) {
        logStockChange(
          targetTenantId,
          log.productId,
          log.name,
          'SALE',
          log.qty,
          log.prev,
          log.curr,
          profile.uid,
          profile.displayName || 'System',
          { id: orderRef.id, number: generatedOrderNumber },
          `Sales Order V1`
        );
      }

      setShowSuccess(true);
      setTimeout(() => {
        navigate('/sales/receive');
      }, 2000);
    } catch (err: any) {
      console.error('Error saving order:', err);
      handleFirestoreError(err, OperationType.WRITE, 'orders/transaction', auth, profile);
    } finally {
      setIsSubmitting(false);
    }
  };


  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 5);

  if (loading) return <div className="p-8 text-center animate-pulse">Memuat data Sales V1...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-indigo-600" />
              Sales Order V1
            </h2>
            <p className="text-gray-500 font-medium">Input pesanan manual dengan cepat & fungsional.</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Main Form */}
        <div className="space-y-6">
          {/* Customer & Date */}
          <div className="bg-white p-8 rounded-md border border-gray-100 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <User className="w-3 h-3" />
                  Nama Sales
                </label>
                <input
                  type="text"
                  placeholder="Nama Sales"
                  value={salesName}
                  onChange={(e) => setSalesName(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans"
                />
              </div>

              <div className="space-y-2">
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <User className="w-3 h-3" />
                  Pilih Pelanggan
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari Pelanggan..."
                    value={customerSearchTerm}
                    onChange={(e) => {
                       setCustomerSearchTerm(e.target.value);
                       setIsCustomerDropdownOpen(true);
                       if (!e.target.value) {
                         setSelectedCustomerId('');
                         setCustomerCodeSearch('');
                       }
                    }}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsCustomerDropdownOpen(false), 200)}
                    className="w-full p-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans"
                  />
                  {isCustomerDropdownOpen && (
                     <div className="absolute top-full left-0 z-50 w-[300px] bg-white border border-gray-100 rounded-md mt-2 max-h-60 overflow-y-auto shadow-xl py-2">
                        {customers.filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase())).map(c => (
                            <div 
                               key={c.id} 
                               onClick={() => handleCustomerSelect(c.id, c.name)}
                               className="p-2 hover:bg-gray-50 cursor-pointer text-sm font-medium text-gray-700 transition-colors"
                            >
                               {c.name}
                            </div>
                        ))}
                        {customers.filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase())).length === 0 && (
                            <div className="p-2 text-sm text-gray-400 italic">Tidak ditemukan</div>
                        )}
                     </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-600">
                  Customer Code
                </label>
                <input
                  type="text"
                  placeholder="Kode Customer"
                  value={customerCodeSearch}
                  readOnly
                  className="w-full text-gray-400 outline-none cursor-not-allowed uppercase p-2 bg-white border border-gray-200 rounded-md text-sm font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-600">
                  No PO
                </label>
                <input
                  type="text"
                  placeholder="No PO (Opsional)"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full p-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                <label className="mb-2 flex items-center gap-2 text-orange-500 text-xs font-semibold text-gray-600">
                  <Clock className="w-3 h-3" />
                  Term Of Payment (TOP)
                </label>
                {!selectedCustomerId ? (
                  <div className="w-full p-2 bg-white border border-dashed border-gray-200 rounded-md text-[10px] font-medium text-gray-400 italic flex items-center justify-center">
                    Pilih pelanggan dahulu
                  </div>
                ) : isTempoAllowed ? (
                  <div className="space-y-3">
                    <div className="w-full p-2 bg-orange-50 border border-orange-100 rounded-md flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-tighter">Term Of Payment</span>
                        <span className="text-sm font-semibold text-orange-600">{tempoDays} Hari</span>
                      </div>
                      <span className="text-[10px] font-mono text-orange-400 font-medium bg-white px-2 py-1 rounded-md">CREDIT</span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Tanggal Jatuh Tempo</label>
                      <input
                        type="date"
                        value={dueDate}
                        readOnly
                        className="w-full text-gray-400 outline-none cursor-not-allowed p-2 bg-white border border-gray-200 rounded-md text-sm font-medium"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-full p-2 bg-emerald-50 border border-emerald-100 rounded-md flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Term Of Payment</span>
                      <span className="text-sm font-semibold text-emerald-600 uppercase">Cash</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-medium bg-white px-2 py-1 rounded-md">PAID</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="mb-2 flex items-center gap-2 text-indigo-500 text-xs font-semibold text-gray-600">
                  <Package className="w-3 h-3" />
                  Program Diskon (Kupon)
                </label>
                <select
                     value={appliedCoupon?.id || ''}
                     onChange={(e) => {
                         if (!e.target.value) {
                             setAppliedCoupon(null);
                             return;
                         }
                         const cp = coupons.find(c => c.id === e.target.value);
                         setAppliedCoupon(cp || null);
                     }}
                     className="w-full p-2 bg-indigo-50 border border-indigo-100 rounded-md text-sm font-medium text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans appearance-none cursor-pointer"
                  >
                     <option value="">-- Tidak Menggunakan Diskon --</option>
                     {coupons.map(c => (
                         <option key={c.id} value={c.id}>{c.code} - {c.type === 'percentage' ? `${c.value}%` : `Rp ${Math.round(c.value).toLocaleString('id-ID')}`}</option>
                     ))}
                </select>
                {customerDiscountAmount > 0 && (
                   <div className="mt-4 bg-emerald-50/50 p-2 border border-emerald-100 rounded-md flex items-center justify-between">
                     <div>
                       <h4 className="text-xs font-black text-emerald-700">Diskon Pelanggan ({selectedCustomer?.discount}%)</h4>
                       <p className="text-[10px] font-medium text-emerald-600/70">Otomatis diterapkan berdasarkan profil</p>
                     </div>
                   </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-50">
               <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 mb-1 ">Total Produk</p>
                  <div className="p-2 bg-gray-50 rounded-md text-base font-semibold text-gray-900">
                     {cartItems.length}
                  </div>
               </div>
               <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 mb-1 ">Total Item</p>
                  <div className="p-2 bg-gray-50 rounded-md text-base font-semibold text-gray-900">
                     {cartItems.reduce((s, i) => s + i.quantity, 0)}
                  </div>
               </div>
               <div className="space-y-2 relative h-full">
                  <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-600">
                    Remark / Keterangan (Maks 25 karakter)
                  </label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value.substring(0, 25))}
                    maxLength={25}
                    className="w-full p-2 bg-white border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium text-gray-700 resize-none h-full min-h-[80px]"
                    placeholder="Keterangan opsional..."
                  />
                  <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md">
                    <span className="text-[10px] font-medium text-gray-400">{remark.length}/25</span>
                  </div>
               </div>
            </div>
          </div>

          {/* Product Picker */}
          <div className="bg-white p-8 rounded-md border border-gray-100 shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-600">
                <Package className="w-3 h-3" />
                Cari & Tambah Produk
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ketik nama produk atau SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              {productSearch && (
                <div className="grid grid-cols-1 gap-2 p-2 bg-gray-50 rounded-md border border-gray-100">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { addToCart(p); setProductSearch(''); }}
                      className="flex items-center justify-between p-3 hover:bg-white rounded-md transition-all group"
                    >
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-gray-400 font-mono">{p.sku}</p>
                          {p.type !== 'service' && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              (p.stock || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              STOK: {p.stock || 0}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-indigo-600">Rp.{Math.round(p.price).toLocaleString('id-ID')}</span>
                        <Plus className="w-5 h-5 text-gray-300 group-hover:text-indigo-600 group-hover:rotate-90 transition-all" />
                      </div>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && <p className="p-3 text-xs text-gray-500">Produk tidak ditemukan.</p>}
                </div>
              )}
            </div>

            {/* Cart Table */}
            <div className="overflow-hidden border border-gray-100 rounded-md">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 mb-1">Produk</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 mb-1 text-center">Harga</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 mb-1 text-center">Qty</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 mb-1 text-right">Subtotal</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 mb-1 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cartItems.map(item => (
                    <tr key={item.productId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-gray-400 font-mono">
                            {products.find(p => p.id === item.productId)?.sku}
                          </p>
                          {products.find(p => p.id === item.productId)?.type !== 'service' && (
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">
                              STOK: {products.find(p => p.id === item.productId)?.stock || 0}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-medium text-gray-600">Rp.{Math.round(item.price).toLocaleString('id-ID')}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
                            <Minus className="w-3 h-3" />
                          </button>
                          <input 
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val)) updateQuantity(item.productId, val);
                            }}
                            className="text-sm font-medium text-gray-900 w-12 text-center bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-indigo-600">Rp.{Math.round(item.price * item.quantity).toLocaleString('id-ID')}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => removeFromCart(item.productId)} className="text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cartItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-gray-400 font-medium">Belum ada item ditambahkan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 p-6 rounded-md border border-amber-100 flex items-start gap-2">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 font-medium leading-relaxed">
            Pesanan V1 akan otomatis mengikuti setting pelanggan. Jika CASH maka status PAID, jika TEMPO maka status UNPAID.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {isBankModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-md">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Pilih Akun Kas/Bank</h3>
                    <p className="text-xs text-white/70 font-medium uppercase tracking-widest">Pembayaran Tunai (Cash)</p>
                  </div>
                </div>
                <button onClick={() => setIsBankModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="bg-amber-50 p-2 rounded-md border border-amber-100 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 font-medium leading-relaxed">
                    Pesanan ini dibayar tunai. Silakan pilih akun bank atau kas yang akan menerima dana ini.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="mb-1 text-xs font-semibold text-gray-600">Daftar Akun Aktif</label>
                  <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {bankAccounts.map((bank) => (
                      <button
                        key={bank.id}
                        onClick={() => setSelectedBankId(bank.id)}
                        className={`w-full p-2 rounded-md border-2 text-left transition-all flex items-center gap-2 group ${
                          selectedBankId === bank.id
                            ? 'border-indigo-600 bg-indigo-50 shadow-md'
                            : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                        }`}
                      >
                        <div className={`p-3 rounded-md transition-colors ${
                          selectedBankId === bank.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 group-hover:text-gray-600'
                        }`}>
                          <Landmark className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className={`font-black text-sm uppercase ${selectedBankId === bank.id ? 'text-indigo-900' : 'text-gray-700'}`}>
                            {bank.name}
                          </p>
                          <p className="text-[10px] font-medium text-gray-400">{bank.type} - {bank.accountNumber || 'No Acc'}</p>
                        </div>
                        {selectedBankId === bank.id && (
                          <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => setIsBankModalOpen(false)}
                    className="flex-1 py-4 border border-gray-200 rounded-md text-gray-600 font-medium hover:bg-white transition-all font-sans"
                  >
                    BATAL
                  </button>
                  <button
                    disabled={!selectedBankId || isSubmitting}
                    onClick={() => {
                      setIsBankModalOpen(false);
                      processSubmit(selectedBankId);
                    }}
                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-md font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Clock className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    KONFIRMASI & SIMPAN
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-white/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-4 border border-gray-100"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black text-gray-900">Pesanan Berhasil Disimpan!</h3>
              <p className="text-gray-500 font-medium">Mengalihkan ke halaman Sales Order Receive...</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-gray-200 p-2 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-6xl mx-auto flex flex-row items-center justify-between gap-2">
          <div className="flex gap-2 sm:gap-12 flex-1 w-full sm:w-auto">
             <div className="hidden sm:block">
                <p className="text-xs font-semibold text-gray-600 mb-1 text-left">Subtotal</p>
                <p className="text-lg font-black text-gray-500 text-left">Rp.{Math.round(subtotal).toLocaleString('id-ID')}</p>
             </div>
             <div className="hidden sm:block">
                <p className="text-xs font-semibold text-gray-600 mb-1 text-left">Diskon</p>
                <p className="text-lg font-black text-emerald-500 text-left">- Rp.{Math.round(discountAmount).toLocaleString('id-ID')}</p>
             </div>
             <div>
                <p className="text-xs font-semibold text-gray-600 mb-1 text-left">Netto {(appliedCoupon || customerDiscountAmount > 0) && <span className="hidden sm:inline text-emerald-500">(Dipotong Diskon)</span>}</p>
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                   <p className="text-2xl font-black text-indigo-600 text-left">Rp.{Math.round(totalAmount).toLocaleString('id-ID')}</p>
                   {discountAmount > 0 && <p className="text-xs font-medium text-emerald-500 sm:hidden">- Rp.{Math.round(discountAmount).toLocaleString('id-ID')} (Diskon)</p>}
                </div>
             </div>
          </div>
          <button
                disabled={isSubmitting || cartItems.length === 0}
                onClick={handlePreSubmit}
                className="w-auto px-6 sm:2 py-4 bg-indigo-600 text-white rounded-md font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {isSubmitting ? <Clock className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span className="hidden sm:inline">SIMPAN PESANAN</span>
                <span className="sm:hidden">SIMPAN</span>
          </button>
        </div>
      </div>
    </div>
  );
}
