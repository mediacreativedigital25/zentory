export type UserRole = 'superadmin' | 'admin' | 'staff' | 'customer' | 'kasir';
export type SubscriptionPlan = 'free' | 'starter' | 'lite' | 'pro' | 'business';

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  permissions: string[]; // List of feature keys
  createdAt: any;
}

export interface UserAddress {
  id: string;
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  village: string;
  postalCode: string;
  detail: string;
  fullAddress: string;
  isMain: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string; // Changed from UserRole to string to support custom roles
  tenantId: string | null;
  salesCode?: string;
  address?: string;
  addresses?: UserAddress[];
  addressDetails?: {
    province: string;
    city: string;
    district: string;
    village: string;
    postalCode: string;
    detail: string;
  };
  createdAt: any;
  forceLogoutAt?: any;
  lastLoginAt?: any;
  lastLogoutAt?: any;
  lastActive?: any;
  isOnline?: boolean;
  ipAddress?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  code?: string;
  ownerId: string;
  subscription: SubscriptionPlan;
  subscriptionStatus?: 'active' | 'expired' | 'trial';
  subscriptionStartDate?: any;
  subscriptionEndDate?: any;
  plan?: SubscriptionPlan; // Use this as primary, fallback to subscription
  features?: string[]; // List of enabled feature keys for this specific tenant
  limits?: {
    maxProducts?: number;
    maxTransactionsPerMonth?: number;
    maxUsers?: number;
  };
  createdAt: any;
  settings?: {
    logoUrl?: string;
    themeColor?: string;
    description?: string;
    address?: string; // Kept for compatibility, but moving towards root level if preferred, or keeping here.
    phone?: string;
    heroImageUrl?: string;
    heroImageUrls?: string[];
    tagline?: string;
    galleryUrls?: string[];
    whyChooseUs?: { icon: string; title: string; description: string; }[];
    faqs?: { question: string; answer: string; }[];
    operationalHours?: string;
    receiptFooter?: string;
  };
  customDomains?: string[];
  menuSettings?: {
    [key: string]: boolean;
  };
  customerSavingsSettings?: {
    enabled: boolean;
    savingsType: 'nominal' | 'percent';
    savingsValue: number;
  };
  
  // Cooperation & Business Details
  ownerName?: string;
  address?: string;
  phone?: string;
  email?: string;
  businessType?: string;
  taxId?: string; // NPWP
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
  cooperationStatus?: 'active' | 'pending' | 'ended' | 'trial';
  cooperationStartDate?: any;
  notes?: string;
  billingCycle?: string;
  lastPaymentMethod?: string;
  catalogTheme?: string;
  storeAddress?: {
    province: string;
    city: string;
    district: string;
    village: string;
    detail: string;
    postalCode: string;
  };
  paymentMethods?: {
    manual?: {
      isEnabled: boolean;
      accounts?: {
        id?: string;
        bankName: string;
        customBankName?: string;
        accountNumber: string;
        accountHolder: string;
      }[];
      bankName?: string;
      accountNumber?: string;
      accountHolder?: string;
    };
    paymentGateway?: {
      isEnabled: boolean;
      mode: string;
      merchantCode: string;
      apiKey: string;
      privateKey: string;
    };
    downPayment?: {
      isEnabled: boolean;
      type: 'fixed' | 'percentage';
      amount: number;
    };
  };
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
  minStock: number; // Minimum stock for alerts
  category: string;
  warehouseId?: string;
  businessLineId?: string;
  imageUrl?: string;
  description?: string;
  type: 'manual' | 'service';
  serviceActiveDays?: number; // active days for service
  createdAt: any;
  variants?: ProductVariant[];
  wholesalePrices?: WholesalePrice[];
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  hpp: number;
  price: number;
  stock: number;
  minStock: number;
  imageUrl?: string;
  type?: 'stock' | 'non-stock';
}

export interface WholesalePrice {
  minQuantity: number;
  price: number;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type?: 'service';
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

export interface CustomerCategory {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  createdAt: any;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  email: string;
  phone: string;
  address: string;
  province?: string;
  regency?: string;
  district?: string;
  village?: string;
  type: 'umum' | 'langganan';
  categoryId?: string;
  allowTempo: boolean;
  tempoLimitDays?: number;
  discount?: number;
  hasSavingsProgram?: boolean;
  savingsBalance?: number;
  createdAt: any;
}

export interface Order {
  id: string;
  orderNumber: string; // M..., IN..., 0J...
  tenantId: string;
  customerId?: string;
  customerName?: string;
  customerCode?: string;
  type: 'manual' | 'catalog' | 'service' | 'pos';
  items: { 
    productId: string; 
    variantId?: string | null;
    name: string; 
    quantity: number; 
    price: number; 
    hpp: number 
  }[];
  totalAmount: number;
  paidAmount?: number;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
  paymentType?: 'cash' | 'credit';
  remark?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  date: any;
  dueDate?: any;
  userId: string;
  paymentMethod?: string; // ID of BankAccount
  isInCollection?: boolean;
}

export interface Transaction {
  id: string;
  orderId?: string; // Reference to order id
  tenantId: string;
  type: 'sale' | 'expense' | 'charity_reserve' | 'transfer_in' | 'transfer_out';
  amount: number;
  items?: { 
    productId: string; 
    variantId?: string | null;
    name: string; 
    quantity: number; 
    price: number; 
    hpp: number;
    businessLineId?: string;
  }[];
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
  charityNumber?: string; // CE202604000001
  dailyClosingId?: string;
  dailyNumber?: string;
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
  type: 'order_status' | 'daily_settlement_open' | 'charity_revision' | 'target_revision' | 'payment_correction';
  orderId?: string;
  orderNumber?: string;
  closingId?: string;
  charityId?: string;
  targetMonth?: string;
  closingDate?: any;
  requestedBy: string;
  requestedAt: any;
  targetStatus?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedBy?: string;
  resolvedAt?: any;
  // Fields for payment corrections
  receiptId?: string;
  customerName?: string;
  amount?: number;
  invoices?: any[];
  collections?: any[];
}

export interface BankAccount {
  id: string;
  tenantId: string;
  name: string;
  accountNumber?: string;
  accountHolder?: string;
  type: 'BANK' | 'QRIS' | 'CASH' | 'E-WALLET';
  isActive: boolean;
  showInCatalog?: boolean;
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
  paymentTerm?: number; // In days
  createdAt: any;
}

export interface PurchaseRequest {
  id: string;
  prNumber: string;
  tenantId: string;
  items: { 
    productId: string; 
    variantId?: string | null;
    name: string; 
    variantName?: string;
    quantity: number 
  }[];
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
  items: { 
    productId: string; 
    variantId?: string | null;
    name: string; 
    quantity: number; 
    price: number 
  }[];
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
    variantId?: string | null;
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

export interface StockOpname {
  id: string;
  soNumber: string;
  tenantId: string;
  date: any;
  period: 'Harian' | 'Mingguan' | 'Bulanan';
  category: string;
  warehouseId: string;
  warehouseName: string;
  remark: string;
  createdBy: string;
  createdByName?: string;
  items: {
    productId: string;
    variantId?: string | null;
    productName: string;
    variantName?: string;
    sku: string;
    systemStock: number;
    physicalStock?: number;
    difference?: number;
  }[];
}

export interface InvoiceCollection {
  id: string;
  tenantId: string;
  collectionNumber: string;
  customerId?: string | null;
  customerName: string;
  date: any;
  orderIds: string[];
  orderNumbers: string[];
  totalAmount: number;
  totalPaid: number;
  totalSisa: number;
  createdBy: string;
  status: 'open' | 'closed' | 'pending' | 'completed' | 'cancelled';
  createdAt: any;
}

export interface SalesTarget {
  id: string;
  tenantId: string;
  month: string; // YYYY-MM
  target1: number;
  target2: number;
  target3: number;
  updatedAt: any;
  updatedBy: string;
  isUnlocked?: boolean;
  revisionCount?: number;
}

export interface BankTransfer {
  id: string;
  tenantId: string;
  transferNumber: string; 
  date: any;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  referenceNumber?: string;
  description?: string;
  createdBy: string;
  createdAt: any;
}

export interface Booking {
  id: string;
  tenantId: string;
  invoiceNumber?: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  serviceId: string;
  serviceName: string;
  items?: any[];
  totalAmount?: number;
  bookingDate: string; // YYYY-MM-DD
  bookingTime: string; // HH:mm
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  salesOrderId?: string;
  createdAt: any;
  updatedAt: any;
  createdBy?: string;
}

export interface PaymentReceipt {
  id: string;
  tenantId: string;
  receiptNumber: string; // RP202604000001
  customerId: string;
  customerName: string;
  date: any;
  paymentMethod: 'Tunai' | 'Bank Transfer';
  bankAccountId?: string; // If Bank Transfer
  bankAccountName?: string;
  amount: number;
  savingsAmount?: number;
  note?: string;
  collections?: {
    collectionId: string;
    collectionNumber: string;
    amountPaid: number;
  }[];
  invoices?: {
    orderId: string;
    orderNumber: string;
    date?: any;
    dueDate?: any;
    totalAmount?: number;
    amountPaid: number;
  }[];
  createdBy: string;
  createdAt: any;
}

export interface BusinessLine {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  createdAt: any;
}

export interface ServiceCategory {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
}

export interface Service {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  duration?: number;
}
