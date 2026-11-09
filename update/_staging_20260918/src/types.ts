export type UserTier = 'bronze' | 'silver' | 'gold' | 'diamond';
export type ConsoleStatus = 'idle' | 'active' | 'reserved' | 'maintenance';
export type SessionStatus = 'running' | 'completed';
export type ReservationStatus = 'pending' | 'confirmed' | 'canceled';
export type SystemUserRole = 'admin' | 'operator' | 'client';

export interface SystemUser {
  id: string;
  username: string;
  fullName: string;
  password?: string;
  role: SystemUserRole;
  phone?: string;
  createdAt: string;
  isActive: boolean;
  clientId?: string;
}

export interface Tariff {
  id: string;
  name: string;
  pricePerHour: number;
  consoleType?: string;
  rates?: {
    single?: number;
    double?: number;
    triple?: number;
    quad?: number;
    extraPlayer?: number;
  };
}

export interface Console {
  id: string;
  name: string;
  type: string;
  status: ConsoleStatus;
  currentSessionId?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock?: number;
  unit?: string;
  isRawMaterial?: boolean; // آیا این محصول ماده فله/خام است (مثلاً دانه قهوه)
  rawMaterialId?: string; // ماده اولیه متصل (مثلاً آیدی دانه قهوه)
  gramsPerServing?: number; // مقدار مصرف در هر سرویس/فنجان به گرم
}

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  tier: string; // Will store the tier name or ID
  balance: number;
  points: number;
  totalPlayTime?: number; // Total duration in minutes
  totalPaid?: number; // Total amount customer has paid over time
  isGuest?: boolean;
  avatar?: string;
}

export interface SystemSettings {
  id: string;
  storeName?: string;
  logo?: string;
  currency: string;
  taxRate: number;
  contactPhone: string;
  address: string;
  autoBackup: boolean;
  alarmMinuteWarning: number;
  alarmEnabled: boolean;
  defaultMinStock?: number;
  themes?: Record<string, { primary: string, secondary: string, accent: string }>;
  monthlySalesTarget?: number;
  rolePermissions?: any;
}

export interface ClientTier {
  id: string;
  name: string;
  minPlayTime: number; // Threshold in minutes to reach this level
  discountPercentage: number;
  color: 'indigo' | 'amber' | 'emerald' | 'rose' | 'slate' | 'orange';
}

export interface Promotion {
  id: string;
  name: string;
  discountPercentage: number;
  startDate: string; // ISO string
  endDate: string; // ISO string
  isActive: boolean;
}

export interface OrderItem {
  id?: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface TariffInterval {
  consoleId?: string;
  consoleName?: string;
  tariffId?: string;
  tariffName: string;
  pricePerHour: number;
  startTime?: string;
  endTime?: string;
  durationSeconds: number;
  cost: number;
}

export interface Session {
  id: string;
  consoleId: string;
  userId?: string;
  userIds?: string[];
  tariffId: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string
  lastResumeTime?: string | null;
  status: SessionStatus;
  addedItems: OrderItem[];
  totalSessionAmount?: number;
  totalProductsAmount?: number;
  taxAmount?: number;
  totalCost?: number;
  duration?: number;
  limitMinutes?: number;
  limitType?: 'none' | 'time' | 'amount';
  limitValue?: number; // Minutes or Toman
  isAlarmTriggered?: boolean;
  tariffHistory?: TariffInterval[];
  isPaused?: boolean;
  pausedAt?: string | null;
  accumulatedSeconds?: number;
  splitUserIds?: string[];
  pointsPerUser?: number;
  costPerUser?: number;
  manualAdjustment?: number; // مبلغ تخفیف (منفی) یا هزینه اضافه (مثبت)
  manualAdjustmentType?: 'discount' | 'addition';
  manualAdjustmentNote?: string;
  customDate?: string;
}

export interface Reservation {
  id: string;
  consoleId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
}

export interface Sale {
  id: string;
  items: OrderItem[];
  totalAmount: number;
  taxAmount?: number;
  taxRate?: number;
  timestamp: string;
  type: 'quick_sale' | 'session_order' | 'manual_invoice';
  userId?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: 'wallet' | 'card' | 'cash' | string;
  discountAmount?: number;
  manualAdjustment?: number;
  manualAdjustmentType?: 'discount' | 'addition';
  manualAdjustmentNote?: string;
  title?: string;
  details?: string;
}

export interface Order {
  id: string;
  userId?: string;
  items: OrderItem[];
  totalAmount: number;
  taxAmount?: number;
  createdAt: string;
}

export interface BulkSubItemSummary {
  productId?: string;
  name: string;
  portionGrams: number;
  allocatedGrams: number;
  servingsAdded: number;
  unitCost: number;
  sellPrice: number;
}

export interface Purchase {
  id: string;
  productId?: string;
  productName: string;
  quantity: number;
  costPrice: number;
  totalCost: number;
  timestamp: string;
  isBulkSplit?: boolean;
  rawBulkName?: string;
  totalGrams?: number;
  subItemsSummary?: BulkSubItemSummary[];
}
