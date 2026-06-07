import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Building2, Search, CalendarDays, ShoppingBag, Clock, ArrowRight, MessageSquare, Menu, UserCircle2, Star, Shield, Heart, CheckCircle, ThumbsUp, Award, Zap, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Tenant } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../../context/CartContext';
import MarketplaceCartDrawer from '../../components/marketplace/MarketplaceCartDrawer';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  imageUrls?: string[];
  type?: 'product' | 'service';
}

export default function BookingV1() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setIsCartOpen, totalItems, addToCart } = useCart();
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let tenantData: Tenant | null = null;
        
        // Custom domain checking logic simplified for this component
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

        if (!tenantData && tenantSlug) {
          const tenantQuery = query(collection(db, 'tenants'), where('slug', '==', tenantSlug));
          const tenantSnap = await getDocs(tenantQuery);
          if (!tenantSnap.empty) {
            tenantData = { id: tenantSnap.docs[0].id, ...tenantSnap.docs[0].data() } as Tenant;
          }
        }

        if (tenantData) {
          setTenant(tenantData);
          document.title = `${tenantData.name} | One Platform for Every Business`;
          
          if (tenantData.catalogTheme === 'v1' || tenantData.catalogTheme === 'default') {
            navigate(tenantData.catalogTheme === 'v1' ? `/marketplace/${tenantData.slug}` : `/catalog/${tenantData.slug}`, { replace: true });
            return;
          }

          const prodQuery = query(collection(db, 'products'), where('tenantId', '==', tenantData.id));
          const prodSnap = await getDocs(prodQuery);
          setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [tenantSlug, navigate]);

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

  const handleBooking = (product: Product) => {
    // Determine route based on if it's a service or a product. For a booking theme, let's just add to cart and go to checkout, or open a booking modal.
    // For V1, we can redirect to a product detail page if we have one, or just add to cart.
    // Assuming we want an elegant flow, let's redirect to checkout or product details.
    navigate(`/marketplace/${tenant?.slug}/product/${product.id}`); 
  };

  const contactWhatsApp = () => {
    if (!tenant) return;
    const phoneNumber = tenant.settings?.phone || tenant.phone;
    if (phoneNumber) {
      window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(`Halo ${tenant.name}, saya ingin bertanya mengenai layanan Anda.`)}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Toko Tidak Ditemukan</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-gray-900 selection:bg-indigo-100 selection:text-indigo-900 pb-24 lg:pb-0 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-indigo-50/80 via-white to-transparent pointer-events-none -z-10"></div>
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-purple-100/50 rounded-full blur-[100px] pointer-events-none -z-10"></div>
      <div className="absolute top-40 left-0 -translate-x-1/3 w-[600px] h-[600px] bg-blue-100/50 rounded-full blur-[100px] pointer-events-none -z-10"></div>

      <MarketplaceCartDrawer tenant={tenant} />
      
      {/* Nya Mobile Navigation Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 px-6 flex justify-between lg:hidden z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
         <button onClick={contactWhatsApp} className="flex flex-col items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors">
           <MessageSquare className="w-5 h-5" />
           <span className="text-[10px] font-medium uppercase tracking-wider">Tanya</span>
         </button>
         <button className="flex flex-col items-center gap-1 text-indigo-600">
           <CalendarDays className="w-5 h-5" />
           <span className="text-[10px] font-bold uppercase tracking-wider">Booking</span>
         </button>
         <button onClick={() => setIsCartOpen(true)} className="flex flex-col items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors relative">
           <ShoppingBag className="w-5 h-5" />
           <span className="text-[10px] font-medium uppercase tracking-wider">Tiket</span>
           {totalItems > 0 && (
             <span className="absolute -top-1 right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
               {totalItems}
             </span>
           )}
         </button>
         <button onClick={() => navigate(user ? `/booking/${tenantSlug}/dashboard` : `/booking/${tenantSlug}/auth`)} className="flex flex-col items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors">
           <UserCircle2 className="w-5 h-5" />
           <span className="text-[10px] font-medium uppercase tracking-wider">{user ? 'Akun' : 'Login'}</span>
         </button>
      </div>

      {/* Elegant Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-40 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/booking/${tenantSlug}`)}>
             {tenant.settings?.logoUrl ? (
               <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 shadow-sm">
                 <img src={tenant.settings.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
               </div>
             ) : (
               <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shadow-sm">
                 {tenant.name.charAt(0)}
               </div>
             )}
             <div>
               <h1 className="text-lg font-bold text-gray-900 tracking-tight leading-none">{tenant.name}</h1>
               {tenant.settings?.tagline && (
                 <p className="text-[11px] text-gray-500 font-medium uppercase tracking-widest mt-1">{tenant.settings.tagline}</p>
               )}
             </div>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            <button onClick={contactWhatsApp} className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Bantuan
            </button>
            <button onClick={() => setIsCartOpen(true)} className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors flex items-center gap-2 relative">
              <ShoppingBag className="w-4 h-4" /> Keranjang
              {totalItems > 0 && (
                 <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                   {totalItems}
                 </span>
               )}
            </button>
            {user ? (
               <button onClick={() => navigate(`/booking/${tenantSlug}/dashboard`)} className="px-5 py-2 bg-gray-900 text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition-colors shadow-md">
                 Dashboard Saya
               </button>
            ) : (
              <button onClick={() => navigate(`/booking/${tenantSlug}/auth`)} className="px-5 py-2 bg-gray-900 text-white rounded-full text-sm font-semibold hover:bg-gray-800 transition-colors shadow-md">
                Login / Daftar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Elegant Hero */}
        <section className="mb-20 md:mb-32 flex flex-col md:flex-row items-center gap-12 relative">
          <div className="flex-1 space-y-6 relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50/80 backdrop-blur-sm border border-indigo-100/50 text-indigo-700 text-xs font-black uppercase tracking-widest rounded-full shadow-sm">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                Pemesanan Cepat
              </span>
            </motion.div>
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight tracking-tight">
              Reservasi Layanan <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-300% animate-gradient">Terbaik Untuk Anda</span>
            </motion.h2>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="text-gray-500 text-sm md:text-base max-w-xl leading-relaxed">
              Jelajahi berbagai pilihan paket dan layanan unggulan kami. Jadwalkan waktu Anda dan serahkan sisanya pada <span className="font-bold text-gray-900">{tenant.name}</span>.
            </motion.p>
          </div>
          {tenant.settings?.heroImageUrls?.[0] ? (
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.3 }} className="w-full md:w-5/12 aspect-[4/5] md:aspect-square relative rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-900/10 z-10 group">
               <img src={tenant.settings.heroImageUrls[0]} alt="Hero" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
               <div className="absolute inset-0 bg-gradient-to-t from-gray-900/50 via-gray-900/10 to-transparent"></div>
             </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.3 }} className="w-full md:w-5/12 aspect-[4/5] md:aspect-square relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 border border-white shadow-xl shadow-indigo-900/5 flex flex-col items-center justify-center text-indigo-400 z-10">
               <CalendarDays className="w-24 h-24 mb-6 opacity-40 drop-shadow-sm" />
               <p className="font-semibold text-sm tracking-wide uppercase">Cepat &amp; Mudah</p>
            </motion.div>
          )}
          
          {/* Subtle decoration */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl max-h-[400px] border border-gray-200/50 rounded-full mix-blend-multiply pointer-events-none -z-0 hidden md:block"></div>
        </section>

        {/* Why Choose Us Section */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Mengapa Memilih Kami?</h3>
            <p className="text-gray-500 max-w-2xl mx-auto">Kami berdedikasi untuk memberikan pengalaman layanan terbaik bagi Anda dengan berbagai keunggulan.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {(tenant.settings?.whyChooseUs && tenant.settings.whyChooseUs.length > 0
              ? tenant.settings.whyChooseUs
              : [
                  { icon: 'Star', title: 'Layanan Prima', description: 'Kepuasan pelanggan adalah prioritas utama kami dengan standar tertinggi.' },
                  { icon: 'Clock', title: 'Tepat Waktu', description: 'Pelayanan cepat dan sesuai dengan jadwal yang telah disepakati.' },
                  { icon: 'Shield', title: 'Aman & Terpercaya', description: 'Keamanan data dan kenyamanan bertransaksi sepenuhnya terjamin.' },
                  { icon: 'Award', title: 'Kualitas Terbaik', description: 'Dikerjakan oleh tenaga profesional yang ahli di bidangnya.' },
                  { icon: 'Heart', title: 'Sepenuh Hati', description: 'Kami melayani setiap permintaan dengan keramahan dan ketulusan.' }
                ].slice(0, 5)
            ).map((item, idx) => {
              const IconComponent = {
                Star, Shield, Clock, Heart, CheckCircle, ThumbsUp, Award, Zap
              }[item.icon as keyof typeof import('lucide-react')] || Star;

              return (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-5 rotate-3 hover:rotate-0 transition-transform">
                    <IconComponent className="w-7 h-7" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Gallery Section */}
        <section className="mb-24">
           <div className="text-center mb-12">
             <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Galeri Layanan</h3>
             <p className="text-gray-500 max-w-2xl mx-auto">Lihat beberapa cuplikan layanan dan momen pengalaman yang telah kami hadirkan.</p>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
             {(tenant.settings?.galleryUrls && tenant.settings.galleryUrls.length > 0 
               ? tenant.settings.galleryUrls 
               : [
                 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                 'https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                 'https://images.unsplash.com/photo-1531973576160-7125cd663d86?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                 'https://images.unsplash.com/photo-1527525443983-6e60c75fff50?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
                 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60'
               ]
             ).map((url, idx) => (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9 }}
                 whileInView={{ opacity: 1, scale: 1 }}
                 viewport={{ once: true }}
                 transition={{ delay: idx * 0.1 }}
                 key={idx} 
                 className="aspect-square bg-gray-100 rounded-2xl overflow-hidden hover:opacity-90 transition-opacity cursor-pointer shadow-sm border border-gray-100"
               >
                 <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-700 ease-in-out" />
               </motion.div>
             ))}
           </div>
        </section>

        {/* Discovery & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-gray-100/50 pb-8 relative z-10">
           <div className="relative w-full md:max-w-md group">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
               <Search className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
             </div>
             <input 
               type="text"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Cari layanan, paket..."
               className="w-full pl-12 pr-4 py-4 bg-white/80 backdrop-blur-sm border border-gray-200/80 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
             />
           </div>

           <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-hide no-scrollbar px-1">
             {categories.map((cat) => (
               <button
                 key={cat}
                 onClick={() => setSelectedCategory(cat)}
                 className={`whitespace-nowrap px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 capitalize ${
                   selectedCategory === cat 
                     ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 -translate-y-0.5' 
                     : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200/80 hover:border-gray-300 hover:-translate-y-0.5 shadow-sm'
                 }`}
               >
                 {cat}
               </button>
             ))}
           </div>
        </div>

        {/* Catalog Grid */}
        {filteredProducts.length === 0 ? (
           <div className="text-center py-20 bg-gray-50 rounded-3xl border border-gray-100 mb-16">
             <CalendarDays className="w-16 h-16 text-gray-300 mx-auto mb-4" />
             <p className="text-gray-500 font-medium">Belum ada layanan yang tersedia dalam kategori ini.</p>
           </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 xl:gap-8 mb-24">
            {filteredProducts.map((product, idx) => {
              const displayImage = product.imageUrls?.[0] || (product as any).imageUrl || (product as any).image;
              return (
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.5 }}
                key={product.id}
                className="group flex flex-col bg-white rounded-[1.5rem] border border-gray-100/80 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-indigo-900/10 hover:-translate-y-2 transition-all duration-500 relative z-10"
              >
                <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                  {displayImage ? (
                    <img src={displayImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                      <CalendarDays className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  {product.category && (
                    <div className="absolute top-4 left-4 z-10">
                       <span className="px-3 py-1.5 bg-white/90 backdrop-blur-md text-gray-900 text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg border border-white/50">
                         {product.category}
                       </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                
                <div className="p-4 md:p-5 flex-1 flex flex-col bg-white relative">
                  <div className="mb-3">
                    <h3 className="text-sm md:text-base font-bold text-gray-900 leading-tight mb-1 md:mb-1.5 group-hover:text-indigo-600 transition-colors line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {product.description || 'Deskripsi layanan tidak tersedia.'}
                    </p>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-100/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5 md:hidden">Harga</p>
                      <p className="text-sm md:text-base font-black text-gray-900 leading-none">
                        Rp {product.price?.toLocaleString('id-ID')}
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => handleBooking(product)}
                      className="w-full md:w-10 md:h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center py-2.5 md:py-0 text-sm font-bold md:font-normal group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 group-hover:shadow-lg group-hover:shadow-indigo-600/30 gap-2 md:gap-0"
                    >
                      <span className="md:hidden">Pesan Sekarang</span>
                      <ArrowRight className="w-5 h-5 md:-rotate-45 md:group-hover:rotate-0 transition-transform duration-300" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )})}
          </div>
        )}

        {/* Customer Reviews Section */}
        <section className="mb-24 pt-24 border-t border-gray-100">
           <div className="text-center mb-12">
             <h3 className="text-3xl font-bold text-gray-900 mb-4">Apa Kata Pelanggan Kami</h3>
             <p className="text-gray-500 max-w-2xl mx-auto">Kami bangga dapat memberikan pelayanan maksimal. Berikut adalah beberapa ulasan dari pelanggan yang telah mempercayakan kebutuhannya kepada kami.</p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[
               { name: 'Andi Susanto', rating: 5, date: '2 hari yang lalu', comment: 'Pelayanannya sangat cepat dan memuaskan. Hasil kerja rapi dan profesional. Sangat direkomendasikan!' },
               { name: 'Budi Pratama', rating: 5, date: '1 minggu yang lalu', comment: 'Staff sangat ramah, proses booking mudah tanpa kendala. Kualitas layanan di atas ekspektasi.' },
               { name: 'Citra Kirana', rating: 4, date: '2 minggu yang lalu', comment: 'Secara keseluruhan bagus, tepat waktu. Hasilnya sangat memuaskan dan rapi.' },
               { name: 'Diana Fitri', rating: 5, date: '1 bulan yang lalu', comment: 'Sangat terbantu dengan layanan ini, harga bersahabat dan kualitas tetap nomor satu.' },
               { name: 'Eka Wijaya', rating: 5, date: '2 bulan yang lalu', comment: 'Selalu pakai jasa ini setiap ada kebutuhan, karena timnya selalu tanggap dan hasilnya super.' },
               { name: 'Fajar Nugraha', rating: 5, date: '2 bulan yang lalu', comment: 'Awalnya ragu, tapi setelah coba ternyata luar biasa bagus. Bakal order lagi ke depannya.' }
             ].map((review, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  key={idx} 
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        {review.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{review.name}</h4>
                        <span className="text-xs text-gray-500">{review.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-gray-200'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">"{review.comment}"</p>
                </motion.div>
             ))}
           </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-24 pt-24 border-t border-gray-100">
           <div className="text-center mb-12">
             <h3 className="text-3xl font-bold text-gray-900 mb-4">Pertanyaan yang Sering Diajukan</h3>
             <p className="text-gray-500 max-w-2xl mx-auto">Kami telah merangkum beberapa pertanyaan umum untuk membantu Anda memahami layanan kami dengan lebih baik.</p>
           </div>
           
           <div className="max-w-3xl mx-auto space-y-4">
            {(tenant.settings?.faqs && tenant.settings.faqs.length > 0 
                ? tenant.settings.faqs 
                : [
                  { question: 'Bagaimana cara melakukan pemesanan (booking)?', answer: 'Anda dapat langsung memilih layanan yang tersedia pada halaman ini, lalu ikuti langkah pemesanan dan lengkapi data diri Anda.' },
                  { question: 'Apakah saya bisa mengubah jadwal yang sudah dipesan?', answer: 'Ya, perubahan jadwal bisa dilakukan maksimal H-1 sebelum waktu pelaksanaan. Silakan hubungi admin kami melalui WhatsApp.' },
                  { question: 'Metode pembayaran apa saja yang diterima?', answer: 'Kami menerima berbagai metode pembayaran mulai dari transfer bank, e-Wallet, hingga pembayaran di tempat (Cash on Delivery) sesuai kesepakatan.' },
                  { question: 'Apakah ada biaya tambahan di luar dari harga yang tertera?', answer: 'Harga yang tertera sudah termasuk biaya layanan dasar. Namun, jika ada permintaan khusus di luar paket, akan dikenakan biaya tambahan yang akan diinformasikan sebelumnya.' },
                  { question: 'Berapa lama proses layanan berlangsung?', answer: 'Durasi pengerjaan bergantung pada jenis layanan yang Anda pilih. Informasi estimasi waktu pengerjaan dapat dilihat pada detail masing-masing paket.' }
                ].slice(0, 5)
            ).map((faq, idx) => (
               <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                 <button 
                   onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                   className="w-full p-6 text-left flex items-center justify-between focus:outline-none focus:bg-gray-50 hover:bg-gray-50 transition-colors"
                 >
                   <h4 className="text-lg font-bold text-gray-900 flex items-start">
                     <span className="text-indigo-600 mr-2 flex-shrink-0">Q:</span>
                     {faq.question}
                   </h4>
                   <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${activeFaq === idx ? 'rotate-180' : ''}`} />
                 </button>
                 <AnimatePresence>
                   {activeFaq === idx && (
                     <motion.div
                       initial={{ height: 0, opacity: 0 }}
                       animate={{ height: 'auto', opacity: 1 }}
                       exit={{ height: 0, opacity: 0 }}
                       transition={{ duration: 0.3 }}
                     >
                       <div className="p-6 pt-0 border-t border-gray-50">
                         <p className="text-gray-600 leading-relaxed flex items-start mt-4">
                           <span className="text-gray-400 mr-2 font-bold flex-shrink-0">A:</span>
                           {faq.answer}
                         </p>
                       </div>
                     </motion.div>
                   )}
                 </AnimatePresence>
               </div>
            ))}
           </div>
        </section>

        {/* Gallery Section Removed From Here */}
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-gray-100 bg-white py-12 mt-12 pb-32 lg:pb-12 text-center lg:text-left">
        <div className="max-w-7xl mx-auto px-6 text-sm text-gray-400 flex flex-col md:flex-row items-center justify-between font-medium">
          <p>&copy; {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
          <div className="mt-4 md:mt-0 flex gap-6">
            <a href="#" className="hover:text-gray-900 transition-colors">Syarat & Ketentuan</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Kebijakan Privasi</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
