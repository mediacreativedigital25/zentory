import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, where, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { generateOrderId } from '../lib/orderUtils';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  User, 
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  X,
  Filter,
  UserPlus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Product, Category, UserProfile, CartItem, Order } from '../types';

export const SalesOrder: React.FC = () => {
  const { currentTenant } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentTenant?.id) return;
      try {
        const [pSnap, cSnap, custSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), where('tenantId', '==', currentTenant.id), where('isActive', '==', true))),
          getDocs(query(collection(db, 'categories'), where('tenantId', '==', currentTenant.id))),
          getDocs(query(collection(db, 'users'), where('role', '==', 'Customer'), where('tenantId', '==', currentTenant.id)))
        ]);
        
        setProducts(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        setCategories(cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
        setCustomers(custSnap.docs.map(doc => doc.data() as UserProfile));
      } catch (err) {
        console.error('Error fetching POS data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentTenant]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price } : item);
      }
      return [...prev, { 
        productId: product.id, 
        productName: product.name, 
        quantity: 1, 
        price: product.price, 
        total: product.price,
        image: product.image 
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        const product = products.find(p => p.id === productId);
        if (product && newQty > product.stock) return item;
        return { ...item, quantity: newQty, total: newQty * item.price };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  const tax = 0; // Could be calculated based on tenant settings
  const total = subtotal + tax;

  const handleSubmit = async () => {
    if (!currentTenant?.id) return;
    if (cart.length === 0) {
      setError('Keranjang masih kosong.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const orderNumber = await generateOrderId('M', currentTenant.id);
      const orderData: Omit<Order, 'id'> = {
        tenantId: currentTenant.id,
        orderNumber,
        customerId: selectedCustomer?.uid || 'guest',
        customerName: selectedCustomer?.name || 'Guest Customer',
        customerPhone: selectedCustomer?.phone || '',
        items: cart.map(({ image, ...item }) => item),
        subtotal,
        tax,
        discount: 0,
        total,
        status: 'Completed',
        paymentStatus: 'Paid',
        paymentMethod: 'Cash',
        type: 'POS',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'orders'), orderData);

      // Update stock
      for (const item of cart) {
        await updateDoc(doc(db, 'products', item.productId), {
          stock: increment(-item.quantity)
        });
      }

      setSuccess(`Pesanan ${orderNumber} berhasil dibuat.`);
      setCart([]);
      setSelectedCustomer(null);
      
      // Refresh products to get updated stock
      const pSnap = await getDocs(query(collection(db, 'products'), where('tenantId', '==', currentTenant.id), where('isActive', '==', true)));
      setProducts(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    } catch (err) {
      setError('Gagal memproses pesanan.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Point of Sale</h1>
          <p className="text-gray-500 mt-1">Input penjualan langsung ke sistem.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Product Selection */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Cari produk atau SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                    selectedCategory === 'all' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  )}
                >
                  Semua
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                      selectedCategory === cat.id ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {loading ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400">
                  <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                  <p>Memuat produk...</p>
                </div>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <button 
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.stock <= 0}
                    className={cn(
                      "flex flex-col text-left p-3 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all group relative",
                      product.stock <= 0 && "opacity-50 grayscale cursor-not-allowed"
                    )}
                  >
                    <div className="aspect-square w-full mb-3 rounded-xl overflow-hidden bg-gray-50 relative">
                      {product.image ? (
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Package size={32} />
                        </div>
                      )}
                      {product.stock <= 5 && product.stock > 0 && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                          Limit Stok
                        </div>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                      {product.name}
                    </h4>
                    <div className="mt-auto pt-2 flex items-center justify-between">
                      <p className="text-indigo-600 font-extrabold text-sm">Rp {product.price.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-gray-400">Stok: {product.stock}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400">
                  <Search size={48} className="mb-4 opacity-20" />
                  <p>Produk tidak ditemukan</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cart & Customer */}
        <div className="lg:col-span-4 space-y-6">
          {/* Customer Selection */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <User size={20} className="text-indigo-600" />
                Pelanggan
              </h3>
              {!selectedCustomer && (
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Default: Guest</span>
              )}
            </div>
            
            {selectedCustomer ? (
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between group">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-indigo-900 truncate">{selectedCustomer.name}</p>
                  <p className="text-xs text-indigo-600 truncate">{selectedCustomer.email}</p>
                </div>
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="Cari pelanggan..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="block w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                  {filteredCustomers.length > 0 ? filteredCustomers.map(customer => (
                    <button
                      key={customer.uid}
                      onClick={() => setSelectedCustomer(customer)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 group-hover:text-indigo-900 truncate">{customer.name}</p>
                        <p className="text-gray-500 group-hover:text-indigo-600 truncate">{customer.email}</p>
                      </div>
                      <Plus size={14} className="opacity-0 group-hover:opacity-100" />
                    </button>
                  )) : (
                    <p className="text-[10px] text-center text-gray-400 py-2">Tidak ada pelanggan terdaftar</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[500px] overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart size={20} className="text-indigo-600" />
                Keranjang
              </h3>
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-1 rounded-lg">
                {cart.reduce((acc, item) => acc + item.quantity, 0)} Item
              </span>
            </div>

            <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[400px] custom-scrollbar">
              {cart.map(item => (
                <div key={item.productId} className="flex gap-4 group">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
                    {item.image ? (
                      <img src={item.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Package size={20} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{item.productName}</p>
                    <p className="text-xs text-indigo-600 font-bold mt-0.5">Rp {item.price.toLocaleString()}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
                        <button 
                          onClick={() => updateQuantity(item.productId, -1)} 
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.productId, 1)} 
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.productId)} 
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                    <Package size={32} className="opacity-20" />
                  </div>
                  <p className="text-sm font-medium">Keranjang masih kosong</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900 font-bold">Rp {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Pajak (0%)</span>
                  <span className="text-gray-900 font-bold">Rp {tax.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-900 font-bold">Total</span>
                  <span className="text-2xl font-black text-indigo-600">Rp {total.toLocaleString()}</span>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-600 text-xs rounded-2xl flex items-center gap-3 animate-shake">
                  <AlertCircle size={18} className="shrink-0" />
                  <p className="font-bold">{error}</p>
                </div>
              )}
              {success && (
                <div className="p-4 bg-emerald-50 text-emerald-600 text-xs rounded-2xl flex items-center gap-3">
                  <CheckCircle2 size={18} className="shrink-0" />
                  <p className="font-bold">{success}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || cart.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3 text-lg"
              >
                {submitting ? <Loader2 className="animate-spin" size={24} /> : (
                  <>
                    <ShoppingCart size={24} />
                    Bayar Sekarang
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
