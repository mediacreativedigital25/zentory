import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import ConfirmModal from '../../components/ConfirmModal';

export default function SuperAdminInvoices() {
  const { profile } = useAuth();
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'danger' | 'warning';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: () => {},
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invoiceSnap, tenantSnap] = await Promise.all([
        getDocs(query(collection(db, 'finance_invoices'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'tenants'))
      ]);
      setAllInvoices(invoiceSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTenants(tenantSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  const handleUpdateStatus = async (invoice: any, newStatus: 'paid' | 'cancelled') => {
    setProcessingId(invoice.id);
    try {
      const invoiceRef = doc(db, 'finance_invoices', invoice.id);
      await updateDoc(invoiceRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        resolvedBy: profile?.uid,
      });

      // If PAID, also update the tenant plan
      if (newStatus === 'paid' && invoice.tenantId && invoice.planId) {
        const tenantRef = doc(db, 'tenants', invoice.tenantId);
        await updateDoc(tenantRef, {
          plan: invoice.planId,
          subscription: invoice.planId,
          subscriptionStatus: 'active',
          updatedAt: serverTimestamp(),
        });
      }

      await fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `finance_invoices/${invoice.id}`, auth, profile);
    } finally {
      setProcessingId(null);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
          <p className="text-gray-500">Semua invoice dari seluruh tenant.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-indigo-600" />
            Daftar Invoice
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4">Tenant</th>
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
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">Memuat data invoice...</td>
                </tr>
              ) : allInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">Belum ada invoice.</td>
                </tr>
              ) : (
                allInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-600">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{tenants.find(t => t.id === inv.tenantId)?.name || inv.tenantName || inv.tenantId}</span>
                        <span className="text-[10px] text-gray-400 font-medium">{inv.userEmail}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900 capitalize">{inv.planName || inv.planId || '-'}</span>
                    </td>
                    <td className="px-6 py-4 font-black text-gray-900">Rp{inv.total?.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                        inv.status === 'paid' ? 'bg-green-100 text-green-700' : 
                        inv.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {inv.status === 'paid' ? 'LUNAS' : inv.status === 'cancelled' ? 'BATAL' : 'PENDING'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {inv.createdAt ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {inv.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setConfirmModal({
                              isOpen: true,
                              title: 'Batalkan Invoice',
                              message: `Apakah Anda yakin ingin membatalkan invoice ${inv.invoiceNumber}?`,
                              type: 'danger',
                              onConfirm: () => handleUpdateStatus(inv, 'cancelled')
                            })}
                            disabled={processingId === inv.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Batalkan Invoice"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setConfirmModal({
                              isOpen: true,
                              title: 'Konfirmasi Pembayaran',
                              message: `Apakah Anda yakin invoice ${inv.invoiceNumber} telah dibayar? Tindakan ini akan mengaktifkan paket tenant secara otomatis.`,
                              type: 'info',
                              onConfirm: () => handleUpdateStatus(inv, 'paid')
                            })}
                            disabled={processingId === inv.id}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Tandai Sudah Bayar"
                          >
                            {processingId === inv.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-5 h-5" />
                            )}
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
      
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
