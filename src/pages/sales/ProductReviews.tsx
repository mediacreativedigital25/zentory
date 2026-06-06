import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Search, Star, Trash2, Edit2, X, Check, Store } from 'lucide-react';

export default function ProductReviews() {
  const { profile, domainTenantId } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  const tId = domainTenantId || profile?.tenantId;

  useEffect(() => {
    fetchReviews();
  }, [tId]);

  const fetchReviews = async () => {
    if (!tId) return;
    try {
      setLoading(true);
      const q = query(collection(db, 'reviews'), where('tenantId', '==', tId));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Map product names for older reviews
      const productsQ = query(collection(db, 'products'), where('tenantId', '==', tId));
      const productsSnap = await getDocs(productsQ);
      const productsMap: Record<string, string> = {};
      productsSnap.forEach(p => {
        productsMap[p.id] = p.data().name;
      });

      const enrichedData = data.map((r: any) => ({
        ...r,
        productName: r.productName || productsMap[r.productId] || 'Produk Dihapus'
      }));

      // target sorting locally
      enrichedData.sort((a: any, b: any) => {
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        return tb - ta;
      });
      setReviews(enrichedData);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus ulasan ini?')) return;
    try {
      await deleteDoc(doc(db, 'reviews', id));
      setReviews(reviews.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting review:', error);
      alert('Gagal menghapus ulasan');
    }
  };

  const startEdit = (review: any) => {
    setEditingId(review.id);
    setEditData({
      name: review.name || '',
      comment: review.comment || '',
      rating: review.rating || 0
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reviews', id), {
        name: editData.name,
        comment: editData.comment,
        rating: editData.rating
      });
      setReviews(reviews.map(r => r.id === id ? { ...r, ...editData } : r));
      setEditingId(null);
    } catch (error) {
      console.error('Error updating review:', error);
      alert('Gagal mengupdate ulasan');
    }
  };

  const filteredReviews = reviews.filter(r => 
    (r.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.comment || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500" />
            Review Produk
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola ulasan dari pelanggan Anda</p>
        </div>
        <div className="relative max-w-sm w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari produk, nama, atau komentar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pelanggan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Komentar</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    Memuat ulasan...
                  </td>
                </tr>
              ) : filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    Belum ada ulasan yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredReviews.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Store className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                        <span className="text-sm font-medium text-gray-900 max-w-[200px] truncate" title={review.productName}>
                          {review.productName || 'Produk Dihapus'}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      {editingId === review.id ? (
                        <div className="flex flex-col gap-2">
                           <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 w-full"
                          />
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setEditData({ ...editData, rating: star })}
                                className={`${star <= editData.rating ? 'text-amber-500' : 'text-gray-300'} focus:outline-none`}
                              >
                                <Star className="w-4 h-4 fill-current" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{review.name || 'NN'}</div>
                          <div className="flex items-center mt-1">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-3 h-3 ${i < (review.rating || 0) ? 'text-amber-500 fill-current' : 'text-gray-300'}`} 
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 min-w-[250px] max-w-[400px]">
                       {editingId === review.id ? (
                         <textarea
                            value={editData.comment}
                            onChange={(e) => setEditData({ ...editData, comment: e.target.value })}
                            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 w-full"
                            rows={3}
                          />
                       ) : (
                         <p className="text-sm text-gray-600 line-clamp-3" title={review.comment}>
                           {review.comment || <span className="text-gray-400 italic">Tidak ada komentar</span>}
                         </p>
                       )}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingId === review.id ? (
                        <div className="flex items-center justify-end gap-2">
                           <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 bg-gray-100 p-1.5 rounded-md transition-colors" title="Batal">
                             <X className="w-4 h-4" />
                           </button>
                           <button onClick={() => saveEdit(review.id)} className="text-green-600 hover:text-green-700 bg-green-50 p-1.5 rounded-md transition-colors" title="Simpan">
                             <Check className="w-4 h-4" />
                           </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                           <button onClick={() => startEdit(review)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-1.5 rounded-md transition-colors" title="Edit">
                             <Edit2 className="w-4 h-4" />
                           </button>
                          <button onClick={() => handleDelete(review.id)} className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-md transition-colors" title="Hapus">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
