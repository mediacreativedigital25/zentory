import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, limit, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product, Tenant } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../hooks/useAuth';
import MarketplaceCartDrawer from '../../components/marketplace/MarketplaceCartDrawer';
import { 
  Building2, MapPin, Phone, Clock, Star, Share2, MessageSquare, 
  Search, ShoppingCart, ArrowLeft, Package, Minus, Plus 
} from 'lucide-react';

export default function ProductDetailV1() {
  const { tenantSlug, productId } = useParams<{ tenantSlug: string, productId: string }>();
  const navigate = useNavigate();
  const { addToCart, totalItems, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  const getBasePath = () => {
    if (tenant?.catalogTheme === 'booking-v1') return 'booking';
    if (tenant?.catalogTheme === 'v1') return 'marketplace';
    return 'catalog';
  };
  const [reviews, setReviews] = useState<any[]>([]);
  const [newReview, setNewReview] = useState({ rating: 0, hoverRating: 0, comment: '', name: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [productRating, setProductRating] = useState({ rating: 0, count: 0 });

  useEffect(() => {
    const fetchProductData = async () => {
      if (!tenantSlug || !productId) return;
      
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

        // Fetch product
        const productDoc = await getDoc(doc(db, 'products', productId));
        if (productDoc.exists()) {
          const productData = { id: productDoc.id, ...productDoc.data() } as Product;
          setProduct(productData);

          // Fetch related products (same category)
          const relatedQuery = query(
            collection(db, 'products'),
            where('tenantId', '==', tenantData.id),
            // where('categoryId', '==', productData.categoryId || null), // This might need index
            limit(5)
          );
          const relatedSnap = await getDocs(relatedQuery);
          let related = relatedSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Product))
            .filter(p => p.id !== productId);
            
          // If less than 4 related, try getting random ones
          if (related.length < 4) {
             const anyProductsQuery = query(
                collection(db, 'products'),
                where('tenantId', '==', tenantData.id),
                limit(5)
              );
              const anyProductsSnap = await getDocs(anyProductsQuery);
              const anyRelated = anyProductsSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Product))
                .filter(p => p.id !== productId);
              related = anyRelated;
          }
          
          setRelatedProducts(related.slice(0, 4));

          try {
            const reviewsQuery = query(
              collection(db, 'reviews'),
              where('productId', '==', productId)
              // Note: omitting orderBy to simplify index requirements for now
            );
            const reviewsSnap = await getDocs(reviewsQuery);
            const reviewsData = reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort client-side
            reviewsData.sort((a: any, b: any) => {
               const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
               const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
               return tb - ta;
            });
            setReviews(reviewsData);
            
            let totalRating = 0;
            reviewsData.forEach(r => {
                totalRating += (r as any).rating || 0;
            });
            setProductRating({
                rating: reviewsData.length > 0 ? totalRating / reviewsData.length : 0,
                count: reviewsData.length
            });
          } catch (reviewError) {
             console.error('Failed to fetch reviews:', reviewError);
          }
        }
      } catch (error) {
        console.error('Error fetching product data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProductData();
  }, [tenantSlug, productId]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newReview.rating === 0) {
      alert('Silakan pilih rating (1-5 bintang)');
      return;
    }
    if (!newReview.name.trim() || !newReview.comment.trim()) {
      alert('Nama dan ulasan harus diisi');
      return;
    }

    try {
      setSubmittingReview(true);
      const reviewDoc = {
        productId: product?.id,
        productName: product?.name,
        tenantId: tenant?.id,
        rating: newReview.rating,
        name: newReview.name,
        comment: newReview.comment,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, 'reviews'), reviewDoc);
      
      // Add to local state optimistically
      const addedReview = { 
        ...reviewDoc, 
        id: docRef.id, 
        createdAt: { toMillis: () => Date.now() } 
      };
      setReviews([addedReview, ...reviews]);
      setNewReview({ rating: 0, hoverRating: 0, comment: '', name: '' });
      alert('Ulasan berhasil dikirim!');
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Gagal mengirim ulasan');
    } finally {
      setSubmittingReview(false);
    }
  };

  const contactWhatsApp = () => {
    const phoneNumber = tenant?.settings?.phone || tenant?.phone;
    if (phoneNumber && product) {
      const text = `Halo, saya tertarik dengan produk ${product.name} (Rp ${product.price.toLocaleString('id-ID')}). Apakah stoknya masih ada?`;
      window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`, '_blank');
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

  if (!tenant || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Toko atau Produk Tidak Ditemukan</h2>
        <button 
          onClick={() => navigate(`/${getBasePath()}/${tenantSlug}`)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Kembali ke Beranda Store
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <MarketplaceCartDrawer tenant={tenant} />

      {/* Header */}
      <header className="bg-white sticky top-0 z-50 border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate(`/${getBasePath()}/${tenantSlug}`)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                aria-label="Kembali"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div 
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => navigate(`/${getBasePath()}/${tenantSlug}`)}
              >
                {tenant.settings?.logoUrl ? (
                  <img src={tenant.settings.logoUrl} alt={tenant.name} className="w-12 h-12 rounded-full object-cover border border-gray-100" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                    {tenant.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <h1 className="text-xl font-bold text-gray-900 hidden sm:block hover:text-indigo-600 transition-colors">
                  {tenant.name}
                </h1>
              </div>
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
                  onClick={() => navigate(`/${getBasePath()}/${tenantSlug}/dashboard`)}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Dashboard Saya
                </button>
              ) : (
                <button 
                  onClick={() => navigate(`/${getBasePath()}/${tenantSlug}/auth`)}
                  className="text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors"
                >
                  Login / Daftar
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24">
        {/* Product Section */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row">
              {/* Product Image */}
              <div className="w-full lg:w-1/2 bg-gray-50 flex items-center justify-center relative shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100">
                <div className="w-full aspect-square lg:max-w-[500px] lg:my-12 lg:rounded-3xl relative flex items-center justify-center overflow-hidden bg-white lg:shadow-md lg:border border-gray-100">
                  {product.image || product.imageUrl ? (
                    <img 
                      src={product.image || product.imageUrl} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 gap-3">
                      <Package className="w-16 h-16 opacity-30" />
                      <span className="font-medium text-sm">No Image Available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div className="w-full lg:w-1/2 p-6 md:p-10 flex flex-col">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full uppercase tracking-wider">
                    {(product as any).categoryId || product.category || 'General'}
                  </span>
                  {productRating.count > 0 && (
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-amber-500 bg-amber-50 px-2.5 py-1.5 rounded-full">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{productRating.rating.toFixed(1)} ({productRating.count})</span>
                    </div>
                  )}
                </div>
                
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-4 leading-tight">{product.name}</h1>
                
                <div className="text-2xl sm:text-3xl font-black text-indigo-600 mb-8 flex items-baseline gap-2">
                  Rp {(product.price || 0).toLocaleString('id-ID')}
                  {product.variants && product.variants.length > 0 && (
                    <span className="text-base font-normal text-gray-500">
                      - Rp {(Math.max(...product.variants.map((v: any) => v.price)) || 0).toLocaleString('id-ID')}
                    </span>
                  )}
                </div>

                {product.variants && product.variants.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                      PILIH VARIAN
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((variant: any) => (
                        <button 
                          key={variant.id}
                          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:border-indigo-600 hover:text-indigo-600 transition-colors bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                        >
                          {variant.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Desktop Sticky Actions (Bottom for mobile) */}
                <div className="hidden lg:block mt-auto pt-8">
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                       PENGATURAN JUMLAH
                    </h3>
                    <div className="flex items-center justify-between border border-gray-200 rounded-lg p-1 bg-white max-w-[120px]">
                      <button 
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-all focus:outline-none"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center font-semibold text-gray-900 text-base">{quantity}</span>
                      <button 
                        onClick={() => setQuantity(quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-all focus:outline-none"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={contactWhatsApp}
                      className="flex-1 bg-white border border-indigo-600 text-indigo-600 py-3 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" /> Tanya Penjual
                    </button>
                    <button 
                      onClick={() => addToCart(product, quantity)}
                      className="flex-1 bg-indigo-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" /> + Keranjang
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-gray-200 pb-4">
                Deskripsi Produk
              </h3>
              <div className="text-gray-600 text-base leading-relaxed whitespace-pre-wrap">
                {product.description || 'Tidak ada deskripsi untuk produk ini.'}
              </div>

              {/* Reviews & Ratings Section */}
              <div className="mt-12 pt-10 border-t border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-widest mb-8 flex items-center gap-2">
                  Penilaian Produk
                </h3>

                {/* Rating Form */}
                <div className="bg-gray-50 rounded-2xl p-6 sm:p-8 mb-10 border border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-4">Tinggalkan Ulasan</h4>
                  <form onSubmit={submitReview}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className="focus:outline-none"
                            onMouseEnter={() => setNewReview({ ...newReview, hoverRating: star })}
                            onMouseLeave={() => setNewReview({ ...newReview, hoverRating: 0 })}
                            onClick={() => setNewReview({ ...newReview, rating: star })}
                          >
                            <Star 
                              className={`w-8 h-8 transition-colors ${
                                star <= (newReview.hoverRating || newReview.rating)
                                  ? 'fill-amber-400 text-amber-400' 
                                  : 'text-gray-300'
                              }`} 
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nama Anda</label>
                      <input 
                        type="text" 
                        required
                        value={newReview.name}
                        onChange={(e) => setNewReview({ ...newReview, name: e.target.value })}
                        className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                        placeholder="Masukkan nama"
                      />
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ulasan</label>
                      <textarea 
                        required
                        value={newReview.comment}
                        onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                        rows={3}
                        className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                        placeholder="Bagaimana pendapat Anda tentang produk ini?"
                      ></textarea>
                    </div>

                    <button 
                      type="submit" 
                      disabled={submittingReview}
                      className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {submittingReview ? 'Mengirim...' : 'Kirim Ulasan'}
                    </button>
                  </form>
                </div>

                {/* Reviews List */}
                <div className="space-y-6">
                  {reviews.length > 0 ? (
                    reviews.map((r) => (
                      <div key={r.id} className="border-b border-gray-100 pb-6 last:border-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-bold text-gray-900">{r.name}</span>
                            <div className="flex items-center gap-1 mt-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star 
                                  key={star} 
                                  className={`w-3.5 h-3.5 ${star <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} 
                                />
                              ))}
                            </div>
                          </div>
                          {r.createdAt && r.createdAt.toMillis && (
                            <span className="text-xs text-gray-400">
                              {new Date(r.createdAt.toMillis()).toLocaleDateString('id-ID')}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm mt-3">{r.comment}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Belum ada ulasan untuk produk ini. Jadilah yang pertama!
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-6">Informasi Toko</h3>
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
                  {tenant.settings?.logoUrl ? (
                    <img src={tenant.settings.logoUrl} alt={tenant.name} className="w-16 h-16 rounded-full object-cover border border-gray-100" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
                      {tenant.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-gray-900">{tenant.name}</h4>
                    <p className="text-sm text-gray-500 mb-1">Trusted Seller</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3 text-sm text-gray-600">
                    <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                    <span>{tenant.settings?.address || tenant.address || 'Alamat tidak tersedia'}</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-gray-600">
                    <Clock className="w-5 h-5 text-gray-400 shrink-0" />
                    <span>{tenant.settings?.operationalHours || '09:00 - 17:00'}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => navigate(`/${getBasePath()}/${tenantSlug}`)}
                  className="w-full mt-6 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Kunjungi Toko
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-white border-t border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-8">Mungkin Kamu Suka</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map(rp => (
                <div 
                  key={rp.id}
                  onClick={() => navigate(`/${getBasePath()}/${tenantSlug}/product/${rp.id}`)}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full hover:-translate-y-1 cursor-pointer"
                >
                  <div className="aspect-square bg-gray-100 relative overflow-hidden flex items-center justify-center">
                    {rp.image || rp.imageUrl ? (
                      <img 
                        src={rp.image || rp.imageUrl} 
                        alt={rp.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <Package className="w-12 h-12 text-gray-300" />
                    )}
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col bg-white">
                    <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-sm group-hover:text-indigo-600 transition-colors">
                      {rp.name}
                    </h4>
                    <div className="mt-auto">
                      <p className="text-sm font-bold text-gray-900">
                        Rp {(rp.price || 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Sticky Actions */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-bold text-gray-900">Total: <span className="text-indigo-600 font-black">Rp {((product.price || 0) * quantity).toLocaleString('id-ID')}</span></span>
            <div className="flex items-center justify-between border border-gray-200 rounded-lg p-0.5 bg-white w-[110px]">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 flex items-center justify-center text-gray-600 active:bg-gray-50 rounded-md transition-all focus:outline-none"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-bold text-gray-900 text-sm">{quantity}</span>
              <button 
                 onClick={() => setQuantity(quantity + 1)}
                 className="w-8 h-8 flex items-center justify-center text-gray-600 active:bg-gray-50 rounded-md transition-all focus:outline-none"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={contactWhatsApp}
              className="flex-1 bg-white border border-indigo-600 text-indigo-600 py-2 rounded-lg text-sm font-semibold active:bg-indigo-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" /> Tanya
            </button>
            <button 
              onClick={() => addToCart(product, quantity)}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold active:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              <ShoppingCart className="w-4 h-4" /> + Keranjang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
