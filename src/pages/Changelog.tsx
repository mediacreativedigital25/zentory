import React from 'react';
import { motion } from 'motion/react';
import { History, CheckCircle2, Rocket, Shield, Layout, ShoppingCart, UserCheck, Wallet, Truck } from 'lucide-react';

const changelogData = [
  {
    date: '10 April 2026',
    version: 'v1.8.0',
    title: 'Modul Purchase & Optimasi Stok',
    icon: Truck,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    changes: [
      'Peluncuran Modul Purchase lengkap: Purchase Request (PR), Purchase Order (PO), Goods Receipt, dan Purchase Invoice.',
      'Implementasi workflow Approval PR: Otomatisasi approval untuk Admin/Superadmin dan sistem pending untuk Staff.',
      'Optimasi Inventaris: Pemisahan produk tipe "Manual" (Stok) dan "Jasa" (Non-Stok) pada modul Purchase dan Monitoring Stok.',
      'Fitur Bulk Scan Barcode untuk penambahan produk massal yang lebih cepat.',
      'Peningkatan keamanan dengan sentralisasi Error Handling Firestore dan pembaruan Security Rules.',
      'Fitur Auto-SKU untuk standarisasi identitas produk manual dan jasa.'
    ]
  },
  {
    date: '9 April 2026',
    version: 'v1.7.0',
    title: 'Manajemen Keuangan Terpadu',
    icon: Wallet,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    changes: [
      'Restrukturisasi menu Finance menjadi Dropdown untuk akses lebih cepat.',
      'Peluncuran fitur "Claim Expense" dengan dukungan upload nota, rincian aktivitas, dan sistem repeater (multi-item).',
      'Implementasi "Report Keuangan" dengan filter periode: Harian, Mingguan, Bulanan, dan Tahunan.',
      'Peningkatan visualisasi data pada dashboard keuangan.'
    ]
  },
  {
    date: '9 April 2026',
    version: 'v1.6.0',
    title: 'Sistem Keuangan & Tutup Buku',
    icon: Wallet,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    changes: [
      'Fitur Hitung Laba per Transaksi berdasarkan HPP (Harga Beli).',
      'Peluncuran menu "Daily Closing" (Tutup Buku Harian).',
      'Otomatisasi potongan Amal 2.5% dari laba harian.',
      'Rekapitulasi total penjualan, modal, dan laba bersih harian.'
    ]
  },
  {
    date: '8 April 2026',
    version: 'v1.5.0',
    title: 'Optimasi UI & Panduan Sistem',
    icon: Layout,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    changes: [
      'Implementasi tampilan Katalog 2 kolom pada perangkat mobile untuk presisi visual.',
      'Peluncuran menu "Panduan" komprehensif yang terintegrasi dengan peran pengguna.',
      'Peningkatan transparansi Superadmin: Nama Tenant kini terlihat di Dashboard, Finance, dan Approval Requests.',
      'Otomatisasi pembaruan menu Panduan dan Changelog untuk sinkronisasi fitur terbaru.'
    ]
  },
  {
    date: '8 April 2026',
    version: 'v1.4.0',
    title: 'Sinkronisasi Finansial & Stok',
    icon: Rocket,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    changes: [
      'Sinkronisasi akumulasi nominal antara order manual dan katalog.',
      'Implementasi pemotongan stok otomatis untuk pesanan via katalog.',
      'Pembaruan Firestore Rules untuk mendukung transaksi pelanggan yang aman.',
      'Optimasi perhitungan total sales di Dashboard dan Finance.'
    ]
  },
  {
    date: '8 April 2026',
    version: 'v1.3.0',
    title: 'Penyempurnaan Dashboard Customer',
    icon: Layout,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    changes: [
      'Penghapusan sidebar Zentory pada tampilan Dashboard Customer untuk pengalaman yang lebih bersih.',
      'Integrasi Logo dan Nama Tenant pada Header Dashboard Customer.',
      'Pemindahan tombol Logout ke Header.',
      'Penambahan sapaan personal pada dashboard.'
    ]
  },
  {
    date: '8 April 2026',
    version: 'v1.2.0',
    title: 'Sistem Registrasi & Keamanan',
    icon: Shield,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    changes: [
      'Implementasi fitur registrasi mandiri untuk pelanggan.',
      'Pembaruan Firestore Security Rules untuk proteksi data PII pelanggan.',
      'Otomatisasi penambahan data ke koleksi Customers saat registrasi.',
      'Perbaikan izin akses (Missing Permissions) pada proses checkout.'
    ]
  },
  {
    date: '7 April 2026',
    version: 'v1.1.0',
    title: 'Fitur Katalog & Order',
    icon: ShoppingCart,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    changes: [
      'Peluncuran fitur Katalog Publik per Tenant.',
      'Sistem keranjang belanja (Shopping Cart) untuk pelanggan.',
      'Fitur cetak Invoice (A4) dan Struk Thermal.',
      'Dashboard khusus pelanggan untuk melacak status pesanan.'
    ]
  },
  {
    date: '6 April 2026',
    version: 'v1.0.0',
    title: 'Initial Release - Zentory POS',
    icon: UserCheck,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    changes: [
      'Sistem Multi-Tenant (SaaS) untuk bisnis.',
      'Manajemen Inventaris (Produk, Kategori, Gudang).',
      'Sistem Kasir (Sales Order) Manual.',
      'Laporan Keuangan & Arus Kas Dasar.',
      'Role-based Access Control (Superadmin, Admin, Staff).'
    ]
  }
];

export default function Changelog() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
          <History className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-900">Changelog</h1>
          <p className="text-gray-500 font-medium">Riwayat pembaruan dan pengembangan sistem Zentory.</p>
        </div>
      </div>

      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-100 hidden sm:block" />

        <div className="space-y-12">
          {changelogData.map((item, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative flex flex-col sm:flex-row gap-8"
            >
              {/* Icon Dot */}
              <div className={`hidden sm:flex sticky top-24 w-16 h-16 rounded-2xl ${item.bgColor} ${item.color} items-center justify-center z-10 shadow-sm border border-white`}>
                <item.icon className="w-8 h-8" />
              </div>

              {/* Content Card */}
              <div className="flex-1 bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${item.bgColor} ${item.color}`}>
                        {item.version}
                      </span>
                      <h2 className="text-xl font-black text-gray-900">{item.title}</h2>
                    </div>
                    <p className="text-sm text-gray-400 font-medium">{item.date}</p>
                  </div>
                </div>

                <ul className="space-y-4">
                  {item.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-600">
                      <CheckCircle2 className={`w-5 h-5 mt-0.5 shrink-0 ${item.color}`} />
                      <span className="text-sm leading-relaxed">{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="bg-indigo-600 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Sistem Pembaruan Otomatis</span>
          </div>
          <h3 className="text-2xl font-black mb-2">Changelog Selalu Terkini</h3>
          <p className="text-indigo-100 text-sm leading-relaxed max-w-md">
            Halaman ini akan diperbarui secara otomatis setiap kali ada perubahan kode, fitur baru, atau perbaikan sistem untuk memastikan transparansi pengembangan Zentory.
          </p>
        </div>
        <History className="absolute -right-8 -bottom-8 w-48 h-48 text-white/10 rotate-12" />
      </div>

      <div className="bg-white rounded-3xl p-8 text-center border border-gray-100">
        <p className="text-gray-900 font-bold">Terus berkembang untuk bisnis Anda.</p>
        <p className="text-gray-400 text-sm mt-1">Zentory Development Team</p>
      </div>
    </div>
  );
}
