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
import CatalogEditor from './pages/CatalogEditor';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  // Superadmin can access everything
  if (profile?.role === 'superadmin') return <Layout>{children}</Layout>;
  
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" />;
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
          
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <Dashboard />
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
              <Finance />
            </ProtectedRoute>
          } />

          <Route path="/catalog-editor" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CatalogEditor />
            </ProtectedRoute>
          } />
          
          <Route path="/superadmin" element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdmin />
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
