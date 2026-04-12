import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SuperAdmin from './pages/SuperAdmin';
import DomainManagement from './pages/superadmin/DomainManagement';
import Catalog from './pages/Catalog';
import SalesOrder from './pages/SalesOrder';
import SalesOrderReceive from './pages/SalesOrderReceive';
import Customers from './pages/Customers';
import Products from './pages/inventory/Products';
import Categories from './pages/inventory/Categories';
import Stock from './pages/inventory/Stock';
import Warehouses from './pages/inventory/Warehouses';
import Sales from './pages/Sales';
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
import NoAccess from './pages/NoAccess';

const ProtectedRoute = ({ children, allowedRoles, permission }: { children: React.ReactNode; allowedRoles?: string[]; permission?: string }) => {
  const { user, profile, permissions, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  // Superadmin can access everything
  if (profile?.role === 'superadmin') return <Layout>{children}</Layout>;
  
  const isSystemRole = ['admin', 'staff', 'customer', 'superadmin'].includes(profile?.role || '');

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
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
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

          <Route path="/sales/order" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="sales_order">
              <SalesOrder />
            </ProtectedRoute>
          } />

          <Route path="/sales/receive" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="sales_receive">
              <SalesOrderReceive />
            </ProtectedRoute>
          } />

          <Route path="/sales/customers" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} permission="sales_customers">
              <Customers />
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

          <Route path="/no-access" element={<NoAccess />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
