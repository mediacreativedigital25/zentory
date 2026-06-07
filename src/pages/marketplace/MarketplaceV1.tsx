import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product, Tenant } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../hooks/useAuth';
import MarketplaceCartDrawer from '../../components/marketplace/MarketplaceCartDrawer';
import { 
  Building2, MapPin, Phone, Clock, Star, Share2, MessageSquare, 
  Search, ShoppingCart, ArrowRight, Package, Users, Calendar, X, Minus, Plus
} from 'lucide-react';

export default function MarketplaceV1() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { addToCart, totalItems, setIsCartOpen } = useCart();
  const { user } = useAuth();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [tenantStats, setTenantStats] = useState({ rating: 0, reviewsCount: 0 });
  const [tenantYear, setTenantYear] = useState('2024');

  useEffect(() => {
    const fetchStorefrontData = async () => {
      if (!tenantSlug) return;
      
      try {
        setLoading(true);
        // Query tenant by slug
        const tenantQuery = query(
          collection(db, 'tenants'),
          where('slug', '==', tenantSlug)
        );
        const tenantSnap = await getDocs(tenantQuery);
        
        if (tenantSnap.empty) {
          setLoading(false);
          return;
        }

        const tenantData = { id: tenantSnap.docs[0].id, ...tenantSnap.docs[0].data() } as Tenant;
        setTenant(tenantData);
        document.title = `${tenantData.name} | One Platform for Every Business`;
        
        if ((tenantData as any).createdAt && (tenantData as any).createdAt.toDate) {
            setTenantYear((tenantData as any).createdAt.toDate().getFullYear().toString());
        }

        // Fetch products for this tenant
        if (tenantData.catalogTheme !== 'v1') {
          navigate(`/catalog/${tenantData.slug}`, { replace: true });
          return;
        }

        const productsQuery = query(
          collection(db, 'products'),
          where('tenantId', '==', tenantData.id)
        );
        const productsSnap = await getDocs(productsQuery);
        const productsList = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(productsList);

        const uniqueCategories = Array.from(new Set(productsList.map(p => (p as any).categoryId || p.category || 'Uncategorized')));
        setCategories(uniqueCategories);
        
        // Fetch customers count
        try {
            const customersQuery = query(
              collection(db, 'customers'),
              where('tenantId', '==', tenantData.id)
            );
            const snapshot = await getCountFromServer(customersQuery);
            setTotalCustomers(snapshot.data().count);
        } catch (e) {
            console.warn('Could not fetch customers count:', e);
            setTotalCustomers(0);
        }

        // Fetch reviews stats
        try {
            const reviewsQuery = query(
              collection(db, 'reviews'),
              where('tenantId', '==', tenantData.id)
            );
            const reviewsSnap = await getDocs(reviewsQuery);
            let totalRating = 0;
            reviewsSnap.forEach(doc => {
                totalRating += doc.data().rating || 0;
            });
            const reviewsCount = reviewsSnap.size;
            setTenantStats({ 
                rating: reviewsCount > 0 ? (totalRating / reviewsCount) : 0, 
                reviewsCount 
            });
        } catch (e) {
            console.warn('Could not fetch reviews:', e);
            setTenantStats({ rating: 0, reviewsCount: 0 });
        }

      } catch (error) {
        console.error('Error fetching storefront data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorefrontData();
  }, [tenantSlug]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || (product as any).categoryId === selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: tenant?.name || 'Toko Kami',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link toko disalin!');
    }
  };

  const contactWhatsApp = () => {
    const phoneNumber = tenant?.settings?.phone || tenant?.phone;
    if (phoneNumber) {
      window.open(`https://wa.me/${phoneNumber}`, '_blank');
    } else {
      alert('Nomor kontak belum diatur.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Toko Tidak Ditemukan</h2>
          <p className="text-gray-500">Toko yang Anda cari tidak tersedia atau belum aktif.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20 lg:pb-0">
      <MarketplaceCartDrawer tenant={tenant} />

      {/* Floating Header Actions - Mobile (Optional) or fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-100 p-3 flex gap-3 z-50">
         <button 
           onClick={contactWhatsApp}
           className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-semibold border border-indigo-100"
         >
           <MessageSquare className="w-4 h-4" /> Tanya
         </button>
         <button 
           onClick={() => setIsCartOpen(true)}
           className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm relative"
         >
           <ShoppingCart className="w-4 h-4" /> Keranjang
           {totalItems > 0 && (
             <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
               {totalItems}
             </span>
           )}
         </button>
      </div>

      {/* Header Info */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 overflow-hidden shrink-0 cursor-pointer"
                onClick={() => navigate(`/marketplace/${tenantSlug}`)}
              >
                {tenant.settings?.logoUrl ? (
                  <img src={tenant.settings.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <h1 
                className="text-xl font-bold text-gray-900 hidden sm:block cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => navigate(`/marketplace/${tenantSlug}`)}
              >
                {tenant.name}
              </h1>
            </div>
            
            <div className="flex items-center justify-end gap-3 sm:gap-6 shrink-0">
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center justify-center p-2 text-gray-600 hover:text-indigo-600 rounded-lg transition-colors"
                aria-label="Keranjang"
              >
                <ShoppingCart className="w-6 h-6" />
                {totalItems > 0 && (
                  <span className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border border-white font-bold">
                    {totalItems}
                  </span>
                )}
              </button>
              
              <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
              
              {user ? (
                <button 
                  onClick={() => navigate(`/marketplace/${tenantSlug}/dashboard`)}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Dashboard Saya
                </button>
              ) : (
                <button 
                  onClick={() => navigate(`/marketplace/${tenantSlug}/auth`)}
                  className="text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors"
                >
                  Login / Daftar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div 
        className="bg-indigo-600 text-white py-16 relative overflow-hidden"
        style={tenant.settings?.heroImageUrls?.[0] ? {
          backgroundImage: `url(${tenant.settings.heroImageUrls[0]})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundBlendMode: 'overlay',
          backgroundColor: 'rgba(79, 70, 229, 0.8)' // indigo-600 with opacity
        } : {}}
      >
        {/* Abstract Background Patterns */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <span className="bg-white/20 text-white border border-white/30 px-3 py-1 rounded-full text-xs font-medium tracking-wide inline-block mb-6 uppercase">Storefront V1</span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
            Temukan Produk Terbaik dari {tenant.name}
          </h2>
          <p className="text-base md:text-lg text-indigo-100 max-w-2xl mx-auto mb-8 font-normal">
            {tenant.settings?.description || 'Produk berkualitas dengan harga terbaik untuk memenuhi segala kebutuhan Anda sehari-hari secara efisien.'}
          </p>
          
          <div className="flex justify-center items-center gap-4 mb-10">
            <button 
              onClick={() => document.getElementById('products-grid')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white text-indigo-600 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-all shadow hover:shadow-md hover:-translate-y-0.5"
            >
              Lihat Produk
            </button>
            <button 
              onClick={contactWhatsApp}
              className="bg-white/20 backdrop-blur-sm border border-white/30 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-white/30 transition-all"
            >
              Hubungi Kami
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto border-t border-white/20 pt-8">
            <div className="flex flex-col items-center">
              <Package className="w-5 h-5 mb-1.5 text-white/80" />
              <p className="text-2xl font-bold mb-1">{products.length > 0 ? `${products.length}+` : '0'}</p>
              <p className="text-xs text-white/80 uppercase tracking-wider">Total Produk</p>
            </div>
            <div className="flex flex-col items-center">
              <Users className="w-5 h-5 mb-1.5 text-white/80" />
              <p className="text-2xl font-bold mb-1">{totalCustomers > 0 ? `${totalCustomers}+` : '0'}</p>
              <p className="text-xs text-white/80 uppercase tracking-wider">Total Pelanggan</p>
            </div>
            <div className="flex flex-col items-center">
              <Calendar className="w-5 h-5 mb-1.5 text-white/80" />
              <p className="text-2xl font-bold mb-1">Sejak {tenantYear}</p>
              <p className="text-xs text-white/80 uppercase tracking-wider">Tahun Berdiri</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div id="products-grid" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-8 mb-12">
          {/* Categories Sidebar */}
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4 px-2 tracking-wide uppercase text-sm">Kategori Produk</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === 'all' 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  Semua Produk
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === category 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {category === 'Uncategorized' ? 'Tanpa Kategori' : category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Product Grid Area */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900">
                {selectedCategory === 'all' ? 'Semua Produk' : selectedCategory}
              </h3>
              <div className="relative w-full max-w-xs ml-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Cari produk impian Anda..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all shadow-sm"
                />
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Produk Tidak Ditemukan</h3>
                <p className="text-gray-500">Coba ubah kata kunci atau kategori pencarian Anda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                {filteredProducts.map((product) => (
                  <div 
                    key={product.id} 
                    onClick={() => {
                        navigate(`/marketplace/${tenantSlug}/product/${product.id}`);
                    }}
                    className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full hover:-translate-y-1 cursor-pointer"
                  >
                    <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                      {product.image || product.imageUrl ? (
                        <img 
                          src={product.image || product.imageUrl} 
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                          <Package className="w-10 h-10" />
                          <span className="text-xs">No Image</span>
                        </div>
                      )}
                      {/* Badge if stock is low or standard logic, placeholder for now */}
                      {product.stock && product.stock < 5 && product.trackStock && (
                        <div className="absolute top-3 right-3 bg-rose-500 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-sm">
                          Sisa {product.stock}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 sm:p-5 flex-1 flex flex-col">
                      <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2 text-sm sm:text-base group-hover:text-indigo-600 transition-colors">
                        {product.name}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 bg-gray-100 w-fit px-1.5 sm:px-2 py-0.5 rounded text-left">
                        {(product as any).categoryId || product.category || 'General'}
                      </p>
                      
                      <div className="mt-auto flex items-center justify-between">
                        <div>
                          <p className="text-sm sm:text-base font-bold text-gray-900">
                            Rp {(product.price || 0).toLocaleString('id-ID')}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product, 1);
                          }}
                          className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-colors"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
