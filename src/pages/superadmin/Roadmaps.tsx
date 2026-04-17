import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ListChecks, CheckCircle2, Clock, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export default function SuperAdminRoadmaps() {
  const { profile } = useAuth();
  const [roadmapItems, setRoadmapItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubRoadmap = onSnapshot(query(collection(db, 'system_roadmap'), orderBy('order', 'asc')), (snap) => {
      if (snap.empty) {
        const defaults = [
          { order: 1, title: 'Riwayat Stok (Stock Ledger)', description: 'Pencatatan mutasi stok masuk/keluar secara detail.', status: 'completed', category: 'Inventory' },
          { order: 2, title: 'Notifikasi Stok Rendah', description: 'Peringatan otomatis saat stok mencapai batas minimum.', status: 'pending', category: 'Inventory' },
          { order: 3, title: 'Laporan & Analitik Visual', description: 'Grafik tren penjualan dan performa produk.', status: 'pending', category: 'Reporting' },
          { order: 4, title: 'Manajemen Pemasok', description: 'Database supplier dan histori pembelian.', status: 'pending', category: 'Purchase' },
          { order: 5, title: 'Validasi Keamanan Firestore', description: 'Audit dan penguatan security rules.', status: 'completed', category: 'Security' },
          { order: 6, title: 'Ekspor/Impor Data', description: 'Fitur download data ke format Excel/CSV.', status: 'pending', category: 'System' },
          { order: 7, title: 'Optimasi Mobile (PWA)', description: 'Aplikasi dapat diinstal di HP untuk operasional gudang.', status: 'pending', category: 'System' },
        ];
        Promise.all(defaults.map(item => addDoc(collection(db, 'system_roadmap'), item)))
          .catch(err => console.error('Error initializing roadmap:', err));
      } else {
        setRoadmapItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'system_roadmap', auth, profile);
      setLoading(false);
    });

    return () => unsubRoadmap();
  }, [profile]);

  const toggleRoadmapStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await updateDoc(doc(db, 'system_roadmap', id), { status: newStatus });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">System Roadmap</h2>
        <p className="text-gray-500">Track development progress and upcoming features.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 flex items-center">
            <ListChecks className="w-5 h-5 mr-2 text-indigo-600" />
            Development Progress
          </h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {loading ? (
              <p className="text-center py-8 text-gray-500">Memuat roadmap...</p>
            ) : roadmapItems.map((item) => (
              <div key={item.id} className="flex items-start p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors group">
                <button 
                  onClick={() => toggleRoadmapStatus(item.id, item.status)}
                  className={`mt-1 p-1 rounded-full border-2 transition-colors ${
                    item.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 text-transparent group-hover:border-gray-300'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-bold ${item.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {item.title}
                    </h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                      item.category === 'Inventory' ? 'bg-blue-100 text-blue-700' :
                      item.category === 'Reporting' ? 'bg-purple-100 text-purple-700' :
                      item.category === 'Security' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {item.category}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${item.status === 'completed' ? 'text-gray-300' : 'text-gray-500'}`}>
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
