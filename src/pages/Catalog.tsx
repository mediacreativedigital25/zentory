import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, runTransaction } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Tenant, Product, BankAccount } from '../types';
import { ShoppingBag, Search, Filter, X, User, LogOut, History, ChevronRight, Landmark, ArrowRight, Star, Heart, Menu, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import ConfirmModal from '../components/ConfirmModal';

export default function Catalog() {
  const { tenantSlug } = useParams();
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');

  // Modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'info' | 'danger' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let tenantData: Tenant | null = null;

        // 1. Check for Custom Domain first
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isAppDomain = hostname.includes('run.app') || hostname.includes('web.app') || hostname.includes('firebaseapp.com');

        if (!isLocalhost && !isAppDomain) {
          const domainQuery = query(collection(db, 'custom_domains'), where('domain', '==', hostname), where('status', '==', 'active'));
          const domainSnap = await getDocs(domainQuery);
          
          if (!domainSnap.empty) {
            const domainData = domainSnap.docs[0].data();
            const tenantDoc = await getDocs(query(collection(db, 'tenants'), where('__name__', '==', domainData.tenantId)));
            if (!tenantDoc.empty) {
              tenantData = { id: tenantDoc.docs[0].id, ...tenantDoc.docs[0].data() } as Tenant;
            }
          }
        }

        // 2. Fallback to Slug if no domain match or on app domain
        if (!tenantData && tenantSlug) {
          const tenantQuery = query(collection(db, 'tenants'), where('slug', '==', tenantSlug));
          const tenantSnap = await getDocs(tenantQuery);
          if (!tenantSnap.empty) {
            tenantData = { id: tenantSnap.docs[0].id, ...tenantSnap.docs[0].data() } as Tenant;
          }
        }
        
        if (tenantData) {
          setTenant(tenantData);

          // 3. Fetch products for this tenant
          const prodQuery = query(collection(db, 'products'), where('tenantId', '==', tenantData.id));
          const prodSnap = await getDocs(prodQuery);
          setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));

          // 4. Fetch bank accounts for this tenant
          const bankQuery = query(collection(db, 'bank_accounts'), where('tenantId', '==', tenantData.id), where('isActive', '==', true));
          const bankSnap = await getDocs(bankQuery);
          const banks = bankSnap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount));
          setBankAccounts(banks);
          if (banks.length > 0) {
            setSelectedBankAccountId(banks[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching catalog data:', err);
        handleFirestoreError(err, OperationType.GET, 'catalog-data', auth);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tenantSlug]);

  useEffect(() => {
    if (profile?.address) {
      setShippingAddress(profile.address);
    }
  }, [profile]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['All', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           p.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0 && product.type !== 'service') {
      setConfirmModal({
        isOpen: true,
        title: 'Stok Habis',
        message: 'Maaf, produk ini sedang tidak tersedia.',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
        type: 'warning'
      });
      return;
    }

    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (product.type !== 'service' && existing.quantity >= product.stock) {
        setConfirmModal({
          isOpen: true,
          title: 'Batas Stok',
          message: 'Anda telah mencapai batas stok yang tersedia untuk produk ini.',
          onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
          type: 'warning'
        });
        return;
      }
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const product = products.find(p => p.id === productId);
    if (product && product.type !== 'service' && delta > 0 && item.quantity >= product.stock) {
      setConfirmModal({
        isOpen: true,
        title: 'Batas Stok',
        message: 'Stok tidak mencukupi untuk menambah jumlah.',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
        type: 'warning'
      });
      return;
    }

    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (!user) {
      navigate(`/catalog/${tenantSlug}/auth`);
      return;
    }

    if (!shippingAddress.trim()) {
      setConfirmModal({
        isOpen: true,
        title: 'Alamat Wajib Diisi',
        message: 'Silakan isi alamat pengiriman lengkap Anda.',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
        type: 'warning'
      });
      return;
    }

    setIsCheckingOut(true);
    try {
      const orderNumber = `ORD-${Date.now()}`;
      await addDoc(collection(db, 'orders'), {
        tenantId: tenant?.id,
        orderNumber,
        customerName: profile?.displayName || user.email,
        customerEmail: user.email,
        customerAddress: shippingAddress,
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          hpp: item.product.hpp || 0,
          quantity: item.quantity,
          total: item.product.price * item.quantity
        })),
        totalAmount: total,
        type: 'catalog',
        status: 'pending',
        date: serverTimestamp(),
        userId: user.uid,
        paymentMethod: selectedBankAccountId || null,
      });

      // Also create a transaction
      await addDoc(collection(db, 'transactions'), {
        tenantId: tenant?.id,
        type: 'sale',
        category: 'Sales',
        amount: total,
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          hpp: item.product.hpp || 0,
          quantity: item.quantity
        })),
        description: `Sales from Catalog: ${orderNumber}`,
        orderNumber,
        status: 'pending',
        date: serverTimestamp(),
        userId: user.uid,
        bankAccountId: selectedBankAccountId || null,
      });

      // Update stock for products
      for (const item of cart) {
        const productRef = doc(db, 'products', item.product.id);
        await runTransaction(db, async (transaction) => {
          const pDoc = await transaction.get(productRef);
          if (!pDoc.exists()) return;
          const currentStock = pDoc.data().stock || 0;
          const newStock = Math.max(0, currentStock - item.quantity);
          transaction.update(productRef, { stock: newStock });
        });
      }

      setLastOrderNumber(orderNumber);
      setShowSuccess(true);
      setCart([]);
      setIsCartOpen(false);
    } catch (err: any) {
      console.error(err);
      setConfirmModal({
        isOpen: true,
        title: 'Gagal Checkout',
        message: `Terjadi kesalahan: ${err.message}`,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
        type: 'danger'
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"
        />
        <p className="text-gray-500 font-medium animate-pulse">Menyiapkan Katalog...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
          <X className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Toko Tidak Ditemukan</h2>
        <p className="text-gray-500 text-center max-w-xs mb-8">Maaf, kami tidak dapat menemukan toko dengan alamat tersebut.</p>
        <button 
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F4] font-sans">
      {/* Header - TikTok Shop Style */}
      <header className="bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div 
              className="flex items-center cursor-pointer flex-shrink-0"
              onClick={() => navigate(`/catalog/${tenantSlug}`)}
            >
              <div className="w-10 h-10 rounded-full border border-gray-100 overflow-hidden bg-gray-50">
                {tenant.settings?.logoUrl ? (
                  <img src={tenant.settings.logoUrl} alt={tenant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-black flex items-center justify-center text-white font-black text-lg">
                    {tenant.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 relative max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-600 transition-all"
              />
            </div>

            <div className="flex items-center space-x-1 sm:space-x-3">
              <button 
                onClick={() => setIsCartOpen(true)}
                className="p-2 text-gray-700 relative hover:bg-gray-100 rounded-full transition-all"
              >
                <ShoppingBag className="w-6 h-6" />
                {cart.length > 0 && (
                  <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                    {cart.reduce((acc, item) => acc + item.quantity, 0)}
                  </span>
                )}
              </button>

              {user ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => navigate(`/catalog/${tenantSlug}/dashboard`)}
                    className="p-2 text-gray-700 hover:bg-gray-100 rounded-full transition-all flex items-center gap-2"
                  >
                    <User className="w-6 h-6" />
                    <span className="hidden sm:inline text-sm font-bold">{profile?.displayName?.split(' ')[0] || 'Akun'}</span>
                  </button>
                  <button 
                    onClick={() => logout()}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                    title="Keluar"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => navigate(`/catalog/${tenantSlug}/auth`)}
                    className="px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                  >
                    Masuk
                  </button>
                  <button 
                    onClick={() => {
                      navigate(`/catalog/${tenantSlug}/auth`, { state: { mode: 'register' } });
                    }}
                    className="px-4 py-2 text-sm font-bold bg-black text-white rounded-xl hover:bg-gray-800 transition-all hidden sm:block"
                  >
                    Daftar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="bg-white border-t border-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex overflow-x-auto no-scrollbar gap-6 py-3">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap text-sm font-medium transition-all relative pb-1 ${
                    selectedCategory === cat 
                      ? 'text-black font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-black' 
                      : 'text-gray-500 hover:text-black'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Product Grid - TikTok Shop Style */}
      <main id="products-grid" className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4">
        <div className="mb-6 px-2">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Katalog {tenant.name}</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-6">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => (
              <motion.div
                layout
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-lg overflow-hidden shadow-sm flex flex-col"
              >
                <div className="aspect-square relative group">
                  <img
                    src={product.imageUrl || `https://picsum.photos/seed/${product.id}/500/500`}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  
                  {product.stock <= 0 && product.type !== 'service' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="bg-white/90 text-black px-3 py-1 rounded-full text-[10px] font-bold uppercase">Habis</span>
                    </div>
                  )}
                </div>

                <div className="p-2 sm:p-3 flex-1 flex flex-col">
                  <h4 className="text-xs sm:text-sm text-gray-800 line-clamp-2 mb-2 min-h-[2.5rem] leading-tight">
                    {product.name}
                  </h4>
                  
                  <div className="mt-auto">
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-indigo-600 text-sm sm:text-lg font-black">
                        Rp.{(product.price || 0).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {/* Rating removed for plain look */}
                      </div>
                      <button 
                        onClick={() => addToCart(product)}
                        disabled={product.stock <= 0 && product.type !== 'service'}
                        className="p-1.5 bg-gray-50 text-gray-900 rounded-lg hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-30"
                      >
                        <ShoppingBag className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl mt-4">
            <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Produk tidak ditemukan.</p>
          </div>
        )}
      </main>

      {/* Footer - Simple TikTok Style */}
      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-black text-lg mr-3">
                {tenant.name.charAt(0)}
              </div>
              <h1 className="text-lg font-black text-gray-900 tracking-tight">{tenant.name}</h1>
            </div>
            
            <div className="flex items-center gap-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <button className="hover:text-black transition-colors">Bantuan</button>
              <button className="hover:text-black transition-colors">Syarat & Ketentuan</button>
              <button className="hover:text-black transition-colors">Kebijakan Privasi</button>
            </div>

            <div className="flex items-center gap-2 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
              <span>© 2026 {tenant.name}</span>
              <span className="text-gray-200">|</span>
              <span>Powered by <span className="text-black font-black">ZENTORY</span></span>
            </div>
          </div>
        </div>
      </footer>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden text-center p-10"
            >
              <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Pesanan Berhasil!</h3>
              <p className="text-gray-500 font-medium mb-8 leading-relaxed">
                Terima kasih telah berbelanja. Pesanan Anda <span className="text-indigo-600 font-black">#{lastOrderNumber}</span> telah kami terima dan sedang diproses.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/catalog/${tenantSlug}/dashboard`)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Cek Status Pesanan
                </button>
                <button
                  onClick={() => setShowSuccess(false)}
                  className="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  Lanjut Belanja
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        type={confirmModal.type}
        confirmText="OK"
        cancelText="Tutup"
      />

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Keranjang Belanja</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{cart.length} Produk Terpilih</p>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-200 rounded-xl transition-all">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {cart.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ShoppingBag className="w-10 h-10 text-gray-200" />
                    </div>
                    <p className="text-gray-500 font-bold">Keranjangmu masih kosong.</p>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="mt-4 text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline"
                    >
                      Mulai Belanja
                    </button>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product.id} className="flex items-center space-x-4 group">
                      <div className="w-20 h-24 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
                        <img src={item.product.imageUrl || `https://picsum.photos/seed/${item.product.id}/200/300`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm mb-1 truncate">{item.product.name}</h4>
                        <p className="text-indigo-600 font-black text-sm mb-3">Rp.{item.product.price.toLocaleString()}</p>
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button 
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="w-7 h-7 flex items-center justify-center bg-white shadow-sm rounded-md text-gray-600 hover:text-indigo-600 transition-all"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="w-7 h-7 flex items-center justify-center bg-white shadow-sm rounded-md text-gray-600 hover:text-indigo-600 transition-all"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.product.id)} 
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-8 border-t border-gray-100 bg-gray-50 space-y-6">
                {cart.length > 0 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Alamat Pengiriman</label>
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Wajib</span>
                      </div>
                      <textarea
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder="Masukkan alamat lengkap (Jalan, No. Rumah, RT/RW, Kec, Kab/Kota, Prov)..."
                        className="w-full p-4 bg-white border-2 border-white rounded-2xl text-sm outline-none focus:border-indigo-600 transition-all min-h-[100px] resize-none shadow-sm"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Metode Pembayaran</label>
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Wajib Pilih</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {bankAccounts.map((bank) => (
                        <button
                          key={bank.id}
                          onClick={() => setSelectedBankAccountId(bank.id)}
                          className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                            selectedBankAccountId === bank.id 
                              ? 'border-indigo-600 bg-white text-indigo-700 shadow-lg shadow-indigo-100' 
                              : 'border-white bg-white hover:border-gray-200 text-gray-600'
                          }`}
                        >
                          <div className="flex items-center">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-3 ${
                              selectedBankAccountId === bank.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                            }`}>
                              <Landmark className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-black uppercase tracking-tight">{bank.name}</p>
                              {bank.accountNumber && <p className="text-[10px] font-bold opacity-50 font-mono">{bank.accountNumber}</p>}
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedBankAccountId === bank.id ? 'border-indigo-600' : 'border-gray-200'
                          }`}>
                            {selectedBankAccountId === bank.id && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                          </div>
                        </button>
                      ))}
                      {bankAccounts.length === 0 && (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-xs font-bold flex items-center">
                          <X className="w-4 h-4 mr-2" />
                          Belum ada metode pembayaran tersedia.
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-gray-400 text-xs font-black uppercase tracking-widest">
                    <span>Subtotal</span>
                    <span>Rp.{total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-2xl font-black text-gray-900 tracking-tighter">
                    <span>Total</span>
                    <span className="text-indigo-600">Rp.{total.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || isCheckingOut || (bankAccounts.length > 0 && !selectedBankAccountId) || !shippingAddress.trim()}
                  className="w-full py-5 bg-gray-900 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all disabled:bg-gray-200 disabled:text-gray-400 shadow-xl shadow-gray-200 flex items-center justify-center gap-3"
                >
                  {isCheckingOut ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                      Memproses...
                    </>
                  ) : (
                    <>
                      Checkout Sekarang
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
