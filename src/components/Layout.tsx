import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import { LayoutDashboard, Package, ShoppingCart, Wallet, Store, LogOut, Settings, Users, ChevronDown, UserRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenus, setOpenMenus] = React.useState<string[]>([]);

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
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'staff', 'superadmin'] },
    { 
      label: 'Sales', 
      icon: ShoppingCart, 
      roles: ['admin', 'staff', 'superadmin'],
      children: [
        { label: 'Sales Order', path: '/sales/order' },
        { label: 'Sales Order Receive', path: '/sales/receive' },
        { label: 'Customers', path: '/sales/customers' },
      ]
    },
    { 
      label: 'Inventory', 
      icon: Package, 
      roles: ['admin', 'staff', 'superadmin'],
      children: [
        { label: 'Produk', path: '/inventory/products' },
        { label: 'Kategori', path: '/inventory/categories' },
        { label: 'Stock', path: '/inventory/stock' },
        { label: 'Gudang', path: '/inventory/warehouses' },
      ]
    },
    { label: 'Finance', icon: Wallet, path: '/finance', roles: ['admin', 'staff', 'superadmin'] },
    { label: 'Catalog Editor', icon: Store, path: '/catalog-editor', roles: ['admin', 'superadmin'] },
    { label: 'Superadmin', icon: Users, path: '/superadmin', roles: ['superadmin'] },
  ];

  const filteredNav = navItems.filter(item => profile && item.roles.includes(profile.role));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-indigo-600">Zentory</h1>
          {profile?.tenantId && (
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Tenant ID: {profile.tenantId}</p>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {filteredNav.map((item) => (
            <div key={item.label}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-900`}
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
              <p className="text-xs text-gray-500 capitalize">{profile?.role || 'Loading...'}</p>
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
