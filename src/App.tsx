import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SuperAdmin from './pages/SuperAdmin';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import SuperAdminInvoices from './pages/superadmin/Invoices';
import SuperAdminTenants from './pages/superadmin/Tenants';
import SuperAdminApprovals from './pages/superadmin/Approvals';
import SuperAdminUsers from './pages/superadmin/Users';
import SuperAdminResetData from './pages/superadmin/ResetData';
import SuperAdminRoadmaps from './pages/superadmin/Roadmaps';
import SuperAdminGlobalSettings from './pages/superadmin/GlobalSettings';
import SuperAdminServiceTenant from './pages/superadmin/ServiceTenant';
import DomainManagement from './pages/superadmin/DomainManagement';
import Catalog from './pages/Catalog';
import SalesOrder from './pages/SalesOrder';
import SalesOrderReceive from './pages/SalesOrderReceive';
import Customers from './pages/Customers';
import Products from './pages/inventory/Products';
import Categories from './pages/inventory/Categories';
import Stock from './pages/inventory/Stock';
import Warehouses from './pages/inventory/Warehouses';
import InventoryReport from './pages/inventory/InventoryReport';
import StockOpname from './pages/inventory/StockOpname';
import Invoices from './pages/finance/Invoices';
import Sales from './pages/Sales';
import Coupons from './pages/Coupons';
import Finance from './pages/Finance';
import ClaimExpense from './pages/ClaimExpense';
import FinancialReport from './pages/FinancialReport';
import ExpenseSettings from './pages/ExpenseSettings';
import BankAccounts from './pages/finance/BankAccounts';
import Charity from './pages/Charity';
import DailySettlement from './pages/DailySettlement';
import CatalogEditor from './pages/CatalogEditor';
import Users from './pages/master/Users';
import Suppliers from './pages/purchase/Suppliers';
import PurchaseRequest from './pages/purchase/PurchaseRequest';
import PurchaseOrder from './pages/purchase/PurchaseOrder';
import GoodsReceipt from './pages/purchase/GoodsReceipt';
import PurchaseInvoice from './pages/purchase/PurchaseInvoice';
import Roles from './pages/master/Roles';
import TenantSettings from './pages/TenantSettings';
import Approvals from './pages/Approvals';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerAuth from './pages/CustomerAuth';
import Changelog from './pages/Changelog';
import Guide from './pages/Guide';
import Pricing from './pages/Pricing';
import LayananInvoice from './pages/LayananInvoice';
import LayananSaya from './pages/LayananSaya';
import Checkout from './pages/Checkout';
import NoAccess from './pages/NoAccess';

const ProtectedRoute = ({ children, allowedRoles, permission }: { children: React.ReactNode; allowedRoles?: string[]; permission?: string }) => {
  const { user, profile, permissions, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  // Superadmin can access everything
  if (profile?.role === 'superadmin') return <Layout>{children}</Layout>;
  
  const isSystemRole = ['admin', 'staff', 'customer', 'superadmin', 'kasir'].includes(profile?.role || '');

  // Redirect 'kasir' to sales order if they are on dashboard or other pages
  if (profile?.role === 'kasir' && location.pathname !== '/sales/order' && location.pathname !== '/no-access') {
    return <Navigate to="/sales/order" />;
  }

  // Check roles and permissions
  if (profile) {
    if (isSystemRole) {
      // For system roles, check allowedRoles
      if (allowedRoles && !allowedRoles.includes(profile.role)) {
        if (profile.role === 'customer') return <Navigate to={`/catalog/${profile.tenantId}/dashboard`} />;
        return <Navigate to="/no-access" />;
      }
    } else {
      // For custom roles
      if (permission) {
        // If permission is required, check it
        if (!permissions.includes(permission)) {
          return <Navigate to="/no-access" />;
        }
      } else if (allowedRoles) {
        // If allowedRoles is specified but no permission key is provided,
        // custom roles are denied by default for these specific routes
        // unless they are explicitly allowed (which they aren't in this system's logic)
        return <Navigate to="/no-access" />;
      }
    }
  }

  // Customers don't get the sidebar layout
  if (profile?.role === 'customer') {
    return <>{children}</>;
  }

  return <Layout>{children}</Layout>;
};

export default function App() {
  const [isCustomDomain, setIsCustomDomain] = React.useState(false);
  const [checkingDomain, setCheckingDomain] = React.useState(true);

  React.useEffect(() => {
    const checkDomain = async () => {
      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      const isAppDomain = hostname.includes('run.app') || hostname.includes('web.app') || hostname.includes('firebaseapp.com');

      if (!isLocalhost && !isAppDomain) {
        // This might be a custom domain
        try {
          const domainQuery = query(collection(db, 'custom_domains'), where('domain', '==', hostname), where('status', '==', 'active'));
          const domainSnap = await getDocs(domainQuery);
          if (!domainSnap.empty) {
            setIsCustomDomain(true);
          }
        } catch (err) {
          console.error('Error checking custom domain:', err);
        }
      }
      setCheckingDomain(false);
    };
    checkDomain();
  }, []);

  if (checkingDomain) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* If on custom domain, the root is the catalog */}
          {isCustomDomain && (
            <Route path="/" element={<Catalog />} />
          )}
          
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/catalog/:tenantSlug" element={<Catalog />} />
          <Route path="/catalog/:tenantSlug/auth" element={<CustomerAuth />} />
          <Route path="/catalog/:tenantSlug/dashboard" element={
            <ProtectedRoute allowedRoles={['customer', 'admin', 'staff']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="dashboard">
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/approvals" element={
            <ProtectedRoute allowedRoles={['admin']} permission="approvals">
              <Approvals />
            </ProtectedRoute>
          } />

          <Route path="/inventory/products" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_products">
              <Products />
            </ProtectedRoute>
          } />

          <Route path="/inventory/categories" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_categories">
              <Categories />
            </ProtectedRoute>
          } />

          <Route path="/inventory/stock" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_stock">
              <Stock />
            </ProtectedRoute>
          } />

          <Route path="/inventory/warehouses" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_warehouses">
              <Warehouses />
            </ProtectedRoute>
          } />

          <Route path="/inventory/report" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_report">
              <InventoryReport />
            </ProtectedRoute>
          } />

          <Route path="/inventory/stock-opname" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_stock_opname">
              <StockOpname />
            </ProtectedRoute>
          } />

          <Route path="/sales/order" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_order">
              <SalesOrder />
            </ProtectedRoute>
          } />

          <Route path="/sales/pos" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_order">
              <Sales />
            </ProtectedRoute>
          } />

          <Route path="/sales/receive" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_receive">
              <SalesOrderReceive />
            </ProtectedRoute>
          } />

          <Route path="/sales/customers" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_customers">
              <Customers />
            </ProtectedRoute>
          } />

          <Route path="/sales/coupons" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="sales_order">
              <Coupons />
            </ProtectedRoute>
          } />

          <Route path="/finance" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="finance_report">
              <FinancialReport />
            </ProtectedRoute>
          } />

          <Route path="/finance/claim" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="finance_claim">
              <ClaimExpense />
            </ProtectedRoute>
          } />

          <Route path="/finance/invoices" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="finance_invoices">
              <Invoices />
            </ProtectedRoute>
          } />

          <Route path="/finance/report" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="finance_report">
              <FinancialReport />
            </ProtectedRoute>
          } />

          <Route path="/finance/settings" element={
            <ProtectedRoute allowedRoles={['admin']} permission="finance_settings">
              <ExpenseSettings />
            </ProtectedRoute>
          } />

          <Route path="/finance/bank-accounts" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="finance_bank_accounts">
              <BankAccounts />
            </ProtectedRoute>
          } />

          <Route path="/finance/charity" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="finance_charity">
              <Charity />
            </ProtectedRoute>
          } />

          <Route path="/daily-settlement" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="daily_settlement">
              <DailySettlement />
            </ProtectedRoute>
          } />

          <Route path="/catalog-editor" element={
            <ProtectedRoute allowedRoles={['admin']} permission="catalog_editor">
              <CatalogEditor />
            </ProtectedRoute>
          } />

          <Route path="/master/users" element={
            <ProtectedRoute allowedRoles={['admin', 'superadmin']} permission="master_users">
              <Users />
            </ProtectedRoute>
          } />

          <Route path="/master/roles" element={
            <ProtectedRoute allowedRoles={['admin', 'superadmin']} permission="master_roles">
              <Roles />
            </ProtectedRoute>
          } />

          <Route path="/settings/business" element={
            <ProtectedRoute allowedRoles={['admin']} permission="tenant_settings">
              <TenantSettings />
            </ProtectedRoute>
          } />

          {/* Purchase */}
          <Route path="/purchase/suppliers" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="purchase_suppliers">
              <Suppliers />
            </ProtectedRoute>
          } />
          <Route path="/purchase/requests" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="purchase_requests">
              <PurchaseRequest />
            </ProtectedRoute>
          } />
          <Route path="/purchase/orders" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="purchase_orders">
              <PurchaseOrder />
            </ProtectedRoute>
          } />
          <Route path="/purchase/receipts" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="purchase_goods_receipts">
              <GoodsReceipt />
            </ProtectedRoute>
          } />
          <Route path="/purchase/invoices" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="purchase_invoices">
              <PurchaseInvoice />
            </ProtectedRoute>
          } />
          
          <Route path="/superadmin" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdmin />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/dashboard" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/invoices" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminInvoices />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/services" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminServiceTenant />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/tenants" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminTenants />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/approvals" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminApprovals />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/users" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminUsers />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/reset" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminResetData />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/roadmap" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminRoadmaps />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/settings" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminGlobalSettings />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/domains" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <DomainManagement />
            </ProtectedRoute>
          } />

          <Route path="/changelog" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']}>
              <Changelog />
            </ProtectedRoute>
          } />

          <Route path="/guide" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']}>
              <Guide />
            </ProtectedRoute>
          } />

          <Route path="/pricing" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']}>
              <Pricing />
            </ProtectedRoute>
          } />

          <Route path="/layanan/invoice" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <LayananInvoice />
            </ProtectedRoute>
          } />

          <Route path="/layanan/saya" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <LayananSaya />
            </ProtectedRoute>
          } />

          <Route path="/checkout" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']}>
              <Checkout />
            </ProtectedRoute>
          } />

          <Route path="/no-access" element={<NoAccess />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
