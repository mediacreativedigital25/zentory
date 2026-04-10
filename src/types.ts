export type UserRole = 
  | 'SuperAdmin' 
  | 'Administrator' 
  | 'Manager' 
  | 'Cashier' 
  | 'Staff' 
  | 'Customer';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: UserRole;
  tenantId?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
}

export type TenantStatus = 'Active' | 'Inactive' | 'Suspended';
export type TenantPlan = 'Free' | 'Pro' | 'Enterprise';
export type BusinessType = 'Retail' | 'Service' | 'Mixed';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  email: string;
  phone?: string;
  address?: string;
  status: TenantStatus;
  plan: TenantPlan;
  businessType: BusinessType;
  logoURL?: string;
  primaryColor?: string;
  password?: string; // Initial password for tenant setup
  createdAt: string;
  updatedAt?: string;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  price: number;
  duration: number; // in minutes
  image?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Booking {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  serviceId: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
  notes?: string;
  total: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  tenantId: string;
  type: 'Income' | 'Expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  referenceId?: string; // Order ID or Booking ID
  paymentMethod: 'Cash' | 'Transfer' | 'E-Wallet';
  createdAt: string;
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
  categoryName: string;
  image?: string;
  sku?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'Pending' | 'Processing' | 'Completed' | 'Cancelled';
  paymentStatus: 'Unpaid' | 'Paid' | 'Partial';
  paymentMethod?: string;
  type: 'POS' | 'Catalog';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface CartItem extends OrderItem {
  image?: string;
}
