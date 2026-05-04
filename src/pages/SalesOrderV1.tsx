import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot, limit, orderBy, runTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useAuth } from '../hooks/useAuth';
import { Product, Customer, BankAccount } from '../types';
import { logStockChange } from '../lib/stock-logger';
import { 
  Package, 
  User, 
  Calendar, 
  Plus, 
  Minus,
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowLeft,
  Save,
  ShoppingBag,
  Landmark,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function SalesOrderV1() {
  const { profile, domainTenantId } = useAuth();
  const navigate = useNavigate();
  const targetTenantId = domainTenantId || profile?.tenantId;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerCodeSearch, setCustomerCodeSearch] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [remark, setRemark] = useState('');
  const [cartItems, setCartItems] = useState<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    hpp: number;
  }[]>([]);
  
  const [productSearch, setProductSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');

  useEffect(() => {
    if (!targetTenantId) return;

    const customersQuery = query(collection(db, 'customers'), where('tenantId', '==', targetTenantId));
    const productsQuery = query(collection(db, 'products'), where('tenantId', '==', targetTenantId));
    const banksQuery = query(
      collection(db, 'bank_accounts'), 
      where('tenantId', '==', targetTenantId),
      where('isActive', '==', true)
    );

    const unsubCustomers = onSnapshot(customersQuery, (snap) => {
      const customerData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
      setCustomers(customerData);
    });

    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubBanks = onSnapshot(banksQuery, (snap) => {
      setBankAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
      setLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubProducts();
      unsubBanks();
    };
  }, [targetTenantId]);

  const addToCart = (product: Product) => {
    if (product.type !== 'service' && (product.stock || 0) <= 0) {
      alert(`Stok ${product.name} kosong.`);
      return;
    }

    const existing = cartItems.find(item => item.productId === product.id);
    if (existing) {
      const newQty = existing.quantity + 1;
      if (product.type !== 'service' && (product.stock || 0) < newQty) {
        alert(`Stok ${product.name} tidak mencukupi.`);
        return;
      }
      setCartItems(cartItems.map(item => 
        item.productId === product.id ? { ...item, quantity: newQty } : item
      ));
    } else {
      setCartItems([...cartItems, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price,
        hpp: product.hpp || 0
      }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCartItems(cartItems.filter(item => item.productId !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) return;
    const product = products.find(p => p.id === id);
    if (product && product.type !== 'service' && (product.stock || 0) < qty) {
      alert(`Stok ${product.name} tidak mencukupi.`);
      return;
    }
    setCartItems(cartItems.map(item => 
      item.productId === id ? { ...item, quantity: qty } : item
    ));
  };

  const handleCustomerCodeSearch = (code: string) => {
    setCustomerCodeSearch(code);
    const customer = customers.find(c => c.code?.toLowerCase() === code.toLowerCase());
    if (customer) {
      setSelectedCustomerId(customer.id);
    }
  };

  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    const customer = customers.find(c => c.id === id);
    if (customer) {
      setCustomerCodeSearch(customer.code || '');
    } else {
      setCustomerCodeSearch('');
    }
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const isTempoAllowed = selectedCustomer?.allowTempo || false;
  const tempoDays = selectedCustomer?.tempoLimitDays || 0;

  useEffect(() => {
    if (isTempoAllowed && tempoDays > 0) {
      const date = new Date();
      date.setDate(date.getDate() + tempoDays);
      setDueDate(date.toISOString().split('T')[0]);
    } else {
      setDueDate('');
    }
  }, [selectedCustomerId, isTempoAllowed, tempoDays]);

  const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTenantId || !profile) return;
    if (!selectedCustomerId) { alert('Pilih pelanggan terlebih dahulu.'); return; }
    if (cartItems.length === 0) { alert('Keranjang belanja masih kosong.'); return; }

    const isCash = !selectedCustomer?.allowTempo;
    if (isCash) {
      if (bankAccounts.length === 0) {
        alert('Harap atur akun bank/kas di menu Finance > Bank Accounts terlebih dahulu.');
        return;
      }
      setIsBankModalOpen(true);
    } else {
      processSubmit();
    }
  };

  const processSubmit = async (bankId?: string) => {
    if (!targetTenantId || !profile) return;

    const finalPaymentType = isTempoAllowed ? 'credit' : 'cash';
    let finalPaymentStatus = 'unpaid';
    let finalStatus = 'pending';
    let actualPaidAmount = 0;

    setIsSubmitting(true);
    let generatedOrderNumber = '';
    const stockLogsToProcess: any[] = [];
    const orderRef = doc(collection(db, 'orders'));

    try {
      await runTransaction(db, async (transaction) => {
        // 1. READS FIRST
        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const counterRef = doc(db, 'counters', `${targetTenantId}_orders_${yearMonth}`);
        const counterDoc = await transaction.get(counterRef);
        
        const productDocs: { ref: any, productName: string, productId: string, requestedQty: number, data: Product }[] = [];
        for (const item of cartItems) {
          const productRef = doc(db, 'products', item.productId);
          const pDoc = await transaction.get(productRef);
          if (!pDoc.exists()) throw new Error(`Produk ${item.productName} tidak ditemukan.`);
          productDocs.push({
            ref: productRef,
            productId: item.productId,
            productName: item.productName,
            requestedQty: item.quantity,
            data: pDoc.data() as Product
          });
        }

        // 2. CALCULATIONS
        let sequence = 1;
        if (counterDoc.exists()) {
          sequence = (counterDoc.data().sequence || 0) + 1;
        }
        
        generatedOrderNumber = `IN${yearMonth}${String(sequence).padStart(6, '0')}`;
        const customer = customers.find(c => c.id === selectedCustomerId);

        const productsToUpdate: { ref: any, currentStock: number, newStock: number, name: string, productId: string }[] = [];
        for (const pInfo of productDocs) {
          if (pInfo.data.type !== 'service') {
            const currentStock = pInfo.data.stock || 0;
            if (currentStock < pInfo.requestedQty) {
              throw new Error(`Stok ${pInfo.requestedQty} tidak mencukupi (Tersisa: ${currentStock}).`);
            }
            productsToUpdate.push({
              ref: pInfo.ref,
              productId: pInfo.productId,
              name: pInfo.productName,
              currentStock: currentStock,
              newStock: currentStock - pInfo.requestedQty
            });
            
            stockLogsToProcess.push({
              productId: pInfo.productId,
              name: pInfo.productName,
              qty: pInfo.requestedQty,
              prev: currentStock,
              curr: currentStock - pInfo.requestedQty
            });
          }
        }

        // 3. WRITES LAST
        if (counterDoc.exists()) {
          transaction.update(counterRef, { 
            sequence,
            updatedAt: serverTimestamp()
          });
        } else {
          transaction.set(counterRef, { 
            tenantId: targetTenantId,
            prefix: yearMonth,
            sequence: 1,
            updatedAt: serverTimestamp()
          });
        }

        for (const pUpdate of productsToUpdate) {
          transaction.update(pUpdate.ref, { stock: pUpdate.newStock });
        }

        transaction.set(orderRef, {
          tenantId: targetTenantId,
          orderNumber: generatedOrderNumber,
          customerId: selectedCustomerId,
          customerName: customer?.name || 'Unknown',
          customerCode: customer?.code || '',
          type: 'manual',
          items: cartItems.map(item => ({
            productId: item.productId,
            name: item.productName,
            quantity: item.quantity,
            price: item.price,
            hpp: item.hpp
          })),
          totalAmount,
          paidAmount: actualPaidAmount,
          paymentStatus: finalPaymentStatus,
          paymentType: finalPaymentType,
          bankAccountId: bankId || null,
          status: finalStatus,
          remark: remark.trim().substring(0, 50),
          date: new Date(orderDate),
          dueDate: finalPaymentType === 'credit' && dueDate ? new Date(dueDate) : null,
          userId: profile.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      // 4. AFTER TRANSACTION: SLOGGING
      for (const log of stockLogsToProcess) {
        logStockChange(
          targetTenantId,
          log.productId,
          log.name,
          'SALE',
          log.qty,
          log.prev,
          log.curr,
          profile.uid,
          profile.displayName || 'System',
          { id: orderRef.id, number: generatedOrderNumber },
          `Sales Order V1`
        );
      }

      setShowSuccess(true);
      setTimeout(() => {
        navigate('/sales/receive');
      }, 2000);
    } catch (err: any) {
      console.error('Error saving order:', err);
      handleFirestoreError(err, OperationType.WRITE, 'orders/transaction', auth, profile);
    } finally {
      setIsSubmitting(false);
    }
  };


  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 5);

  if (loading) return <div className="p-8 text-center animate-pulse">Memuat data Sales V1...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-indigo-600" />
              Sales Order V1
            </h2>
            <p className="text-gray-500 font-medium">Input pesanan manual dengan cepat & fungsional.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Date */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                  <User className="w-3 h-3" />
                  Pilih Pelanggan
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => handleCustomerSelect(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans"
                    >
                      <option value="">-- Pilih Customer --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="w-40">
                    <input
                      type="text"
                      placeholder="Cek Kode..."
                      value={customerCodeSearch}
                      onChange={(e) => handleCustomerCodeSearch(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all uppercase placeholder:normal-case"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                  <Calendar className="w-3 h-3" />
                  Tanggal Order
                </label>
                <input
                  type="date"
                  value={orderDate}
                  readOnly
                  className="w-full px-5 py-4 bg-gray-100 border-none rounded-2xl text-sm font-black text-gray-400 outline-none cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1 text-orange-500">
                  <Clock className="w-3 h-3" />
                  Term Of Payment (TOP)
                </label>
                {!selectedCustomerId ? (
                  <div className="w-full px-5 py-4 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-[10px] font-bold text-gray-400 italic flex items-center justify-center">
                    Pilih pelanggan dahulu
                  </div>
                ) : isTempoAllowed ? (
                  <div className="space-y-3">
                    <div className="w-full px-5 py-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-tighter">Term Of Payment</span>
                        <span className="text-sm font-black text-orange-600">{tempoDays} Hari</span>
                      </div>
                      <span className="text-[10px] font-mono text-orange-400 font-bold bg-white px-2 py-1 rounded-lg">CREDIT</span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-400 px-1 uppercase tracking-widest">Tanggal Jatuh Tempo</label>
                      <input
                        type="date"
                        value={dueDate}
                        readOnly
                        className="w-full px-5 py-3 bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-400 outline-none cursor-not-allowed font-sans"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-full px-5 py-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Term Of Payment</span>
                      <span className="text-sm font-black text-emerald-600 uppercase">Cash</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold bg-white px-2 py-1 rounded-lg">PAID</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Product Picker */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
                <Package className="w-3 h-3" />
                Cari & Tambah Produk
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ketik nama produk atau SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              {productSearch && (
                <div className="grid grid-cols-1 gap-2 p-2 bg-gray-50 rounded-2xl border border-gray-100">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { addToCart(p); setProductSearch(''); }}
                      className="flex items-center justify-between p-3 hover:bg-white rounded-xl transition-all group"
                    >
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-900">{p.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-gray-400 font-mono">{p.sku}</p>
                          {p.type !== 'service' && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              (p.stock || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              STOK: {p.stock || 0}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black text-indigo-600">Rp.{p.price.toLocaleString()}</span>
                        <Plus className="w-5 h-5 text-gray-300 group-hover:text-indigo-600 group-hover:rotate-90 transition-all" />
                      </div>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && <p className="p-3 text-xs text-gray-500">Produk tidak ditemukan.</p>}
                </div>
              )}
            </div>

            {/* Cart Table */}
            <div className="overflow-hidden border border-gray-100 rounded-3xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Produk</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Harga</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Qty</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Subtotal</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cartItems.map(item => (
                    <tr key={item.productId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900">{item.productName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-gray-400 font-mono">
                            {products.find(p => p.id === item.productId)?.sku}
                          </p>
                          {products.find(p => p.id === item.productId)?.type !== 'service' && (
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">
                              STOK: {products.find(p => p.id === item.productId)?.stock || 0}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-bold text-gray-600">Rp.{item.price.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
                            <Minus className="w-3 h-3" />
                          </button>
                          <input 
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val)) updateQuantity(item.productId, val);
                            }}
                            className="text-sm font-black text-gray-900 w-12 text-center bg-gray-50 border-none rounded-lg focus:ring-1 focus:ring-indigo-500 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-indigo-600">Rp.{(item.price * item.quantity).toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => removeFromCart(item.productId)} className="text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cartItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-gray-400 font-medium">Belum ada item ditambahkan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Summary */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm sticky top-6">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 px-1">Ringkasan Pesanan</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-50">
                <span className="text-xs font-bold text-gray-500">Total Items</span>
                <span className="text-sm font-black text-gray-900">{cartItems.reduce((s, i) => s + i.quantity, 0)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-50">
                <span className="text-xs font-bold text-gray-500">Total Produk</span>
                <span className="text-sm font-black text-gray-900">{cartItems.length}</span>
              </div>

              <div className="py-3 border-b border-gray-50">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Remark / Keterangan (Maks 50 karakter)</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value.substring(0, 50))}
                  maxLength={50}
                  className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium text-gray-700 resize-none h-20"
                  placeholder="Keterangan pesanan..."
                />
                <div className="text-right mt-1">
                  <span className="text-[10px] font-bold text-gray-400">{remark.length}/50</span>
                </div>
              </div>

              <div className="pt-6">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 text-right">Total Tagihan</p>
                 <p className="text-3xl font-black text-indigo-600 text-right">Rp.{totalAmount.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <button
                disabled={isSubmitting || cartItems.length === 0}
                onClick={handlePreSubmit}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Clock className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                SIMPAN PESANAN
              </button>
              <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-tighter">
                * Data akan langsung masuk ke Sales Order Receive
              </p>
            </div>
          </div>

          <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 font-bold leading-relaxed">
              Pesanan V1 akan otomatis mengikuti setting pelanggan. Jika CASH maka status PAID, jika TEMPO maka status UNPAID.
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isBankModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Pilih Akun Kas/Bank</h3>
                    <p className="text-xs text-white/70 font-bold uppercase tracking-widest">Pembayaran Tunai (Cash)</p>
                  </div>
                </div>
                <button onClick={() => setIsBankModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 font-bold leading-relaxed">
                    Pesanan ini dibayar tunai. Silakan pilih akun bank atau kas yang akan menerima dana ini.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Daftar Akun Aktif</label>
                  <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {bankAccounts.map((bank) => (
                      <button
                        key={bank.id}
                        onClick={() => setSelectedBankId(bank.id)}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 group ${
                          selectedBankId === bank.id
                            ? 'border-indigo-600 bg-indigo-50 shadow-md'
                            : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                        }`}
                      >
                        <div className={`p-3 rounded-xl transition-colors ${
                          selectedBankId === bank.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 group-hover:text-gray-600'
                        }`}>
                          <Landmark className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className={`font-black text-sm uppercase ${selectedBankId === bank.id ? 'text-indigo-900' : 'text-gray-700'}`}>
                            {bank.name}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400">{bank.type} - {bank.accountNumber || 'No Acc'}</p>
                        </div>
                        {selectedBankId === bank.id && (
                          <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => setIsBankModalOpen(false)}
                    className="flex-1 py-4 border border-gray-200 rounded-2xl text-gray-600 font-black hover:bg-gray-50 transition-all font-sans"
                  >
                    BATAL
                  </button>
                  <button
                    disabled={!selectedBankId || isSubmitting}
                    onClick={() => {
                      setIsBankModalOpen(false);
                      processSubmit(selectedBankId);
                    }}
                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Clock className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    KONFIRMASI & SIMPAN
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-4 border border-gray-100"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black text-gray-900">Pesanan Berhasil Disimpan!</h3>
              <p className="text-gray-500 font-medium">Mengalihkan ke halaman Sales Order Receive...</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
