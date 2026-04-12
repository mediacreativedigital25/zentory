import { useState, useEffect } from 'react';
import { collection, query, where, addDoc, serverTimestamp, increment, doc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Product, Transaction, StockLog, Customer, BankAccount } from '../types';
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, User, Tag, X, Landmark } from 'lucide-react';
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
    if (product.stock <= 0) return;
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) return;
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty > item.product.stock) return item;
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
      const transRef = await addDoc(collection(db, 'transactions'), {
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
      });

      // 2. Update stock
      for (const item of cart) {
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
          { id: transRef.id, number: 'SALE-' + transRef.id.slice(0, 5).toUpperCase() },
          'Sales transaction'
        );
      }

      setCart([]);
      setIsCheckoutModalOpen(false);
      setSelectedCustomer('');
      setPaymentType('cash');
      alert('Transaction completed successfully!');
    } catch (err) {
      console.error(err);
      alert('Transaction failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)]">
      {/* POS Terminal */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className="flex flex-col text-left group bg-white border border-gray-100 rounded-xl p-3 hover:border-indigo-500 hover:shadow-md transition-all disabled:opacity-50"
              >
                <div className="aspect-square bg-gray-50 rounded-lg mb-3 overflow-hidden relative">
                  <img
                    src={product.imageUrl || `https://picsum.photos/seed/${product.id}/200/200`}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {product.stock <= 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white bg-red-600 px-2 py-1 rounded">OUT OF STOCK</span>
                    </div>
                  )}
                </div>
                <h4 className="text-sm font-bold text-gray-900 truncate">{product.name}</h4>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-indigo-600 font-extrabold text-sm">Rp.{(product.price || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">{product.stock} left</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart / Checkout */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2 text-indigo-600" />
            Current Order
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Guest Customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">
              {cart.length} items
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.map((item) => (
            <div key={item.product.id} className="flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-bold text-gray-900 truncate">{item.product.name}</p>
                <p className="text-xs text-gray-500">Rp.{(item.product.price || 0).toLocaleString()} x {item.quantity}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-gray-100 rounded">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:bg-gray-100 rounded">
                  <Plus className="w-4 h-4" />
                </button>
                <button onClick={() => updateQuantity(item.product.id, -item.quantity)} className="p-1 text-red-500 hover:bg-red-50 rounded ml-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center py-20">
              <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500">Your cart is empty.</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>Rp.{(total || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tax (0%)</span>
            <span>Rp.0</span>
          </div>
          <div className="flex justify-between text-xl font-extrabold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total</span>
            <span>Rp.{(total || 0).toLocaleString()}</span>
          </div>

          <button
            onClick={() => setIsCheckoutModalOpen(true)}
            disabled={cart.length === 0 || isProcessing}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50 shadow-lg shadow-indigo-200"
          >
            {isProcessing ? 'Processing...' : (
              <>
                <CreditCard className="w-6 h-6 mr-2" />
                Checkout
              </>
            )}
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
    </div>
  );
}
