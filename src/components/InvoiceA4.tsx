import React, { useState, useEffect } from 'react';
import { Customer, Tenant } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface InvoiceA4Props {
  transaction: any;
  tenantInfo: Tenant | null;
  customers?: Customer[];
}

export default function InvoiceA4({ transaction, tenantInfo, customers }: InvoiceA4Props) {
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (transaction?.customerId) {
      if (customers && customers.length > 0) {
        const found = customers.find(c => c.id === transaction.customerId);
        if (found) {
          setMatchedCustomer(found);
          return;
        }
      }
      
      // If we don't have it in the array, fetch it
      getDoc(doc(db, 'customers', transaction.customerId)).then(snap => {
        if (snap.exists()) {
          setMatchedCustomer({ id: snap.id, ...snap.data() } as Customer);
        }
      });
    }
  }, [transaction?.customerId, customers]);

  if (!transaction) return null;

  const customerCode = matchedCustomer?.code || '-';
  const customerAddress = transaction.customerAddress !== '-' && transaction.customerAddress ? transaction.customerAddress : (matchedCustomer?.address || '-');
  
  // Use date or createdAt fields depending on where it's called
  const rawDate = transaction.date?.seconds || transaction.createdAt?.seconds;
  const tDate = rawDate ? new Date(rawDate * 1000).toLocaleDateString('id-ID') : '-';
  
  const tDueDate = transaction.dueDate ? new Date(transaction.dueDate.seconds * 1000).toLocaleDateString('id-ID') : '-';

  const subTotal = (transaction.totalAmount || transaction.total || 0) + (transaction.discountAmount || transaction.discount || 0);
  const discountAmount = transaction.discountAmount || transaction.discount || 0;
  const grandTotal = transaction.totalAmount || transaction.total || 0;

  return (
    <div className="p-8 text-black font-sans bg-white min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            {tenantInfo?.settings?.logoUrl && (
              <img src={tenantInfo.settings.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{tenantInfo?.name || 'ZENTORY'}</h1>
              <p className="text-xs text-gray-500 max-w-xs">{tenantInfo?.settings?.description || 'Business & Sales Solutions'}</p>
            </div>
          </div>
          <div className="text-right max-w-[200px] mt-2">
            <p className="text-xs text-black leading-tight border-b border-black pb-1">
              Pesan lebih cepat dengan klik {tenantInfo?.customDomains?.[0] || (tenantInfo?.slug ? `${tenantInfo.slug}.my.id` : 'domaintenant.my.id')}
            </p>
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-gray-900 uppercase">FAKTUR PENJUALAN</h2>
        </div>

        <div className="flex justify-between mb-6 text-xs">
          <div className="flex-1 mr-4">
            <div className="grid grid-cols-[80px_10px_1fr]">
              <span>Dari</span><span>:</span><span className="font-semibold">{tenantInfo?.name || '-'}</span>
              <span>Alamat</span><span>:</span><span>{tenantInfo?.settings?.address || '-'}</span>
              <span>No Hp</span><span>:</span><span>{tenantInfo?.settings?.phone || '-'}</span>
            </div>
          </div>
          <div className="flex-1 ml-4 border-l border-transparent">
            <div className="grid grid-cols-[120px_10px_1fr]">
              <span>No. Pelanggan</span><span>:</span><span>{customerCode}</span>
              <span>Nama Pelanggan</span><span>:</span><span className="font-semibold">{transaction.customerName || '-'}</span>
              <span>No. Faktur</span><span>:</span><span className="font-semibold">{transaction.orderNumber || '-'}</span>
              <span>Tanggal</span><span>:</span><span>{tDate}</span>
              <span>Due Date</span><span>:</span><span>{tDueDate}</span>
              <span>No PO</span><span>:</span><span>-</span>
              <span>Alamat</span><span>:</span><span>{customerAddress}</span>
            </div>
          </div>
        </div>

        <table className="w-full mb-4 border-collapse border border-black text-xs">
          <thead>
            <tr className="border-[1px] border-black text-center font-bold bg-gray-50">
              <th className="border-[1px] border-black py-2 w-12 text-center">No</th>
              <th className="border-[1px] border-black py-2 w-20 text-center">Jumlah</th>
              <th className="border-[1px] border-black py-2 w-20 text-center">Satuan</th>
              <th className="border-[1px] border-black py-2 px-2 text-center">Nama Barang / Jasa</th>
              <th className="border-[1px] border-black py-2 w-32 text-center">Harga Satuan</th>
              <th className="border-[1px] border-black py-2 w-32 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {transaction.items?.map((item: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="border-[1px] border-black py-2 text-center align-top">{i + 1}</td>
                <td className="border-[1px] border-black py-2 text-center align-top">{item.quantity}</td>
                <td className="border-[1px] border-black py-2 text-center align-top">-</td>
                <td className="border-[1px] border-black py-2 px-2 align-top">{item.name}</td>
                <td className="border-[1px] border-black py-2 px-2 text-right align-top">{Math.round(item.price).toLocaleString('id-ID')}</td>
                <td className="border-[1px] border-black py-2 px-2 text-right align-top">{Math.round(item.price * item.quantity).toLocaleString('id-ID')}</td>
              </tr>
            ))}
            {/* Create some empty padding rows if items are few to make it look like a real invoice */}
            {(!transaction.items || transaction.items.length < 3) && (
              <tr>
                 <td className="border-[1px] border-black py-16 text-center align-top"></td>
                 <td className="border-[1px] border-black py-16 text-center align-top"></td>
                 <td className="border-[1px] border-black py-16 text-center align-top"></td>
                 <td className="border-[1px] border-black py-16 px-2 align-top"></td>
                 <td className="border-[1px] border-black py-16 px-2 text-right align-top"></td>
                 <td className="border-[1px] border-black py-16 px-2 text-right align-top"></td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end mb-10 text-xs font-bold">
          <div className="grid grid-cols-[100px_10px_1fr] w-72">
            <span>Sub Total</span><span>:</span><span className="text-right">{Math.round(subTotal).toLocaleString('id-ID')}</span>
            <span>Diskon 1</span><span>:</span><span className="text-right">{discountAmount ? Math.round(discountAmount).toLocaleString('id-ID') : '0'}</span>
            <span>Diskon 2</span><span>:</span><span className="text-right">0</span>
            <span className="pt-2">Netto</span><span className="pt-2">:</span><span className="text-right pt-2">{Math.round(grandTotal).toLocaleString('id-ID')}</span>
          </div>
        </div>

        <div className="flex justify-between text-center text-xs mt-16 px-10">
          <div>
            <p className="font-bold mb-20 text-gray-800">Terima Kasih</p>
            <hr className="border-black w-48 mx-auto" />
            <p className="mt-2 font-medium">Nama & Tanda Tangan</p>
          </div>
          <div>
            <p className="font-bold mb-20 text-gray-800">Diterima Oleh</p>
            <hr className="border-black w-48 mx-auto" />
            <p className="mt-2 font-medium">Nama Jelas & Tanda Tangan / Cap</p>
          </div>
        </div>
      </div>
    </div>
  );
}
