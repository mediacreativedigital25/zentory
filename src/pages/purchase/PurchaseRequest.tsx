import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { PurchaseRequest, Product } from '../../types';
import { Plus, Search, Edit2, Trash2, FileText, X, Package, Printer, CheckCircle, Clock, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';

export default function PurchaseRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<PurchaseRequest | null>(null);
  const [formData, setFormData] = useState({
    items: [{ productId: '', variantId: '', name: '', variantName: '', quantity: 1 }],
    reason: '',
  });
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'warning' } | null>(null);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'purchase_requests'), 
      where('tenantId', '==', profile.tenantId),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseRequest)));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching purchase requests:', error);
      setLoading(false);
    });

    const prodQ = query(collection(db, 'products'), where('tenantId', '==', profile.tenantId), where('type', '==', 'manual'));
    const unsubProds = onSnapshot(prodQ, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }, (error) => {
      console.error('Error fetching products:', error);
    });

    return () => {
      unsubscribe();
      unsubProds();
    };
  }, [profile]);

  const generatePRNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `PR${year}${month}`;
    
    // Find the highest sequence for the current month
    const sameMonthRequests = requests.filter(r => r.prNumber?.startsWith(prefix));
    let nextSeq = 1;
    if (sameMonthRequests.length > 0) {
      const sequences = sameMonthRequests.map(r => {
        const seqStr = r.prNumber.replace(prefix, '');
        return parseInt(seqStr, 10) || 0;
      });
      nextSeq = Math.max(...sequences) + 1;
    }
    
    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    try {
      if (editingRequest) {
        await updateDoc(doc(db, 'purchase_requests', editingRequest.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'purchase_requests'), {
          ...formData,
          prNumber: generatePRNumber(),
          tenantId: profile.tenantId,
          requestedBy: profile.uid,
          requestedByName: profile.displayName || profile.email,
          date: serverTimestamp(),
          status: profile.role === 'admin' || profile.role === 'superadmin' ? 'approved' : 'pending',
        });
      }
      setIsModalOpen(false);
      setEditingRequest(null);
      setFormData({ items: [{ productId: '', variantId: '', name: '', variantName: '', quantity: 1 }], reason: '' });
    } catch (err) {
      console.error(err);
      alert('Failed to save purchase request.');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus PR',
      message: 'Apakah Anda yakin ingin menghapus permintaan pembelian ini?',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteDoc(doc(db, 'purchase_requests', id));
      }
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productId: '', variantId: '', name: '', variantName: '', quantity: 1 }]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) return;
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const newItems = [...formData.items];
    newItems[index] = { 
      ...newItems[index], 
      productId, 
      name: product.name,
      variantId: '',
      variantName: ''
    };
    setFormData({ ...formData, items: newItems });
  };

  const updateVariant = (index: number, variantId: string) => {
    const item = formData.items[index];
    const product = products.find(p => p.id === item.productId);
    if (!product || !product.variants) return;
    
    const variant = product.variants.find(v => v.id === variantId);
    if (!variant) return;

    const newItems = [...formData.items];
    newItems[index] = { 
      ...newItems[index], 
      variantId, 
      variantName: variant.name 
    };
    setFormData({ ...formData, items: newItems });
  };

  const updateQty = (index: number, quantity: number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], quantity };
    setFormData({ ...formData, items: newItems });
  };

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, 'purchase_requests', id), {
        status: 'approved',
        approvedBy: profile?.uid,
        approvedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      alert('Failed to approve request.');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateDoc(doc(db, 'purchase_requests', id), {
        status: 'rejected',
        rejectedBy: profile?.uid,
        rejectedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      alert('Failed to reject request.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'approved': return 'bg-green-50 text-green-700 border-green-100';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-100';
      case 'converted': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const handlePrint = async (pr: PurchaseRequest) => {
    let logoUrl = '';
    let tenantName = 'Our Company';
    let address = '';
    let phone = '';
    
    if (profile?.tenantId) {
      try {
        const tenantDoc = await getDoc(doc(db, 'tenants', profile.tenantId));
        if (tenantDoc.exists()) {
          const tData = tenantDoc.data();
          logoUrl = tData.settings?.logoUrl || '';
          tenantName = tData.name || tenantName;
          address = tData.settings?.address || '';
          phone = tData.settings?.phone || '';
        }
      } catch (e) {
        console.error('Failed to load tenant info for printing', e);
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups for printing");
      return;
    }

    const itemsHtml = pr.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">
          ${item.name} ${item.variantName ? `<span style="color: #6366f1;">(${item.variantName})</span>` : ''}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Request - ${pr.prNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .title { font-size: 24px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8f9fa; padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">PURCHASE REQUEST</div>
              <div>No: ${pr.prNumber}</div>
              <div>Date: ${new Date(pr.date?.seconds * 1000).toLocaleDateString()}</div>
            </div>
            <div style="text-align: right;">
               ${logoUrl ? `<img src="${logoUrl}" style="max-height: 50px; object-fit: contain; margin-bottom: 8px;" />` : ''}
               <div style="font-weight: bold; font-size: 16px;">${tenantName}</div>
               ${address ? `<div style="font-size: 12px; color: #444; margin-top: 4px;">${address}</div>` : ''}
               ${phone ? `<div style="font-size: 12px; color: #444; margin-top: 2px;">${phone}</div>` : ''}
            </div>
          </div>
          <div style="margin-bottom: 20px;">
            <strong>Status:</strong> ${pr.status.toUpperCase()}
          </div>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th style="text-align: center;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div style="margin-top: 40px;">
            <strong>Reason/Note:</strong><br/>
            ${pr.reason || '-'}
          </div>
          <div style="margin-top: 60px; display: flex; justify-content: space-between;">
            <div style="text-align: center; width: 200px;">
              <div style="margin-bottom: 60px;">Requested By</div>
              <div style="border-top: 1px solid #000;">( Admin / Staff )</div>
            </div>
            <div style="text-align: center; width: 200px;">
              <div style="margin-bottom: 60px;">Approved By</div>
              <div style="border-top: 1px solid #000;">( Manager / Owner )</div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Purchase Requests...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Purchase Request (PR)</h2>
          <p className="text-gray-500">Permintaan pembelian internal untuk persetujuan.</p>
        </div>
        <button
          onClick={() => { setEditingRequest(null); setFormData({ items: [{ productId: '', variantId: '', name: '', variantName: '', quantity: 1 }], reason: '' }); setIsModalOpen(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Buat PR
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">No. PR</th>
                <th className="px-6 py-4 font-medium">Tanggal</th>
                <th className="px-6 py-4 font-medium">Pemohon</th>
                <th className="px-6 py-4 font-medium">Items</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((pr) => (
                <tr key={pr.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-indigo-600">{pr.prNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {pr.date ? new Date(pr.date.seconds * 1000).toLocaleDateString() : 'Just now'}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{pr.requestedByName || 'System'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{pr.items.length} Items</p>
                    <div className="flex flex-col gap-0.5">
                      {pr.items.map((i, idx) => (
                        <p key={idx} className="text-xs text-gray-500 truncate max-w-[200px]">
                          • {i.name} {i.variantName && <span className="text-indigo-400">[{i.variantName}]</span>} ({i.quantity})
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(pr.status)}`}>
                      {pr.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      {pr.status === 'pending' && (profile?.role === 'admin' || profile?.role === 'superadmin') && (
                        <>
                          <button onClick={() => handleApprove(pr.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Approve">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleReject(pr.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Reject">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button onClick={() => handlePrint(pr)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Print PR">
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditingRequest(pr); setFormData({ items: pr.items, reason: pr.reason || '' }); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(pr.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {requests.length === 0 && (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-gray-100 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada permintaan pembelian.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">{editingRequest ? 'Edit PR' : 'Buat Purchase Request'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-900 flex items-center">
                      <Package className="w-5 h-5 mr-2 text-indigo-600" />
                      Daftar Barang
                    </h4>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Tambah Baris
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.items.map((item, index) => {
                      const selectedProduct = products.find(p => p.id === item.productId);
                      return (
                        <div key={index} className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-gray-100">
                          <div className="flex gap-3 items-start">
                            <div className="flex-1">
                              <select
                                required
                                value={item.productId}
                                onChange={(e) => updateItem(index, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="">Pilih Produk</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                              </select>
                            </div>
                            <div className="w-24">
                              <input
                                type="number"
                                required
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateQty(index, Number(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Qty"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {selectedProduct?.variants && selectedProduct.variants.length > 0 && (
                            <div className="flex gap-3 items-center">
                              <div className="w-6 border-l-2 border-b-2 border-indigo-200 h-4 rounded-bl-lg -mt-4 ml-4"></div>
                              <select
                                required
                                value={item.variantId || ''}
                                onChange={(e) => updateVariant(index, e.target.value)}
                                className="flex-1 px-3 py-1.5 border border-indigo-100 bg-indigo-50/30 rounded-lg text-xs font-medium text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="">Pilih Variasi</option>
                                {selectedProduct.variants.map(v => (
                                  <option key={v.id} value={v.id}>{v.name} (S: {v.stock})</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Alasan / Catatan</label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24 text-sm"
                    placeholder="Contoh: Stok menipis, permintaan khusus pelanggan..."
                  />
                </div>

                <div className="pt-4 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 p-2 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                  >
                    {editingRequest ? 'Simpan Perubahan' : 'Kirim Permintaan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          type={confirmConfig.type}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
    </div>
  );
}
