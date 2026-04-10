import React from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Wallet, 
  ShieldCheck, 
  Settings,
  ChevronRight,
  Info,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

interface GuideSection {
  id: string;
  title: string;
  icon: any;
  content: {
    subtitle: string;
    steps: string[];
  }[];
  roles: ('admin' | 'staff' | 'superadmin' | 'customer')[];
}

const guides: GuideSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard & Ringkasan',
    icon: LayoutDashboard,
    roles: ['admin', 'staff', 'superadmin'],
    content: [
      {
        subtitle: 'Memahami Statistik',
        steps: [
          'Total Sales: Akumulasi pendapatan dari pesanan yang selesai.',
          'Total Orders: Jumlah pesanan yang masuk ke sistem.',
          'Total Products: Jumlah item yang terdaftar di inventaris.',
          'Grafik Sales vs Expenses: Perbandingan visual antara pemasukan dan pengeluaran.'
        ]
      }
    ]
  },
  {
    id: 'inventory',
    title: 'Manajemen Inventaris',
    icon: Package,
    roles: ['admin', 'staff'],
    content: [
      {
        subtitle: 'Mengelola Produk',
        steps: [
          'Tambah Produk: Klik tombol "Add Product" di menu Inventory.',
          'Stok Otomatis: Stok akan berkurang otomatis setiap kali ada pesanan katalog yang berhasil.',
          'Tipe Produk: Gunakan tipe "Service" untuk jasa yang tidak memerlukan stok fisik.'
        ]
      }
    ]
  },
  {
    id: 'sales',
    title: 'Penjualan & Pesanan',
    icon: ShoppingCart,
    roles: ['admin', 'staff'],
    content: [
      {
        subtitle: 'Alur Pesanan',
        steps: [
          'Manual Order: Input pesanan langsung dari kasir/admin.',
          'Catalog Order: Pesanan yang masuk dari link toko online pelanggan.',
          'Status Pesanan: Update status dari "Pending" ke "Processing" hingga "Completed".',
          'Pembatalan: Status "Cancelled" memerlukan persetujuan Superadmin jika ingin diubah kembali.'
        ]
      }
    ]
  },
  {
    id: 'finance',
    title: 'Keuangan & Arus Kas',
    icon: Wallet,
    roles: ['admin', 'staff'],
    content: [
      {
        subtitle: 'Pencatatan Keuangan',
        steps: [
          'Claim Expense: Catat pengeluaran operasional (Internet, Listrik, dll) lengkap dengan upload nota.',
          'Report Keuangan: Lihat ringkasan pendapatan dan pengeluaran dengan filter waktu.',
          'Laba: Dihitung otomatis dari selisih Harga Jual dan Harga Beli (HPP).'
        ]
      },
      {
        subtitle: 'Daily Closing (Tutup Buku)',
        steps: [
          'Rekap Harian: Lihat total penjualan, modal, dan laba dalam satu hari.',
          'Potongan Amal: Sistem otomatis menghitung 2.5% dari laba untuk amal.',
          'Simpan Riwayat: Klik "Tutup Buku Sekarang" untuk mengunci data harian ke riwayat.'
        ]
      }
    ]
  },
  {
    id: 'superadmin',
    title: 'Panel Superadmin',
    icon: ShieldCheck,
    roles: ['superadmin'],
    content: [
      {
        subtitle: 'Manajemen Multi-Tenant',
        steps: [
          'Tenant List: Melihat dan mengelola semua bisnis yang terdaftar.',
          'Approval Requests: Menyetujui atau menolak permintaan perubahan status transaksi dari tenant.',
          'Global Overview: Melihat statistik transaksi dari seluruh tenant.'
        ]
      }
    ]
  },
  {
    id: 'customer',
    title: 'Panduan Pelanggan',
    icon: Users,
    roles: ['customer'],
    content: [
      {
        subtitle: 'Cara Berbelanja',
        steps: [
          'Pilih Produk: Masukkan item ke keranjang dari halaman katalog.',
          'Checkout: Lakukan login/register untuk menyelesaikan pesanan.',
          'Lacak Pesanan: Cek status pesanan Anda di Dashboard Pelanggan.',
          'Alamat: Simpan alamat pengiriman di profil untuk kemudahan checkout berikutnya.'
        ]
      }
    ]
  }
];

export default function Guide() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900">Panduan Penggunaan</h2>
          <p className="text-gray-500 mt-1">Pelajari cara mengoperasikan sistem Zentory secara efektif.</p>
        </div>
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
          <BookOpen className="w-8 h-8" />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar Navigation */}
        <div className="md:col-span-1 space-y-2">
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm sticky top-24">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4 mb-4">Daftar Isi</p>
            {guides.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center p-3 rounded-xl text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all group"
              >
                <section.icon className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold">{section.title}</span>
                <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
            <div className="mt-6 pt-6 border-t border-gray-50">
              <div className="p-4 bg-gray-50 rounded-2xl">
                <div className="flex items-center text-indigo-600 mb-2">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  <span className="text-xs font-black uppercase">Butuh Bantuan?</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Jika Anda menemukan kendala teknis, silakan hubungi tim dukungan kami melalui email atau WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-2 space-y-12">
          {guides.map((section, index) => (
            <motion.section
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm scroll-mt-24"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-gray-50 text-indigo-600 rounded-2xl">
                  <section.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">{section.title}</h3>
                  <div className="flex gap-2 mt-1">
                    {section.roles.map(role => (
                      <span key={role} className="text-[9px] font-black uppercase px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                {section.content.map((item, idx) => (
                  <div key={idx}>
                    <h4 className="flex items-center text-sm font-black text-gray-900 mb-4">
                      <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-2" />
                      {item.subtitle}
                    </h4>
                    <ul className="space-y-3">
                      {item.steps.map((step, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-3 text-sm text-gray-600 leading-relaxed">
                          <div className="mt-1.5 w-1 h-1 bg-gray-300 rounded-full flex-shrink-0" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.section>
          ))}

          {/* Automatic Update Notice */}
          <div className="bg-indigo-600 rounded-[2rem] p-8 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-widest">Sistem Pembaruan Otomatis</span>
              </div>
              <h3 className="text-2xl font-black mb-2">Panduan Selalu Terkini</h3>
              <p className="text-indigo-100 text-sm leading-relaxed max-w-md">
                Halaman ini terintegrasi langsung dengan logika sistem. Setiap kali ada fitur baru atau perubahan alur kerja, panduan ini akan diperbarui secara otomatis untuk memastikan Anda mendapatkan informasi terbaru.
              </p>
            </div>
            <BookOpen className="absolute -right-8 -bottom-8 w-48 h-48 text-white/10 rotate-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
