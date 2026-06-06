import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, Tenant, Customer } from '../types';
import InvoiceA4 from '../components/InvoiceA4';
import { Printer } from 'lucide-react';

export default function PrintView() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [tenantInfo, setTenantInfo] = useState<Tenant | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrintData = async () => {
      if (!id) return;
      try {
        const orderSnap = await getDoc(doc(db, 'orders', id));
        if (orderSnap.exists()) {
          const orderData = { id: orderSnap.id, ...orderSnap.data() } as Order;
          setOrder(orderData);

          if (orderData.tenantId) {
            const tenantSnap = await getDoc(doc(db, 'tenants', orderData.tenantId));
            if (tenantSnap.exists()) {
              setTenantInfo({ id: tenantSnap.id, ...tenantSnap.data() } as Tenant);
            }
          }
          
          if (orderData.customerId) {
            const customerSnap = await getDoc(doc(db, 'customers', orderData.customerId));
            if (customerSnap.exists()) {
              setCustomers([{ id: customerSnap.id, ...customerSnap.data() } as Customer]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching print data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrintData();
  }, [id]);

  useEffect(() => {
    if (!loading && order) {
      setTimeout(() => {
        window.print();
      }, 1000); // Give time for images to load
    }
  }, [loading, order]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Pesanan Tidak Ditemukan</h2>
        <button
          onClick={() => window.close()}
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
        >
          Tutup
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen print:bg-white print:m-0 print:p-0">
      <div className="fixed top-4 right-4 print:hidden z-50">
        <button
          onClick={() => window.print()}
          className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-bold flex items-center shadow-lg"
        >
          <Printer className="w-5 h-5 mr-2" />
          Cetak Ulang
        </button>
      </div>

      {type === 'invoice' && (
        <InvoiceA4 transaction={order} tenantInfo={tenantInfo} customers={customers} />
      )}

      {type === 'receipt' && (
        <div className="p-4 text-black font-mono text-[10px] w-[80mm] mx-auto bg-white min-h-screen">
          <div className="text-center mb-4 flex flex-col items-center">
            {tenantInfo?.settings?.logoUrl && (
              <img src={tenantInfo.settings.logoUrl} alt="Logo" className="max-w-[40mm] h-10 mb-2 object-contain grayscale" />
            )}
            <h1 className="text-base font-bold uppercase">{tenantInfo?.name || 'ZENTORY'}</h1>
            <p className="text-[8px]">{tenantInfo?.settings?.description || 'Sales Receipt'}</p>
            {tenantInfo?.settings?.address && <p className="text-[8px] mt-1">{tenantInfo?.settings?.address}</p>}
            {tenantInfo?.settings?.phone && <p className="text-[8px]">{tenantInfo?.settings?.phone}</p>}
          </div>

          <div className="border-t border-dashed border-gray-300 py-2 mb-2">
            <div className="flex justify-between">
              <span>Order:</span>
              <span>#{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{order.date || (order as any).createdAt ? new Date((order.date?.seconds || (order as any).createdAt?.seconds || 0) * 1000).toLocaleString() : ''}</span>
            </div>
            <div className="flex justify-between">
              <span>Cust:</span>
              <span>{order.customerName}</span>
            </div>
          </div>

          <table className="w-full mb-2">
            <thead>
              <tr className="border-b border-dashed border-gray-300">
                <th className="text-left py-1">Item</th>
                <th className="text-right py-1">Qty</th>
                <th className="text-right py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="py-1 break-words pr-2">{item.name}</td>
                  <td className="text-right py-1 align-top">{item.quantity}</td>
                  <td className="text-right py-1 align-top">{Math.round(item.price * item.quantity).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-gray-300 pt-2 mb-4">
            <div className="flex justify-between font-bold">
              <span>Subtotal:</span>
              <span>{( ((order.totalAmount || (order as any).total || 0) + ((order as any).discountAmount || (order as any).discount || 0)) ).toLocaleString('id-ID')}</span>
            </div>
            {((order as any).discountAmount || (order as any).discount || 0) > 0 && (
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>-{((order as any).discountAmount || (order as any).discount || 0).toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>{(order.totalAmount || (order as any).total || 0).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="text-center mt-6">
            <p className="font-bold">Thank You!</p>
            <p className="text-[8px] text-gray-500 mt-1">Generated by Zyvora</p>
          </div>
        </div>
      )}
    </div>
  );
}
