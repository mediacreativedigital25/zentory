import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

interface FonnteSettings {
  token: string;
  isActive: boolean;
}

interface NotificationTemplates {
  invoiceCreate: string;
  paymentSuccess: string;
  subscriptionInfo: string;
}

export const getFonnteSettings = async (): Promise<FonnteSettings | null> => {
  try {
    const snap = await getDoc(doc(db, 'global_settings', 'fonnte'));
    if (snap.exists() && snap.data().isActive) {
      return snap.data() as FonnteSettings;
    }
    return null;
  } catch (error) {
    console.error("Failed to get Fonnte settings:", error);
    return null;
  }
};

export const getNotificationTemplates = async (): Promise<NotificationTemplates> => {
  const defaults = {
    invoiceCreate: 'Halo {nama_tenant},\n\nTagihan untuk langganan {plan_name} sebesar {amount} telah dibuat dengan nomor {invoice_number}.\n\nSilakan lakukan pembayaran melalui link pembayaran berikut:\n{invoice_url}\n\nTerima kasih!',
    paymentSuccess: 'Halo {nama_tenant},\n\nPembayaran sebesar {amount} untuk tagihan {invoice_number} ({plan_name}) telah berhasil kami terima.\n\nTerima kasih telah menggunakan layanan kami!',
    subscriptionInfo: 'Halo {nama_tenant},\n\nLayanan {plan_name} Anda aktif hingga {end_date}.\n\nSalam sukses!'
  };

  try {
    const snap = await getDoc(doc(db, 'global_settings', 'notification_templates'));
    if (snap.exists()) {
      return {
        ...defaults,
        ...snap.data()
      };
    }
  } catch (error) {
    console.error("Failed to get notification templates:", error);
  }
  
  return defaults;
};

export const sendFonnteMessage = async (target: string, message: string) => {
  if (!target || !message) return false;
  
  const settings = await getFonnteSettings();
  if (!settings || !settings.token) return false;

  try {
    const formData = new FormData();
    formData.append('target', target);
    formData.append('message', message);

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': settings.token,
      },
      body: formData,
    });

    const result = await response.json();
    return result.status;
  } catch (error) {
    console.error('Error sending fonnte message:', error);
    return false;
  }
};

export const sendInvoiceCreatedNotification = async (
  targetPhone: string,
  data: { nama_tenant: string; plan_name: string; amount: string; invoice_url: string; invoice_number: string }
) => {
  const templates = await getNotificationTemplates();
  let message = templates.invoiceCreate;
  Object.entries(data).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  return sendFonnteMessage(targetPhone, message);
};

export const sendPaymentSuccessNotification = async (
  targetPhone: string,
  data: { nama_tenant: string; plan_name: string; amount: string; invoice_number: string }
) => {
  const templates = await getNotificationTemplates();
  let message = templates.paymentSuccess;
  Object.entries(data).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  return sendFonnteMessage(targetPhone, message);
};

export const sendSubscriptionInfoNotification = async (
  targetPhone: string,
  data: { nama_tenant: string; plan_name: string; end_date: string }
) => {
  const templates = await getNotificationTemplates();
  let message = templates.subscriptionInfo;
  Object.entries(data).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  return sendFonnteMessage(targetPhone, message);
};

export const sendCatalogOrderNotification = async (
  targetPhone: string,
  data: { nama_tenant: string; nama_customer: string; produk: string; qty: string; total: string; tanggal_order: string; nomor_customer: string; link_dashboard: string }
) => {
  let message = `🚨 *NOTIFIKASI PESANAN BARU*

Halo *{nama_tenant}* 👋

Anda mendapatkan pesanan baru melalui katalog online.

📋 *Detail Pesanan*
• Nama Customer : {nama_customer}
• Produk : {produk}
• Jumlah : {qty}
• Total Pesanan : {total}
• Tanggal : {tanggal_order}

📞 *Kontak Customer*
{nomor_customer}

⚠️ Mohon segera ditindak lanjuti untuk menghindari keterlambatan respon kepada customer.

🔗 Kelola pesanan:
{link_dashboard}

Terima kasih.

━━━━━━━━━━━━━━━
*Zyvora System*

#PesanOtomatis
Pesan ini dikirim secara otomatis oleh sistem dan tidak perlu dibalas.`;

  Object.entries(data).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  return sendFonnteMessage(targetPhone, message);
};
