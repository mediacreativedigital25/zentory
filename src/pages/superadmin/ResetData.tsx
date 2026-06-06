import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, writeBatch, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Tenant } from '../../types';
import { RefreshCcw, AlertTriangle, Building2, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export default function SuperAdminResetData() {
  const { profile } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedResetTenant, setSelectedResetTenant] = useState<string>('');
  const [resetCollections, setResetCollections] = useState<string[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; showCancel?: boolean } | null>(null);
  const [resetProgress, setResetProgress] = useState<string>('');
  const [confirmText, setConfirmText] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const tenantSnap = await getDocs(query(collection(db, 'tenants'), orderBy('name', 'asc')));
        setTenants(tenantSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'tenants', auth, profile);
      }
    };
    fetchTenants();
  }, [profile]);

  const collectionsToReset = [
    { id: 'orders', label: 'Orders (Pesanan)' },
    { id: 'invoice_collections', label: 'Invoices (Faktur Penjualan)' },
    { id: 'finance_invoices', label: 'Billing Invoices (Tagihan Langganan)' },
    { id: 'payment_receipts', label: 'Payment Receipts (Kuitansi)' },
    { id: 'transactions', label: 'Transactions (Jurnal/Keuangan)' },
    { id: 'bank_accounts', label: 'Bank Accounts (Rekening)' },
    { id: 'bank_transfers', label: 'Bank Transfers (Transfer Antar Rekening)' },
    { id: 'dailyClosings', label: 'Daily Closings (Tutup Buku)' },
    { id: 'charityRecords', label: 'Charity Records (Zakat/Infaq)' },
    { id: 'products', label: 'Products (Produk)' },
    { id: 'categories', label: 'Categories (Kategori Produk)' },
    { id: 'warehouses', label: 'Warehouses (Gudang)' },
    { id: 'stock_logs', label: 'Stock Logs (Riwayat Stok)' },
    { id: 'suppliers', label: 'Suppliers (Pemasok)' },
    { id: 'purchase_requests', label: 'Purchase Requests (PR)' },
    { id: 'purchase_orders', label: 'Purchase Orders (PO)' },
    { id: 'goods_receipts', label: 'Goods Receipts (GR)' },
    { id: 'purchase_invoices', label: 'Purchase Invoices (PI)' },
    { id: 'customers', label: 'Customers (Pelanggan)' },
    { id: 'customer_categories', label: 'Customer Categories (Kategori Pelanggan)' },
    { id: 'sales_targets', label: 'Sales Targets (Target Penjualan)' },
    { id: 'coupons', label: 'Coupons (Kupon Diskon)' },
    { id: 'approval_requests', label: 'Approval Requests (Persetujuan)' },
    { id: 'delete_requests', label: 'Delete/Edit Requests (Permintaan Edit/Hapus)' },
    { id: 'payment_corrections', label: 'Payment Corrections (Koreksi Pembayaran)' },
    { id: 'expenseRules', label: 'Expense Rules (Aturan Biaya)' },
    { id: 'roles', label: 'Custom Roles (Jabatan)' },
    { id: 'counters', label: 'Counters (Sequence Numbers / ID)' },
    { id: 'services', label: 'Layanan / Services (Produk Jasa)' },
    { id: 'service_categories', label: 'Kategori Layanan' }
  ];

  const handleResetInitiate = () => {
    if (!selectedResetTenant) return;
    if (resetCollections.length === 0) return;
    setConfirmText('');
    setShowConfirmModal(true);
  };

  const executeReset = async () => {
    const tenantName = tenants.find(t => t.id === selectedResetTenant)?.name || selectedResetTenant;
    
    if (confirmText !== tenantName) {
      alert(`Mohon ketikkan nama tenant dengan benar: ${tenantName}`);
      return;
    }

    setShowConfirmModal(false);
    setIsResetting(true);
    setResetSuccess(false);
    
    try {
      for (const collId of resetCollections) {
        setResetProgress(`Menghapus data ${collectionsToReset.find(c => c.id === collId)?.label || collId}...`);
        
        if (collId === 'counters') {
            try {
              const counterSnap = await getDocs(collection(db, 'counters'));
              const countersToDelete = counterSnap.docs.filter(d => d.id.startsWith(`${selectedResetTenant}_`));
              let cBatch = writeBatch(db);
              let cCount = 0;
              countersToDelete.forEach(c => {
                 cBatch.delete(c.ref);
                 cCount++;
                 if (cCount === 490) {
                     cBatch.commit();
                     cBatch = writeBatch(db);
                     cCount = 0;
                 }
              });
              if (cCount > 0) await cBatch.commit();
            } catch(e) {
                console.error('Error deleting counters', e);
            }
        } else {
            const q = query(collection(db, collId), where('tenantId', '==', selectedResetTenant));
            const snap = await getDocs(q);
            
            let batch = writeBatch(db);
            let count = 0;
            
            for (const d of snap.docs) {
              batch.delete(d.ref);
              count++;
              if (count === 490) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
              }
            }
            if (count > 0) await batch.commit();
        }
      }
      
      setResetSuccess(true);
      setResetCollections([]);
      setResetProgress('');
      setTimeout(() => setResetSuccess(false), 5000);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.DELETE, 'multiple_collections', auth, profile);
      setResetProgress('Terjadi kesalahan saat mereset data.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reset Data</h2>
        <p className="text-gray-500">Hapus data spesifik untuk tenant tertentu. Gunakan dengan sangat hati-hati.</p>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100 p-8">
        <div className="max-w-2xl space-y-8">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-md flex items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Peringatan Kritis</p>
              <p className="text-xs text-amber-700">Tindakan ini akan menghapus data secara permanen dari database. Data yang dihapus tidak dapat dikembalikan.</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-semibold text-gray-600">1. Pilih Tenant</label>
            <select
              value={selectedResetTenant}
              onChange={(e) => setSelectedResetTenant(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Pilih Tenant --</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-semibold text-gray-600">2. Pilih Data yang Akan Dihapus</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {collectionsToReset.map(coll => (
                <label key={coll.id} className="flex items-center p-3 border border-gray-100 rounded-md hover:bg-white cursor-pointer transition-colors text-xs font-medium text-gray-600">
                  <input
                    type="checkbox"
                    checked={resetCollections.includes(coll.id)}
                    onChange={(e) => {
                      if (e.target.checked) setResetCollections([...resetCollections, coll.id]);
                      else setResetCollections(resetCollections.filter(id => id !== coll.id));
                    }}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 mr-3"
                  />
                  <span className="text-sm text-gray-700">{coll.label}</span>
                </label>
              ))}
            </div>
            <div className="flex space-x-4 mt-2">
              <button 
                onClick={() => setResetCollections(collectionsToReset.map(c => c.id))}
                className="text-xs font-bold text-indigo-600"
              >
                Pilih Semua
              </button>
              <button 
                onClick={() => setResetCollections([])}
                className="text-xs font-bold text-gray-500"
              >
                Hapus Semua Pilihan
              </button>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleResetInitiate}
              disabled={!selectedResetTenant || resetCollections.length === 0 || isResetting}
              className="w-full py-4 bg-red-600 text-white rounded-md font-bold hover:bg-red-700 shadow-lg shadow-red-100 transition-all disabled:opacity-50 flex items-center justify-center"
            >
              {isResetting ? (
                <>
                  <RefreshCcw className="w-5 h-5 mr-2 animate-spin" />
                  Sedang Menghapus Data...
                </>
              ) : (
                <>
                  <RefreshCcw className="w-5 h-5 mr-2" />
                  Reset Data Sekarang
                </>
              )}
            </button>
            {isResetting && resetProgress && (
              <p className="text-center text-sm font-medium text-gray-500 mt-4 animate-pulse">
                {resetProgress}
              </p>
            )}
            {resetSuccess && (
              <p className="text-center text-green-600 font-bold mt-4 animate-bounce">
                Data berhasil dihapus!
              </p>
            )}
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Konfirmasi Penghapusan</h3>
              <p className="text-sm text-gray-500 mb-6">
                Anda akan menghapus <strong>{resetCollections.length} koleksi data</strong> dari tenant ini.
                <br /><br />
                Tindakan ini <strong>tidak dapat dibatalkan</strong>. Untuk melanjutkan, mohon ketik <strong>"{tenants.find(t => t.id === selectedResetTenant)?.name || selectedResetTenant}"</strong> di bawah ini.
              </p>

              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Ketik nama tenant di sini"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-6"
              />

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Batal
                </button>
                <button
                  onClick={executeReset}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  disabled={confirmText !== (tenants.find(t => t.id === selectedResetTenant)?.name || selectedResetTenant)}
                >
                  Konfirmasi Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
