import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot, runTransaction, Timestamp, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Product, Customer, BankAccount, StockLog } from '../types';
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, User, Tag, Briefcase, X, ListOrdered, Barcode, Landmark, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import { logStockChange } from '../lib/stock-logger';

export default function SalesOrder() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');
  const [paymentMethodType, setPaymentMethodType] = useState<'tunai' | 'transfer'>('tunai');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [orderType, setOrderType] = useState<'manual' | 'service'>('manual');
  const [search, setSearch] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [isSettledToday, setIsSettledToday] = useState(false);

  useEffect(() => {
    if (!profile?.tenantId) return;
    
    const pQuery = query(collection(db, 'products'), where('tenantId', '==', profile.tenantId));
    const cQuery = query(collection(db, 'customers'), where('tenantId', '==', profile.tenantId));
    const bQuery = query(collection(db, 'bank_accounts'), where('tenantId', '==', profile.tenantId), where('isActive', '==', true));

    const unsubProducts = onSnapshot(pQuery, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }, (error) => {
      console.error('Error fetching products:', error);
    });

    const unsubCustomers = onSnapshot(cQuery, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    }, (error) => {
      console.error('Error fetching customers:', error);
    });

    const unsubBanks = onSnapshot(bQuery, async (snap) => {
      const banks = snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount));
      
      // Check if TUNAI account exists, if not create it
      let tunaiAccount = banks.find(b => b.name.toUpperCase() === 'TUNAI');
      
      if (!tunaiAccount && profile?.tenantId) {
        try {
          const newBankRef = await addDoc(collection(db, 'bank_accounts'), {
            tenantId: profile.tenantId,
            name: 'TUNAI',
            accountNumber: 'CASH',
            balance: 0,
            isActive: true,
            createdAt: serverTimestamp()
          });
          // The snapshot will trigger again with the new account
        } catch (err) {
          console.error('Error creating TUNAI account:', err);
        }
      }

      setBankAccounts(banks);
      
      // Auto-select bank account
      if (paymentMethodType === 'tunai' && tunaiAccount) {
        setSelectedBankAccountId(tunaiAccount.id);
      } else if (paymentMethodType === 'transfer' && banks.length > 0) {
        const firstNonTunai = banks.find(b => b.name.toUpperCase() !== 'TUNAI') || banks[0];
        setSelectedBankAccountId(firstNonTunai.id);
      }
    }, (error) => {
      console.error('Error fetching bank accounts:', error);
    });

    // Check if today is settled
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const settledQ = query(
      collection(db, 'dailyClosings'),
      where('tenantId', '==', profile.tenantId),
      where('date', '>=', Timestamp.fromDate(startOfDay)),
      where('date', '<=', Timestamp.fromDate(endOfDay)),
      limit(1)
    );

    const unsubSettled = onSnapshot(settledQ, (snap) => {
      setIsSettledToday(!snap.empty);
    }, (error) => {
      console.error('Error fetching settlement status:', error);
    });

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubBanks();
      unsubSettled();
    };
  }, [profile]);

  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeSearch.trim()) return;

    const product = products.find(p => p.barcode === barcodeSearch.trim() || p.sku === barcodeSearch.trim());
    if (product) {
      addToCart(product);
      setBarcodeSearch('');
    } else {
      // Optional: Add a sound or visual feedback for not found
      console.log('Product not found for barcode:', barcodeSearch);
      setBarcodeSearch('');
    }
  };

  const addToCart = (product: Product) => {
    if (orderType === 'manual' && product.stock <= 0) return;
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (orderType === 'manual' && existing.quantity >= product.stock) return;
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        if (orderType === 'manual' && newQty > item.product.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const setQuantity = (productId: string, value: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(0, value);
        if (orderType === 'manual' && newQty > item.product.stock) {
          return { ...item, quantity: item.product.stock };
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

  useEffect(() => {
    if (paymentType === 'cash') {
      setAmountPaid(total);
      if (cashReceived < total) {
        setCashReceived(total);
      }
    }
  }, [total, paymentType]);

  useEffect(() => {
    if (paymentMethodType === 'tunai') {
      const tunaiAccount = bankAccounts.find(b => b.name.toUpperCase() === 'TUNAI');
      if (tunaiAccount) setSelectedBankAccountId(tunaiAccount.id);
    }
  }, [paymentMethodType, bankAccounts]);

  const change = cashReceived - total;

  const generateOrderNumber = async (type: 'manual' | 'catalog' | 'service') => {
    const now = new Date();
    const yearMonth = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = type === 'manual' ? 'M' : type === 'catalog' ? 'IN' : '0J';
    
    // In a real app, you'd use a counter in Firestore to ensure uniqueness
    // For this demo, we'll use a random suffix or count existing orders
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('tenantId', '==', profile?.tenantId), where('type', '==', type));
    const snap = await getDocs(q);
    const sequence = (snap.size + 1).toString().padStart(6, '0');
    
    return `${prefix}${yearMonth}${sequence}`;
  };

  const currentCustomer = customers.find(c => c.id === selectedCustomer);
  const canUseTempo = currentCustomer?.type === 'langganan' && currentCustomer?.allowTempo;

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;

    if (isSettledToday) {
      alert('Buku hari ini sudah ditutup (Settled). Tidak dapat memproses pesanan baru.');
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Konfirmasi Pesanan',
      message: 'Apakah Anda yakin ingin memproses pesanan ini?',
      onConfirm: async () => {
        setConfirmConfig(null);
        setIsProcessing(true);
        try {
          const orderNumber = await generateOrderNumber(orderType);
          const customer = customers.find(c => c.id === selectedCustomer);
          
          const orderRef = doc(collection(db, 'orders'));
          const transactionRef = doc(collection(db, 'transactions'));

          // Calculate Due Date if credit
          let dueDate = null;
          if (paymentType === 'credit' && customer?.allowTempo) {
            const days = customer.tempoLimitDays || 30;
            const date = new Date();
            date.setDate(date.getDate() + days);
            dueDate = Timestamp.fromDate(date);
          }

          // Determine status based on payment
          const status = amountPaid >= total ? 'completed' : amountPaid > 0 ? 'processing' : 'pending';
          const paymentStatus = amountPaid >= total ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';

          await runTransaction(db, async (transaction) => {
            // 1. Read all necessary data first (Update stock for manual products)
            const productUpdates: { ref: any; newStock: number }[] = [];
            
            if (orderType === 'manual') {
              for (const item of cart) {
                const productRef = doc(db, 'products', item.product.id);
                const pDoc = await transaction.get(productRef);
                
                if (!pDoc.exists()) throw new Error(`Product ${item.product.name} not found`);
                
                const currentStock = pDoc.data().stock || 0;
                if (currentStock < item.quantity) throw new Error(`Stok ${item.product.name} tidak mencukupi`);
                
                productUpdates.push({
                  ref: productRef,
                  newStock: currentStock - item.quantity
                });
              }
            }

            // 2. Perform all writes after all reads
            for (const update of productUpdates) {
              transaction.update(update.ref, { stock: update.newStock });
              
              // Find item in cart to get name and quantity
              const item = cart.find(i => i.product.id === update.ref.id);
              if (item) {
                logStockChange(
                  profile?.tenantId!,
                  item.product.id,
                  item.product.name,
                  'SALE',
                  item.quantity,
                  item.product.stock,
                  update.newStock,
                  profile?.uid!,
                  profile?.displayName || 'System',
                  { id: orderRef.id, number: orderNumber },
                  'Sales Order'
                );
              }
            }

            // Create Order
            transaction.set(orderRef, {
              orderNumber,
              tenantId: profile?.tenantId,
              customerId: selectedCustomer || null,
              customerName: customer?.name || 'Guest',
              type: orderType,
              items: cart.map(item => ({
                productId: item.product.id,
                name: item.product.name,
                quantity: item.quantity,
                price: item.product.price,
                hpp: item.product.hpp || 0
              })),
              totalAmount: total,
              paidAmount: amountPaid,
              paymentStatus,
              paymentType,
              date: serverTimestamp(),
              dueDate,
              status: status,
              userId: profile?.uid,
              paymentMethod: selectedBankAccountId || null,
              createdAt: serverTimestamp()
            });

            // 3. Create Financial Transaction (only if there's an actual payment)
            if (amountPaid > 0) {
              transaction.set(transactionRef, {
                tenantId: profile?.tenantId,
                type: 'sale',
                category: 'Sales',
                amount: amountPaid, // Only record the actual amount paid
                totalOrderAmount: total,
                items: cart.map(item => ({
                  productId: item.product.id,
                  name: item.product.name,
                  quantity: item.quantity,
                  price: item.product.price,
                  hpp: item.product.hpp || 0
                })),
                date: serverTimestamp(),
                dueDate: paymentType === 'credit' ? dueDate : null,
                status: 'completed',
                userId: profile?.uid,
                orderNumber: orderNumber,
                bankAccountId: selectedBankAccountId || null,
                createdAt: serverTimestamp()
              });
            }
          });

          setLastOrderNumber(orderNumber);
          setShowSuccessModal(true);
          setIsCheckoutModalOpen(false);
          setCart([]);
          setSelectedCustomer('');
          setAmountPaid(0);
          setCashReceived(0);
        } catch (err: any) {
          console.error(err);
          alert(err.message || 'Gagal memproses pesanan.');
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-120px)] overflow-hidden lg:overflow-visible">
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px] lg:min-h-0">
        {isSettledToday && (
          <div className="p-4 bg-red-50 border-b border-red-100 flex items-center text-red-700 text-sm font-bold animate-pulse">
            <AlertCircle className="w-5 h-5 mr-2" />
            Buku hari ini sudah ditutup (Settled). Tidak dapat memproses pesanan baru.
          </div>
        )}
        <div className="p-4 lg:p-6 border-b border-gray-100 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg lg:text-xl font-bold text-gray-900">Buat Pesanan Baru</h2>
            <button
              onClick={() => navigate('/sales/receive')}
              className="flex items-center px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-xs lg:text-sm font-bold"
            >
              <ListOrdered className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Daftar Pesanan</span>
              <span className="sm:hidden">Daftar</span>
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
            <form onSubmit={handleBarcodeScan} className="flex-1 relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan Barcode / SKU..."
                value={barcodeSearch}
                onChange={(e) => setBarcodeSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 lg:py-3 bg-indigo-50 border border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300 text-sm"
              />
            </form>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 lg:py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 lg:gap-4">
            <button 
              onClick={() => setOrderType('manual')}
              className={`flex-1 py-2 rounded-lg text-xs lg:text-sm font-bold flex items-center justify-center border transition-all ${orderType === 'manual' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Tag className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
              Manual
            </button>
            <button 
              onClick={() => setOrderType('service')}
              className={`flex-1 py-2 rounded-lg text-xs lg:text-sm font-bold flex items-center justify-center border transition-all ${orderType === 'service' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Briefcase className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
              Service
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {products
              .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
              .filter(p => (p.type || 'manual') === orderType)
              .map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={orderType === 'manual' && product.stock <= 0}
                className="flex flex-col text-left group bg-white border border-gray-100 rounded-xl p-2 lg:p-3 hover:border-indigo-500 hover:shadow-md transition-all disabled:opacity-50"
              >
                <div className="aspect-square bg-gray-50 rounded-lg mb-2 lg:mb-3 overflow-hidden relative">
                  <img src={product.imageUrl || `https://picsum.photos/seed/${product.id}/200/200`} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  {orderType === 'manual' && product.stock <= 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-[8px] lg:text-[10px] font-bold text-white bg-red-600 px-2 py-1 rounded">OUT OF STOCK</span>
                    </div>
                  )}
                </div>
                <h4 className="text-xs lg:text-sm font-bold text-gray-900 truncate">{product.name}</h4>
                <div className="flex justify-between items-center mt-1 lg:mt-2">
                  <p className="text-indigo-600 font-extrabold text-xs lg:text-sm">Rp.{(product.price || 0).toLocaleString()}</p>
                  {orderType === 'manual' && <p className="text-[8px] lg:text-[10px] text-gray-500">{product.stock} left</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:h-[calc(100vh-120px)] lg:sticky lg:top-0">
        <div className="p-3 lg:p-4 border-b border-gray-100 space-y-3">
          <h3 className="text-base lg:text-lg font-bold flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2 text-indigo-600" />
            Order Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Select Customer</label>
              <select 
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs lg:text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Guest Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 min-h-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-2 py-8">
              <ShoppingCart className="w-8 h-8" />
              <p className="text-xs font-bold">Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-xs lg:text-sm font-bold text-gray-900 leading-tight mb-1">{item.product.name}</p>
                  <p className="text-[10px] lg:text-xs text-gray-500 font-medium">Rp.{(item.product.price || 0).toLocaleString()} x {item.quantity}</p>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"><Minus className="w-3 h-3 lg:w-4 lg:h-4" /></button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => setQuantity(item.product.id, parseInt(e.target.value) || 0)}
                    className="text-xs lg:text-sm font-black w-10 lg:w-12 text-center text-indigo-600 bg-gray-50 border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"><Plus className="w-3 h-3 lg:w-4 lg:h-4" /></button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 lg:p-4 bg-gray-50 border-t border-gray-100 space-y-3">
          <div className="flex justify-between text-lg lg:text-xl font-extrabold text-gray-900 pt-2">
            <span>Total</span>
            <span>Rp.{(total || 0).toLocaleString()}</span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsCheckoutModalOpen(true);
            }}
            disabled={cart.length === 0 || isProcessing}
            className="w-full bg-indigo-600 text-white py-3 lg:py-4 rounded-xl font-bold text-base lg:text-lg hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50 shadow-lg shadow-indigo-200 active:scale-95"
          >
            <CreditCard className="w-5 h-5 lg:w-6 lg:h-6 mr-2" />
            Checkout
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[650px] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
                <h3 className="text-xl font-bold flex items-center">
                  <CreditCard className="w-6 h-6 mr-2" />
                  Pembayaran
                </h3>
                <button
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Metode Pembayaran</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentMethodType('tunai')}
                      className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all flex flex-col items-center justify-center gap-2 ${paymentMethodType === 'tunai' ? 'bg-green-50 text-green-600 border-green-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                    >
                      <Landmark className="w-6 h-6" />
                      Tunai
                    </button>
                    <button
                      onClick={() => setPaymentMethodType('transfer')}
                      className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all flex flex-col items-center justify-center gap-2 ${paymentMethodType === 'transfer' ? 'bg-blue-50 text-blue-600 border-blue-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                    >
                      <CreditCard className="w-6 h-6" />
                      Transfer
                    </button>
                  </div>
                </div>

                {paymentMethodType === 'transfer' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Pilih Bank</label>
                    <select 
                      value={selectedBankAccountId}
                      onChange={(e) => setSelectedBankAccountId(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      {bankAccounts.filter(b => b.name.toUpperCase() !== 'TUNAI').map(b => (
                        <option key={b.id} value={b.id}>{b.name} {b.accountNumber ? `(${b.accountNumber})` : ''}</option>
                      ))}
                      {bankAccounts.filter(b => b.name.toUpperCase() !== 'TUNAI').length === 0 && (
                        <option value="">Belum ada rekening bank</option>
                      )}
                    </select>
                  </motion.div>
                )}

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Tipe Transaksi</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPaymentType('cash')}
                      className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all ${paymentType === 'cash' ? 'bg-indigo-50 text-indigo-600 border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                    >
                      Lunas
                    </button>
                    <button
                      onClick={() => {
                        if (canUseTempo) {
                          setPaymentType('credit');
                        }
                      }}
                      disabled={!canUseTempo}
                      className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all ${paymentType === 'credit' ? 'bg-indigo-50 text-indigo-600 border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-100'} ${!canUseTempo ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Tempo
                    </button>
                  </div>
                  {!canUseTempo && selectedCustomer && (
                    <p className="text-[10px] text-red-500 font-bold mt-1">
                      * Pelanggan ini tidak diizinkan untuk pembayaran Tempo.
                    </p>
                  )}
                  {!selectedCustomer && (
                    <p className="text-[10px] text-orange-500 font-bold mt-1">
                      * Pilih pelanggan Langganan untuk mengaktifkan pembayaran Tempo.
                    </p>
                  )}
                </div>

                {paymentType === 'cash' && paymentMethodType === 'tunai' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Uang Diterima (Bayar)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                        <input
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(Number(e.target.value))}
                          className="w-full pl-12 pr-4 py-3 bg-green-50 border-2 border-green-100 rounded-2xl text-lg font-black text-green-900 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kembalian</span>
                      <span className={`text-xl font-black ${change >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                        Rp.{change.toLocaleString()}
                      </span>
                    </div>
                  </motion.div>
                )}

                {paymentType === 'credit' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Amount Paid (DP)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                      <input
                        type="number"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(Number(e.target.value))}
                        className="w-full pl-12 pr-4 py-3 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-lg font-black text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    {amountPaid < total && (
                      <p className="text-xs text-red-500 font-bold text-right">
                        Sisa: Rp.{(total - amountPaid).toLocaleString()}
                      </p>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Tagihan</span>
                  <span className="text-2xl font-black text-gray-900">Rp.{total.toLocaleString()}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={isProcessing || (paymentType === 'cash' && paymentMethodType === 'tunai' && cashReceived < total)}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50 shadow-xl shadow-indigo-100 active:scale-95"
                >
                  {isProcessing ? (
                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin mr-3" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 mr-3" />
                  )}
                  {isProcessing ? 'Memproses...' : 'Simpan Pesanan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[650px] overflow-hidden text-center p-10"
            >
              <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingCart className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Pesanan Berhasil!</h3>
              <p className="text-gray-500 font-medium mb-8">
                Order <span className="text-indigo-600 font-bold">#{lastOrderNumber}</span> telah berhasil diproses dan stok telah diperbarui.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/sales/receive');
                  }}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Lihat Daftar Pesanan
                </button>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-4 bg-gray-50 text-gray-500 rounded-xl font-bold hover:bg-gray-100 transition-all"
                >
                  Buat Pesanan Baru
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
