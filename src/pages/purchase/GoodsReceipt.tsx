import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, orderBy, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { GoodsReceipt, PurchaseOrder, Supplier, Product } from '../../types';
import { Plus, Search, Edit2, FileText, X, Package, Printer, Truck, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';
import { logStockChange } from '../../lib/stock-logger';
import { getDoc } from 'firebase/firestore';

export default function GoodsReceipts() {
  const { profile } = useAuth();
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<GoodsReceipt | null>(null);
  const [formData, setFormData] = useState({
    poId: '',
    items: [] as { productId: string; name: string; quantityOrdered: number; quantityReceived: number; isChecked: boolean }[],
    status: 'draft' as const,
  });
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'warning' } | null>(null);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'goods_receipts'), 
      where('tenantId', '==', profile.tenantId),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() } as GoodsReceipt)));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching goods receipts:', error);
      setLoading(false);
    });

    const poQ = query(collection(db, 'purchase_orders'), where('tenantId', '==', profile.tenantId), where('status', 'in', ['sent', 'draft']));
    const unsubPos = onSnapshot(poQ, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
    }, (error) => {
      console.error('Error fetching purchase orders:', error);
    });

    const supQ = query(collection(db, 'suppliers'), where('tenantId', '==', profile.tenantId));
    const unsubSups = onSnapshot(supQ, (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    }, (error) => {
      console.error('Error fetching suppliers:', error);
    });

    return () => {
      unsubscribe();
      unsubPos();
      unsubSups();
    };
  }, [profile]);

  const generateGRNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `GR${year}${month}`;
    
    // Find the highest sequence for the current month
    const sameMonthReceipts = receipts.filter(r => r.grNumber?.startsWith(prefix));
    let nextSeq = 1;
    if (sameMonthReceipts.length > 0) {
      const sequences = sameMonthReceipts.map(r => {
        const seqStr = r.grNumber.replace(prefix, '');
        return parseInt(seqStr, 10) || 0;
      });
      nextSeq = Math.max(...sequences) + 1;
    }
    
    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  };

  const handlePOSelection = (poId: string) => {
    const po = orders.find(o => o.id === poId);
    if (!po) return;

    setFormData({
      ...formData,
      poId,
      items: po.items.map(item => ({
        productId: item.productId,
        variantId: (item as any).variantId || null,
        name: item.name,
        quantityOrdered: item.quantity,
        quantityReceived: item.quantity,
        isChecked: false
      })) as any
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    const po = orders.find(o => o.id === formData.poId);

    try {
      if (editingReceipt) {
        await updateDoc(doc(db, 'goods_receipts', editingReceipt.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'goods_receipts'), {
          ...formData,
          grNumber: generateGRNumber(),
          tenantId: profile.tenantId,
          poNumber: po?.poNumber,
          supplierId: po?.supplierId,
          receivedBy: profile.uid,
          date: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      setEditingReceipt(null);
      setFormData({ poId: '', items: [], status: 'draft' });
    } catch (err) {
      console.error(err);
      alert('Failed to save goods receipt.');
    }
  };

  const toggleCheck = (index: number) => {
    const newItems = [...formData.items];
    newItems[index].isChecked = !newItems[index].isChecked;
    setFormData({ ...formData, items: newItems });
  };

  const handleComplete = async (receipt: GoodsReceipt) => {
    const allChecked = receipt.items.every(i => i.isChecked);
    if (!allChecked) {
      alert('Semua item harus divalidasi (dicentang) sebelum diselesaikan.');
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Selesaikan Penerimaan',
      message: 'Apakah Anda yakin? Stok produk akan otomatis bertambah sesuai jumlah yang diterima.',
      type: 'info',
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          // Fetch PO to get prices for HPP update
          const poRef = doc(db, 'purchase_orders', receipt.poId);
          const poSnap = await getDoc(poRef);
          const poData = poSnap.exists() ? poSnap.data() as PurchaseOrder : null;

          // Update Stock and HPP for each item
          for (const item of receipt.items) {
            const productRef = doc(db, 'products', item.productId);
            const productSnap = await getDoc(productRef);
            if (!productSnap.exists()) continue;
            
            const productData = productSnap.data() as Product;
            const currentStock = productData.stock;

            // Get purchase price for HPP update
            const poItem = poData?.items.find(i => i.productId === item.productId && (i as any).variantId === (item as any).variantId);
            const newHPP = poItem?.price || productData.hpp;
            const itemVid = (item as any).variantId;

            if (itemVid && productData.variants) {
                // Update variant stock and HPP
                const updatedVariants = productData.variants.map((v: any) => {
                    if (v.id === itemVid) {
                        return { 
                            ...v, 
                            stock: v.stock + item.quantityReceived,
                            hpp: newHPP
                        };
                    }
                    return v;
                });
                await updateDoc(productRef, {
                    variants: updatedVariants,
                    stock: increment(item.quantityReceived)
                });
            } else {
                await updateDoc(productRef, {
                    stock: increment(item.quantityReceived),
                    hpp: newHPP
                });
            }

            const variant = itemVid ? productData.variants?.find((v: any) => v.id === itemVid) : null;
            const variantCurrentStock = variant ? variant.stock : productData.stock;

            await logStockChange(
              profile?.tenantId!,
              item.productId,
              item.name,
              'PURCHASE',
              item.quantityReceived,
              variantCurrentStock,
              variantCurrentStock + item.quantityReceived,
              profile?.uid!,
              profile?.displayName || 'System',
              { id: receipt.id, number: receipt.grNumber },
              `Goods Receipt from PO: ${receipt.poNumber || '-'} ${itemVid ? '(Variant)' : ''}`
            );
          }

          // Update GR status
          await updateDoc(doc(db, 'goods_receipts', receipt.id), {
            status: 'completed'
          });

          // Update PO status
          if (receipt.poId) {
            await updateDoc(doc(db, 'purchase_orders', receipt.poId), {
              status: 'received'
            });
          }
        } catch (err) {
          console.error(err);
          alert('Gagal memperbarui stok.');
        }
      }
    });
  };

  const handlePrint = async (gr: GoodsReceipt) => {
    const supplier = suppliers.find(s => s.id === gr.supplierId);
    let logoUrl = '';
    let tenantName = profile?.tenantName || 'Our Warehouse';
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

    const itemsHtml = gr.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantityOrdered}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantityReceived}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.isChecked ? '✓' : '✗'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Goods Receipt - ${gr.grNumber}</title>
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
              <div class="title">GOODS RECEIPT</div>
              <div>No: ${gr.grNumber}</div>
              <div>PO Ref: ${gr.poNumber || '-'}</div>
              <div>Date: ${new Date(gr.date?.seconds * 1000).toLocaleDateString()}</div>
            </div>
            <div style="text-align: right;">
               ${logoUrl ? `<img src="${logoUrl}" style="max-height: 50px; object-fit: contain; margin-bottom: 8px;" />` : ''}
               <div style="font-weight: bold; font-size: 16px;">${tenantName}</div>
               ${address ? `<div style="font-size: 12px; color: #444; margin-top: 4px;">${address}</div>` : ''}
               ${phone ? `<div style="font-size: 12px; color: #444; margin-top: 2px;">${phone}</div>` : ''}
            </div>
          </div>
          <div style="margin-bottom: 20px;">
            <strong>Supplier:</strong> ${suppliers.find(s => s.id === gr.supplierId)?.name || '-'}
          </div>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th style="text-align: center;">Qty Ordered</th>
                <th style="text-align: center;">Qty Received</th>
                <th style="text-align: center;">Validated</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div style="margin-top: 60px; display: flex; justify-content: space-between;">
            <div style="text-align: center; width: 200px;">
              <div style="margin-bottom: 60px;">Received By</div>
              <div style="border-top: 1px solid #000;">( Warehouse Staff )</div>
            </div>
            <div style="text-align: center; width: 200px;">
              <div style="margin-bottom: 60px;">Checked By</div>
              <div style="border-top: 1px solid #000;">( QC / Admin )</div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Goods Receipts...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Goods Receipt (Penerimaan Barang)</h2>
          <p className="text-gray-500">Validasi barang masuk dan update stok otomatis.</p>
        </div>
        <button
          onClick={() => { setEditingReceipt(null); setFormData({ poId: '', items: [], status: 'draft' }); setIsModalOpen(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Terima Barang
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">No. GR</th>
                <th className="px-6 py-4 font-medium">Ref PO</th>
                <th className="px-6 py-4 font-medium">Tanggal</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipts.map((gr) => (
                <tr key={gr.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-indigo-600">{gr.grNumber}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{gr.poNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {gr.date ? new Date(gr.date.seconds * 1000).toLocaleDateString() : 'Just now'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                      gr.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                    }`}>
                      {gr.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => handlePrint(gr)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Print GR">
                        <Printer className="w-4 h-4" />
                      </button>
                      {gr.status === 'draft' && (
                        <>
                          <button onClick={() => { setEditingReceipt(gr); setFormData({ poId: gr.poId, items: gr.items, status: gr.status }); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleComplete(gr)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Selesaikan & Update Stok">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">Validasi Penerimaan Barang</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="block mb-2 text-xs font-semibold text-gray-600">Reference Purchase Order (PO)</label>
                  <select
                    required
                    disabled={!!editingReceipt}
                    value={formData.poId}
                    onChange={(e) => handlePOSelection(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-white"
                  >
                    <option value="">Pilih PO yang akan diterima</option>
                    {orders.map(o => <option key={o.id} value={o.id}>{o.poNumber} - {o.supplierName}</option>)}
                  </select>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-indigo-600" />
                    Checklist Barang Datang
                  </h4>
                  
                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex gap-3 items-center bg-white p-4 rounded-lg border border-gray-100">
                        <button
                          type="button"
                          onClick={() => toggleCheck(index)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            item.isChecked ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-200'
                          }`}
                        >
                          {item.isChecked && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">Dipesan: {item.quantityOrdered} Unit</p>
                        </div>
                        <div className="w-32">
                          <label className="block mb-1 text-xs font-semibold text-gray-600">Qty Diterima</label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={item.quantityReceived}
                            onChange={(e) => {
                              const newItems = [...formData.items];
                              newItems[index].quantityReceived = Number(e.target.value);
                              setFormData({ ...formData, items: newItems });
                            }}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {formData.items.length > 0 && (
                  <div className="p-4 bg-blue-50 rounded-xl flex items-start">
                    <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                    <p className="text-sm text-blue-700">
                      Pastikan jumlah barang sesuai dengan fisik yang datang. Centang item untuk memvalidasi.
                    </p>
                  </div>
                )}

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
                    Simpan Draft
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
