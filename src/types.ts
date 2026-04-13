export type UserRole = 'superadmin' | 'admin' | 'staff' | 'customer' | 'kasir';

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  permissions: string[]; // List of feature keys
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string; // Changed from UserRole to string to support custom roles
  tenantId: string | null;
  address?: string;
  createdAt: any;
  forceLogoutAt?: any;
  lastLoginAt?: any;
  lastLogoutAt?: any;
  isOnline?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  code?: string;
  ownerId: string;
  subscription: 'free' | 'pro' | 'enterprise';
  createdAt: any;
  settings?: {
    logoUrl?: string;
    themeColor?: string;
    description?: string;
  };
  customDomains?: string[];
  
  // Cooperation & Business Details
  ownerName?: string;
  address?: string;
  phone?: string;
  email?: string;
  businessType?: string;
  taxId?: string; // NPWP
  cooperationStatus?: 'active' | 'pending' | 'ended' | 'trial';
  cooperationStartDate?: any;
  notes?: string;
}

export interface CustomDomain {
  id: string;
  domain: string;
  tenantId: string;
  tenantName?: string;
  status: 'active' | 'pending';
  sslStatus: 'valid' | 'invalid' | 'pending';
  isPrimary: boolean;
  createdAt: any;
  verifiedAt?: any;
}

export interface StockLog {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'SALE' | 'PURCHASE' | 'CANCEL';
  quantity: number;
  previousStock: number;
  currentStock: number;
  referenceId?: string; // Order ID, PO ID, etc.
  referenceNumber?: string; // Order Number, PO Number, etc.
  note?: string;
  userId: string;
  userName: string;
  createdAt: any;
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
  type: 'umum' | 'langganan';
  allowTempo: boolean;
  tempoLimitDays?: number;
  createdAt: any;
}

export interface Order {
  id: string;
  orderNumber: string; // M..., IN..., 0J...
  tenantId: string;
  customerId?: string;
  customerName?: string;
  type: 'manual' | 'catalog' | 'service';
  items: { productId: string; name: string; quantity: number; price: number; hpp: number }[];
  totalAmount: number;
  paidAmount?: number;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
  paymentType?: 'cash' | 'credit';
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  date: any;
  dueDate?: any;
  userId: string;
  paymentMethod?: string; // ID of BankAccount
}

export interface Transaction {
  id: string;
  tenantId: string;
  type: 'sale' | 'expense';
  amount: number;
  items?: { productId: string; name: string; quantity: number; price: number; hpp: number }[];
  date: any;
  dueDate?: any;
  status: 'completed' | 'pending' | 'cancelled';
  userId: string;
  orderNumber?: string;
  description?: string;
  category?: string;
  activity?: string;
  receiptUrl?: string;
  totalTransactions?: number;
  transactionNumber?: string;
  bankAccountId?: string;
  expenseItems?: { 
    category: string; 
    activity: string; 
    amount: number; 
    description: string; 
    receiptUrl?: string;
  }[];
}

export interface ExpenseRule {
  id: string;
  tenantId: string;
  category: string;
  defaultActivity: string;
  createdAt: any;
}

export interface DailyClosing {
  id: string;
  tenantId: string;
  date: any; // Date of closing
  dailyNumber?: string; // DS202604000001
  totalSales: number;
  totalCost: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  transactionCount: number;
  charityAmount: number;
  isCharityEnabled?: boolean;
  status: 'UNTUNG' | 'RUGI' | 'IMPAS';
  closedBy: string;
  createdAt: any;
}

export interface CharityRecord {
  id: string;
  tenantId: string;
  dailyClosingId: string;
  dailyNumber: string;
  date: any;
  totalProfit: number; // Gross Profit from daily closing
  charityAmount: number; // 2.5% of totalProfit
  netProfitAfterCharity: number;
  transactionCount: number;
  status: 'draft' | 'saved' | 'locked';
  createdAt: any;
  updatedAt?: any;
}

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  tenantName?: string;
  type: 'order_status' | 'daily_settlement_open' | 'charity_revision';
  orderId?: string;
  orderNumber?: string;
  closingId?: string;
  charityId?: string;
  closingDate?: any;
  requestedBy: string;
  requestedAt: any;
  targetStatus?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedBy?: string;
  resolvedAt?: any;
}

export interface BankAccount {
  id: string;
  tenantId: string;
  name: string;
  accountNumber?: string;
  accountHolder?: string;
  type: 'BANK' | 'QRIS' | 'CASH' | 'E-WALLET';
  isActive: boolean;
  createdAt: any;
}

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: any;
}

export interface PurchaseRequest {
  id: string;
  prNumber: string;
  tenantId: string;
  items: { productId: string; name: string; quantity: number }[];
  requestedBy: string;
  requestedByName?: string;
  date: any;
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  reason?: string;
  approvedBy?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedAt?: any;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  tenantId: string;
  supplierId: string;
  supplierName?: string;
  prId?: string;
  items: { productId: string; name: string; quantity: number; price: number }[];
  totalAmount: number;
  date: any;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
}

export interface GoodsReceipt {
  id: string;
  grNumber: string;
  tenantId: string;
  poId: string;
  poNumber?: string;
  supplierId: string;
  items: { 
    productId: string; 
    name: string; 
    quantityOrdered: number; 
    quantityReceived: number; 
    isChecked: boolean 
  }[];
  receivedBy: string;
  date: any;
  status: 'draft' | 'completed';
}

export interface PurchaseInvoice {
  id: string;
  piNumber: string;
  tenantId: string;
  poId: string;
  poNumber?: string;
  supplierId: string;
  amount: number;
  dueDate: any;
  date: any;
  status: 'unpaid' | 'partial' | 'paid';
}
