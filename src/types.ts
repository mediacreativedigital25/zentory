export type UserRole = 'superadmin' | 'admin' | 'staff';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  tenantId: string | null;
  createdAt: any;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  subscription: 'free' | 'pro' | 'enterprise';
  createdAt: any;
  settings?: {
    logoUrl?: string;
    themeColor?: string;
    description?: string;
  };
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  barcode?: string;
  hpp: number; // Cost of Goods Sold
  price: number; // Selling Price
  stock: number;
  category: string;
  warehouseId?: string;
  imageUrl?: string;
  description?: string;
  type: 'manual' | 'service';
  createdAt: any;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  createdAt: any;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  name: string;
  location?: string;
  description?: string;
  createdAt: any;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: any;
}

export interface Order {
  id: string;
  orderNumber: string; // M..., IN..., 0J...
  tenantId: string;
  customerId?: string;
  customerName?: string;
  type: 'manual' | 'catalog' | 'service';
  items: { productId: string; name: string; quantity: number; price: number }[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  date: any;
  userId: string;
}

export interface Transaction {
  id: string;
  tenantId: string;
  type: 'sale' | 'expense';
  amount: number;
  items: { productId: string; name: string; quantity: number; price: number }[];
  date: any;
  status: 'completed' | 'pending' | 'cancelled';
  userId: string;
}

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  orderId: string;
  orderNumber: string;
  requestedBy: string;
  requestedAt: any;
  targetStatus: 'pending' | 'processing' | 'completed';
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedBy?: string;
  resolvedAt?: any;
}
