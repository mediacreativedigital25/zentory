import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { FileText, Download, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function LayananInvoice() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!profile?.tenantId) return;
      try {
        const q = query(
          collection(db, 'finance_invoices'),
          where('tenantId', '==', profile.tenantId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching invoices:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [profile]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoice Layanan</h2>
          <p className="text-gray-500">Riwayat pembayaran langganan Zyvora Anda.</p>
        </div>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">No. Invoice</th>
                <th className="px-6 py-4">Paket</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Memuat data invoice...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <FileText className="w-12 h-12 text-gray-200 mb-4" />
                      <p className="text-gray-500 font-medium">Belum ada riwayat invoice.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-indigo-600">{inv.invoiceNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900 capitalize">{inv.planId || 'Upgrade'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-gray-900">Rp{inv.total?.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {inv.status === 'paid' ? (
                          <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase">
                            <CheckCircle2 className="w-3 h-3" />
                            LUNAS
                          </span>
                        ) : inv.status === 'pending' ? (
                          <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase">
                            <Clock className="w-3 h-3" />
                            PENDING
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-black uppercase">
                            <AlertCircle className="w-3 h-3" />
                            {inv.status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-500">
                        {inv.createdAt ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString('id-ID') : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="Download Invoice">
                        <Download className="w-4 h-4" />
                      </button>
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
