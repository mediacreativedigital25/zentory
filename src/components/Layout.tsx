import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  UserCircle, 
  Settings, 
  LogOut, 
  ChevronDown, 
  ChevronRight,
  Menu,
  X,
  Store,
  ShieldCheck,
  Calendar,
  Wallet,
  Globe
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface NavItemProps {
  to?: string;
  icon: React.ReactNode;
  label: string;
  children?: { to: string; label: string }[];
  isOpen?: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, children, isOpen, onClick }) => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const isActive = to ? location.pathname === to : children?.some(child => location.pathname === child.to);

  if (children) {
    return (
      <div className="mb-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
            isActive ? "bg-indigo-50 text-indigo-600" : "text-gray-600 hover:bg-gray-50"
          )}
        >
          <div className="flex items-center gap-3">
            {icon}
            <span>{label}</span>
          </div>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden ml-9 mt-1 space-y-1"
            >
              {children.map((child) => (
                <Link
                  key={child.to}
                  to={child.to}
                  className={cn(
                    "block px-4 py-2 text-sm rounded-lg transition-colors",
                    location.pathname === child.to ? "text-indigo-600 font-semibold" : "text-gray-500 hover:text-indigo-600 hover:bg-gray-50"
                  )}
                >
                  {child.label}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Link
      to={to!}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 mb-1 text-sm font-medium rounded-lg transition-colors",
        isActive ? "bg-indigo-50 text-indigo-600" : "text-gray-600 hover:bg-gray-50"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, isStaff, isCustomer, isSuperAdmin, currentTenant, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const isRetail = currentTenant?.businessType === 'Retail' || currentTenant?.businessType === 'Mixed';
  const isService = currentTenant?.businessType === 'Service' || currentTenant?.businessType === 'Mixed';

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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3">
            {currentTenant?.logoURL ? (
              <img src={currentTenant.logoURL} alt={currentTenant.name} className="w-10 h-10 rounded-xl object-cover shadow-lg" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Store size={24} />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold text-gray-900 truncate">{currentTenant?.name || 'Zentory'}</span>
              {currentTenant && <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{currentTenant.subdomain}.my.id</span>}
            </div>
          </div>

          <nav className="flex-1 px-4 overflow-y-auto">
            {isSuperAdmin && (
              <NavItem to="/super-admin" icon={<ShieldCheck size={20} />} label="Super Admin" />
            )}

            {isStaff && (
              <>
                <NavItem to="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" />
                
                {isRetail && (
                  <NavItem 
                    icon={<ShoppingCart size={20} />} 
                    label="Sales & POS" 
                    children={[
                      { to: '/sales-order', label: 'POS / Input Sales' },
                      { to: '/order-receiving', label: 'Order History' },
                      { to: '/customers', label: 'Customers' }
                    ]}
                  />
                )}

                {isService && (
                  <NavItem 
                    icon={<Calendar size={20} />} 
                    label="Booking" 
                    children={[
                      { to: '/booking', label: 'Appointments' },
                      { to: '/services', label: 'Services' }
                    ]}
                  />
                )}

                <NavItem 
                  icon={<Package size={20} />} 
                  label="Inventory" 
                  children={[
                    { to: '/products', label: 'Products' },
                    { to: '/categories', label: 'Categories' }
                  ]}
                />

                <NavItem to="/financials" icon={<Wallet size={20} />} label="Financials" />
                <NavItem to="/staff" icon={<Users size={20} />} label="Team & Staff" />
              </>
            )}

            {isCustomer && (
              <>
                <NavItem to="/catalog" icon={<Store size={20} />} label="Katalog" />
                <NavItem to="/my-orders" icon={<ShoppingCart size={20} />} label="Pesanan Saya" />
              </>
            )}

            <NavItem 
              icon={<UserCircle size={20} />} 
              label="Profil" 
              children={[
                { to: '/profile', label: 'Profil' },
                { to: '/settings', label: 'Setting Password' }
              ]}
            />
          </nav>

          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold flex-shrink-0">
                {profile?.name?.[0].toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{profile?.name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{profile?.role || 'Role'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden"
          >
            <Menu size={24} />
          </button>
          <div className="flex-1" />
          
          {isStaff && currentTenant && (
            <a 
              href={`/catalog?tenant=${currentTenant.subdomain}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Globe size={18} />
              <span className="hidden sm:inline">Lihat Toko</span>
            </a>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};
