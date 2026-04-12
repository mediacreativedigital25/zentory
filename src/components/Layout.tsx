import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LayoutDashboard, Package, ShoppingCart, Wallet, Store, LogOut, Settings, Users, ChevronDown, UserRound, Menu, X, History, BookOpen, Calculator, Truck, CheckCircle2, Globe, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, permissions: userPermissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => 
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'staff', 'superadmin'], permission: 'dashboard' },
    { label: 'Approval', icon: CheckCircle2, path: '/approvals', roles: ['admin'], permission: 'approvals' },
    { 
      label: 'Sales', 
      icon: ShoppingCart, 
      roles: ['admin', 'staff', 'superadmin'],
      children: [
        { label: 'Sales Order', path: '/sales/order', permission: 'sales_order' },
        { label: 'Sales Order Receive', path: '/sales/receive', permission: 'sales_receive' },
        { label: 'Customers', path: '/sales/customers', permission: 'sales_customers' },
      ]
    },
    { 
      label: 'Inventory', 
      icon: Package, 
      roles: ['admin', 'staff', 'superadmin'],
      children: [
        { label: 'Produk', path: '/inventory/products', permission: 'inventory_products' },
        { label: 'Kategori', path: '/inventory/categories', permission: 'inventory_categories' },
        { label: 'Stock', path: '/inventory/stock', permission: 'inventory_stock' },
        { label: 'Gudang', path: '/inventory/warehouses', permission: 'inventory_warehouses' },
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
        { label: 'Akun Bank', path: '/finance/bank-accounts', permission: 'finance_bank_accounts' },
        { label: 'Claim Expense', path: '/finance/claim', permission: 'finance_claim' },
        { label: 'Amal', path: '/finance/charity', permission: 'finance_charity' },
        { label: 'Report Keuangan', path: '/finance/report', permission: 'finance_report' },
        { label: 'Setting Claim Expense', path: '/finance/settings', roles: ['admin'], permission: 'finance_settings' },
      ]
    },
    { label: 'Daily Settlement', icon: Calculator, path: '/daily-settlement', roles: ['admin', 'staff'], permission: 'daily_settlement' },
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
    { label: 'Changelog', icon: History, path: '/changelog', roles: ['admin', 'staff', 'superadmin'], permission: 'changelog' },
    { label: 'Panduan', icon: BookOpen, path: '/guide', roles: ['admin', 'staff', 'superadmin'], permission: 'guide' },
    { 
      label: 'Superadmin', 
      icon: Users, 
      roles: ['superadmin'],
      children: [
        { label: 'Dashboard', path: '/superadmin' },
        { label: 'Domain Management', path: '/superadmin/domains' },
      ]
    },
  ];

  const [roleName, setRoleName] = useState<string>('');

  React.useEffect(() => {
    if (profile) {
      if (['superadmin', 'admin', 'staff', 'customer'].includes(profile.role)) {
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
    
    const isSystemRole = ['admin', 'staff'].includes(profile.role);

    // Check custom role permissions
    if (!isSystemRole) {
      if (item.children) {
        // For parent items, show if any child is allowed
        return item.children.some((child: any) => {
          if (child.permission) return userPermissions.includes(child.permission);
          if (child.roles) return !child.roles.includes('superadmin');
          if (item.roles) return !item.roles.includes('superadmin');
          return true;
        });
      }
      
      if (item.permission) {
        return userPermissions.includes(item.permission);
      }
      
      // If no permission key, check roles
      if (item.roles) {
        // Custom roles are not superadmin, so if it's superadmin-only, deny
        return !item.roles.includes('superadmin');
      }
      
      return true;
    }

    // System roles (admin, staff)
    if (item.children) {
      return item.children.some((child: any) => {
        const allowedRoles = child.roles || item.roles;
        return !allowedRoles || allowedRoles.includes(profile.role);
      });
    }
    
    return !item.roles || item.roles.includes(profile.role);
  };

  const filteredNav = navItems.filter(hasPermission).map(item => {
    if (item.children) {
      return {
        ...item,
        children: item.children.filter((child: any) => {
          if (profile?.role === 'superadmin') return true;
          
          const isSystemRole = ['admin', 'staff'].includes(profile?.role || '');
          if (isSystemRole) {
            const allowedRoles = child.roles || item.roles;
            return !allowedRoles || allowedRoles.includes(profile?.role || '');
          }
          
          // For custom roles, check permission key
          if (child.permission) {
            return userPermissions.includes(child.permission);
          }
          
          // If no permission key, check roles
          const allowedRoles = child.roles || item.roles;
          if (allowedRoles) {
            return !allowedRoles.includes('superadmin');
          }
          
          return true;
        })
      };
    }
    return item;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
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
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
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
                            className={`block px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
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
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
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
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">{profile?.displayName || profile?.email || 'User'}</p>
              <p className="text-xs text-gray-500 capitalize">{roleName || profile?.role || 'Loading...'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Mobile Header */}
        <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between lg:hidden sticky top-0 z-30 no-print">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-indigo-600">Zentory</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </header>

        {/* Main Content */}
        <main className="flex-1 bg-gray-50 p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
