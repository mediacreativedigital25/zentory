import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LayoutDashboard, Package, ShoppingCart, Wallet, Store, LogOut, Settings, Users, ChevronDown, UserRound, Menu, X, History, BookOpen, Calculator, Truck, CheckCircle2, Globe, Building2, Lock, Zap, ShieldCheck, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePermissions } from '../hooks/usePermissions';
import UpgradePrompt from './Subscription/UpgradePrompt';
import { PLANS } from '../constants/plans';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, permissions: userPermissions, tenant } = useAuth();
  const { hasFeature, plan } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState<{ isOpen: boolean; feature: string } | null>(null);

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => 
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const handleLogout = async () => {
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
    navigate('/login');
  };

  const navItems = [
    { 
      label: 'Sistem Super', 
      icon: ShieldCheck, 
      roles: ['superadmin'],
      children: [
        { label: 'Dashboard Utama', path: '/superadmin/dashboard' },
        { label: 'Pengaturan Global', path: '/superadmin/settings' },
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
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'staff', 'superadmin'], permission: 'dashboard' },
    { label: 'Approval', icon: CheckCircle2, path: '/approvals', roles: ['admin'], permission: 'approvals' },
    { 
      label: 'Sales', 
      icon: ShoppingCart, 
      roles: ['admin', 'staff', 'superadmin', 'kasir'],
      children: [
        { label: 'Sales Order V1', path: '/sales/order-v1', permission: 'sales_order' },
        { label: 'Sales Order', path: '/sales/order', permission: 'sales_order' },
        { label: 'Sales POS', path: '/sales/pos', permission: 'sales_order' },
        { label: 'Sales Order Receive', path: '/sales/receive', permission: 'sales_receive' },
        { label: 'Kupon', path: '/sales/coupons', permission: 'sales_order' },
        { label: 'Customers', path: '/sales/customers', permission: 'sales_customers' },
        { label: 'Tipe Pelanggan', path: '/sales/customer-categories', permission: 'sales_customers' },
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
      label: 'Inventory', 
      icon: Package, 
      roles: ['admin', 'staff', 'superadmin'],
      children: [
        { label: 'Daftar Produk', path: '/inventory/products', permission: 'inventory_products' },
        { label: 'Riwayat Produk', path: '/inventory/products?tab=history', permission: 'inventory_products' },
        { label: 'Kategori', path: '/inventory/categories', permission: 'inventory_categories' },
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
      ]
    },
    { label: 'Daily Settlement', icon: Calculator, path: '/daily-settlement', roles: ['admin'], permission: 'daily_settlement' },
    { 
      label: 'Master', 
      icon: Settings, 
      roles: ['admin', 'superadmin'],
      children: [
        { label: 'Tambah User', path: '/master/users', permission: 'master_users' },
        { label: 'Tambah Role', path: '/master/roles', permission: 'master_roles' },
      ]
    },
    { label: 'Catalog Editor', icon: Store, path: '/catalog-editor', roles: ['admin', 'superadmin'], permission: 'catalog_editor' },
    { label: 'Profil Bisnis', icon: Building2, path: '/settings/business', roles: ['admin'], permission: 'tenant_settings' },
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
    { label: 'Panduan', icon: BookOpen, path: '/guide', roles: ['admin', 'staff', 'superadmin'], permission: 'guide' },
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

      if (profile?.role === 'superadmin') return true;

      // Check if tenant has disabled this menu
      if (tenant?.menuSettings && tenant.menuSettings[item.label] === false) {
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
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
          className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-50 transition-transform duration-300 transform no-print ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <div className="p-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-indigo-600">Zentory</h1>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 lg:hidden"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
            {filteredNav.map((item) => (
              <div key={item.label}>
                {item.children ? (
                  <div>
                    <button
                      onClick={() => toggleMenu(item.label)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                        item.children.some(c => location.pathname === c.path)
                          ? 'text-indigo-700 bg-indigo-50'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon className="w-5 h-5 mr-3" />
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
                          className="overflow-hidden pl-12 space-y-1 mt-1"
                        >
                          {item.children.map((child) => (
                            <Link
                              key={child.path}
                              to={child.path}
                              onClick={() => setIsSidebarOpen(false)}
                              className={`block px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                location.pathname === child.path
                                  ? 'text-indigo-700 bg-indigo-50'
                                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                              }`}
                            >
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
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                      location.pathname === item.path
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center mb-4 px-4">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs uppercase">
                {profile?.displayName?.charAt(0) || profile?.email?.charAt(0)}
              </div>
              <div className="ml-3 overflow-hidden flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{profile?.displayName || profile?.email || 'User'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-gray-500 capitalize">{roleName || profile?.role || 'Loading...'}</p>
                  {plan && (
                    <Link to="/pricing" className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${PLANS[plan]?.color || 'bg-gray-100 text-gray-600'}`}>
                      {PLANS[plan]?.name}
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isKasir ? 'pl-0' : 'lg:pl-64'}`}>
        {/* Mobile Header */}
        {!isKasir && (
          <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between lg:hidden sticky top-0 z-30 no-print">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-indigo-600">Zentory</h1>
            <div className="w-10" /> {/* Spacer for centering */}
          </header>
        )}

        {/* Kasir Header */}
        {isKasir && (
          <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 no-print shadow-sm">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-black text-indigo-600 tracking-tighter">ZENTORY <span className="text-gray-400 font-medium text-sm ml-2 tracking-normal">POS TERMINAL</span></h1>
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
        <main className={`flex-1 bg-gray-50 ${isKasir ? 'p-0' : 'p-4 sm:p-6 lg:p-8'}`}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={isKasir ? 'w-full h-full' : 'max-w-7xl mx-auto'}
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
