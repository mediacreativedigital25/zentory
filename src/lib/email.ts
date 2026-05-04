import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

interface EmailSettings {
  isActive: boolean;
}

interface NotificationTemplates {
  invoiceCreateEmailSubject?: string;
  invoiceCreateEmailHtml?: string;
  paymentSuccessEmailSubject?: string;
  paymentSuccessEmailHtml?: string;
  subscriptionInfoEmailSubject?: string;
  subscriptionInfoEmailHtml?: string;
}

export const getEmailSettings = async (): Promise<EmailSettings | null> => {
  try {
    const snap = await getDoc(doc(db, 'global_settings', 'email_settings'));
    if (snap.exists() && snap.data().isActive) {
      return snap.data() as EmailSettings;
    }
    return null;
  } catch (error) {
    console.error("Failed to get Email settings:", error);
    return null;
  }
};

export const getEmailTemplates = async (): Promise<NotificationTemplates> => {
  const defaults = {
    invoiceCreateEmailSubject: 'Tagihan Baru - {plan_name}',
    invoiceCreateEmailHtml: 'Halo {nama_tenant},<br/><br/>Tagihan untuk langganan <b>{plan_name}</b> sebesar <b>{amount}</b> telah dibuat dengan nomor <b>{invoice_number}</b>.<br/><br/>Silakan lakukan pembayaran melalui link berikut:<br/><a href="{invoice_url}">Bayar Sekarang</a><br/><br/>Terima kasih!',
    paymentSuccessEmailSubject: 'Pembayaran Berhasil - {invoice_number}',
    paymentSuccessEmailHtml: 'Halo {nama_tenant},<br/><br/>Pembayaran sebesar <b>{amount}</b> untuk tagihan <b>{invoice_number}</b> ({plan_name}) telah berhasil kami terima.<br/><br/>Terima kasih telah menggunakan layanan kami!',
    subscriptionInfoEmailSubject: 'Informasi Layanan - {plan_name}',
    subscriptionInfoEmailHtml: 'Halo {nama_tenant},<br/><br/>Layanan <b>{plan_name}</b> Anda aktif hingga <b>{end_date}</b>.<br/><br/>Salam sukses!'
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
    console.error("Failed to get email templates:", error);
  }
  
  return defaults;
};

export const sendEmailNotification = async (to: string, subject: string, html: string) => {
  if (!to) return false;
  const settings = await getEmailSettings();
  if (!settings) return false;

  try {
    await addDoc(collection(db, 'mail'), {
      to,
      message: {
        subject,
        html
      }
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

export const sendInvoiceCreatedEmail = async (
  targetEmail: string,
  data: { nama_tenant: string; plan_name: string; amount: string; invoice_url: string; invoice_number: string }
) => {
  const templates = await getEmailTemplates();
  let subject = templates.invoiceCreateEmailSubject || '';
  let html = templates.invoiceCreateEmailHtml || '';
  
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
  });
  
  return sendEmailNotification(targetEmail, subject, html);
};

export const sendPaymentSuccessEmail = async (
  targetEmail: string,
  data: { nama_tenant: string; plan_name: string; amount: string; invoice_number: string }
) => {
  const templates = await getEmailTemplates();
  let subject = templates.paymentSuccessEmailSubject || '';
  let html = templates.paymentSuccessEmailHtml || '';
  
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
  });
  
  return sendEmailNotification(targetEmail, subject, html);
};

export const sendSubscriptionInfoEmail = async (
  targetEmail: string,
  data: { nama_tenant: string; plan_name: string; end_date: string }
) => {
  const templates = await getEmailTemplates();
  let subject = templates.subscriptionInfoEmailSubject || '';
  let html = templates.subscriptionInfoEmailHtml || '';
  
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
  });
  
  return sendEmailNotification(targetEmail, subject, html);
};
