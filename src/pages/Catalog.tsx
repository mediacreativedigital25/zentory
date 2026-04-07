import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tenant, Product } from '../types';
import { ShoppingBag, Search, Filter } from 'lucide-react';
import { motion } from 'motion/react';

export default function Catalog() {
  const { tenantSlug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // 1. Find tenant by slug
      const tenantQuery = query(collection(db, 'tenants'), where('slug', '==', tenantSlug));
      const tenantSnap = await getDocs(tenantQuery);
      
      if (!tenantSnap.empty) {
        const tenantData = { id: tenantSnap.docs[0].id, ...tenantSnap.docs[0].data() } as Tenant;
        setTenant(tenantData);

        // 2. Fetch products for this tenant
        const prodQuery = query(collection(db, 'products'), where('tenantId', '==', tenantData.id));
        const prodSnap = await getDocs(prodQuery);
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      }
      setLoading(false);
    };
    fetchData();
  }, [tenantSlug]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading Catalog...</div>;
  if (!tenant) return <div className="flex items-center justify-center min-h-screen text-red-500">Store not found.</div>;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center">
            {tenant.settings?.logoUrl ? (
              <img src={tenant.settings.logoUrl} alt={tenant.name} className="h-8 w-auto mr-3" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl mr-3">
                {tenant.name.charAt(0)}
              </div>
            )}
            <h1 className="text-xl font-bold text-gray-900">{tenant.name}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-full text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-64"
              />
            </div>
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full relative">
              <ShoppingBag className="w-6 h-6" />
              <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">0</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-indigo-50 py-12 px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Welcome to {tenant.name}</h2>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          {tenant.settings?.description || 'Browse our exclusive collection of products.'}
        </p>
      </section>

      {/* Product Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900">Our Products</h3>
          <button className="flex items-center text-gray-600 hover:text-indigo-600">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <motion.div
              key={product.id}
              whileHover={{ y: -5 }}
              className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all"
            >
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                <img
                  src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/400`}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                {product.stock <= 0 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-white text-black px-3 py-1 rounded-full text-xs font-bold">OUT OF STOCK</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{product.category}</p>
                <h4 className="font-bold text-gray-900 mb-2 truncate">{product.name}</h4>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-extrabold text-indigo-600">Rp.{(product.price || 0).toLocaleString()}</p>
                  <button
                    disabled={product.stock <= 0}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-600 transition-colors disabled:bg-gray-300"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No products found in this store.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-500 text-sm">© 2026 {tenant.name}. Powered by Zentory.</p>
        </div>
      </footer>
    </div>
  );
}
