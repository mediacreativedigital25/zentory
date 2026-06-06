import React from 'react';
import { motion } from 'motion/react';
import { History, CheckCircle2, Rocket, Shield, Layout, ShoppingCart, UserCheck, Wallet, Truck, Barcode, BarChart3 } from 'lucide-react';

const changelogData = [
  {
    date: '17 Mei 2026',
    version: 'v2.6.0',
    title: 'Standarisasi UI & Manajemen Visibilitas',
    icon: Layout,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    changes: [
      'Standardisasi UI (User Interface): Pembaruan bentuk dan kelengkungan elemen visual pada keseluruhan aplikasi untuk estetika yang lebih seragam dan modern.',
      'Penambahan Opsi Reset Superadmin: Modul Reset Data kini mencakup lebih banyak opsi kontrol reset, termasuk Transfer Rekening, Kategori, Riwayat Stok, Transaksi Persetujuan, dan Target Penjualan.',
      'Kontrol Visibilitas Rekening: Pengguna kini dapat memilih rekening bank mana yang akan ditampilkan ke publik sebagai opsi pembayaran pada halaman Katalog.'
    ]
  },
  {
    date: '22 April 2026',
    version: 'v2.5.0',
    title: 'Manajemen Penagihan Kolektif (Invoice Collection)',
    icon: Wallet,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    changes: [
      'Peluncuran Modul "Invoice Collection": Fitur baru untuk merangkum dan melacak sesi penagihan masal per pelanggan.',
      'Tombol "Simpan Koleksi": Integrasi fungsi penyimpanan pada modal Tagihkan untuk mendokumentasikan setiap sesi penagihan.',
      'Penomoran Koleksi Otomatis: Implementasi format ID unik (IC-YYYYMM-XXXXXX) untuk standarisasi dokumen penagihan.',
      'Dashboard Finansial Kolektif: Ringkasan statistik nominal tertagih dan sisa piutang kolektif secara real-time.',
      'Riwayat Detail Penagihan: Kemudahan melihat daftar rincian nomor order yang tercakup dalam satu sesi koleksi.',
      'Optimasi Alur Kerja Kolektor: Mempercepat proses administrasi penagihan piutang pelanggan yang menumpuk.'
    ]
  },
  {
    date: '22 April 2026',
    version: 'v2.4.0',
    title: 'Disiplin Target & Rincian Pencapaian',
    icon: BarChart3,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    changes: [
      'Implementasi "Target Locking": Otomatisasi penguncian target untuk bulan berjalan dan bulan lalu guna menjaga integritas perencanaan bisnis.',
      'Upgrade Tabel Pencapaian: Penambahan kolom multi-target (Target 1, 2, 3) beserta persentase realisasi untuk setiap tingkatan.',
      'Fitur "Shortfall Tracking": Kalkulasi otomatis sisa nominal (Kurang: Rp.XXX) yang dibutuhkan untuk mencapai setiap level target.',
      'Sinkronisasi Zona Waktu (Local Time): Standarisasi penentuan kunci bulan (YYYY-MM) berdasarkan waktu lokal pengguna untuk akurasi data "Bulan Berjalan".',
      'Peningkatan UX Dashboard: Penambahan indikator visual "Target Terkunci" pada menu Setting Target.',
      'Optimasi Performa Query: Filter transaksi bulanan kini lebih presisi di semua komponen analisis.'
    ]
  },
  {
    date: '19 April 2026',
    version: 'v2.3.0',
    title: 'Keamanan Multi-Tenant & RBAC Berbasis Domain',
    icon: Shield,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    changes: [
      'Isolasi Data Tenant (Domain-Specific): Implementasi domainTenantId untuk memastikan data hanya dapat diakses melalui domain kustom yang sah.',
      'Kontekstualisasi Superadmin: Superadmin kini secara otomatis mengikuti cakupan tenant saat mengakses aplikasi via custom domain.',
      'Restrukturisasi Role Staff: Pembatasan akses fitur finansial sensitif, tutup buku harian, dan manajemen user untuk keamanan internal.',
      'Optimasi POS Terminal untuk Kasir: Kasir kini dapat mengakses modul Customers untuk efisiensi input data pelanggan langsung dari terminal POS.',
      'Peningkatan Keamanan Dashboard: Filter data transaksi, produk, dan saldo bank kini sepenuhnya patuh pada isolasi tenant di domain kustom.',
      'Proteksi Rute Ganda: Penguatan logika ProtectedRoute untuk mencegah akses lintas tenant meskipun pengguna memiliki token yang valid.',
      'Logout Terpadu pada Halaman NoAccess: Kemudahan bagi pengguna untuk berganti akun langsung jika terkena blokir isolasi domain.'
    ]
  },
  {
    date: '15 April 2026',
    version: 'v2.2.0',
    title: 'Manajemen Invoice & Pelacakan Piutang',
    icon: Wallet,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    changes: [
      'Peluncuran Modul "Finance/Invoice": Pelacakan tagihan pelanggan yang belum lunas (Piutang).',
      'Fitur "Kode Pelanggan": Penambahan identitas unik untuk setiap pelanggan guna mempermudah pencarian.',
      'Sistem Pembayaran Parsial: Dukungan untuk mencatat cicilan pembayaran pada invoice yang sedang berjalan.',
      'Visualisasi Jatuh Tempo: Indikator warna untuk invoice yang mendekati atau sudah melewati batas waktu pembayaran.',
      'Integrasi Transaksi Finansial: Setiap pembayaran invoice otomatis tercatat dalam arus kas (Transactions).',
      'Detail Invoice Komprehensif: Tampilan rincian item pesanan, riwayat pembayaran, dan sisa tagihan dalam satu modal.',
      'Optimasi List Produk: Tampilan mode list dengan thumbnail gambar kecil untuk efisiensi navigasi stok.'
    ]
  },
  {
    date: '14 April 2026',
    version: 'v2.1.0',
    title: 'Analisis Inventaris & Optimasi Data',
    icon: BarChart3,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    changes: [
      'Peluncuran Modul "Inventory Report": Analisis pergerakan produk (Fast Moving, Slow Moving, Dead Stock).',
      'Visualisasi Data Inventaris: Integrasi grafik Pie Chart dan Bar Chart untuk komposisi stok dan produk terlaris.',
      'Implementasi Sistem Pagination Global: Navigasi halaman pada semua tabel utama (Finance, Sales, Products, Customers, Suppliers).',
      'Fitur "Rows Per Page": Pengguna dapat memilih tampilan 10, 25, atau 50 data per halaman.',
      'Field "Jatuh Tempo" Supplier: Penambahan fitur pengingat tenggat waktu pembayaran pada modul Supplier.',
      'Peningkatan Keamanan Role: Penambahan izin akses "inventory_report" pada sistem manajemen role.',
      'Optimasi Filter & Search: Reset otomatis halaman ke nomor 1 saat melakukan pencarian atau perubahan filter.',
      'Rekomendasi Strategi Stok: Sistem memberikan saran otomatis berdasarkan kategori pergerakan produk.',
      'Keamanan Sesi: Implementasi Alert "Sesi Berakhir" otomatis jika tidak ada aktivitas selama 5 jam.',
      'Export Stock Opname: Fitur cetak laporan stok opname per kategori dalam format PDF dan Excel (XLSX).',
      'Modul Stock Opname: Fitur perencanaan pemeriksaan stok fisik (Stock Planning) dengan filter periode dan kategori, serta riwayat pemeriksaan.'
    ]
  },
  {
    date: '12 April 2026',
    version: 'v2.0.0',
    title: 'Riwayat Stok & Klasifikasi Pelanggan',
    icon: History,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    changes: [
      'Peluncuran Tab "Riwayat Stok" (Audit Log) global pada menu Produk dengan filter periode tanggal kustom.',
      'Sistem Klasifikasi Pelanggan: Pemisahan tipe pelanggan "Umum" dan "Langganan".',
      'Implementasi Izin Pembayaran Tempo: Pengaturan izin kredit per pelanggan dengan tenggat waktu (Due Date) yang dapat disesuaikan.',
      'Otomatisasi Kalkulasi Jatuh Tempo: Sistem secara otomatis menghitung tanggal jatuh tempo saat transaksi kredit dilakukan.',
      'Integrasi Validasi Tempo pada POS & Sales Order: Tombol Tempo terkunci otomatis untuk pelanggan tanpa izin.',
      'Peningkatan Audit Trail: Setiap mutasi stok kini mencatat referensi transaksi dan user yang bertanggung jawab secara real-time.',
      'Role Baru: "Kasir" - Akses khusus modul penjualan dengan antarmuka Full-Size & Clean.',
      'POS Terminal: Optimalisasi tampilan kasir untuk efisiensi transaksi cepat.'
    ]
  },
  {
    date: '11 April 2026',
    version: 'v1.9.0',
    title: 'Sistem Barcode & Keamanan Role',
    icon: Barcode,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    changes: [
      'Integrasi pemindaian barcode menggunakan kamera perangkat (Html5-QRCode) pada modul Produk.',
      'Fitur "Generate Barcode" otomatis untuk standarisasi produk yang belum memiliki barcode.',
      'Sistem cetak label barcode (Single & Multi-select) untuk mempermudah pelabelan stok fisik.',
      'Perbaikan kritis pada sistem login dan sinkronisasi izin akses untuk Role Custom.',
      'Implementasi halaman "No Access" dan proteksi rute berbasis izin (Permission-based Routing).',
      'Peningkatan validasi navigasi sidebar untuk memastikan keamanan data antar role.'
    ]
  },
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
      'Penghapusan sidebar Zyvora pada tampilan Dashboard Customer untuk pengalaman yang lebih bersih.',
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
    title: 'Initial Release - Zyvora POS',
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
        <div className="w-12 h-12 bg-indigo-600 rounded-md flex items-center justify-center text-white shadow-lg shadow-indigo-100">
          <History className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-900">Changelog</h1>
          <p className="text-gray-500 font-medium">Riwayat pembaruan dan pengembangan sistem Zyvora.</p>
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
              <div className={`hidden sm:flex sticky top-24 w-16 h-16 rounded-md ${item.bgColor} ${item.color} items-center justify-center z-10 shadow-sm border border-white`}>
                <item.icon className="w-8 h-8" />
              </div>

              {/* Content Card */}
              <div className="flex-1 bg-white rounded-md p-8 shadow-sm border border-gray-100 hover:shadow-md transition-all">
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

      <div className="bg-indigo-600 rounded-xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Sistem Pembaruan Otomatis</span>
          </div>
          <h3 className="text-2xl font-black mb-2">Changelog Selalu Terkini</h3>
          <p className="text-indigo-100 text-sm leading-relaxed max-w-md">
            Halaman ini akan diperbarui secara otomatis setiap kali ada perubahan kode, fitur baru, atau perbaikan sistem untuk memastikan transparansi pengembangan Zyvora.
          </p>
        </div>
        <History className="absolute -right-8 -bottom-8 w-48 h-48 text-white/10 rotate-12" />
      </div>

      <div className="bg-white rounded-md p-8 text-center border border-gray-100">
        <p className="text-gray-900 font-bold">Terus berkembang untuk bisnis Anda.</p>
        <p className="text-gray-400 text-sm mt-1">Zyvora Development Team</p>
      </div>
    </div>
  );
}
