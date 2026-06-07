import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { CartProvider } from './context/CartContext';
import Layout from './components/Layout';
import { PLANS } from './constants/plans';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SuperAdmin from './pages/SuperAdmin';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import DataCheck from './pages/superadmin/DataCheck';
import SuperAdminInvoices from './pages/superadmin/Invoices';
import SuperAdminTenants from './pages/superadmin/Tenants';
import SuperAdminCoupons from './pages/superadmin/TenantCoupons';
import SuperAdminNotifications from './pages/superadmin/Notifications';
import SuperAdminNotificationTemplates from './pages/superadmin/NotificationTemplates';
import SuperAdminApprovals from './pages/superadmin/Approvals';
import SuperAdminUsers from './pages/superadmin/Users';
import SuperAdminResetData from './pages/superadmin/ResetData';
import SuperAdminRoadmaps from './pages/superadmin/Roadmaps';
import SuperAdminGlobalSettings from './pages/superadmin/GlobalSettings';
import SuperAdminBankLogos from './pages/superadmin/BankLogos';
import SuperAdminBrandSettings from './pages/superadmin/BrandSettings';
import SuperAdminServiceTenant from './pages/superadmin/ServiceTenant';
import DomainManagement from './pages/superadmin/DomainManagement';
import Catalog from './pages/Catalog';
import SalesOrder from './pages/SalesOrder';
import SalesOrderV1 from './pages/SalesOrderV1';
import SalesOrderReceive from './pages/SalesOrderReceive';
import Customers from './pages/Customers';
import BookingList from './pages/sales/BookingList';
import SalesBooking from './pages/sales/SalesBooking';
import ProductReviews from './pages/sales/ProductReviews';
import Products from './pages/inventory/Products';
import Categories from './pages/inventory/Categories';
import ServiceList from './pages/services/ServiceList';
import ServiceCategories from './pages/services/ServiceCategories';
import BusinessLines from './pages/inventory/BusinessLines';
import Stock from './pages/inventory/Stock';
import Warehouses from './pages/inventory/Warehouses';
import InventoryReport from './pages/inventory/InventoryReport';
import StockOpname from './pages/inventory/StockOpname';
import Invoices from './pages/finance/Invoices';
import ReceivePayment from './pages/finance/ReceivePayment';
import Sales from './pages/Sales';
import Coupons from './pages/Coupons';
import SettingTarget from './pages/analysis/SettingTarget';
import Achievement from './pages/analysis/Achievement';
import CostRatio from './pages/analysis/CostRatio';
import Finance from './pages/Finance';
import ClaimExpense from './pages/ClaimExpense';
import FinancialReport from './pages/FinancialReport';
import InvoiceCollection from './pages/finance/InvoiceCollection';
import CustomerSavings from './pages/finance/CustomerSavings';
import ExpenseSettings from './pages/ExpenseSettings';
import BankAccounts from './pages/finance/BankAccounts';
import BankTransfers from './pages/finance/BankTransfers';
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
import TenantPaymentSettings from './pages/TenantPaymentSettings';
import TenantStoreAddress from './pages/TenantStoreAddress';
import Approvals from './pages/Approvals';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerAuth from './pages/CustomerAuth';
import Changelog from './pages/Changelog';
import Guide from './pages/Guide';
import Pricing from './pages/Pricing';
import SubscriptionExpired from './pages/SubscriptionExpired';
import LayananInvoice from './pages/LayananInvoice';
import LayananSaya from './pages/LayananSaya';
import Checkout from './pages/Checkout';
import NoAccess from './pages/NoAccess';
import PrintView from './pages/PrintView';
import Profile from './pages/Profile';

import MarketplaceV1 from './pages/marketplace/MarketplaceV1';
import ProductDetailV1 from './pages/marketplace/ProductDetailV1';
import MarketplaceCheckout from './pages/marketplace/MarketplaceCheckout';
import BookingV1 from './pages/marketplace/BookingV1';
import CustomerCategories from './pages/sales/CustomerCategories';

const ProtectedRoute = ({ children, allowedRoles, permission, menuLabel }: { children: React.ReactNode; allowedRoles?: string[]; permission?: string; menuLabel?: string }) => {
  const { user, profile, tenant, domainTenantId, permissions, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) {
    const match = location.pathname.match(/\/(marketplace|catalog|booking)\/([^/]+)/);
    if (match) {
      return <Navigate to={`/${match[1]}/${match[2]}/auth`} />;
    }
    return <Navigate to="/login" />;
  }
  
  // Domain isolation check
  if (domainTenantId && profile?.role !== 'superadmin' && profile?.tenantId !== domainTenantId) {
    return <Navigate to="/no-access" />;
  }

  // Superadmin can access everything
  if (profile?.role === 'superadmin') return <Layout>{children}</Layout>;

  // Check if tenant has disabled this menu
  if (tenant?.menuSettings && menuLabel && tenant.menuSettings[menuLabel] === false) {
    return <Navigate to="/no-access" />;
  }

  // Subscription check
  if (tenant && profile?.role !== 'superadmin') {
    const isExpired = tenant.subscriptionStatus === 'expired' || (
      tenant.subscriptionEndDate && 
      new Date(tenant.subscriptionEndDate.seconds * 1000) < new Date()
    );

    const allowedExpiredPaths = ['/subscription-expired', '/pricing', '/checkout', '/layanan/invoice', '/layanan/saya', '/no-access'];
    if (isExpired && !allowedExpiredPaths.includes(location.pathname)) {
      return <Navigate to="/subscription-expired" />;
    }
  }
  
  const isSystemRole = ['admin', 'staff', 'customer', 'superadmin', 'kasir'].includes(profile?.role || '');

  // Redirect 'kasir' to sales order if they are on dashboard or other pages
  const allowedKasirPaths = ['/sales/order', '/sales/pos', '/sales/receive', '/sales/customers', '/no-access'];
  if (profile?.role === 'kasir' && !allowedKasirPaths.includes(location.pathname)) {
    return <Navigate to="/sales/pos" />; // Default to POS for kasir
  }

  // Check roles and permissions
  if (profile) {
    // 1. Subscription-based Feature Gating (Block access if plan doesn't support the feature)
    if (permission && profile.role !== 'superadmin') {
      const tenantFeatures = tenant?.features || PLANS[tenant?.plan || tenant?.subscription || 'free']?.features || [];
      if (!tenantFeatures.includes(permission)) {
        return <Navigate to="/no-access" />;
      }
    }

    if (isSystemRole) {
      // 2. Role-based Gating
      if (allowedRoles && !allowedRoles.includes(profile.role)) {
        if (profile.role === 'customer') return <Navigate to={`/marketplace/${tenant?.slug || profile.tenantId}/dashboard`} />;
        return <Navigate to="/no-access" />;
      }
    } else {
      // 3. Custom Role (Staff) Permissions Gating
      if (permission) {
        if (!permissions.includes(permission)) {
          return <Navigate to="/no-access" />;
        }
      } else if (allowedRoles) {
        return <Navigate to="/no-access" />;
      }
    }
  }

  return <Layout>{children}</Layout>;
};

import { useBrand } from './hooks/useBrand';

export default function App() {
  const [isCustomDomain, setIsCustomDomain] = React.useState(false);
  const [domainTenantId, setDomainTenantId] = React.useState<string | null>(null);
  const [checkingDomain, setCheckingDomain] = React.useState(true);
  useBrand(); // Initialize brand settings globally

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
            const domainData = domainSnap.docs[0].data();
            setIsCustomDomain(true);
            setDomainTenantId(domainData.tenantId);
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
    <AuthProvider domainTenantId={domainTenantId}>
      <CartProvider>
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
          <Route path="/marketplace/:tenantSlug/auth" element={<CustomerAuth />} />
          <Route path="/marketplace/:tenantSlug" element={<MarketplaceV1 />} />
          <Route path="/marketplace/:tenantSlug/product/:productId" element={<ProductDetailV1 />} />
          <Route path="/marketplace/:tenantSlug/checkout" element={<MarketplaceCheckout />} />
          <Route path="/marketplace/:tenantSlug/dashboard" element={
            <ProtectedRoute allowedRoles={['customer', 'admin', 'staff']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/marketplace/:tenantSlug/history" element={
            <ProtectedRoute allowedRoles={['customer', 'admin', 'staff']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/marketplace/:tenantSlug/status" element={
            <ProtectedRoute allowedRoles={['customer', 'admin', 'staff']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/marketplace/:tenantSlug/downloads" element={
            <ProtectedRoute allowedRoles={['customer', 'admin', 'staff']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/marketplace/:tenantSlug/address" element={
            <ProtectedRoute allowedRoles={['customer', 'admin', 'staff']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />

          <Route path="/booking/:tenantSlug" element={<BookingV1 />} />
          <Route path="/booking/:tenantSlug/auth" element={<CustomerAuth />} />
          <Route path="/booking/:tenantSlug/checkout" element={<MarketplaceCheckout />} />
          <Route path="/booking/:tenantSlug/dashboard" element={
            <ProtectedRoute allowedRoles={['customer', 'admin', 'staff']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/booking/:tenantSlug/history" element={
            <ProtectedRoute allowedRoles={['customer', 'admin', 'staff']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />

          <Route path="/catalog/:tenantSlug/dashboard" element={
            <ProtectedRoute allowedRoles={['customer', 'admin', 'staff']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="dashboard" menuLabel="Dashboard">
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/approvals" element={
            <ProtectedRoute allowedRoles={['admin']} permission="approvals" menuLabel="Approval">
              <Approvals />
            </ProtectedRoute>
          } />

          <Route path="/services/list" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_products" menuLabel="Service">
              <ServiceList />
            </ProtectedRoute>
          } />

          <Route path="/services/categories" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_categories" menuLabel="Service">
              <ServiceCategories />
            </ProtectedRoute>
          } />

          <Route path="/inventory/products" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_products" menuLabel="Inventory">
              <Products />
            </ProtectedRoute>
          } />

          <Route path="/inventory/categories" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_categories" menuLabel="Inventory">
              <Categories />
            </ProtectedRoute>
          } />

          <Route path="/inventory/business-lines" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_categories" menuLabel="Inventory">
              <BusinessLines />
            </ProtectedRoute>
          } />

          <Route path="/inventory/stock" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_stock" menuLabel="Inventory">
              <Stock />
            </ProtectedRoute>
          } />

          <Route path="/inventory/warehouses" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_warehouses" menuLabel="Inventory">
              <Warehouses />
            </ProtectedRoute>
          } />

          <Route path="/inventory/report" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_report" menuLabel="Inventory">
              <InventoryReport />
            </ProtectedRoute>
          } />

          <Route path="/inventory/stock-opname" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="inventory_stock_opname" menuLabel="Inventory">
              <StockOpname />
            </ProtectedRoute>
          } />

          <Route path="/sales/order" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_order" menuLabel="Sales">
              <SalesOrder />
            </ProtectedRoute>
          } />

          <Route path="/sales/order-v1" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_order" menuLabel="Sales">
              <SalesOrderV1 />
            </ProtectedRoute>
          } />

          <Route path="/sales/pos" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_order" menuLabel="Sales">
              <Sales />
            </ProtectedRoute>
          } />

          <Route path="/sales/receive" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_receive" menuLabel="Sales">
              <SalesOrderReceive />
            </ProtectedRoute>
          } />

          <Route path="/sales/bookings" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_customers" menuLabel="Sales">
              <BookingList />
            </ProtectedRoute>
          } />

          <Route path="/sales/sales-booking" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_order" menuLabel="Sales">
              <SalesBooking />
            </ProtectedRoute>
          } />

          <Route path="/sales/customers" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_customers" menuLabel="Sales">
              <Customers />
            </ProtectedRoute>
          } />

          <Route path="/sales/customer-categories" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_customers" menuLabel="Sales">
              <CustomerCategories />
            </ProtectedRoute>
          } />

          <Route path="/sales/reviews" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'kasir']} permission="sales_order" menuLabel="Sales">
              <ProductReviews />
            </ProtectedRoute>
          } />

          <Route path="/sales/analysis/target" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="sales_order" menuLabel="Sales Analisis">
              <SettingTarget />
            </ProtectedRoute>
          } />

          <Route path="/sales/analysis/achievement" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="sales_order" menuLabel="Sales Analisis">
              <Achievement />
            </ProtectedRoute>
          } />

          <Route path="/sales/analysis/cost-ratio" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="sales_order" menuLabel="Sales Analisis">
              <CostRatio />
            </ProtectedRoute>
          } />

          <Route path="/sales/coupons" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="sales_order" menuLabel="Sales">
              <Coupons />
            </ProtectedRoute>
          } />

          <Route path="/finance" element={
            <ProtectedRoute allowedRoles={['admin']} permission="finance_report" menuLabel="Finance">
              <FinancialReport />
            </ProtectedRoute>
          } />

          <Route path="/finance/claim" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="finance_claim" menuLabel="Finance">
              <ClaimExpense />
            </ProtectedRoute>
          } />

          <Route path="/finance/invoices" element={
            <ProtectedRoute allowedRoles={['admin']} permission="finance_invoices" menuLabel="Finance">
              <Invoices />
            </ProtectedRoute>
          } />

          <Route path="/finance/receive-payment" element={
            <ProtectedRoute allowedRoles={['admin']} permission="finance_invoices" menuLabel="Finance">
              <ReceivePayment />
            </ProtectedRoute>
          } />

          <Route path="/finance/collections" element={
            <ProtectedRoute allowedRoles={['admin']} permission="finance_invoices" menuLabel="Finance">
              <InvoiceCollection />
            </ProtectedRoute>
          } />

          <Route path="/finance/customer-savings" element={
            <ProtectedRoute allowedRoles={['admin']} permission="finance_settings" menuLabel="Finance">
              <CustomerSavings />
            </ProtectedRoute>
          } />

          <Route path="/finance/report" element={
            <ProtectedRoute allowedRoles={['admin']} permission="finance_report" menuLabel="Finance">
              <FinancialReport />
            </ProtectedRoute>
          } />

          <Route path="/finance/settings" element={
            <ProtectedRoute allowedRoles={['admin']} permission="finance_settings" menuLabel="Finance">
              <ExpenseSettings />
            </ProtectedRoute>
          } />

          <Route path="/finance/bank-accounts" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="finance_bank_accounts" menuLabel="Finance">
              <BankAccounts />
            </ProtectedRoute>
          } />

          <Route path="/finance/bank-transfers" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="finance_bank_accounts" menuLabel="Finance">
              <BankTransfers />
            </ProtectedRoute>
          } />

          <Route path="/finance/charity" element={
            <ProtectedRoute allowedRoles={['admin']} permission="finance_charity" menuLabel="Finance">
              <Charity />
            </ProtectedRoute>
          } />

          <Route path="/daily-settlement" element={
            <ProtectedRoute allowedRoles={['admin']} permission="daily_settlement" menuLabel="Daily Settlement">
              <DailySettlement />
            </ProtectedRoute>
          } />

          <Route path="/catalog-editor" element={
            <ProtectedRoute allowedRoles={['admin']} permission="catalog_editor" menuLabel="Catalog Editor">
              <CatalogEditor />
            </ProtectedRoute>
          } />

          <Route path="/master/users" element={
            <ProtectedRoute allowedRoles={['admin', 'superadmin']} permission="master_users" menuLabel="Master">
              <Users />
            </ProtectedRoute>
          } />

          <Route path="/master/roles" element={
            <ProtectedRoute allowedRoles={['admin', 'superadmin']} permission="master_roles" menuLabel="Master">
              <Roles />
            </ProtectedRoute>
          } />

          <Route path="/settings/business" element={
            <ProtectedRoute allowedRoles={['admin']} permission="tenant_settings" menuLabel="Profil Bisnis">
              <TenantSettings />
            </ProtectedRoute>
          } />

          <Route path="/settings/payment-methods" element={
            <ProtectedRoute allowedRoles={['admin']} permission="tenant_settings" menuLabel="Payment Metode">
              <TenantPaymentSettings />
            </ProtectedRoute>
          } />

          <Route path="/settings/store-address" element={
            <ProtectedRoute allowedRoles={['admin']} permission="tenant_settings" menuLabel="Alamat Toko">
              <TenantStoreAddress />
            </ProtectedRoute>
          } />

          {/* Purchase */}
          <Route path="/purchase/suppliers" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="purchase_suppliers" menuLabel="Purchase">
              <Suppliers />
            </ProtectedRoute>
          } />
          <Route path="/purchase/requests" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="purchase_requests" menuLabel="Purchase">
              <PurchaseRequest />
            </ProtectedRoute>
          } />
          <Route path="/purchase/orders" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="purchase_orders" menuLabel="Purchase">
              <PurchaseOrder />
            </ProtectedRoute>
          } />
          <Route path="/purchase/receipts" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="purchase_goods_receipts" menuLabel="Purchase">
              <GoodsReceipt />
            </ProtectedRoute>
          } />
          <Route path="/purchase/invoices" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} permission="purchase_invoices" menuLabel="Purchase">
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

          <Route path="/superadmin/data-check" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <DataCheck />
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

          <Route path="/superadmin/coupons" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminCoupons />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/notifications" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminNotifications />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/notification-templates" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminNotificationTemplates />
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

          <Route path="/superadmin/bank-logos" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminBankLogos />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/brand" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminBrandSettings />
            </ProtectedRoute>
          } />

          <Route path="/superadmin/domains" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <DomainManagement />
            </ProtectedRoute>
          } />

          <Route path="/changelog" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} menuLabel="Changelog">
              <Changelog />
            </ProtectedRoute>
          } />

          <Route path="/guide" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']} menuLabel="Panduan">
              <Guide />
            </ProtectedRoute>
          } />

          <Route path="/pricing" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']}>
              <Pricing />
            </ProtectedRoute>
          } />

          <Route path="/subscription-expired" element={<SubscriptionExpired />} />

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

          <Route path="/print/:type/:id" element={<PrintView />} />

          <Route path="/no-access" element={<NoAccess />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
