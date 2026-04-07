import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Product, Customer } from '../types';
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, User, Tag, Briefcase, X, ListOrdered } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';

export default function SalesOrder() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [orderType, setOrderType] = useState<'manual' | 'service'>('manual');
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (!profile?.tenantId) return;
    
    const pQuery = query(collection(db, 'products'), where('tenantId', '==', profile.tenantId));
    const cQuery = query(collection(db, 'customers'), where('tenantId', '==', profile.tenantId));

    const unsubProducts = onSnapshot(pQuery, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubCustomers = onSnapshot(cQuery, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    });

    return () => {
      unsubProducts();
      unsubCustomers();
    };
  }, [profile]);

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

  const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

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

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;

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

          await addDoc(collection(db, 'orders'), {
            orderNumber,
            tenantId: profile?.tenantId,
            customerId: selectedCustomer || null,
            customerName: customer?.name || 'Guest',
            type: orderType,
            items: cart.map(item => ({
              productId: item.product.id,
              name: item.product.name,
              quantity: item.quantity,
              price: item.product.price
            })),
            totalAmount: total,
            date: serverTimestamp(),
            status: 'completed',
            userId: profile?.uid,
          });

          // 1b. Create transaction for financial tracking
          await addDoc(collection(db, 'transactions'), {
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
            status: 'completed',
            userId: profile?.uid,
            orderNumber: orderNumber, // Reference to the order
          });

          // Update stock only for manual products (not services)
          if (orderType === 'manual') {
            for (const item of cart) {
              const productRef = doc(db, 'products', item.product.id);
              await runTransaction(db, async (transaction) => {
                const pDoc = await transaction.get(productRef);
                if (!pDoc.exists()) return;
                const newStock = pDoc.data().stock - item.quantity;
                transaction.update(productRef, { stock: newStock });
              });
            }
          }

          setCart([]);
          setSelectedCustomer('');
          alert(`Order ${orderNumber} created successfully!`);
        } catch (err) {
          console.error(err);
          alert('Failed to create order.');
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)]">
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Buat Pesanan Baru</h2>
            <button
              onClick={() => navigate('/sales/receive')}
              className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-bold"
            >
              <ListOrdered className="w-4 h-4 mr-2" />
              Daftar Pesanan
            </button>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setOrderType('manual')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center border transition-all ${orderType === 'manual' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Tag className="w-4 h-4 mr-2" />
              Manual Product
            </button>
            <button 
              onClick={() => setOrderType('service')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center border transition-all ${orderType === 'service' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Briefcase className="w-4 h-4 mr-2" />
              Service (Jasa)
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {products
              .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
              .filter(p => (p.type || 'manual') === orderType)
              .map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={orderType === 'manual' && product.stock <= 0}
                className="flex flex-col text-left group bg-white border border-gray-100 rounded-xl p-3 hover:border-indigo-500 hover:shadow-md transition-all disabled:opacity-50"
              >
                <div className="aspect-square bg-gray-50 rounded-lg mb-3 overflow-hidden relative">
                  <img src={product.imageUrl || `https://picsum.photos/seed/${product.id}/200/200`} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  {orderType === 'manual' && product.stock <= 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white bg-red-600 px-2 py-1 rounded">OUT OF STOCK</span>
                    </div>
                  )}
                </div>
                <h4 className="text-sm font-bold text-gray-900 truncate">{product.name}</h4>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-indigo-600 font-extrabold text-sm">Rp.{(product.price || 0).toLocaleString()}</p>
                  {orderType === 'manual' && <p className="text-[10px] text-gray-500">{product.stock} left</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 space-y-4">
          <h3 className="text-lg font-bold flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2 text-indigo-600" />
            Order Details
          </h3>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Select Customer</label>
            <select 
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Guest Customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
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
                <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-gray-100 rounded"><Minus className="w-4 h-4" /></button>
                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:bg-gray-100 rounded"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-4">
          <div className="flex justify-between text-xl font-extrabold text-gray-900 pt-2">
            <span>Total</span>
            <span>Rp.{(total || 0).toLocaleString()}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isProcessing}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50 shadow-lg shadow-indigo-200"
          >
            <CreditCard className="w-6 h-6 mr-2" />
            {isProcessing ? 'Processing...' : 'Complete Order'}
          </button>
        </div>
      </div>

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
