import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SuperAdmin from './pages/SuperAdmin';
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
import Approvals from './pages/Approvals';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerAuth from './pages/CustomerAuth';
import Changelog from './pages/Changelog';
import Guide from './pages/Guide';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  // Superadmin can access everything
  if (profile?.role === 'superadmin') return <Layout>{children}</Layout>;
  
  // Check roles
  if (allowedRoles && profile) {
    const isSystemRole = ['admin', 'staff', 'customer'].includes(profile.role);
    
    if (isSystemRole) {
      if (!allowedRoles.includes(profile.role)) {
        return <Navigate to="/dashboard" />;
      }
    } else {
      // Custom roles are allowed to pass through to the Layout, 
      // where granular permission filtering happens.
      // We only redirect if they are explicitly NOT allowed and it's a system role check.
      // However, for custom roles, we generally want them to reach the page so Layout can handle it.
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
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/approvals" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Approvals />
            </ProtectedRoute>
          } />

          <Route path="/inventory/products" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <Products />
            </ProtectedRoute>
          } />

          <Route path="/inventory/categories" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <Categories />
            </ProtectedRoute>
          } />

          <Route path="/inventory/stock" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <Stock />
            </ProtectedRoute>
          } />

          <Route path="/inventory/warehouses" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <Warehouses />
            </ProtectedRoute>
          } />

          <Route path="/sales/order" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <SalesOrder />
            </ProtectedRoute>
          } />

          <Route path="/sales/receive" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <SalesOrderReceive />
            </ProtectedRoute>
          } />

          <Route path="/sales/customers" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <Customers />
            </ProtectedRoute>
          } />

          <Route path="/finance" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <FinancialReport />
            </ProtectedRoute>
          } />

          <Route path="/finance/claim" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <ClaimExpense />
            </ProtectedRoute>
          } />

          <Route path="/finance/report" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <FinancialReport />
            </ProtectedRoute>
          } />

          <Route path="/finance/settings" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ExpenseSettings />
            </ProtectedRoute>
          } />

          <Route path="/finance/bank-accounts" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']}>
              <BankAccounts />
            </ProtectedRoute>
          } />

          <Route path="/finance/charity" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <Charity />
            </ProtectedRoute>
          } />

          <Route path="/daily-settlement" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <DailySettlement />
            </ProtectedRoute>
          } />

          <Route path="/catalog-editor" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CatalogEditor />
            </ProtectedRoute>
          } />

          <Route path="/master/users" element={
            <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
              <Users />
            </ProtectedRoute>
          } />

          <Route path="/master/roles" element={
            <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
              <Roles />
            </ProtectedRoute>
          } />

          {/* Purchase */}
          <Route path="/purchase/suppliers" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']}>
              <Suppliers />
            </ProtectedRoute>
          } />
          <Route path="/purchase/requests" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']}>
              <PurchaseRequest />
            </ProtectedRoute>
          } />
          <Route path="/purchase/orders" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']}>
              <PurchaseOrder />
            </ProtectedRoute>
          } />
          <Route path="/purchase/receipts" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']}>
              <GoodsReceipt />
            </ProtectedRoute>
          } />
          <Route path="/purchase/invoices" element={
            <ProtectedRoute allowedRoles={['admin', 'staff', 'superadmin']}>
              <PurchaseInvoice />
            </ProtectedRoute>
          } />
          
          <Route path="/superadmin" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdmin />
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

          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
