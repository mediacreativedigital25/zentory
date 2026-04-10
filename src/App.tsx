/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Customers } from './pages/Customers';
import { SalesOrder } from './pages/SalesOrder';
import { OrderReceiving } from './pages/OrderReceiving';
import { Categories } from './pages/Categories';
import { Catalog } from './pages/Catalog';
import { MyOrders } from './pages/MyOrders';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { SuperAdmin } from './pages/SuperAdmin';
import { BookingPage } from './pages/Booking';
import { Services } from './pages/Services';
import { Financials } from './pages/Financials';
import { LandingPage } from './pages/LandingPage';
import { Staff } from './pages/Staff';
import { Loader2 } from 'lucide-react';

import { ProtectedRoute } from './components/ProtectedRoute';
import { SuperAdminRoute } from './components/SuperAdminRoute';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/super-admin" element={<SuperAdminRoute><SuperAdmin /></SuperAdminRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute staffOnly><Dashboard /></ProtectedRoute>} />
          <Route path="/sales-order" element={<ProtectedRoute staffOnly><SalesOrder /></ProtectedRoute>} />
          <Route path="/order-receiving" element={<ProtectedRoute staffOnly><OrderReceiving /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute staffOnly><Customers /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute staffOnly><Products /></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute staffOnly><Categories /></ProtectedRoute>} />
          <Route path="/booking" element={<ProtectedRoute staffOnly><BookingPage /></ProtectedRoute>} />
          <Route path="/services" element={<ProtectedRoute staffOnly><Services /></ProtectedRoute>} />
          <Route path="/financials" element={<ProtectedRoute staffOnly><Financials /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute staffOnly><Staff /></ProtectedRoute>} />
          
          <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
          <Route path="/my-orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

