import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, runTransaction } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { Tenant, Product, BankAccount } from '../types';
import { ShoppingBag, Search, Filter, X, User, LogOut, History, ChevronRight, Landmark, ArrowRight, Star, Heart, Menu, CheckCircle2, Ticket, Percent, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import ConfirmModal from '../components/ConfirmModal';

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase: number;
  startDate: any;
  endDate: any;
  category: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
}

function HeroCarousel({ 
  images, 
  title, 
  description 
}: { 
  images: string[], 
  title: string, 
  description?: string 
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent(prev => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <div className="relative w-full h-[250px] sm:h-[350px] md:h-[450px] rounded-xl overflow-hidden group shadow-sm bg-gray-900 border border-gray-100">
        {images.map((src, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${index === current ? 'opacity-100' : 'opacity-0'}`}
          >
            <img 
              src={src} 
              alt={`Hero Banner ${index + 1}`} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s] ease-out"
              referrerPolicy="no-referrer"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent"></div>
        
        <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12 max-w-4xl flex flex-col justify-end h-full">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-base sm:text-lg text-gray-200 line-clamp-2 md:line-clamp-3 font-medium max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {images.length > 1 && (
          <div className="absolute bottom-6 right-8 flex space-x-2 z-10">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${index === current ? 'bg-white w-8' : 'bg-white/30 hover:bg-white/50'}`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Catalog() {
  const { tenantSlug } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartStep, setCartStep] = useState(1);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

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
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  useEffect(() => {
    if (!isCartOpen) {
      setCartStep(1);
    }
  }, [isCartOpen]);

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

          if (tenantData.catalogTheme === 'v1') {
            navigate(`/marketplace/${tenantData.slug}`, { replace: true });
            return;
          }

          // 3. Fetch products for this tenant
          const prodQuery = query(collection(db, 'products'), where('tenantId', '==', tenantData.id));
          const prodSnap = await getDocs(prodQuery);
          setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));

          // 4. Fetch bank accounts for this tenant
          const bankQuery = query(collection(db, 'bank_accounts'), where('tenantId', '==', tenantData.id), where('isActive', '==', true));
          const bankSnap = await getDocs(bankQuery);
          const banks = bankSnap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)).filter(b => b.showInCatalog !== false);
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

  const viewProductDetail = (product: Product) => {
    setSelectedDetailProduct(product);
    if (product.variants && product.variants.length > 0) {
      setSelectedVariantId(product.variants[0].id);
    } else {
      setSelectedVariantId('');
    }
  };

  const addToCart = (product: Product, variantId?: string) => {
    if (!variantId && product.variants && product.variants.length > 0) {
      viewProductDetail(product);
      return;
    }

    if (product.stock <= 0 && product.type !== 'service' && !variantId) {
      setConfirmModal({
        isOpen: true,
        title: 'Stok Habis',
        message: 'Maaf, produk ini sedang tidak tersedia.',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
        type: 'warning'
      });
      return;
    }

    const variant = variantId ? product.variants?.find(v => v.id === variantId) : null;
    const stockToUse = variant ? variant.stock : product.stock;

    if (variant && stockToUse <= 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Stok Habis',
        message: 'Maaf, variasi ini sedang tidak tersedia.',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
        type: 'warning'
      });
      return;
    }

    const cartItemId = variantId ? `${product.id}-${variantId}` : product.id;
    const existing = cart.find(item => {
        const itemVid = (item as any).variantId;
        const currentItemId = itemVid ? `${item.product.id}-${itemVid}` : item.product.id;
        return currentItemId === cartItemId;
    });

    if (existing) {
      if (product.type !== 'service' && existing.quantity >= stockToUse) {
        setConfirmModal({
          isOpen: true,
          title: 'Batas Stok',
          message: 'Anda telah mencapai batas stok yang tersedia untuk produk ini.',
          onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
          type: 'warning'
        });
        return;
      }
      setCart(cart.map(item => {
        const itemVid = (item as any).variantId;
        const currentItemId = itemVid ? `${item.product.id}-${itemVid}` : item.product.id;
        return currentItemId === cartItemId
          ? { ...item, quantity: item.quantity + 1 }
          : item;
      }));
    } else {
      setCart([...cart, { product, quantity: 1, variantId } as any]);
    }
    
    if (variantId) {
      setSelectedDetailProduct(null);
      setSelectedVariantId('');
    }
    setIsCartOpen(true);
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    const item = cart.find(i => {
      const itemVid = (i as any).variantId;
      return (itemVid ? `${i.product.id}-${itemVid}` : i.product.id) === cartItemId;
    });
    if (!item) return;

    const itemVid = (item as any).variantId;
    const variant = itemVid ? item.product.variants?.find(v => v.id === itemVid) : null;
    const stockToUse = variant ? variant.stock : item.product.stock;

    if (item.product.type !== 'service' && delta > 0 && item.quantity >= stockToUse) {
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
      const itemVid = (item as any).variantId;
      const currentItemId = itemVid ? `${item.product.id}-${itemVid}` : item.product.id;
      if (currentItemId === cartItemId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setQuantity = (cartItemId: string, value: number) => {
    const item = cart.find(i => {
      const itemVid = (i as any).variantId;
      return (itemVid ? `${i.product.id}-${itemVid}` : i.product.id) === cartItemId;
    });
    if (!item) return;

    const newQty = Math.max(1, value);
    const itemVid = (item as any).variantId;
    const variant = itemVid ? item.product.variants?.find(v => v.id === itemVid) : null;
    const stockToUse = variant ? variant.stock : item.product.stock;
    
    if (item.product && item.product.type !== 'service' && newQty > stockToUse) {
      setCart(cart.map(i => {
        const iVid = (i as any).variantId;
        const currentItemId = iVid ? `${i.product.id}-${iVid}` : i.product.id;
        return currentItemId === cartItemId ? { ...i, quantity: stockToUse } : i;
      }));
      return;
    }

    setCart(cart.map(i => {
      const iVid = (i as any).variantId;
      const currentItemId = iVid ? `${i.product.id}-${iVid}` : i.product.id;
      return currentItemId === cartItemId ? { ...i, quantity: newQty } : i;
    }));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(cart.filter(item => {
      const itemVid = (item as any).variantId;
      const currentItemId = itemVid ? `${item.product.id}-${itemVid}` : item.product.id;
      return currentItemId !== cartItemId;
    }));
  };

  const getProductPrice = (product: Product, quantity: number, variantId?: string) => {
    let basePrice = product.price;

    if (variantId && product.variants) {
      const variant = product.variants.find(v => v.id === variantId);
      if (variant) basePrice = variant.price;
    }

    if (!product.wholesalePrices || product.wholesalePrices.length === 0) {
      return basePrice;
    }
    
    // Sort by minQuantity descending to find the highest applicable tier
    const applicableTier = [...product.wholesalePrices]
      .sort((a, b) => b.minQuantity - a.minQuantity)
      .find(tier => quantity >= tier.minQuantity);
      
    return applicableTier ? applicableTier.price : basePrice;
  };

  const subtotal = cart.reduce((acc, item) => acc + (getProductPrice(item.product, item.quantity, (item as any).variantId) * item.quantity), 0);
  
  const discount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percentage') {
      return (subtotal * appliedCoupon.value) / 100;
    }
    return appliedCoupon.value;
  }, [appliedCoupon, subtotal]);

  const total = Math.max(0, subtotal - discount);

  const validateCoupon = async () => {
    if (!couponCode.trim() || !tenant?.id) return;
    setIsValidatingCoupon(true);
    try {
      const q = query(
        collection(db, 'coupons'),
        where('tenantId', '==', tenant.id),
        where('code', '==', couponCode.toUpperCase()),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        alert('Kupon tidak valid atau sudah tidak aktif.');
        setAppliedCoupon(null);
        return;
      }

      const couponData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Coupon;
      
      // Check date
      const now = new Date();
      const start = new Date(couponData.startDate);
      const end = new Date(couponData.endDate);
      if (now < start || now > end) {
        alert('Kupon sudah kadaluarsa atau belum dimulai.');
        return;
      }

      // Check usage limit
      if (couponData.usageLimit > 0 && couponData.usedCount >= couponData.usageLimit) {
        alert('Kupon sudah mencapai batas penggunaan.');
        return;
      }

      // Check min purchase
      if (subtotal < couponData.minPurchase) {
        alert(`Minimal pembelian untuk kupon ini adalah Rp ${couponData.minPurchase.toLocaleString()}`);
        return;
      }

      // Check category
      if (couponData.category !== 'all') {
        const hasValidCategory = cart.some(item => item.product.category === couponData.category);
        if (!hasValidCategory) {
          alert('Kupon ini tidak berlaku untuk produk di keranjang Anda.');
          return;
        }
      }

      setAppliedCoupon(couponData);
      alert('Kupon berhasil dipasang!');
    } catch (err) {
      console.error('Error validating coupon:', err);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

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

    if (bankAccounts.length > 0 && !selectedBankAccountId) {
      alert('Silakan pilih metode pembayaran terlebih dahulu.');
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
        items: cart.map(item => {
          const itemVid = (item as any).variantId;
          const unitPrice = getProductPrice(item.product, item.quantity, itemVid);
          const variant = itemVid ? item.product.variants?.find(v => v.id === itemVid) : null;
          const name = variant ? `${item.product.name} (${variant.name})` : item.product.name;
          
          return {
            productId: item.product.id,
            variantId: itemVid || null,
            name,
            price: unitPrice,
            hpp: variant ? (variant.hpp || 0) : (item.product.hpp || 0),
            quantity: item.quantity,
            total: unitPrice * item.quantity
          };
        }),
        totalAmount: total,
        discountAmount: discount,
        couponId: appliedCoupon?.id || null,
        couponCode: appliedCoupon?.code || null,
        type: 'catalog',
        status: 'pending',
        date: serverTimestamp(),
        userId: user.uid,
        paymentMethod: selectedBankAccountId || null,
      });

      // Increment coupon usage
      if (appliedCoupon) {
        const couponRef = doc(db, 'coupons', appliedCoupon.id);
        await runTransaction(db, async (transaction) => {
          const cDoc = await transaction.get(couponRef);
          if (cDoc.exists()) {
            transaction.update(couponRef, { usedCount: (cDoc.data().usedCount || 0) + 1 });
          }
        });
      }

      // Also create a transaction
      await addDoc(collection(db, 'transactions'), {
        tenantId: tenant?.id,
        type: 'sale',
        category: 'Sales',
        amount: total,
        discountAmount: discount,
        items: cart.map(item => {
          const itemVid = (item as any).variantId;
          const variant = itemVid ? item.product.variants?.find(v => v.id === itemVid) : null;
          return {
            productId: item.product.id,
            variantId: itemVid || null,
            name: variant ? `${item.product.name} (${variant.name})` : item.product.name,
            price: getProductPrice(item.product, item.quantity, itemVid),
            hpp: variant ? (variant.hpp || 0) : (item.product.hpp || 0),
            quantity: item.quantity
          };
        }),
        description: `Sales from Catalog: ${orderNumber}`,
        orderNumber,
        status: 'pending',
        date: serverTimestamp(),
        userId: user.uid,
        bankAccountId: selectedBankAccountId || null,
      });

      // Update stock for products
      for (const item of cart) {
        if (item.product.type === 'service') continue;
        
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
      setAppliedCoupon(null);
      setCouponCode('');
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
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-md flex items-center justify-center mb-6">
          <X className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Toko Tidak Ditemukan</h2>
        <p className="text-gray-500 text-center max-w-xs mb-8">Maaf, kami tidak dapat menemukan toko dengan alamat tersebut.</p>
        <button 
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-indigo-600 text-white rounded-md font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/30 font-sans">
      {/* Header - Professional Store Style */}
      <header className="bg-white/80 sticky top-0 z-40 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-6">
            <div 
              className="flex items-center cursor-pointer flex-shrink-0 group"
              onClick={() => navigate(`/catalog/${tenantSlug}`)}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl border border-gray-100 overflow-hidden bg-white flex-shrink-0 shadow-sm group-hover:shadow-md transition-all">
                {tenant.settings?.logoUrl ? (
                  <img src={tenant.settings.logoUrl} alt={tenant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white font-bold text-xl">
                    {tenant.name.charAt(0)}
                  </div>
                )}
              </div>
              <span className="hidden sm:block ml-3 text-lg font-bold tracking-tight text-gray-900">{tenant.name}</span>
            </div>

            <div className="flex-1 max-w-2xl mx-auto hidden md:block">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-gray-900 transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari produk..."
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-100/50 border border-transparent hover:bg-gray-100 hover:border-gray-200 rounded-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all placeholder:text-gray-400 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => setIsCartOpen(true)}
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-gray-700 relative hover:bg-gray-100 rounded-full transition-all"
              >
                <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-gray-900" />
                {cart.length > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white">
                    {cart.reduce((acc, item) => acc + item.quantity, 0)}
                  </span>
                )}
              </button>

              {user ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <button 
                    onClick={() => navigate(`/catalog/${tenantSlug}/dashboard`)}
                    className="flex items-center gap-2 pl-2 pr-3 sm:pr-4 py-1.5 hover:bg-gray-100 rounded-full transition-all border border-gray-200 shadow-sm bg-white"
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-900 text-white flex items-center justify-center">
                       <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span className="hidden sm:inline text-sm font-semibold text-gray-900">{profile?.displayName?.split(' ')[0] || 'Akun'}</span>
                  </button>
                  <button 
                    onClick={() => signOut(auth)}
                    className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                    title="Keluar"
                  >
                    <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <button 
                    onClick={() => navigate(`/catalog/${tenantSlug}/auth`)}
                    className="px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
                  >
                    Masuk
                  </button>
                  <button 
                    onClick={() => {
                      navigate(`/catalog/${tenantSlug}/auth`, { state: { mode: 'register' } });
                    }}
                    className="px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-bold bg-gray-900 text-white rounded-full hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-900/20 transition-all"
                  >
                    Daftar
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile Search */}
          <div className="pb-4 md:hidden">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari produk..."
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-100 border border-transparent rounded-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all font-medium"
                />
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="border-t border-gray-100 bg-white/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex overflow-x-auto no-scrollbar gap-2 py-3 lg:gap-3">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === cat 
                      ? 'bg-gray-900 text-white shadow-md' 
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {cat === 'All' ? 'Semua Produk' : cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {tenant.settings?.heroImageUrls && tenant.settings.heroImageUrls.length > 0 ? (
        <HeroCarousel 
          images={tenant.settings.heroImageUrls} 
          title={tenant.name} 
          description={tenant.settings?.description} 
        />
      ) : tenant.settings?.heroImageUrl ? (
        <HeroCarousel 
          images={[tenant.settings.heroImageUrl]} 
          title={tenant.name} 
          description={tenant.settings?.description} 
        />
      ) : tenant.settings?.description ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
           <div className="bg-white rounded-xl p-10 sm:p-14 text-center border border-gray-100 shadow-sm">
             <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">{tenant.name}</h1>
             <p className="text-base text-gray-500 max-w-2xl mx-auto font-medium leading-relaxed">{tenant.settings.description}</p>
           </div>
        </div>
      ) : null}

      {/* Product Grid - Modern Premium Style */}
      <main id="products-grid" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-[50vh]">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight mb-2">Pilihan Terbaik</h2>
            <p className="text-sm font-medium text-gray-500">Koleksi produk berkualitas dari {tenant.name}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => (
              <motion.div
                layout
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl p-3 border border-gray-100 shadow-[0_2px_15px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col group cursor-pointer"
                onClick={() => viewProductDetail(product)}
              >
                <div className="aspect-square relative flex-shrink-0 overflow-hidden bg-gray-100 rounded-lg">
                  <img
                    src={product.imageUrl || `https://picsum.photos/seed/${product.id}/500/500`}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                    referrerPolicy="no-referrer"
                  />
                  
                  {product.stock <= 0 && product.type !== 'service' && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                      <span className="bg-gray-900 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg">HABIS</span>
                    </div>
                  )}

                  {/* Add to cart hover button - Desktop only */}
                  {!(product.stock <= 0 && product.type !== 'service') && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 hidden sm:flex z-20">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           addToCart(product);
                         }}
                         className="bg-white/90 backdrop-blur-md text-gray-900 px-5 py-2.5 rounded-full font-bold text-sm shadow-xl flex items-center gap-2 hover:bg-gray-900 hover:text-white transition-colors"
                       >
                         <ShoppingBag className="w-4 h-4" />
                         Beli Cepat
                       </button>
                    </div>
                  )}
                </div>

                <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between mt-1">
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">{product.category || 'PRODUK'}</div>
                    <h4 className="text-sm sm:text-base font-bold text-gray-900 line-clamp-2 leading-relaxed mb-3 group-hover:text-gray-700 transition-colors">
                      {product.name}
                    </h4>
                    
                    {product.wholesalePrices && product.wholesalePrices.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                          {product.wholesalePrices.slice(0, 1).map((tier, idx) => (
                              <span key={idx} className="text-[10px] font-semibold bg-amber-100/50 text-amber-700 px-2.5 py-1 rounded-md flex items-center">
                                  <Tag className="w-3 h-3 mr-1" /> Grosir: Rp.{(tier.price).toLocaleString()}
                              </span>
                          ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-2 flex items-end justify-between items-center">
                    <span className="text-base sm:text-lg font-bold text-gray-900">
                      Rp.{(product.price || 0).toLocaleString()}
                    </span>
                    
                    {/* Mobile add to cart - always visible on mobile */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                      disabled={product.stock <= 0 && product.type !== 'service'}
                      className="w-10 h-10 sm:hidden rounded-full bg-gray-100 flex items-center justify-center text-gray-900 hover:bg-gray-900 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-gray-100 disabled:hover:text-gray-900"
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl mt-6 border border-gray-100 shadow-sm">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
               <Search className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Oops! Tidak ada produk</h3>
            <p className="text-gray-500 font-medium text-center max-w-md">Tidak menemukan produk yang cocok dengan pencarian atau filter Anda.</p>
            <button 
               onClick={() => {
                 setSearchQuery('');
                 setSelectedCategory('All');
               }}
               className="mt-8 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-full transition-colors text-sm"
            >
              Hapus Filter
            </button>
          </div>
        )}
      </main>

      {/* Footer - Professional Style */}
      <footer className="bg-white border-t border-gray-100 mt-auto py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold text-xl mr-4 shadow-sm">
                {tenant.name.charAt(0)}
              </div>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">{tenant.name}</h1>
            </div>
            
            <div className="flex items-center gap-6 text-sm font-semibold text-gray-500">
              <button className="hover:text-gray-900 transition-colors">Bantuan</button>
              <button className="hover:text-gray-900 transition-colors">Ketentuan</button>
              <button className="hover:text-gray-900 transition-colors">Privasi</button>
            </div>

            <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold">
              <span>© {new Date().getFullYear()} {tenant.name}</span>
              <span className="text-gray-200 px-1">|</span>
              <span>Supported by <span className="text-gray-900 font-bold">ZENTORY</span></span>
            </div>
          </div>
        </div>
      </footer>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-center p-8 sm:p-10 flex flex-col max-h-[90vh]"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 tracking-tight">Pesanan Berhasil!</h3>
              <p className="text-gray-500 text-sm sm:text-base font-medium mb-8 leading-relaxed">
                Terima kasih telah berbelanja. Pesanan <span className="text-indigo-600 font-bold">#{lastOrderNumber}</span> telah kami terima dan sedang diproses.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/catalog/${tenantSlug}/dashboard`)}
                  className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold tracking-wide shadow-lg shadow-gray-900/20 hover:bg-gray-800 transition-all text-sm"
                >
                  Cek Status Pesanan
                </button>
                <button
                  onClick={() => setShowSuccess(false)}
                  className="w-full py-3.5 bg-gray-100 text-gray-900 rounded-xl font-bold tracking-wide hover:bg-gray-200 transition-all text-sm"
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

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedDetailProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-6 lg:p-10 bg-gray-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-t-lg md:rounded-xl shadow-2xl w-full max-w-5xl max-h-[100dvh] md:max-h-full h-full md:h-auto overflow-hidden flex flex-col md:flex-row mt-auto md:mt-0 relative"
            >
              {/* Image Section */}
              <div className="w-full md:w-1/2 aspect-square md:aspect-auto md:h-[70vh] bg-gray-100 relative flex-shrink-0">
                <button 
                  onClick={() => setSelectedDetailProduct(null)} 
                  className="absolute top-4 right-4 z-10 md:hidden w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-900 shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
                <img 
                  src={(selectedVariantId ? selectedDetailProduct.variants?.find(v => v.id === selectedVariantId)?.imageUrl : null) || selectedDetailProduct.imageUrl || `https://picsum.photos/seed/${selectedDetailProduct.id}/800/800`} 
                  alt={selectedDetailProduct.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Content Section */}
              <div className="flex-1 flex flex-col h-full bg-white relative max-h-[60vh] md:max-h-[70vh]">
                <button 
                  onClick={() => setSelectedDetailProduct(null)} 
                  className="absolute top-6 right-6 hidden md:flex w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full items-center justify-center text-gray-400 hover:text-gray-900 transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 md:py-10 custom-scrollbar">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">{selectedDetailProduct.category || 'PRODUK'}</p>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 tracking-tight pr-8">{selectedDetailProduct.name}</h2>
                  
                  <div className="text-xl md:text-2xl font-bold text-gray-900 mb-8 border-b border-gray-100 pb-6">
                      Rp.{(selectedVariantId ? selectedDetailProduct.variants?.find(v => v.id === selectedVariantId)?.price : selectedDetailProduct.price)?.toLocaleString()}
                  </div>
                  
                  {selectedDetailProduct.variants && selectedDetailProduct.variants.length > 0 && (
                    <div className="mb-8">
                       <h4 className="text-sm font-bold text-gray-900 mb-4">Pilih Varian</h4>
                       <div className="grid grid-cols-2 gap-3">
                          {selectedDetailProduct.variants.map((v: any) => (
                            <button
                              key={v.id}
                              onClick={() => setSelectedVariantId(v.id)}
                              disabled={v.stock <= 0}
                              className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left ${
                                selectedVariantId === v.id 
                                  ? 'border-gray-900 bg-gray-50/50' 
                                  : 'border-gray-100 hover:border-gray-200 bg-white'
                              } ${v.stock <= 0 ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                            >
                              <span className={`font-semibold text-sm mb-1 ${selectedVariantId === v.id ? 'text-gray-900' : 'text-gray-900'}`}>{v.name}</span>
                              <div className="flex items-center justify-between w-full mt-auto pt-2">
                                <span className="font-bold text-gray-900 text-xs">Rp.{v.price.toLocaleString()}</span>
                                <span className={`text-[10px] font-medium ${v.stock <= 5 ? 'text-red-500' : 'text-gray-500'}`}>
                                    {v.stock > 0 ? `Sisa: ${v.stock}` : 'Habis'}
                                </span>
                              </div>
                            </button>
                          ))}
                       </div>
                    </div>
                  )}

                  <div className="prose prose-sm text-gray-600 mb-8 max-w-none leading-relaxed">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 font-sans">Deskripsi Produk</h4>
                      {selectedDetailProduct.description ? (
                          <p className="whitespace-pre-line">{selectedDetailProduct.description}</p>
                      ) : (
                          <p className="italic text-gray-400">Tidak ada deskripsi untuk produk ini.</p>
                      )}
                  </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-white md:bg-gray-50/50">
                  <button
                    onClick={() => addToCart(selectedDetailProduct, selectedVariantId)}
                    disabled={(selectedDetailProduct.variants && selectedDetailProduct.variants.length > 0 && !selectedVariantId) || (selectedDetailProduct.stock <= 0 && selectedDetailProduct.type !== 'service')}
                    className="w-full bg-gray-900 hover:bg-indigo-600 text-white py-4 rounded-xl font-bold tracking-wide shadow-xl shadow-gray-900/20 hover:shadow-indigo-600/30 disabled:opacity-50 disabled:shadow-none disabled:hover:bg-gray-900 transition-all flex items-center justify-center text-sm"
                  >
                    <ShoppingBag className="w-5 h-5 mr-3" />
                    {((selectedDetailProduct.stock <= 0 && selectedDetailProduct.type !== 'service')) ? 'Stok Habis' : 'Tambah ke Keranjang'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-gray-900/40 z-40 backdrop-blur-md"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", stiffness: 70, damping: 20, duration: 0.8 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col sm:rounded-l-xl overflow-hidden"
            >
              <div className="p-6 sm:p-8 flex justify-between items-center bg-white border-b border-gray-100">
                <div className="flex items-center gap-4">
                  {cartStep === 2 && (
                    <button 
                      onClick={() => setCartStep(1)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-indigo-600 border border-gray-100"
                    >
                      <ArrowRight className="w-5 h-5 rotate-180" />
                    </button>
                  )}
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                      {cartStep === 1 ? 'Keranjang Anda' : 'Pengiriman'}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                      {cartStep === 1 ? `${cart.length} Produk Terpilih` : 'Langkah 2 dari 2'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)} 
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-all border border-gray-100"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar bg-gray-50/50">
                {cart.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ShoppingBag className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-900 font-bold mb-2">Keranjang Anda masih kosong</p>
                    <p className="text-gray-500 text-sm">Temukan berbagai produk menarik di katalog kami.</p>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="mt-8 px-6 py-3 bg-gray-900 text-white font-medium text-sm rounded-full hover:bg-indigo-600 transition-colors"
                    >
                      Mulai Belanja
                    </button>
                  </div>
                ) : cartStep === 1 ? (
                  <div className="space-y-6">
                    {cart.map((item) => {
                      const itemVid = (item as any).variantId;
                      const variant = itemVid ? item.product.variants?.find((v: any) => v.id === itemVid) : null;
                      const cartItemId = itemVid ? `${item.product.id}-${itemVid}` : item.product.id;
                      const displayPrice = getProductPrice(item.product, item.quantity, itemVid);
                      const basePrice = variant ? variant.price : item.product.price;
                      const isDiscounted = displayPrice < basePrice;
                      const itemImageUrl = variant?.imageUrl || item.product.imageUrl || `https://picsum.photos/seed/${item.product.id}/200/300`;

                      return (
                        <div key={cartItemId} className="flex items-center space-x-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 group">
                          <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <img src={itemImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm mb-1 truncate group-hover:text-indigo-600 transition-colors">
                              {item.product.name}
                              {variant && <span className="text-gray-500 ml-1 font-normal">({variant.name})</span>}
                            </h4>
                            <div className="flex flex-col gap-0.5 mb-3">
                              <p className={`text-sm font-bold ${isDiscounted ? 'text-indigo-600' : 'text-gray-900'}`}>
                                  Rp.{displayPrice.toLocaleString()}
                                  {isDiscounted && (
                                      <span className="text-[10px] text-gray-400 line-through ml-2 font-medium">Rp.{basePrice.toLocaleString()}</span>
                                  )}
                              </p>
                              {isDiscounted && (
                                  <span className="text-[9px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full w-fit mt-1">Harga Grosir</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center bg-gray-50 rounded-full border border-gray-100 p-1">
                                <button 
                                  onClick={() => updateQuantity(cartItemId, -1)}
                                  className="w-7 h-7 flex items-center justify-center bg-white shadow-sm rounded-full text-gray-600 hover:text-indigo-600 transition-all font-medium"
                                >
                                  -
                                </button>
                                <input 
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => setQuantity(cartItemId, parseInt(e.target.value) || 0)}
                                  className="w-10 text-center text-xs font-bold text-gray-900 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button 
                                  onClick={() => updateQuantity(cartItemId, 1)}
                                  className="w-7 h-7 flex items-center justify-center bg-white shadow-sm rounded-full text-gray-600 hover:text-indigo-600 transition-all font-medium"
                                >
                                  +
                                </button>
                              </div>
                              <button 
                                onClick={() => removeFromCart(cartItemId)} 
                                className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Alamat Pengiriman</label>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Wajib</span>
                        </div>
                        <textarea
                          value={shippingAddress}
                          onChange={(e) => setShippingAddress(e.target.value)}
                          placeholder="Masukkan alamat lengkap (Jalan, No. Rumah, RT/RW, Kec, Kab/Kota, Prov)..."
                          className="w-full p-4 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all min-h-[120px] resize-none shadow-sm"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Metode Pembayaran</label>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Pilih Satu</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {bankAccounts.map((bank) => (
                            <button
                              key={bank.id}
                              onClick={() => setSelectedBankAccountId(bank.id)}
                              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                selectedBankAccountId === bank.id 
                                  ? 'border-indigo-600 bg-indigo-50/30 text-indigo-700 shadow-sm' 
                                  : 'border-gray-200 bg-white hover:border-indigo-300 text-gray-600'
                              }`}
                            >
                              <div className="flex items-center">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
                                  selectedBankAccountId === bank.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  <Landmark className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-bold text-gray-900 tracking-tight">{bank.name}</p>
                                  {bank.accountNumber && <p className="text-[11px] font-medium text-gray-500">{bank.accountNumber}</p>}
                                </div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex flex-shrink-0 items-center justify-center transition-all ${
                                selectedBankAccountId === bank.id ? 'border-indigo-600' : 'border-gray-300'
                              }`}>
                                {selectedBankAccountId === bank.id && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                              </div>
                            </button>
                          ))}
                          {bankAccounts.length === 0 && (
                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-sm font-medium flex items-center">
                              <X className="w-4 h-4 mr-2" />
                              Belum ada metode pembayaran tersedia.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-white border-t border-gray-100 space-y-4">
                {/* Coupon Section */}
                <div className="pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Ticket className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Kupon Diskon</h4>
                  </div>
                  
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-indigo-900">{appliedCoupon.code}</p>
                          <p className="text-[10px] font-semibold text-indigo-600">
                            -{appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}%` : `Rp ${appliedCoupon.value.toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setAppliedCoupon(null);
                          setCouponCode('');
                        }}
                        className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded-full transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Kode kupon..."
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all placeholder:text-gray-400"
                      />
                      <button
                        onClick={validateCoupon}
                        disabled={!couponCode.trim() || isValidatingCoupon}
                        className="px-5 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center whitespace-nowrap"
                      >
                        {isValidatingCoupon ? 'Tunggu...' : 'Terapkan'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-gray-500 text-sm font-medium">
                    <span>Subtotal</span>
                    <span className="font-semibold text-gray-900">Rp.{subtotal.toLocaleString()}</span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex justify-between items-center text-indigo-600 text-sm font-medium">
                      <span>Diskon ({appliedCoupon.code})</span>
                      <span className="font-bold">- Rp.{discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-end text-xl font-bold text-gray-900 tracking-tight pt-2 border-t border-gray-100">
                    <span className="text-sm font-semibold text-gray-500 mb-1">Total Tagihan</span>
                    <span className="text-2xl text-gray-900">Rp.{total.toLocaleString()}</span>
                  </div>
                </div>

                {cartStep === 1 ? (
                  <button
                    onClick={() => setCartStep(2)}
                    disabled={cart.length === 0}
                    className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold tracking-wide hover:bg-gray-800 transition-all disabled:bg-gray-200 disabled:text-gray-400 shadow-lg shadow-gray-900/20 disabled:shadow-none flex items-center justify-center gap-2 text-sm"
                  >
                    Lanjut ke Pengiriman
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || isCheckingOut || (bankAccounts.length > 0 && !selectedBankAccountId) || !shippingAddress.trim()}
                    className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold tracking-wide hover:bg-gray-800 transition-all disabled:bg-gray-200 disabled:text-gray-400 shadow-lg shadow-gray-900/30 disabled:shadow-none flex items-center justify-center gap-2 text-sm"
                  >
                    {isCheckingOut ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        />
                        Memproses Pesanan...
                      </>
                    ) : (
                      <>
                        Konfirmasi Pembayaran
                        <CheckCircle2 className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
