import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { FileText, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import ConfirmModal from '../../components/ConfirmModal';
import { PLANS } from '../../constants/plans';
import { SubscriptionPlan } from '../../types';
import { sendPaymentSuccessNotification, sendSubscriptionInfoNotification } from '../../lib/fonnte';
import { sendPaymentSuccessEmail, sendSubscriptionInfoEmail } from '../../lib/email';

export default function SuperAdminInvoices() {
  const { profile } = useAuth();
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
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
        const currentTenant = tenants.find(t => t.id === invoice.tenantId);
        
        const durationInDays = invoice.duration || 30; // Default 30 if not set
        let newEndDate = new Date();
        
        // If current subscription is still active, add to the current end date
        if (currentTenant?.subscriptionEndDate && currentTenant.subscriptionStatus === 'active') {
          const currentEnd = new Date(currentTenant.subscriptionEndDate.seconds * 1000);
          if (currentEnd > new Date()) {
            newEndDate = new Date(currentEnd.getTime());
          }
        }
        
        newEndDate.setDate(newEndDate.getDate() + durationInDays);

        const planDef = PLANS[invoice.planId as SubscriptionPlan];

        await updateDoc(tenantRef, {
          plan: invoice.planId,
          subscription: invoice.planId,
          subscriptionStatus: 'active',
          subscriptionStartDate: serverTimestamp(),
          subscriptionEndDate: newEndDate,
          features: planDef?.features || [],
          limits: planDef?.limits || {},
          billingCycle: `${durationInDays} Hari`,
          lastPaymentMethod: invoice.paymentMethod === 'bank' ? 'Transfer Bank' : 
                            invoice.paymentMethod === 'qris' ? 'QRIS Manual' : 
                            invoice.paymentMethod === 'tripay' ? 'Otomatis (TriPay)' : invoice.paymentMethod || 'Manual',
          updatedAt: serverTimestamp(),
        });

        // Send WhatsApp & Email Notification to Tenant
        if (currentTenant) {
          try {
            const dateStr = newEndDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            
            const paymentVarData = {
              nama_tenant: currentTenant.name,
              plan_name: invoice.planName || invoice.planId,
              amount: `Rp ${Number(invoice.total || invoice.amount).toLocaleString('id-ID')}`,
              invoice_number: invoice.invoiceNumber
            };

            const subscriptionVarData = {
              nama_tenant: currentTenant.name,
              plan_name: invoice.planName || invoice.planId,
              end_date: dateStr
            };

            if (currentTenant.phone) {
              await sendPaymentSuccessNotification(currentTenant.phone, paymentVarData);
            }
            if (currentTenant.email) {
              await sendPaymentSuccessEmail(currentTenant.email, paymentVarData);
            }

            // Delay a bit before second msg
            setTimeout(async () => {
              if (currentTenant.phone) {
                await sendSubscriptionInfoNotification(currentTenant.phone, subscriptionVarData);
              }
              if (currentTenant.email) {
                await sendSubscriptionInfoEmail(currentTenant.email, subscriptionVarData);
              }
            }, 2000);
          } catch (e) {
            console.error("Failed to send WA/Email notification", e);
          }
        }
      }

      await fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `finance_invoices/${invoice.id}`, auth, profile);
    } finally {
      setProcessingId(null);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.length === allInvoices.length && allInvoices.length > 0) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(allInvoices.map(inv => inv.id));
    }
  };

  const toggleSelectInvoice = (id: string) => {
    if (selectedInvoices.includes(id)) {
      setSelectedInvoices(selectedInvoices.filter(i => i !== id));
    } else {
      setSelectedInvoices([...selectedInvoices, id]);
    }
  };

  const handleDeleteSelected = async () => {
    setProcessingId('delete-multiple');
    try {
      const deletePromises = selectedInvoices.map(id => deleteDoc(doc(db, 'finance_invoices', id)));
      await Promise.all(deletePromises);
      setSelectedInvoices([]);
      await fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'finance_invoices', auth, profile);
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

      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-indigo-600" />
            Daftar Invoice
          </h3>
          {selectedInvoices.length > 0 && (
            <button
              onClick={() => setConfirmModal({
                isOpen: true,
                title: 'Hapus Invoice',
                message: `Apakah Anda yakin ingin menghapus ${selectedInvoices.length} invoice yang dipilih?`,
                type: 'danger',
                onConfirm: handleDeleteSelected
              })}
              disabled={processingId === 'delete-multiple'}
              className="px-4 py-2 bg-red-600 text-white rounded-md font-bold flex items-center shadow-lg hover:bg-red-700 transition"
            >
              {processingId === 'delete-multiple' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Hapus ({selectedInvoices.length})
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={allInvoices.length > 0 && selectedInvoices.length === allInvoices.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                </th>
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
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">Memuat data invoice...</td>
                </tr>
              ) : allInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">Belum ada invoice.</td>
                </tr>
              ) : (
                allInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.includes(inv.id)}
                        onChange={() => toggleSelectInvoice(inv.id)}
                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      />
                    </td>
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
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
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
                            className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
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
