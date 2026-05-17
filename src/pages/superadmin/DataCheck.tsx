import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, writeBatch, getDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CheckCircle2, AlertCircle, RefreshCw, Wrench } from 'lucide-react';
import { Order } from '../../types';

export default function DataCheck() {
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchAnomalies = async () => {
    setLoading(true);
    setAnomalies([]);
    try {
      const foundAnomalies: any[] = [];
      
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const productsSnap = await getDocs(collection(db, 'products'));
      
      const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const receiptsSnap = await getDocs(collection(db, 'payment_receipts'));
      const receipts = receiptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      for (const rec of receipts) {
        if (rec.amount > 0 && rec.amount < 1000 && rec.amount % 1 !== 0) {
          const properAmount = Math.round(rec.amount * 1000);
          foundAnomalies.push({
            id: `decimal_amount_1000_${rec.id}`,
            entity: 'Penerimaan',
            entityId: rec.id,
            title: `Nominal Typo Desimal (<1000)`,
            description: `Penerimaan ${rec.receiptNumber} bernilai (Rp.${rec.amount}). Kemungkinan karena typo titik ribuan saat input manual. Harusnya Rp.${properAmount.toLocaleString('id-ID')}?`,
            actionLabel: 'Perbaiki Nominal (x1000)',
            actionParams: { type: 'fixDecimalAmount_x1000', receiptId: rec.id, currentAmount: rec.amount, properAmount, receiptNumber: rec.receiptNumber },
            data: rec
          });
        }
        else if (rec.amount > 0 && rec.amount >= 1000 && rec.amount % 1 !== 0) {
          const properAmount = Math.round(rec.amount);
          foundAnomalies.push({
            id: `decimal_amount_round_${rec.id}`,
            entity: 'Penerimaan',
            entityId: rec.id,
            title: `Nominal Desimal (Pecahan)`,
            description: `Penerimaan ${rec.receiptNumber} memiliki nominal desimal (Rp.${rec.amount}). Biasanya karena diskon persen. IDR tidak menerima desimal. Harusnya dibulatkan -> Rp.${properAmount.toLocaleString('id-ID')}?`,
            actionLabel: 'Bulatkan (Round)',
            actionParams: { type: 'fixDecimalAmount_round', receiptId: rec.id, currentAmount: rec.amount, properAmount, receiptNumber: rec.receiptNumber },
            data: rec
          });
        }
      }

      for (const prod of products) {
        if (prod.stock < 0) {
          foundAnomalies.push({
            id: `minus_stock_${prod.id}`,
            entity: 'Product',
            entityId: prod.id,
            title: `Stok Minus`,
            description: `Produk ${prod.name} memiliki stok negatif (${prod.stock}).`,
            actionLabel: 'Set Stok = 0',
            actionParams: { type: 'setStockZero', productId: prod.id },
            data: prod
          });
        }
        
        if (prod.variants && prod.variants.length > 0) {
          prod.variants.forEach((v: any, index: number) => {
             if (v.stock < 0) {
                foundAnomalies.push({
                  id: `minus_stock_variant_${prod.id}_${v.id}`,
                  entity: 'Product',
                  entityId: prod.id,
                  title: `Stok Varian Minus`,
                  description: `Variasi ${v.name} dari Produk ${prod.name} memiliki stok negatif (${v.stock}).`,
                  actionLabel: 'Set Stok Varian = 0',
                  actionParams: { type: 'setVariantStockZero', productId: prod.id, variantIndex: index, variants: prod.variants },
                  data: prod
                });
             }
          });
        }
      }
      
      for (const order of orders) {
        // Anomaly: Paid amount is greater than total
        const total = (order.totalAmount || (order as any).total || 0);
        const paid = order.paidAmount || 0;
        
        if (paid > total) {
          foundAnomalies.push({
            id: `overpaid_${order.id}`,
            entity: 'Order',
            entityId: order.id,
            title: `Memiliki Paid Amount > Total`,
            description: `Order ${order.orderNumber} memiliki nominal dibayar (Rp.${paid.toLocaleString()}) melebihi tagihan total (Rp.${total.toLocaleString()}).`,
            actionLabel: 'Set Paid = Total',
            actionParams: { type: 'setPaidEqualTotal', orderId: order.id, total },
            data: order
          });
        }

        if ((order.status === 'completed' || order.paymentStatus === 'paid') && paid < total) {
          foundAnomalies.push({
            id: `status_completed_unpaid_${order.id}`,
            entity: 'Order',
            entityId: order.id,
            title: `Status Lunas Tapi Kurang Bayar`,
            description: `Order ${order.orderNumber} selesai/lunas tetapi pembayaran (Rp.${paid.toLocaleString()}) kurang dari total tagihan (Rp.${total.toLocaleString()}).`,
            actionLabel: 'Set Status Sesuai Paid Amount',
            actionParams: { type: 'fixPaymentStatus', orderId: order.id, total, paid },
            data: order
          });
        }
      }

      setAnomalies(foundAnomalies);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async (anomaly: any) => {
    if (!window.confirm(`Yakin ingin membenarkan bug ini?`)) return;
    try {
      const { type } = anomaly.actionParams;
      
      if (type === 'setPaidEqualTotal') {
        await updateDoc(doc(db, 'orders', anomaly.actionParams.orderId), {
           paidAmount: anomaly.actionParams.total
        });
      } else if (type === 'fixPaymentStatus') {
        const { paid, total } = anomaly.actionParams;
        await updateDoc(doc(db, 'orders', anomaly.actionParams.orderId), {
           paymentStatus: paid === 0 ? 'unpaid' : (paid < total ? 'partial' : 'paid'),
           status: paid < total ? 'processing' : 'completed' // downgrade status if not fully paid
        });
      } else if (type === 'setStockZero') {
        await updateDoc(doc(db, 'products', anomaly.actionParams.productId), {
           stock: 0
        });
      } else if (type === 'fixDecimalAmount_x1000' || type === 'fixDecimalAmount_round') {
        const { receiptId, properAmount, receiptNumber } = anomaly.actionParams;
        const isMultiplier = type === 'fixDecimalAmount_x1000';
        
        const recRef = doc(db, 'payment_receipts', receiptId);
        const recSnap = await getDoc(recRef);
        if (!recSnap.exists()) return;
        const recData = recSnap.data() as any;

        const batch = writeBatch(db);
        
        // 1. Update Payment Receipt
        const newCollections = (recData.collections || []).map((c: any) => ({
          ...c,
          amountPaid: c.amountPaid % 1 !== 0 
             ? (isMultiplier ? Math.round(c.amountPaid * 1000) : Math.round(c.amountPaid)) 
             : c.amountPaid
        }));

        const newInvoices = (recData.invoices || []).map((inv: any) => ({
          ...inv,
          amountPaid: inv.amountPaid % 1 !== 0 
             ? (isMultiplier ? Math.round(inv.amountPaid * 1000) : Math.round(inv.amountPaid)) 
             : inv.amountPaid
        }));

        batch.update(recRef, {
          amount: properAmount,
          collections: newCollections,
          invoices: newInvoices
        });

        // 2. Update Transactions
        if (receiptNumber) {
          const trxQuery = query(
            collection(db, 'transactions'),
            where('transactionNumber', '>=', `TRX-RP-${receiptNumber}`),
            where('transactionNumber', '<=', `TRX-RP-${receiptNumber}\uf8ff`)
          );
          const trxSnap = await getDocs(trxQuery);
          trxSnap.forEach(tDoc => {
            const tData = tDoc.data();
            if (tData.amount && tData.amount % 1 !== 0) {
               const fixedAmount = isMultiplier ? Math.round(tData.amount * 1000) : Math.round(tData.amount);
               batch.update(tDoc.ref, { amount: fixedAmount });
            }
          });
        }

        // 3. Re-calculate Order paids? 
        // Or we can just set them using a similar approach by fetching them directly
        for (const inv of newInvoices) {
           if (inv.orderId) {
             const oRef = doc(db, 'orders', inv.orderId);
             const oSnap = await getDoc(oRef);
             if (oSnap.exists()) {
                const oData = oSnap.data() as any;
                // Actually the easiest way is to let the other anomalies fix orders!
                // We'll just update this much here, and then rely on "Periksa Data Harian" again for orders.
             }
           }
        }
        
        await batch.commit();
      } else if (type === 'setVariantStockZero') {
        const { variantIndex, variants } = anomaly.actionParams;
        const mut = [...variants];
        mut[variantIndex].stock = 0;
        await updateDoc(doc(db, 'products', anomaly.actionParams.productId), {
           variants: mut
        });
      }

      alert('Berhasil dibenarkan');
      fetchAnomalies();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Periksa Data Harian</h1>
          <p className="text-gray-500 mt-1">Audit dan perbaiki bug data atau anomali transaksi.</p>
        </div>
        <button
          onClick={fetchAnomalies}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Periksa Ulang
        </button>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Memeriksa data...</div>
        ) : anomalies.length === 0 ? (
           <div className="p-12 text-center">
             <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
               <CheckCircle2 className="w-8 h-8 text-green-500" />
             </div>
             <h3 className="text-lg font-bold text-gray-900">Data Sehat</h3>
             <p className="text-gray-500">Tidak ada bug atau anomali yang terdeteksi.</p>
           </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {anomalies.map((anom) => (
              <div key={anom.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <div className="p-2 bg-red-50 rounded-md mr-4 mt-1">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{anom.title}</h3>
                      <p className="text-sm text-gray-600 mt-1 max-w-2xl">{anom.description}</p>
                      
                      {expandedRow === anom.id && (
                        <div className="mt-4 p-4 bg-gray-900 rounded-md overflow-x-auto">
                          <pre className="text-xs text-green-400 font-mono">
                            {JSON.stringify(anom.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedRow(expandedRow === anom.id ? null : anom.id)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md border border-gray-200"
                    >
                      {expandedRow === anom.id ? 'Tutup Data' : 'Lihat Raw Data'}
                    </button>
                    <button
                      onClick={() => handleFix(anom)}
                      className="flex items-center px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md"
                    >
                      <Wrench className="w-3 h-3 mr-1" />
                      {anom.actionLabel}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
