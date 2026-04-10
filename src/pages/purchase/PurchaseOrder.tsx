import React, { useState, useEffect } from 'react';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { PurchaseOrder, Supplier, Product, PurchaseRequest } from '../../types';
import { Plus, Search, Edit2, Trash2, FileText, X, Package, Printer, Truck, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';

export default function PurchaseOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [formData, setFormData] = useState({
    supplierId: '',
    prId: '',
    items: [{ productId: '', name: '', quantity: 1, price: 0 }],
    status: 'draft' as const,
  });
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'info' | 'warning' } | null>(null);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(
      collection(db, 'purchase_orders'), 
      where('tenantId', '==', profile.tenantId),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching purchase orders:', error);
      setLoading(false);
    });

    const supQ = query(collection(db, 'suppliers'), where('tenantId', '==', profile.tenantId));
    const unsubSups = onSnapshot(supQ, (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    }, (error) => {
      console.error('Error fetching suppliers:', error);
    });

    const prodQ = query(collection(db, 'products'), where('tenantId', '==', profile.tenantId), where('type', '==', 'manual'));
    const unsubProds = onSnapshot(prodQ, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }, (error) => {
      console.error('Error fetching products:', error);
    });

    const prQ = query(collection(db, 'purchase_requests'), where('tenantId', '==', profile.tenantId), where('status', '==', 'approved'));
    const unsubPrs = onSnapshot(prQ, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseRequest)));
    }, (error) => {
      console.error('Error fetching purchase requests:', error);
    });

    return () => {
      unsubscribe();
      unsubSups();
      unsubProds();
      unsubPrs();
    };
  }, [profile]);

  const generatePONumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PO-${year}${month}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;

    const supplier = suppliers.find(s => s.id === formData.supplierId);
    const totalAmount = formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    try {
      if (editingOrder) {
        await updateDoc(doc(db, 'purchase_orders', editingOrder.id), {
          ...formData,
          supplierName: supplier?.name,
          totalAmount,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'purchase_orders'), {
          ...formData,
          poNumber: generatePONumber(),
          tenantId: profile.tenantId,
          supplierName: supplier?.name,
          totalAmount,
          date: serverTimestamp(),
        });

        if (formData.prId) {
          await updateDoc(doc(db, 'purchase_requests', formData.prId), {
            status: 'converted'
          });
        }
      }
      setIsModalOpen(false);
      setEditingOrder(null);
      setFormData({ supplierId: '', prId: '', items: [{ productId: '', name: '', quantity: 1, price: 0 }], status: 'draft' });
    } catch (err) {
      console.error(err);
      alert('Failed to save purchase order.');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus PO',
      message: 'Apakah Anda yakin ingin menghapus Purchase Order ini?',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteDoc(doc(db, 'purchase_orders', id));
      }
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productId: '', name: '', quantity: 1, price: 0 }]
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
    newItems[index] = { ...newItems[index], productId, name: product.name, price: product.hpp || 0 };
    setFormData({ ...formData, items: newItems });
  };

  const updateField = (index: number, field: 'quantity' | 'price', value: number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handlePRSelection = (prId: string) => {
    const pr = requests.find(r => r.id === prId);
    if (!pr) return;
    
    const newItems = pr.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: product?.hpp || 0
      };
    });

    setFormData({
      ...formData,
      prId,
      items: newItems
    });
  };

  const handlePrint = (po: PurchaseOrder) => {
    const supplier = suppliers.find(s => s.id === po.supplierId);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = po.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">Rp.${item.price.toLocaleString()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">Rp.${(item.quantity * item.price).toLocaleString()}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Order - ${po.poNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .title { font-size: 28px; font-weight: bold; color: #4f46e5; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8f9fa; padding: 12px 8px; text-align: left; border-bottom: 2px solid #dee2e6; font-size: 12px; text-transform: uppercase; }
            .total-section { margin-top: 30px; text-align: right; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">PURCHASE ORDER</div>
              <div style="margin-top: 8px;">No: <strong>${po.poNumber}</strong></div>
              <div>Date: ${new Date(po.date?.seconds * 1000).toLocaleDateString()}</div>
            </div>
          </div>
          
          <div class="info-grid">
            <div>
              <div style="color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">Supplier:</div>
              <div style="font-weight: bold; font-size: 16px;">${po.supplierName}</div>
              <div style="font-size: 14px; margin-top: 4px;">${supplier?.address || ''}</div>
              <div style="font-size: 14px;">${supplier?.phone || ''}</div>
            </div>
            <div style="text-align: right;">
              <div style="color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">Ship To:</div>
              <div style="font-weight: bold; font-size: 16px;">${profile?.tenantName || 'Our Warehouse'}</div>
              <div style="font-size: 14px; margin-top: 4px;">Main Office / Warehouse</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-section">
            <span style="color: #666; font-weight: normal; margin-right: 20px;">GRAND TOTAL:</span>
            Rp.${po.totalAmount.toLocaleString()}
          </div>

          <div style="margin-top: 80px; display: flex; justify-content: space-between;">
            <div style="text-align: center; width: 200px;">
              <div style="margin-bottom: 60px; color: #666;">Authorized By</div>
              <div style="border-top: 1px solid #ccc; padding-top: 8px;">( Purchasing Manager )</div>
            </div>
            <div style="text-align: center; width: 200px;">
              <div style="margin-bottom: 60px; color: #666;">Accepted By</div>
              <div style="border-top: 1px solid #ccc; padding-top: 8px;">( Supplier Signature )</div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Purchase Orders...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Purchase Order (PO)</h2>
          <p className="text-gray-500">Dokumen resmi pesanan pembelian ke supplier.</p>
        </div>
        <button
          onClick={() => { setEditingOrder(null); setFormData({ supplierId: '', prId: '', items: [{ productId: '', name: '', quantity: 1, price: 0 }], status: 'draft' }); setIsModalOpen(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Buat PO Baru
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">No. PO</th>
                <th className="px-6 py-4 font-medium">Supplier</th>
                <th className="px-6 py-4 font-medium">Total</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-indigo-600">{po.poNumber}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <Truck className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{po.supplierName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    Rp.{po.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                      po.status === 'draft' ? 'bg-gray-50 text-gray-600 border-gray-100' :
                      po.status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      po.status === 'received' ? 'bg-green-50 text-green-700 border-green-100' :
                      'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => handlePrint(po)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Print PO">
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditingOrder(po); setFormData({ supplierId: po.supplierId, prId: po.prId || '', items: po.items, status: po.status }); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(po.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-gray-100 mx-auto mb-4" />
            <p className="text-gray-500">Belum ada Purchase Order.</p>
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">{editingOrder ? 'Edit PO' : 'Buat Purchase Order'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Supplier</label>
                    <select
                      required
                      value={formData.supplierId}
                      onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Pilih Supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Reference PR (Optional)</label>
                    <select
                      value={formData.prId}
                      onChange={(e) => handlePRSelection(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Pilih PR yang disetujui</option>
                      {requests.map(r => <option key={r.id} value={r.id}>{r.prNumber} ({r.items.length} Items)</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-900 flex items-center">
                      <Package className="w-5 h-5 mr-2 text-indigo-600" />
                      Daftar Barang & Harga
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
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex gap-3 items-start bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex-1">
                          <select
                            required
                            value={item.productId}
                            onChange={(e) => updateItem(index, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Pilih Produk</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="w-20">
                          <input
                            type="number"
                            required
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateField(index, 'quantity', Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Qty"
                          />
                        </div>
                        <div className="w-32">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Rp</span>
                            <input
                              type="number"
                              required
                              value={item.price}
                              onChange={(e) => updateField(index, 'price', Number(e.target.value))}
                              className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="Harga"
                            />
                          </div>
                        </div>
                        <div className="w-32 pt-2 text-right font-bold text-indigo-600 text-sm">
                          Rp.{(item.quantity * item.price).toLocaleString()}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-xl">
                  <span className="font-bold text-indigo-900">GRAND TOTAL</span>
                  <span className="text-xl font-black text-indigo-600">
                    Rp.{formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0).toLocaleString()}
                  </span>
                </div>

                <div className="pt-4 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 font-bold hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                  >
                    {editingOrder ? 'Simpan Perubahan' : 'Buat Purchase Order'}
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
