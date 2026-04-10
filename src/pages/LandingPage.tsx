import React from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  ShoppingCart, 
  Calendar, 
  Package, 
  Wallet, 
  ArrowRight, 
  Store, 
  ShieldCheck,
  Globe,
  Zap,
  Users,
  BarChart3
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

export const LandingPage: React.FC = () => {
  const { currentTenant } = useAuth();

  if (currentTenant) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Tenant Storefront Header */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                  {currentTenant.name[0]}
                </div>
                <span className="text-xl font-bold text-gray-900 tracking-tight">{currentTenant.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <Link to={`/login?tenant=${currentTenant.subdomain}`} className="text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors">Masuk</Link>
                <Link to={`/register?tenant=${currentTenant.subdomain}`} className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Daftar</Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Tenant Hero */}
        <section className="pt-32 pb-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-6">
              Selamat Datang di <br />
              <span className="text-indigo-600">{currentTenant.name}</span>
            </h1>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
              {currentTenant.address || 'Kami menyediakan layanan terbaik untuk kebutuhan Anda.'}
            </p>
            <div className="flex justify-center gap-4">
              <Link 
                to={`/catalog?tenant=${currentTenant.subdomain}`}
                className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200"
              >
                Lihat Katalog & Booking
              </Link>
            </div>
          </div>
        </section>

        {/* Featured Content Placeholder */}
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-video bg-gray-100 rounded-3xl animate-pulse"></div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">Z</div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Zentory</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Fitur</a>
              <a href="#solutions" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Solusi</a>
              <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Harga</a>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors">Masuk</Link>
              <Link to="/login" className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Coba Gratis</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold mb-8 animate-fade-in">
            <Zap size={14} />
            <span>Platform Bisnis All-in-One #1 di Indonesia</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-gray-900 mb-6 tracking-tight leading-tight">
            1 Platform untuk Semua <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Kebutuhan Bisnis Anda</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Kelola jualan, booking layanan, stok barang, hingga laporan keuangan dalam satu dashboard terintegrasi. Tingkatkan efisiensi bisnis Anda hari ini.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 group">
              Mulai Sekarang
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
            </Link>
            <button className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-lg text-gray-600 hover:bg-gray-50 transition-all border border-gray-200">
              Lihat Demo
            </button>
          </div>
          
          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-indigo-600/5 blur-3xl rounded-full transform -translate-y-1/2"></div>
            <img 
              src="https://picsum.photos/seed/dashboard/1200/800" 
              alt="Dashboard Preview" 
              className="relative rounded-3xl shadow-2xl border border-gray-100 mx-auto max-w-5xl w-full"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">Fitur Lengkap untuk Kemajuan Bisnis</h2>
          <p className="text-gray-600 mb-16 max-w-2xl mx-auto">Dirancang khusus untuk membantu UMKM hingga perusahaan menengah mengelola operasional dengan lebih cerdas.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <ShoppingCart className="text-blue-600" />, title: "Penjualan & POS", desc: "Sistem kasir modern untuk toko retail dengan integrasi katalog online." },
              { icon: <Calendar className="text-purple-600" />, title: "Sistem Booking", desc: "Kelola janji temu dan reservasi layanan jasa secara otomatis." },
              { icon: <Package className="text-orange-600" />, title: "Inventory Stok", desc: "Pantau stok barang secara real-time dengan notifikasi stok rendah." },
              { icon: <Wallet className="text-green-600" />, title: "Laporan Keuangan", desc: "Catat arus kas masuk dan keluar untuk pantau profitabilitas bisnis." }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all text-left group">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subdomain Value */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-indigo-600 rounded-[3rem] p-12 md:p-20 text-white flex flex-col md:flex-row items-center gap-12 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="flex-1 space-y-6 relative z-10">
              <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">Domain Kustom untuk Branding Anda</h2>
              <p className="text-indigo-100 text-lg leading-relaxed">
                Berikan kesan profesional dengan subdomain unik untuk bisnis Anda. Contoh: <span className="font-bold text-white">duodesain.my.id</span> atau <span className="font-bold text-white">gudangbarang.my.id</span>.
              </p>
              <ul className="space-y-4">
                {['Akses Katalog Online Instan', 'Link Bio Media Sosial', 'Katalog Produk Interaktif'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="text-indigo-300" size={20} />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 relative z-10">
              <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="bg-white rounded-xl p-4 flex items-center gap-3 mb-4">
                  <Globe className="text-indigo-600" size={20} />
                  <span className="text-gray-900 font-bold">bisnis-anda.my.id</span>
                </div>
                <div className="space-y-3">
                  <div className="h-4 w-3/4 bg-white/20 rounded-full"></div>
                  <div className="h-4 w-1/2 bg-white/20 rounded-full"></div>
                  <div className="h-32 w-full bg-white/10 rounded-2xl"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">Z</div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">Zentory</span>
          </div>
          <p className="text-gray-500 text-sm">© 2026 Zentory Platform. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-gray-400 hover:text-indigo-600 transition-colors"><Users size={20} /></a>
            <a href="#" className="text-gray-400 hover:text-indigo-600 transition-colors"><BarChart3 size={20} /></a>
            <a href="#" className="text-gray-400 hover:text-indigo-600 transition-colors"><ShieldCheck size={20} /></a>
          </div>
        </div>
      </footer>
    </div>
  );
};
