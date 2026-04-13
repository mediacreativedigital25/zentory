import { useState, useEffect, useRef } from 'react';
import { collection, query, where, addDoc, serverTimestamp, increment, doc, updateDoc, onSnapshot, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Product, Transaction, StockLog, Customer, BankAccount, Tenant } from '../types';
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, User, Tag, X, Landmark, Printer, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import { logStockChange } from '../lib/stock-logger';

export default function Sales() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');
  const [paymentMethodType, setPaymentMethodType] = useState<'tunai' | 'transfer'>('tunai');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [printType, setPrintType] = useState<'invoice' | 'receipt' | null>(null);
  const [tenantInfo, setTenantInfo] = useState<Tenant | null>(null);

  useEffect(() => {
    if (profile?.tenantId) {
      getDoc(doc(db, 'tenants', profile.tenantId)).then(snap => {
        if (snap.exists()) {
          setTenantInfo({ id: snap.id, ...snap.data() } as Tenant);
        }
      });
    }
  }, [profile]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintType(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    if (!profile?.tenantId) return;
    
    const pQuery = query(collection(db, 'products'), where('tenantId', '==', profile.tenantId));
    const cQuery = query(collection(db, 'customers'), where('tenantId', '==', profile.tenantId));
    const bQuery = query(collection(db, 'bank_accounts'), where('tenantId', '==', profile.tenantId));

    const unsubProducts = onSnapshot(pQuery, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });

    const unsubCustomers = onSnapshot(cQuery, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    const unsubBanks = onSnapshot(bQuery, (snap) => {
      const banks = snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount));
      setBankAccounts(banks);
      
      const tunaiAccount = banks.find(b => b.name.toUpperCase() === 'TUNAI');
      if (tunaiAccount && paymentMethodType === 'tunai') {
        setSelectedBankAccountId(tunaiAccount.id);
      }
    });

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubBanks();
    };
  }, [profile]);

  const currentCustomer = customers.find(c => c.id === selectedCustomer);
  const canUseTempo = currentCustomer?.type === 'langganan' && currentCustomer?.allowTempo;

  const addToCart = (product: Product) => {
    const isService = product.type === 'service';
    if (!isService && product.stock <= 0) return;
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (!isService && existing.quantity >= product.stock) return;
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        const isService = item.product.type === 'service';
        if (!isService && newQty > item.product.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;

    setIsProcessing(true);
    try {
      // Calculate Due Date if credit
      let dueDate = null;
      if (paymentType === 'credit' && currentCustomer?.allowTempo) {
        const days = currentCustomer.tempoLimitDays || 30;
        const date = new Date();
        date.setDate(date.getDate() + days);
        dueDate = Timestamp.fromDate(date);
      }

      // 1. Create transaction
      const transData = {
        tenantId: profile?.tenantId,
        type: 'sale',
        amount: total,
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price
        })),
        date: serverTimestamp(),
        dueDate,
        status: paymentType === 'cash' ? 'completed' : 'pending',
        paymentType,
        paymentMethod: selectedBankAccountId,
        customerId: selectedCustomer || null,
        customerName: currentCustomer?.name || 'Guest',
        userId: profile?.uid,
        transactionNumber: 'SALE-' + Math.random().toString(36).substr(2, 5).toUpperCase()
      };

      const transRef = await addDoc(collection(db, 'transactions'), transData);

      // 2. Update stock
      for (const item of cart) {
        const isService = item.product.type === 'service';
        
        if (!isService) {
          await updateDoc(doc(db, 'products', item.product.id), {
            stock: increment(-item.quantity)
          });

          await logStockChange(
            profile?.tenantId!,
            item.product.id,
            item.product.name,
            'SALE',
            item.quantity,
            item.product.stock,
            item.product.stock - item.quantity,
            profile?.uid!,
            profile?.displayName || 'System',
            { id: transRef.id, number: transData.transactionNumber },
            'Sales transaction'
          );
        }
      }

      setLastTransaction({ id: transRef.id, ...transData, date: { seconds: Date.now() / 1000 } });
      setCart([]);
      setIsCheckoutModalOpen(false);
      setSelectedCustomer('');
      setPaymentType('cash');
      setShowSuccessModal(true);
    } catch (err) {
      console.error(err);
      alert('Transaction failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = (type: 'invoice' | 'receipt') => {
    setPrintType(type);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const isKasir = profile?.role === 'kasir';

  return (
    <div className={`flex flex-col lg:flex-row gap-6 ${isKasir ? 'h-[calc(100vh-73px)]' : 'h-[calc(100vh-120px)]'} ${isKasir ? 'p-0 sm:p-4' : ''} relative`}>
      {/* Mobile Tab Navigation */}
      <div className="lg:hidden flex border-b border-gray-200 bg-white sticky top-0 z-20">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'products' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-400'}`}
        >
          Produk ({filteredProducts.length})
        </button>
        <button
          onClick={() => setActiveTab('cart')}
          className={`flex-1 py-4 text-sm font-bold transition-all relative ${activeTab === 'cart' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-400'}`}
        >
          Keranjang
          {cart.length > 0 && (
            <span className="absolute top-2 right-1/4 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full animate-bounce">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* POS Terminal / Product List */}
      <div className={`flex-1 flex flex-col bg-white lg:rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${activeTab === 'products' ? 'flex' : 'hidden lg:flex'}`}>
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className="flex flex-col text-left group bg-white border border-gray-100 rounded-xl p-2 sm:p-3 hover:border-indigo-500 hover:shadow-md transition-all disabled:opacity-50 active:scale-95"
              >
                <div className="aspect-square bg-gray-50 rounded-lg mb-2 sm:mb-3 overflow-hidden relative">
                  <img
                    src={product.imageUrl || `https://picsum.photos/seed/${product.id}/200/200`}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {product.stock <= 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white bg-red-600 px-2 py-1 rounded">HABIS</span>
                    </div>
                  )}
                  {cart.find(item => item.product.id === product.id) && (
                    <div className="absolute top-1 right-1 bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg">
                      {cart.find(item => item.product.id === product.id)?.quantity}
                    </div>
                  )}
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">{product.name}</h4>
                <div className="flex justify-between items-center mt-1 sm:mt-2">
                  <p className="text-indigo-600 font-extrabold text-xs sm:text-sm">Rp.{(product.price || 0).toLocaleString()}</p>
                  <p className="text-[9px] sm:text-[10px] text-gray-400">{product.stock} stok</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart / Checkout */}
      <div className={`w-full lg:w-96 flex flex-col bg-white lg:rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${activeTab === 'cart' ? 'flex' : 'hidden lg:flex'}`}>
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2 text-indigo-600" />
            Pesanan Aktif
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 max-w-[120px]"
            >
              <option value="">Pelanggan Umum</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {cart.map((item) => (
            <div key={item.product.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-bold text-gray-900 truncate">{item.product.name}</p>
                <p className="text-xs text-gray-500 font-medium">Rp.{(item.product.price || 0).toLocaleString()} x {item.quantity}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => updateQuantity(item.product.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
                <button onClick={() => updateQuantity(item.product.id, -item.quantity)} className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-10 h-10 text-gray-200" />
              </div>
              <p className="text-gray-400 font-medium">Keranjang masih kosong</p>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-100 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-bold">Rp.{(total || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xl font-black text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-indigo-600">Rp.{(total || 0).toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() => setIsCheckoutModalOpen(true)}
            disabled={cart.length === 0 || isProcessing}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50 shadow-xl shadow-indigo-100 active:scale-95"
          >
            {isProcessing ? 'Memproses...' : (
              <>
                <CreditCard className="w-6 h-6 mr-2" />
                BAYAR SEKARANG
              </>
            )}
          </button>
        </div>
      </div>

      {/* Floating Cart Button for Mobile (when on products tab) */}
      {activeTab === 'products' && cart.length > 0 && (
        <button
          onClick={() => setActiveTab('cart')}
          className="lg:hidden fixed bottom-6 right-6 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center z-30 animate-bounce border-4 border-white"
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {cart.length}
          </span>
        </button>
      )}

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[500px] overflow-hidden flex flex-col"
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

              <div className="p-6 space-y-6">
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

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-500 font-bold">Total Tagihan</span>
                    <span className="text-2xl font-black text-indigo-600">Rp.{total.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={isProcessing}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                  >
                    {isProcessing ? 'Memproses...' : 'Konfirmasi & Bayar'}
                  </button>
                </div>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden text-center p-10"
            >
              <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Berhasil!</h3>
              <p className="text-gray-500 font-medium mb-8 leading-relaxed">
                Transaksi <span className="text-indigo-600 font-black">#{lastTransaction?.transactionNumber}</span> telah berhasil diproses.
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => handlePrint('invoice')}
                  className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                >
                  <FileText className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 mb-2" />
                  <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-700">Faktur (A4)</span>
                </button>
                <button
                  onClick={() => handlePrint('receipt')}
                  className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                >
                  <Printer className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 mb-2" />
                  <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-700">Struk (80mm)</span>
                </button>
              </div>

              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
              >
                Transaksi Baru
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Templates */}
      <div className={`${printType ? 'block' : 'hidden'} print:block print-section fixed inset-0 bg-white z-[9999] overflow-auto`}>
        {lastTransaction && (
          <>
            {printType === 'invoice' && (
              <div className="p-10 text-black font-sans bg-white min-h-screen">
                <div className="max-w-4xl mx-auto">
                  <div className="flex justify-between items-start mb-10">
                    <div>
                      <h1 className="text-4xl font-black text-indigo-600 mb-1">{tenantInfo?.name || 'ZENTORY'}</h1>
                      <p className="text-sm text-gray-500 max-w-xs">{tenantInfo?.settings?.description || 'Business Inventory & Sales Solutions'}</p>
                    </div>
                    <div className="text-right">
                      <h2 className="text-3xl font-bold text-gray-900 uppercase tracking-tighter">INVOICE</h2>
                      <p className="text-sm font-mono text-gray-500">#{lastTransaction.transactionNumber}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {lastTransaction.date ? new Date(lastTransaction.date.seconds * 1000).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-10 mb-10 border-y border-gray-100 py-6">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Billed To</p>
                      <p className="text-lg font-bold text-gray-900">{lastTransaction.customerName}</p>
                      <p className="text-sm text-gray-500 uppercase">POS Transaction</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payment Status</p>
                      <p className="text-lg font-bold text-indigo-600 uppercase">{lastTransaction.status}</p>
                    </div>
                  </div>

                  <table className="w-full mb-10">
                    <thead>
                      <tr className="border-b-2 border-gray-900 text-left text-xs font-bold uppercase tracking-wider">
                        <th className="py-3">Description</th>
                        <th className="py-3 text-center">Quantity</th>
                        <th className="py-3 text-right">Unit Price</th>
                        <th className="py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lastTransaction.items.map((item: any, i: number) => (
                        <tr key={i} className="text-sm">
                          <td className="py-4 font-medium">{item.name}</td>
                          <td className="py-4 text-center">{item.quantity}</td>
                          <td className="py-4 text-right">Rp.{item.price.toLocaleString()}</td>
                          <td className="py-4 text-right font-bold">Rp.{(item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-900">
                        <td colSpan={3} className="py-6 text-right font-bold text-gray-500 uppercase tracking-widest">Grand Total</td>
                        <td className="py-6 text-right text-2xl font-black text-indigo-600">
                          Rp.{lastTransaction.amount.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="mt-20 pt-10 border-t border-gray-100 text-center">
                    <p className="text-sm font-bold text-gray-900">Thank you for your business!</p>
                    <p className="text-xs text-gray-400 mt-1">Generated by Zentory POS System</p>
                  </div>
                </div>
              </div>
            )}

            {printType === 'receipt' && (
              <div className="p-4 text-black font-mono text-[10px] w-[80mm] mx-auto bg-white min-h-screen">
                <div className="text-center mb-4">
                  <h1 className="text-base font-bold uppercase">{tenantInfo?.name || 'ZENTORY'}</h1>
                  <p className="text-[8px]">{tenantInfo?.settings?.description || 'Sales Receipt'}</p>
                </div>
                
                <div className="border-t border-dashed border-gray-300 py-2 mb-2">
                  <div className="flex justify-between">
                    <span>Order:</span>
                    <span>#{lastTransaction.transactionNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{lastTransaction.date ? new Date(lastTransaction.date.seconds * 1000).toLocaleString() : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cust:</span>
                    <span>{lastTransaction.customerName}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-300 py-2 mb-2">
                  {lastTransaction.items.map((item: any, i: number) => (
                    <div key={i} className="mb-1">
                      <div className="flex justify-between">
                        <span>{item.name}</span>
                      </div>
                      <div className="flex justify-between pl-2">
                        <span>{item.quantity} x {item.price.toLocaleString()}</span>
                        <span>{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-gray-300 py-2 font-bold text-xs">
                  <div className="flex justify-between">
                    <span>TOTAL</span>
                    <span>Rp.{lastTransaction.amount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-center mt-6">
                  <p>TERIMA KASIH</p>
                  <p className="text-[8px] mt-1">Zentory POS System</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
