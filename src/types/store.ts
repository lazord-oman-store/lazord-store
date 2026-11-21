export type ProductCategory = 'perfume' | 'bukhoor';

export type OrderStatus =
  | 'قيد المراجعة'
  | 'تم تأكيد الدفع'
  | 'جاري التجهيز'
  | 'تم الشحن'
  | 'تم التوصيل'
  | 'مرفوض';

export const ORDER_STATUS_LIST: OrderStatus[] = [
  'قيد المراجعة',
  'تم تأكيد الدفع',
  'جاري التجهيز',
  'تم الشحن',
  'تم التوصيل',
  'مرفوض',
];

export interface Product {
  id: string;
  nameAr: string;
  category: ProductCategory;
  notesAr: string;
  sizeLabel: string;
  priceOmr: number;
  imageUrl: string;
  featured?: boolean;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  nameAr: string;
  category: ProductCategory;
  sizeLabel: string;
  unitPriceOmr: number;
  quantity: number;
  lineTotalOmr: number;
}

export type DiscountType = 'percentage' | 'fixed';

export interface PromoCode {
  id: string;
  code: string;
  discountType: DiscountType;
  value: number;
  active: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  customerName: string;
  customerPhone: string;
  city: string;
  address: string;
  items: OrderItem[];
  originalSubtotal: number;
  promoCodeUsed: string | null;
  discountAmount: number;
  finalTotal: number;
  receiptImageUrl: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PublicOrderTracking {
  orderNumber: string;
  trackingNumber: string;
  customerName: string;
  city: string;
  items: OrderItem[];
  originalSubtotal: number;
  promoCodeUsed: string | null;
  discountAmount: number;
  finalTotal: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettings {
  brandName: string;
  brandBio: string;
  bankPhoneNumber: string;
  bankAccountLabel: string;
  whatsappNumber: string;
  currencyLabel: string;
}

export interface StoreAnalytics {
  totalSalesRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  totalStoreVisits: number;
}

export interface PublicStorefrontData {
  products: Product[];
  settings: StoreSettings;
}

export interface AdminDashboardData {
  analytics: StoreAnalytics;
  orders: Order[];
  products: Product[];
  promoCodes: PromoCode[];
  settings: StoreSettings;
}
