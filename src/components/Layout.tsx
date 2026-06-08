import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBrand } from '../hooks/useBrand';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LayoutDashboard, Package, ShoppingCart, Wallet, Store, LogOut, Settings, Users, ChevronDown, UserRound, Menu, X, History, BookOpen, Calculator, Truck, CheckCircle2, Globe, Building2, Lock, Zap, ShieldCheck, TrendingUp, Search, Bell, Sun, LayoutGrid, Circle, CalendarDays, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePermissions } from '../hooks/usePermissions';
import UpgradePrompt from './Subscription/UpgradePrompt';
import { PLANS } from '../constants/plans';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, permissions: userPermissions, tenant } = useAuth();
  const { brand } = useBrand();
  const { hasFeature, plan } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState<{ isOpen: boolean; feature: string } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => prev.includes(label) ? [] : [label]);
  };

  const handleLogout = async () => {
    const isCustomer = profile?.role === 'customer';
    const targetTenantId = tenant?.slug || profile?.tenantId || tenant?.id;

    if (auth.currentUser) {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const profileRef = doc(db, 'users', auth.currentUser.uid);
      try {
        await updateDoc(profileRef, {
          isOnline: false,
          lastLogoutAt: serverTimestamp()
        });
      } catch (e) {
        console.error(e);
      }
    }
    await auth.signOut();

    if (isCustomer && targetTenantId) {
      if (location.pathname.startsWith('/catalog')) {
        navigate(`/catalog/${targetTenantId}/auth`);
      } else {
        navigate(`/marketplace/${targetTenantId}/auth`);
      }
    } else {
      navigate('/login');
    }
  };

  const navItems = [
    { 
      label: 'Sistem Super', 
      icon: ShieldCheck, 
      roles: ['superadmin'],
      children: [
        { label: 'Dashboard Utama', path: '/superadmin/dashboard' },
        { label: 'Pengaturan Global', path: '/superadmin/settings' },
        { label: 'Brand & Tampilan', path: '/superadmin/brand' },
        { label: 'Logo Bank', path: '/superadmin/bank-logos' },
        { label: 'Sistem Audit', path: '/superadmin/audit' },
        { label: 'Riwayat Aktivitas', path: '/superadmin/history' },
        { label: 'Roadmap Produk', path: '/superadmin/roadmap' },
        { label: 'Reset Database', path: '/superadmin/reset' },
        { label: 'Periksa Data Harian', path: '/superadmin/data-check' },
      ]
    },
    { 
      label: 'Manajemen Tenant', 
      icon: Building2, 
      roles: ['superadmin'],
      children: [
        { label: 'Daftar Tenant', path: '/superadmin/tenants' },
        { label: 'Layanan / Produk', path: '/superadmin/services' },
        { label: 'Kupon Diskon', path: '/superadmin/coupons' },
        { label: 'Notifikasi (Fonnte)', path: '/superadmin/notifications' },
        { label: 'Template Pesan', path: '/superadmin/notification-templates' },
        { label: 'Tagihan (Invoice)', path: '/superadmin/invoices' },
        { label: 'Domain & SSL', path: '/superadmin/domains' },
      ]
    },
    { 
      label: 'Otoritas', 
      icon: Lock, 
      roles: ['superadmin'],
      children: [
        { label: 'Master Users', path: '/superadmin/users' },
        { label: 'Persetujuan (Approvals)', path: '/superadmin/approvals' },
      ]
    },
    { label: 'Dashboard', icon: LayoutDashboard, path: profile?.role === 'customer' ? `/marketplace/${tenant?.slug || profile?.tenantId || tenant?.id || ''}/dashboard` : '/dashboard', roles: ['admin', 'staff', 'superadmin', 'customer'], permission: 'dashboard' },
    { 
      label: 'Portal Customer', 
      icon: UserRound, 
      roles: ['customer'],
      children: [
        { label: 'Riwayat Pembelian', path: `/marketplace/${tenant?.slug || profile?.tenantId || tenant?.id || ''}/history` },
        { label: 'Status Orderan', path: `/marketplace/${tenant?.slug || profile?.tenantId || tenant?.id || ''}/status` },
        { label: 'Download', path: `/marketplace/${tenant?.slug || profile?.tenantId || tenant?.id || ''}/downloads` },
        { label: 'Alamat', path: `/marketplace/${tenant?.slug || profile?.tenantId || tenant?.id || ''}/address` },
      ]
    },
    { label: 'Katalog Produk', icon: Store, path: `/marketplace/${tenant?.slug || profile?.tenantId || tenant?.id || ''}`, roles: ['customer'] },
    { 
      label: 'Sales', 
      icon: ShoppingCart, 
      roles: ['admin', 'staff', 'superadmin', 'kasir'],
      children: [
        { label: 'Sales Booking', path: '/sales/sales-booking', permission: 'sales_order' },
        { label: 'Booking List', path: '/sales/bookings', permission: 'sales_customers' },
        { label: 'Sales Order V1', path: '/sales/order-v1', permission: 'sales_order' },
        { label: 'Sales Order', path: '/sales/order', permission: 'sales_order' },
        { label: 'Sales POS', path: '/sales/pos', permission: 'sales_order' },
        { label: 'Sales Order Receive', path: '/sales/receive', permission: 'sales_receive' },
        { label: 'Kupon', path: '/sales/coupons', permission: 'sales_order' },
        { label: 'Customers', path: '/sales/customers', permission: 'sales_customers' },
        { label: 'Tipe Pelanggan', path: '/sales/customer-categories', permission: 'sales_customers' },
        { label: 'Review Produk', path: '/sales/reviews', permission: 'sales_order' },
      ]
    },
    { 
      label: 'Finance', 
      icon: Wallet, 
      roles: ['admin', 'staff', 'superadmin'],
      children: [
        { label: 'Invoice', path: '/finance/invoices', roles: ['admin', 'superadmin'], permission: 'finance_invoices' },
        { label: 'Receive Payment', path: '/finance/receive-payment', roles: ['admin', 'superadmin'], permission: 'finance_invoices' },
        { label: 'Invoice Collection', path: '/finance/collections', roles: ['admin', 'superadmin'], permission: 'finance_invoices' },
        { label: 'Tabungan Pelanggan', path: '/finance/customer-savings', permission: 'finance_settings' },
        { label: 'Akun Bank', path: '/finance/bank-accounts', permission: 'finance_bank_accounts' },
        { label: 'Transfer Kas/Bank', path: '/finance/bank-transfers', permission: 'finance_bank_accounts' },
        { label: 'Claim Expense', path: '/finance/claim', permission: 'finance_claim' },
        { label: 'Amal', path: '/finance/charity', roles: ['admin', 'superadmin'], permission: 'finance_charity' },
        { label: 'Report Keuangan', path: '/finance/report', roles: ['admin', 'superadmin'], permission: 'finance_report' },
        { label: 'Setting Claim Expense', path: '/finance/settings', roles: ['admin'], permission: 'finance_settings' },
        { label: 'Daily Settlement', path: '/daily-settlement', roles: ['admin'], permission: 'daily_settlement' },
      ]
    },
    { label: 'Approval', icon: CheckCircle2, path: '/approvals', roles: ['admin'], permission: 'approvals' },
    { 
      label: 'Inventory', 
      icon: Package, 
      roles: ['admin', 'staff', 'superadmin'],
      children: [
        { label: 'Daftar Produk', path: '/inventory/products', permission: 'inventory_products' },
        { label: 'Kategori', path: '/inventory/categories', permission: 'inventory_categories' },
        { label: 'Lini Bisnis', path: '/inventory/business-lines', permission: 'inventory_categories' },
        { label: 'Stock', path: '/inventory/stock', permission: 'inventory_stock' },
        { label: 'Gudang', path: '/inventory/warehouses', permission: 'inventory_warehouses' },
        { label: 'Report Inventory', path: '/inventory/report', permission: 'inventory_report' },
        { label: 'Stock Opname', path: '/inventory/stock-opname', permission: 'inventory_stock_opname' },
      ]
    },
    { 
      label: 'Purchase', 
      icon: Truck, 
      roles: ['admin', 'staff', 'superadmin'],
      children: [
        { label: 'Purchase Request (PR)', path: '/purchase/requests', permission: 'purchase_requests' },
        { label: 'Purchase Order (PO)', path: '/purchase/orders', permission: 'purchase_orders' },
        { label: 'Goods Receipt', path: '/purchase/receipts', permission: 'purchase_goods_receipts' },
        { label: 'Purchase Invoice', path: '/purchase/invoices', permission: 'purchase_invoices' },
        { label: 'Supplier', path: '/purchase/suppliers', permission: 'purchase_suppliers' },
      ]
    },
    { 
      label: 'Sales Analisis', 
      icon: TrendingUp, 
      roles: ['admin', 'staff', 'superadmin'],
      children: [
        { label: 'Setting Target', path: '/sales/analysis/target', permission: 'sales_order' },
        { label: 'Pencapaian', path: '/sales/analysis/achievement', permission: 'sales_order' },
        { label: 'Operational Cost Ratio', path: '/sales/analysis/cost-ratio', permission: 'sales_order' },
      ]
    },
    { 
      label: 'Master', 
      icon: Settings, 
      roles: ['admin', 'superadmin'],
      children: [
        { label: 'Tambah User', path: '/master/users', permission: 'master_users' },
        { label: 'Tambah Role', path: '/master/roles', permission: 'master_roles' },
      ]
    },
    { 
      label: 'Setting', 
      icon: Settings, 
      roles: ['admin', 'superadmin'],
      children: [
        { label: 'Profil Bisnis', path: '/settings/business', permission: 'tenant_settings' },
        { label: 'Payment Metode', path: '/settings/payment-methods', permission: 'tenant_settings' },
        { label: 'Alamat Toko', path: '/settings/store-address', permission: 'tenant_settings' },
      ]
    },
    { 
      label: 'Paket & Upgrade', 
      icon: Zap, 
      roles: ['admin', 'superadmin'],
      children: [
        { label: 'Pilih Paket', path: '/pricing' },
        { label: 'Invoice Transaksi', path: '/layanan/invoice' },
        { label: 'Layanan Saya', path: '/layanan/saya' },
      ]
    },
    { label: 'Changelog', icon: History, path: '/changelog', roles: ['admin', 'staff', 'superadmin'], permission: 'changelog' },
    { label: 'Panduan', icon: BookOpen, path: '/guide', roles: ['admin', 'staff', 'superadmin'], permission: 'guide' }
  ];

  const [roleName, setRoleName] = useState<string>('');

  React.useEffect(() => {
    if (profile) {
      if (['superadmin', 'admin', 'staff', 'customer', 'kasir'].includes(profile.role)) {
        setRoleName(profile.role.charAt(0).toUpperCase() + profile.role.slice(1));
      } else if (profile.role) {
        // Custom role - fetch name if needed, or we can just use the ID for now
        // But we already have the permissions from useAuth
        const fetchRoleName = async () => {
          try {
            const roleDoc = await getDoc(doc(db, 'roles', profile.role));
            if (roleDoc.exists()) {
              setRoleName(roleDoc.data().name);
            }
          } catch (err) {
            console.error('Error fetching role name:', err);
          }
        };
        fetchRoleName();
      }
    }
  }, [profile]);

  const hasPermission = (item: any) => {
    if (!profile) return false;
    if (profile.role === 'superadmin') return true;
    
    // 1. Check Role Restriction on the item itself first
    if (item.roles && !item.roles.includes(profile.role)) {
      return false;
    }

    // 2. Check Feature Gating (Subscription)
    if (item.permission && !hasFeature(item.permission)) {
      return false;
    }

    // 3. If it has children, check if any child is accessible
    if (item.children) {
      return item.children.some((child: any) => hasPermission(child));
    }

    const isSystemRole = ['admin', 'staff'].includes(profile.role);

    // 4. Check custom role permissions
    if (!isSystemRole) {
      if (item.permission) {
        return userPermissions.includes(item.permission);
      }
      return true;
    }

    // 5. System roles (admin, staff) - already checked roles at step 1
    return true;
  };

  const filteredNav = navItems
    .map(item => {
      if (item.children) {
        const filteredChildren = item.children.filter((child: any) => {
          // Strict check: if child is superadmin-only, hide from others immediately
          if (child.roles && child.roles.includes('superadmin') && child.roles.length === 1 && profile?.role !== 'superadmin') {
            return false;
          }

          // Strict check: if child is customer-only, hide from others
          if (child.roles && child.roles.includes('customer') && child.roles.length === 1 && profile?.role !== 'customer') {
            return false;
          }

          if (profile?.role === 'superadmin') return true;

          // Check if tenant has disabled this sub-menu
          if (tenant?.menuSettings && tenant.menuSettings[`${item.label}_${child.label}`] === false) {
            return false;
          }

          return hasPermission(child);
        });

        return { ...item, children: filteredChildren };
      }
      return item;
    })
    .filter(item => {
      // Strict check: if item is superadmin-only, hide from others immediately
      if (item.roles && item.roles.includes('superadmin') && item.roles.length === 1 && profile?.role !== 'superadmin') {
        return false;
      }

      // Strict check: if item is customer-only, hide from others
      if (item.roles && item.roles.includes('customer') && item.roles.length === 1 && profile?.role !== 'customer') {
        return false;
      }

      if (profile?.role === 'superadmin') return true;

      // Check if tenant has disabled this menu
      if (tenant?.menuSettings && tenant.menuSettings[item.label] === false) {
        return false;
      }

      // Hide specific menus for customers
      if (profile?.role === 'customer' && ['Profil Bisnis', 'Paket & Upgrade', 'Changelog', 'Panduan'].includes(item.label)) {
        return false;
      }

      // Always show these basic items for authenticated users
      if (['Dashboard', 'Changelog', 'Panduan', 'Profil Bisnis'].includes(item.label)) return true;

      // If it has children, only show if there's at least one accessible child
      if (item.children) {
        return item.children.length > 0;
      }

      return hasPermission(item);
    });

  const isKasir = profile?.role === 'kasir';

  const searchableItems = React.useMemo(() => {
    const items: { label: string; path: string; icon: any; parent?: string }[] = [];
    filteredNav.forEach(item => {
      if (item.children) {
        item.children.forEach((child: any) => {
          items.push({
            label: child.label,
            path: child.path,
            icon: child.icon || item.icon,
            parent: item.label
          });
        });
      } else if (item.path) {
        items.push({
          label: item.label,
          path: item.path,
          icon: item.icon
        });
      }
    });
    return items;
  }, [filteredNav]);

  const searchResults = searchableItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.parent && item.parent.toLowerCase().includes(searchQuery.toLowerCase()))
  ).slice(0, 8); // Limit results

  return (
    <div className="min-h-screen bg-[#f8f8f9] flex font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && !isKasir && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      {!isKasir && (
        <aside 
          className={`fixed inset-y-0 left-0 w-[260px] bg-white flex flex-col z-50 transition-transform duration-300 transform no-print shadow-[0_0.25rem_0.875rem_0_rgba(38,43,67,0.05)] ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <div className="p-5 flex items-center justify-between mb-2 mt-2">
            <div className="flex items-center">
              <img src={brand.headerLogoUrl} alt={brand.appName} className="h-[40px] object-contain ml-2 mt-1" />
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 lg:hidden rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar pb-4">
            {filteredNav.map((item) => {
              const hasActiveChild = item.children?.some(c => location.pathname === c.path);
              const isActive = location.pathname === item.path;
              
              return (
              <div key={item.label}>
                {item.children ? (
                  <div>
                    <button
                      onClick={() => toggleMenu(item.label)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-[15px] rounded-lg transition-colors ${
                        hasActiveChild || openMenus.includes(item.label)
                          ? 'bg-gray-100/50 text-gray-800 font-semibold'
                          : 'text-gray-600 hover:bg-gray-100/50 hover:text-gray-800 font-medium'
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon className="w-[1.125rem] h-[1.125rem] mr-3" />
                        {item.label}
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${openMenus.includes(item.label) ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {openMenus.includes(item.label) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden space-y-1 mt-1"
                        >
                          {item.children.map((child) => (
                            <Link
                              key={child.path}
                              to={child.path}
                              onClick={() => setIsSidebarOpen(false)}
                              className={`flex items-center pl-11 pr-4 py-2.5 text-[15px] rounded-lg transition-all ${
                                location.pathname === child.path
                                  ? 'bg-gradient-to-r from-[#7367f0] to-[#7367f0]/90 text-white font-medium shadow-md shadow-[#7367f0]/30 translate-x-1'
                                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 hover:translate-x-1'
                              }`}
                            >
                              <Circle className={`w-2 h-2 mr-3 ${location.pathname === child.path ? 'fill-white' : 'border-2 border-gray-400 rounded-full'}`} />
                              {child.label}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    to={item.path!}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center px-4 py-2.5 text-[15px] rounded-lg transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[#7367f0] to-[#7367f0]/90 text-white font-medium shadow-md shadow-[#7367f0]/30'
                        : 'text-gray-600 hover:bg-gray-100/50 hover:text-gray-800 font-medium'
                    }`}
                  >
                    <item.icon className="w-[1.125rem] h-[1.125rem] mr-3" />
                    {item.label}
                  </Link>
                )}
              </div>
            )})}
          </nav>


        </aside>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isKasir ? 'pl-0' : 'lg:pl-[260px]'}`}>
        
        {/* Vuexy style Top Navbar */}
        {!isKasir && (
          <nav className="sticky top-4 z-40 mx-4 sm:mx-6 lg:mx-8 mb-6 mt-4 p-3 bg-white/95 backdrop-blur-md rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] flex items-center justify-between border border-gray-100 no-print transition-all">
            <div className="flex items-center gap-2">
               {/* Mobile menu toggle */}
               <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full lg:hidden transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              <div className="relative">
                <div className="hidden sm:flex items-center text-gray-400 bg-gray-50/50 px-3 py-1.5 rounded-lg border border-transparent hover:border-gray-200 transition-colors focus-within:border-[#7367f0] focus-within:bg-white focus-within:text-[#7367f0] focus-within:shadow-sm">
                  <Search className="w-4 h-4 mr-2" />
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    placeholder="Search (Ctrl+K)" 
                    className="bg-transparent border-none outline-none text-[15px] text-gray-700 w-48 xl:w-64 placeholder-gray-400" 
                  />
                </div>

                <AnimatePresence>
                  {isSearchFocused && searchQuery && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-2 w-full min-w-[300px] bg-white rounded-xl shadow-[0_4px_24px_0_rgba(34,41,47,0.1)] border border-gray-100 py-2 z-50 max-h-[400px] overflow-y-auto"
                    >
                      {searchResults.length > 0 ? (
                        searchResults.map((item, index) => (
                          <Link
                            key={index}
                            to={item.path}
                            className="flex items-center px-4 py-2.5 hover:bg-gray-50 transition-colors rounded-lg mx-2"
                            onClick={() => {
                              setSearchQuery('');
                              setIsSearchFocused(false);
                            }}
                          >
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mr-3 flex-shrink-0">
                              <item.icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                              {item.parent && <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-0.5">{item.parent}</p>}
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-sm text-gray-500 text-center flex flex-col items-center">
                          <Search className="w-8 h-8 text-gray-300 mb-2" />
                          <p>Tidak ada hasil untuk "{searchQuery}"</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors hidden md:block">
                <Globe className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors hidden sm:block">
                <Sun className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors hidden sm:block">
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors relative mr-2">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
              
              {isProfileOpen && (
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProfileOpen(false)}
                />
              )}
              <div className="relative z-50">
                <div 
                  className="flex items-center gap-3 cursor-pointer pl-3 border-l border-gray-200"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                >
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-semibold text-gray-700 leading-tight">{profile?.displayName || profile?.email?.split('@')[0] || 'User'}</p>
                    <p className="text-[11px] font-medium text-gray-500 capitalize">{roleName || profile?.role || 'Admin'}</p>
                  </div>
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[#7367f0]/10 flex flex-col items-center justify-center text-[#7367f0] font-bold text-sm uppercase">
                      {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || 'U'}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                  </div>
                </div>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-[230px] bg-white rounded-xl shadow-[0_4px_24px_0_rgba(34,41,47,0.1)] border border-gray-100 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#7367f0]/10 flex items-center justify-center text-[#7367f0] font-bold text-sm uppercase shrink-0">
                          {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || 'U'}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-gray-800 truncate">{profile?.displayName || profile?.email?.split('@')[0] || 'User'}</p>
                          <p className="text-xs text-gray-500 capitalize">{roleName || profile?.role || 'Admin'}</p>
                        </div>
                      </div>

                      <div className="p-2 border-b border-gray-100">
                        <Link to="/profile" className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:text-[#7367f0] hover:bg-[#7367f0]/5 rounded-md transition-colors" onClick={() => setIsProfileOpen(false)}>
                          <UserRound className="w-4 h-4" />
                          Profile
                        </Link>
                      </div>

                      <div className="p-3">
                        <button
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
                        >
                          Logout
                          <LogOut className="w-4 h-4 ml-1" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </nav>
        )}

        {/* Kasir Header */}
        {isKasir && (
          <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 no-print shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <img src={brand.headerLogoUrl} alt={brand.appName} className="h-[40px] object-contain" />
              </div>
              <span className="text-gray-400 font-medium text-sm ml-2 tracking-normal border-l border-gray-200 pl-4 h-6 flex items-center">POS TERMINAL</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs uppercase">
                  {profile?.displayName?.charAt(0) || profile?.email?.charAt(0)}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{profile?.displayName || profile?.email}</p>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Kasir Aktif</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-md transition-all"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className={`flex-1 ${isKasir ? 'p-0 bg-gray-50' : 'px-4 sm:px-6 lg:px-8 pb-8 pt-2'}`}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={isKasir ? 'w-full h-full' : 'w-full mx-auto'}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <AnimatePresence>
        {showUpgradeModal?.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <UpgradePrompt 
                featureName={showUpgradeModal.feature} 
                requiredPlan="lite" 
                onClose={() => setShowUpgradeModal(null)} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
