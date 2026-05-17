import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { MessageSquare, Save, Loader2, Info } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

// Variables available
const INVOICE_VARS = "{nama_tenant}, {plan_name}, {amount}, {invoice_url}, {invoice_number}";
const PAY_VARS = "{nama_tenant}, {plan_name}, {amount}, {invoice_number}";
const INFO_VARS = "{nama_tenant}, {plan_name}, {end_date}";

export default function SuperAdminNotificationTemplates() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'wa'|'email'>('wa');

  const [templates, setTemplates] = useState({
    invoiceCreate: 'Halo {nama_tenant},\n\nTagihan untuk langganan {plan_name} sebesar {amount} telah dibuat dengan nomor {invoice_number}.\n\nSilakan lakukan pembayaran melalui link pembayaran berikut:\n{invoice_url}\n\nTerima kasih!',
    paymentSuccess: 'Halo {nama_tenant},\n\nPembayaran sebesar {amount} untuk tagihan {invoice_number} ({plan_name}) telah berhasil kami terima.\n\nTerima kasih telah menggunakan layanan kami!',
    subscriptionInfo: 'Halo {nama_tenant},\n\nLayanan {plan_name} Anda aktif hingga {end_date}.\n\nSalam sukses!',
    invoiceCreateEmailSubject: 'Tagihan Baru - {plan_name}',
    invoiceCreateEmailHtml: 'Halo {nama_tenant},\n\nTagihan untuk langganan <b>{plan_name}</b> sebesar <b>{amount}</b> telah dibuat dengan nomor <b>{invoice_number}</b>.\n\nSilakan lakukan pembayaran melalui link berikut:\n<a href="{invoice_url}">Bayar Sekarang</a>\n\nTerima kasih!',
    paymentSuccessEmailSubject: 'Pembayaran Berhasil - {invoice_number}',
    paymentSuccessEmailHtml: 'Halo {nama_tenant},\n\nPembayaran sebesar <b>{amount}</b> untuk tagihan <b>{invoice_number}</b> ({plan_name}) telah berhasil kami terima.\n\nTerima kasih telah menggunakan layanan kami!',
    subscriptionInfoEmailSubject: 'Informasi Layanan - {plan_name}',
    subscriptionInfoEmailHtml: 'Halo {nama_tenant},\n\nLayanan <b>{plan_name}</b> Anda aktif hingga <b>{end_date}</b>.\n\nSalam sukses!'
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const snap = await getDoc(doc(db, 'global_settings', 'notification_templates'));
      if (snap.exists()) {
        const data = snap.data();
        setTemplates(prev => ({
          invoiceCreate: data.invoiceCreate || prev.invoiceCreate,
          paymentSuccess: data.paymentSuccess || prev.paymentSuccess,
          subscriptionInfo: data.subscriptionInfo || prev.subscriptionInfo,
          invoiceCreateEmailSubject: data.invoiceCreateEmailSubject || prev.invoiceCreateEmailSubject,
          invoiceCreateEmailHtml: data.invoiceCreateEmailHtml || prev.invoiceCreateEmailHtml,
          paymentSuccessEmailSubject: data.paymentSuccessEmailSubject || prev.paymentSuccessEmailSubject,
          paymentSuccessEmailHtml: data.paymentSuccessEmailHtml || prev.paymentSuccessEmailHtml,
          subscriptionInfoEmailSubject: data.subscriptionInfoEmailSubject || prev.subscriptionInfoEmailSubject,
          subscriptionInfoEmailHtml: data.subscriptionInfoEmailHtml || prev.subscriptionInfoEmailHtml,
        }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'global_settings', 'notification_templates'), templates, { merge: true });
      alert('Template notifikasi berhasil disimpan!');
    } catch (error) {
      // @ts-ignore
      handleFirestoreError(error, OperationType.WRITE, 'global_settings/notification_templates', auth, null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 bg-white p-6 rounded-md shadow-sm border border-gray-100">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-md">
          <MessageSquare className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Template Pesan Notifikasi</h1>
          <p className="text-sm text-gray-500 font-medium">Sesuaikan isi pesan yang akan dikirim ke Tenant via WhatsApp</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        <button
          className={`px-4 py-3 font-bold border-b-2 transition-colors ${activeTab === 'wa' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          onClick={() => setActiveTab('wa')}
        >
          Notifikasi WhatsApp
        </button>
        <button
          className={`px-4 py-3 font-bold border-b-2 transition-colors ${activeTab === 'email' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          onClick={() => setActiveTab('email')}
        >
          Notifikasi Email
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {activeTab === 'wa' && (
          <div className="space-y-6">
            {/* Invoice Created */}
            <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 space-y-4">
              <h2 className="font-bold text-gray-900">Tagihan Baru Dibuat</h2>
              <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-xs font-mono">
                <strong>Variabel tersedia:</strong> {INVOICE_VARS}
              </div>
              <textarea
                value={templates.invoiceCreate}
                onChange={e => setTemplates({...templates, invoiceCreate: e.target.value})}
                rows={6}
                className="w-full p-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
              />
            </div>

            {/* Payment Success */}
            <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 space-y-4">
              <h2 className="font-bold text-gray-900">Pembayaran Berhasil</h2>
              <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-xs font-mono">
                <strong>Variabel tersedia:</strong> {PAY_VARS}
              </div>
              <textarea
                value={templates.paymentSuccess}
                onChange={e => setTemplates({...templates, paymentSuccess: e.target.value})}
                rows={6}
                className="w-full p-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
              />
            </div>

            {/* Subscription Info */}
            <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 space-y-4">
              <h2 className="font-bold text-gray-900">Info Layanan Aktif</h2>
              <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-xs font-mono">
                <strong>Variabel tersedia:</strong> {INFO_VARS}
              </div>
              <textarea
                value={templates.subscriptionInfo}
                onChange={e => setTemplates({...templates, subscriptionInfo: e.target.value})}
                rows={5}
                className="w-full p-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
              />
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-6">
            {/* EMAIL Invoice Created */}
            <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 space-y-4">
              <h2 className="font-bold text-gray-900">Tagihan Baru Dibuat</h2>
              <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-xs font-mono">
                <strong>Variabel tersedia:</strong> {INVOICE_VARS}
              </div>
              <input
                type="text"
                placeholder="Subject Email"
                value={templates.invoiceCreateEmailSubject}
                onChange={e => setTemplates({...templates, invoiceCreateEmailSubject: e.target.value})}
                className="w-full p-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
              />
              <textarea
                value={templates.invoiceCreateEmailHtml}
                onChange={e => setTemplates({...templates, invoiceCreateEmailHtml: e.target.value})}
                rows={6}
                placeholder="HTML Body"
                className="w-full p-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              />
            </div>

            {/* EMAIL Payment Success */}
            <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 space-y-4">
              <h2 className="font-bold text-gray-900">Pembayaran Berhasil</h2>
              <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-xs font-mono">
                <strong>Variabel tersedia:</strong> {PAY_VARS}
              </div>
              <input
                type="text"
                placeholder="Subject Email"
                value={templates.paymentSuccessEmailSubject}
                onChange={e => setTemplates({...templates, paymentSuccessEmailSubject: e.target.value})}
                className="w-full p-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
              />
              <textarea
                value={templates.paymentSuccessEmailHtml}
                onChange={e => setTemplates({...templates, paymentSuccessEmailHtml: e.target.value})}
                rows={6}
                placeholder="HTML Body"
                className="w-full p-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              />
            </div>

            {/* EMAIL Subscription Info */}
            <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 space-y-4">
              <h2 className="font-bold text-gray-900">Info Layanan Aktif</h2>
              <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-xs font-mono">
                <strong>Variabel tersedia:</strong> {INFO_VARS}
              </div>
              <input
                type="text"
                placeholder="Subject Email"
                value={templates.subscriptionInfoEmailSubject}
                onChange={e => setTemplates({...templates, subscriptionInfoEmailSubject: e.target.value})}
                className="w-full p-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
              />
              <textarea
                value={templates.subscriptionInfoEmailHtml}
                onChange={e => setTemplates({...templates, subscriptionInfoEmailHtml: e.target.value})}
                rows={5}
                placeholder="HTML Body"
                className="w-full p-2 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-indigo-600 text-white rounded-md font-bold flex items-center shadow-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
            Simpan Template
          </button>
        </div>
      </form>
    </div>
  );
}
