import { SubscriptionPlan } from '../types';

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  price: string; // Base display price (usually 30 days)
  pricing: {
    duration: number; // in days
    price: number;
    priceDisplay: string;
    description: string;
  }[];
  description: string;
  features: string[];
  limits: {
    maxProducts: number;
    maxTransactionsPerMonth: number;
    maxUsers: number;
  };
  color: string;
}

export const FEATURE_KEYS = {
  DASHBOARD: 'dashboard',
  INVENTORY_PRODUCTS: 'inventory_products',
  INVENTORY_CATEGORIES: 'inventory_categories',
  INVENTORY_STOCK: 'inventory_stock',
  INVENTORY_WAREHOUSES: 'inventory_warehouses',
  INVENTORY_REPORT: 'inventory_report',
  INVENTORY_STOCK_OPNAME: 'inventory_stock_opname',
  SALES_ORDER: 'sales_order',
  SALES_RECEIVE: 'sales_receive',
  SALES_CUSTOMERS: 'sales_customers',
  FINANCE_INVOICES: 'finance_invoices',
  FINANCE_REPORT: 'finance_report',
  FINANCE_CLAIM: 'finance_claim',
  FINANCE_SETTINGS: 'finance_settings',
  FINANCE_BANK_ACCOUNTS: 'finance_bank_accounts',
  FINANCE_CHARITY: 'finance_charity',
  DAILY_SETTLEMENT: 'daily_settlement',
  CATALOG_EDITOR: 'catalog_editor',
  MASTER_USERS: 'master_users',
  MASTER_ROLES: 'master_roles',
  PURCHASE_SUPPLIERS: 'purchase_suppliers',
  PURCHASE_REQUESTS: 'purchase_requests',
  PURCHASE_ORDERS: 'purchase_orders',
  PURCHASE_GOODS_RECEIPTS: 'purchase_goods_receipts',
  PURCHASE_INVOICES: 'purchase_invoices',
  TENANT_SETTINGS: 'tenant_settings',
  APPROVALS: 'approvals',
  CUSTOM_DOMAIN: 'custom_domain',
  MULTI_WAREHOUSE: 'multi_warehouse',
};

export const PLANS: Record<SubscriptionPlan, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'FREE',
    price: 'Rp 0',
    pricing: [
      { duration: 0, price: 0, priceDisplay: 'Rp 0', description: 'Selamanya' }
    ],
    description: 'Untuk coba sistem',
    features: [
      FEATURE_KEYS.DASHBOARD,
      FEATURE_KEYS.INVENTORY_PRODUCTS,
      FEATURE_KEYS.SALES_ORDER,
      FEATURE_KEYS.FINANCE_REPORT,
    ],
    limits: {
      maxProducts: 10,
      maxTransactionsPerMonth: 50,
      maxUsers: 1,
    },
    color: 'bg-gray-100 text-gray-700',
  },
  starter: {
    id: 'starter',
    name: 'STARTER',
    price: 'Rp 29K',
    pricing: [
      { duration: 30, price: 29000, priceDisplay: 'Rp 29K', description: '30 Hari' },
      { duration: 90, price: 79000, priceDisplay: 'Rp 79K', description: '90 Hari (~10% Hemat)' },
      { duration: 180, price: 149000, priceDisplay: 'Rp 149K', description: '180 Hari (~15% Hemat)' },
      { duration: 365, price: 279000, priceDisplay: 'Rp 279K', description: '365 Hari (~20% Hemat)' },
    ],
    description: 'Untuk mulai usaha',
    features: [
      FEATURE_KEYS.DASHBOARD,
      FEATURE_KEYS.INVENTORY_PRODUCTS,
      FEATURE_KEYS.INVENTORY_CATEGORIES,
      FEATURE_KEYS.SALES_ORDER,
      FEATURE_KEYS.SALES_CUSTOMERS,
      FEATURE_KEYS.FINANCE_REPORT,
      FEATURE_KEYS.FINANCE_BANK_ACCOUNTS,
    ],
    limits: {
      maxProducts: 100,
      maxTransactionsPerMonth: 500,
      maxUsers: 1,
    },
    color: 'bg-blue-100 text-blue-700',
  },
  lite: {
    id: 'lite',
    name: 'LITE ⭐',
    price: 'Rp 79K',
    pricing: [
      { duration: 30, price: 79000, priceDisplay: 'Rp 79K', description: '30 Hari' },
      { duration: 90, price: 219000, priceDisplay: 'Rp 219K', description: '90 Hari (~10% Hemat)' },
      { duration: 180, price: 399000, priceDisplay: 'Rp 399K', description: '180 Hari (~15% Hemat)' },
      { duration: 365, price: 699000, priceDisplay: 'Rp 699K', description: '365 Hari (~20% Hemat)' },
    ],
    description: 'Untuk bisnis berkembang',
    features: [
      FEATURE_KEYS.DASHBOARD,
      FEATURE_KEYS.INVENTORY_PRODUCTS,
      FEATURE_KEYS.INVENTORY_CATEGORIES,
      FEATURE_KEYS.INVENTORY_STOCK,
      FEATURE_KEYS.INVENTORY_STOCK_OPNAME,
      FEATURE_KEYS.SALES_ORDER,
      FEATURE_KEYS.SALES_CUSTOMERS,
      FEATURE_KEYS.FINANCE_INVOICES,
      FEATURE_KEYS.FINANCE_REPORT,
      FEATURE_KEYS.FINANCE_BANK_ACCOUNTS,
      FEATURE_KEYS.CATALOG_EDITOR,
      FEATURE_KEYS.PURCHASE_SUPPLIERS,
    ],
    limits: {
      maxProducts: 1000000, // Unlimited
      maxTransactionsPerMonth: 1000000, // Unlimited
      maxUsers: 3,
    },
    color: 'bg-amber-100 text-amber-700',
  },
  pro: {
    id: 'pro',
    name: 'PRO',
    price: 'Rp 179K',
    pricing: [
      { duration: 30, price: 179000, priceDisplay: 'Rp 179K', description: '30 Hari' },
      { duration: 90, price: 499000, priceDisplay: 'Rp 499K', description: '90 Hari (~10% Hemat)' },
      { duration: 180, price: 899000, priceDisplay: 'Rp 899K', description: '180 Hari (~15% Hemat)' },
      { duration: 365, price: 1599000, priceDisplay: 'Rp 1.599K', description: '365 Hari (~20% Hemat)' },
    ],
    description: 'Untuk bisnis dengan tim & cabang',
    features: Object.values(FEATURE_KEYS).filter(k => k !== FEATURE_KEYS.CUSTOM_DOMAIN),
    limits: {
      maxProducts: 1000000,
      maxTransactionsPerMonth: 1000000,
      maxUsers: 10,
    },
    color: 'bg-indigo-100 text-indigo-700',
  },
  business: {
    id: 'business',
    name: 'BUSINESS',
    price: 'Rp 349K',
    pricing: [
      { duration: 30, price: 349000, priceDisplay: 'Rp 349K', description: '30 Hari' },
      { duration: 90, price: 999000, priceDisplay: 'Rp 999K', description: '90 Hari (~10% Hemat)' },
      { duration: 180, price: 1799000, priceDisplay: 'Rp 1.799K', description: '180 Hari (~15% Hemat)' },
      { duration: 365, price: 2999000, priceDisplay: 'Rp 2.999K', description: '365 Hari (~20% Hemat)' },
    ],
    description: 'Untuk skala besar & enterprise',
    features: Object.values(FEATURE_KEYS),
    limits: {
      maxProducts: 1000000,
      maxTransactionsPerMonth: 1000000,
      maxUsers: 100,
    },
    color: 'bg-purple-100 text-purple-700',
  },
};
