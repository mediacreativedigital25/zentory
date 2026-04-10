import React, { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, increment, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateOrderId } from '../lib/orderUtils';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  X, 
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
}

interface CartItem extends Product {
  quantity: number;
}

export const Catalog: React.FC = () => {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!profile?.tenantId) return;
      try {
        const q = query(collection(db, 'products'), where('tenantId', '==', profile.tenantId));
        const snap = await getDocs(q);
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setShowCart(true);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        if (newQty > item.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (!profile) return;
    setSubmitting(true);
    try {
      const orderId = await generateOrderId('IN', profile.tenantId);
      const orderData = {
        tenantId: profile.tenantId,
        orderId,
        customerId: profile.uid,
        customerName: profile.name,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total,
        status: 'Pending',
        type: 'Catalog',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'orders'), orderData);

      // Update stock
      for (const item of cart) {
        await updateDoc(doc(db, 'products', item.id), {
          stock: increment(-item.quantity)
        });
      }

      setSuccess(true);
      setCart([]);
      setTimeout(() => {
        setSuccess(false);
        setShowCart(false);
      }, 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Katalog Produk</h1>
          <p className="text-gray-500">Temukan produk terbaik untuk kebutuhan Anda.</p>
        </div>
        <div className="relative max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={48} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              whileHover={{ y: -5 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group"
            >
              <div className="relative aspect-square overflow-hidden bg-gray-50">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                {product.stock <= 0 && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                    <span className="bg-white text-gray-900 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Stok Habis</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">{product.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-4 h-8">{product.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-indigo-600">Rp {product.price.toLocaleString()}</span>
                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.stock <= 0}
                    className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[70]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[80] flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingCart size={24} className="text-indigo-600" />
                  Keranjang Belanja
                </h3>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <img src={item.image} className="w-20 h-20 rounded-xl object-cover bg-gray-50" referrerPolicy="no-referrer" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate">{item.name}</h4>
                      <p className="text-indigo-600 font-bold text-sm">Rp {item.price.toLocaleString()}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-1.5">
                          <button onClick={() => updateQuantity(item.id, -1)} className="text-gray-400 hover:text-indigo-600"><Minus size={16} /></button>
                          <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="text-gray-400 hover:text-indigo-600"><Plus size={16} /></button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 text-sm font-medium">Hapus</button>
                      </div>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && !success && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                    <ShoppingBag size={64} className="mb-4 opacity-20" />
                    <p className="text-lg font-medium">Keranjang Anda kosong</p>
                    <button onClick={() => setShowCart(false)} className="mt-4 text-indigo-600 font-bold">Mulai Belanja</button>
                  </div>
                )}
                {success && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-20">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-6">
                      <CheckCircle2 size={48} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Pesanan Berhasil!</h3>
                    <p className="text-gray-500">Terima kasih telah berbelanja di Zentory. Pesanan Anda sedang diproses.</p>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 border-t border-gray-100 space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium">Total Pembayaran</span>
                    <span className="text-2xl font-bold text-gray-900">Rp {total.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={submitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={24} /> : 'Checkout Sekarang'}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
