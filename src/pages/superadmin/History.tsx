import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { History, Eye, Pencil, Trash2, Search, X } from 'lucide-react';

interface ActivityLog {
  id: string;
  tenantId: string;
  tenantName?: string;
  timestamp: Timestamp | Date;
  userId: string;
  userName?: string;
  activity: string;
  details?: string;
}

export default function SuperAdminHistory() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Users & Tenants cache for joining names
  const [tenantsMap, setTenantsMap] = useState<Record<string, string>>({});
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch mappings first to show names instead of IDs (if IDs are stored)
    const fetchMappings = async () => {
      try {
        const [tSnap, uSnap] = await Promise.all([
          getDocs(collection(db, 'tenants')),
          getDocs(collection(db, 'users'))
        ]);
        
        const tMap: Record<string, string> = {};
        tSnap.forEach(d => tMap[d.id] = d.data().name || 'Unknown Tenant');
        setTenantsMap(tMap);

        const uMap: Record<string, string> = {};
        uSnap.forEach(d => uMap[d.id] = d.data().displayName || d.data().email || 'Unknown User');
        setUsersMap(uMap);
      } catch (e) {
        console.error('Error fetching mappings:', e);
      }
    };
    
    fetchMappings();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: ActivityLog[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as ActivityLog);
      });
      setLogs(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching history:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus riwayat ini?')) {
      try {
        await deleteDoc(doc(db, 'activity_logs', id));
      } catch (error) {
        console.error('Error deleting log:', error);
        alert('Gagal menghapus riwayat.');
      }
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLog) return;
    try {
      await updateDoc(doc(db, 'activity_logs', selectedLog.id), {
        activity: selectedLog.activity,
        details: selectedLog.details
      });
      setIsEditModalOpen(false);
      setSelectedLog(null);
    } catch (error) {
      console.error('Error updating log:', error);
      alert('Gagal mengupdate riwayat.');
    }
  };

  const formatDate = (timestamp: Timestamp | Date | any) => {
    if (!timestamp) return '-';
    // Handle Firestore Timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('id-ID');
  };

  const filteredLogs = logs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    const tName = log.tenantName || tenantsMap[log.tenantId] || '';
    const uName = log.userName || usersMap[log.userId] || '';
    return (
      log.activity?.toLowerCase().includes(searchLower) ||
      tName.toLowerCase().includes(searchLower) ||
      uName.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return <div className="flex justify-center py-8">Loading riwayat...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <History className="w-6 h-6 mr-2 text-indigo-600" />
            Riwayat Aktivitas Tenant
          </h1>
          <p className="text-gray-500 mt-1">Pantau semua aktivitas yang dilakukan oleh tenant secara realtime.</p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Cari aktivitas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Nama Tenant</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Tanggal dan Waktu</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Pengguna</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Aktivitas</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {log.tenantName || tenantsMap[log.tenantId] || log.tenantId || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {log.userName || usersMap[log.userId] || log.userId || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {log.activity}
                    </td>
                    <td className="px-6 py-4 text-sm text-right space-x-2">
                      <button 
                        onClick={() => { setSelectedLog(log); setIsDetailModalOpen(true); }}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-md transition-colors"
                        title="Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setSelectedLog(log); setIsEditModalOpen(true); }}
                        className="text-amber-600 hover:text-amber-900 bg-amber-50 p-2 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(log.id)}
                        className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-md transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada riwayat aktivitas ditemukan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600" />
                Detail Aktivitas
              </h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tenant</label>
                <p className="text-gray-900 font-medium mt-1">{selectedLog.tenantName || tenantsMap[selectedLog.tenantId] || selectedLog.tenantId}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Waktu</label>
                <p className="text-gray-900 mt-1">{formatDate(selectedLog.timestamp)}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pengguna</label>
                <p className="text-gray-900 mt-1">{selectedLog.userName || usersMap[selectedLog.userId] || selectedLog.userId}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Aktivitas</label>
                <p className="text-gray-900 mt-1">{selectedLog.activity}</p>
              </div>
              {selectedLog.details && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Detail Tambahan</label>
                  <p className="text-gray-900 mt-1 bg-gray-50 p-3 rounded-md text-sm whitespace-pre-wrap">{selectedLog.details}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-600" />
                Edit Aktivitas
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aktivitas</label>
                <input
                  type="text"
                  required
                  value={selectedLog.activity}
                  onChange={(e) => setSelectedLog({...selectedLog, activity: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Detail Tambahan (Opsional)</label>
                <textarea
                  rows={4}
                  value={selectedLog.details || ''}
                  onChange={(e) => setSelectedLog({...selectedLog, details: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
