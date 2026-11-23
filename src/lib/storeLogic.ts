import type {
  CartItem,
  Order,
  OrderStatus,
  Product,
  ProductCategory,
  PromoCode,
  StoreAnalytics,
} from '../types/store';

export const BANK_TRANSFER_INSTRUCTION =
  'من فضلك حول المبلغ على الرقم و ارسل الايصال لتأكيد طلبك';

export const ORDER_CONFIRMATION_MESSAGE =
  'شكرا لك ثقتك ودعمك لبراند لازورد للعطور . سيكون هذا رقم التتبع الخاص بطلبك لتتمكن من معرفة حالة طلبك';

export const LAZORD_INSTAGRAM_URL = 'https://www.instagram.com/9lazord/';

export const OMAN_GOVERNORATES = [
  'محافظة مسقط',
  'محافظة ظفار',
  'محافظة مسندم',
  'محافظة البريمي',
  'محافظة الداخلية',
  'محافظة شمال الباطنة',
  'محافظة جنوب الباطنة',
  'محافظة جنوب الشرقية',
  'محافظة شمال الشرقية',
  'محافظة الظاهرة',
  'محافظة الوسطى',
] as const;

export function roundOmr(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function formatOmr(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${roundOmr(safe).toFixed(3)} ر.ع`;
}

export function getCategoryLabelAr(category: ProductCategory): string {
  return category === 'perfume' ? 'عطور' : 'بخور';
}

export function isProductOutOfStock(
  product: Pick<Product, 'outOfStock'> | null | undefined
): boolean {
  return Boolean(product?.outOfStock);
}

/**
 * Generates strictly sequential, non-overlapping Order Numbers:
 * LZD-1001, LZD-1002, LZD-1003...
 */
export function generateNextOrderNumber(existingOrderNumbers: string[]): string {
  let maxNum = 1000;
  for (const raw of existingOrderNumbers) {
    const match = /^LZD-(\d+)$/i.exec(raw.trim());
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }
  return `LZD-${maxNum + 1}`;
}

/**
 * Generates strictly unique, non-colliding Tracking Numbers:
 * TRK-LZD-XXXXX (5 digits, bound 1-to-1 to a single Order Number).
 */
export function generateUniqueTrackingNumber(
  existingTrackingNumbers: Iterable<string>,
  randomFn: () => number = Math.random
): string {
  const existing = new Set(
    Array.from(existingTrackingNumbers, (code) => code.trim().toUpperCase())
  );

  for (let attempt = 0; attempt < 500; attempt++) {
    const numeric = Math.floor(10000 + randomFn() * 90000);
    const candidate = `TRK-LZD-${numeric}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique tracking number');
}

export interface CartTotalsResult {
  originalSubtotal: number;
  discountAmount: number;
  finalTotal: number;
  appliedCode: string | null;
}

export function calculateCartTotals(
  items: Pick<CartItem, 'product' | 'quantity'>[],
  promoCode: PromoCode | null
): CartTotalsResult {
  const originalSubtotal = roundOmr(
    items.reduce((sum, item) => {
      const qty = Math.max(0, Math.floor(item.quantity));
      return sum + item.product.priceOmr * qty;
    }, 0)
  );

  if (!promoCode || !promoCode.active || originalSubtotal <= 0) {
    return {
      originalSubtotal,
      discountAmount: 0,
      finalTotal: originalSubtotal,
      appliedCode: null,
    };
  }

  let rawDiscount = 0;
  if (promoCode.discountType === 'percentage') {
    const clampedPct = Math.min(100, Math.max(0, promoCode.value));
    rawDiscount = originalSubtotal * (clampedPct / 100);
  } else {
    rawDiscount = Math.max(0, promoCode.value);
  }

  const discountAmount = roundOmr(Math.min(originalSubtotal, rawDiscount));
  const finalTotal = roundOmr(Math.max(0, originalSubtotal - discountAmount));

  return {
    originalSubtotal,
    discountAmount,
    finalTotal,
    appliedCode: promoCode.code,
  };
}

export function normalizePromoInput(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

export function computeStoreAnalytics(
  orders: Pick<Order, 'finalTotal' | 'status'>[],
  totalStoreVisits: number
): StoreAnalytics {
  const approvedOrders = orders.filter(
    (o) => o.status !== 'قيد المراجعة' && o.status !== 'مرفوض'
  );
  const totalOrders = approvedOrders.length;
  const pendingOrders = orders.filter((o) => o.status === 'قيد المراجعة').length;
  const totalSalesRevenue = roundOmr(
    approvedOrders.reduce((sum, o) => sum + (Number.isFinite(o.finalTotal) ? o.finalTotal : 0), 0)
  );

  return {
    totalSalesRevenue,
    totalOrders,
    pendingOrders,
    totalStoreVisits: Math.max(0, Math.floor(totalStoreVisits)),
  };
}

export const LAZORD_WHATSAPP_NUMBER = '96879115527';
export const LAZORD_WHATSAPP_MESSAGE_LINK = 'https://wa.me/message/W6HN5EKAT2GLK1';

export function formatCustomerOrderWhatsAppMessage(
  order: Pick<Order, 'items' | 'finalTotal'>
): string {
  const itemLines = order.items.map(
    (item) => `- ${item.nameAr} (الكمية: ${item.quantity} × ${formatOmr(item.unitPriceOmr)})`
  );

  return [
    'شكراً لك على دعمك لبراند لازورد للعطور',
    '',
    'تفاصيل الطلب:',
    ...itemLines,
    `السعر الكلي: ${formatOmr(order.finalTotal)}`,
  ].join('\n');
}

function normalizeAsciiDigits(raw: string): string {
  return raw
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}

export function sanitizeWhatsAppDigits(phone: string): string {
  const ascii = normalizeAsciiDigits(String(phone || ''));
  const digits = ascii.replace(/[^\d]/g, '').replace(/^0+/, '');
  if (!digits) return '';

  // Remove accidental trunk zero(s) after Oman country code (e.g., 968091234567 -> 96891234567)
  if (digits.startsWith('968')) {
    const subscriber = digits.slice(3).replace(/^0+/, '');
    if (subscriber.length === 8) {
      return `968${subscriber}`;
    }
  }

  // Default Oman country code 968 if 8-digit local number provided
  if (digits.length === 8) {
    return `968${digits}`;
  }
  return digits;
}

function safeEncodeWhatsAppText(text: string): string {
  const clean = text.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ''
  );
  return encodeURIComponent(clean);
}

/**
 * Unified direct WhatsApp URL builder using official https://wa.me/<digits>?text=<encoded> format.
 * Automatically strips symbols/spaces/+/00/leading-0 and prepends Oman code (968) for 8-digit local numbers.
 * Returns empty string if the cleaned phone number has fewer than 8 digits.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanedPhone = sanitizeWhatsAppDigits(phone);
  if (cleanedPhone.length < 8) {
    return '';
  }
  return `https://wa.me/${cleanedPhone}?text=${safeEncodeWhatsAppText(message)}`;
}

export const LAZORD_WHATSAPP_GREETING =
  'مرحباً دار LAZORD | لازورد، أود الاستفسار عن العطور والبخور.';

export function buildBrandDirectWhatsAppUrl(
  brandWhatsapp?: string,
  greeting: string = LAZORD_WHATSAPP_GREETING
): string {
  const cleaned = sanitizeWhatsAppDigits(brandWhatsapp || '');
  const target = cleaned.length >= 8 ? cleaned : LAZORD_WHATSAPP_NUMBER;
  return buildWhatsAppUrl(target, greeting);
}

export function buildCustomerOrderWhatsAppUrl(
  brandWhatsapp: string,
  order: Pick<
    Order,
    | 'orderNumber'
    | 'trackingNumber'
    | 'customerName'
    | 'customerPhone'
    | 'city'
    | 'address'
    | 'items'
    | 'promoCodeUsed'
    | 'discountAmount'
    | 'finalTotal'
  >
): string {
  const cleanedBrand = sanitizeWhatsAppDigits(brandWhatsapp);
  const target = cleanedBrand.length >= 8 ? cleanedBrand : LAZORD_WHATSAPP_NUMBER;
  const itemLines = order.items.map(
    (item) => `- ${item.nameAr} × ${item.quantity} (${formatOmr(item.lineTotalOmr)})`
  );

  const lines = [
    `طلب جديد من متجر LAZORD | لازورد`,
    `رقم الطلب: ${order.orderNumber}`,
    ...(order.trackingNumber ? [`رقم التتبع: ${order.trackingNumber}`] : []),
    `اسم العميل: ${order.customerName}`,
    `رقم الهاتف: ${order.customerPhone}`,
    `المحافظة والعنوان: ${order.city} - ${order.address}`,
    `المنتجات:`,
    ...itemLines,
  ];

  if (order.promoCodeUsed && order.discountAmount > 0) {
    lines.push(`الخصم (${order.promoCodeUsed}): -${formatOmr(order.discountAmount)}`);
  }

  lines.push(`السعر النهائي: ${formatOmr(order.finalTotal)}`);
  lines.push(`إيصال الدفع: تم رفع وإرفاق صورة إيصال التحويل البنكي مع الطلب.`);

  return buildWhatsAppUrl(target, lines.join('\n'));
}

export function buildOwnerStatusWhatsAppUrl(
  customerPhone: string,
  order: Pick<Order, 'customerName' | 'orderNumber' | 'trackingNumber' | 'status' | 'finalTotal'>
): string {
  const statusDetails: Record<OrderStatus, string> = {
    'قيد المراجعة': 'طلبك حالياً قيد المراجعة من قبل فريق لازورد.',
    'تم تأكيد الدفع': 'تم تأكيد استلام مبلغ التحويل البنكي بنجاح.',
    'جاري التجهيز': 'جاري تجهيز وتغليف طلبك بعناية فائقة.',
    'تم الشحن': 'تم شحن طلبك وهو الآن في طريقه إليك.',
    'تم التوصيل': 'تم توصيل طلبك بنجاح. نتمنى لك تجربة عطرية مميزة مع لازورد.',
    مرفوض: 'نعتذر، تعذر تأكيد الطلب الحالي. يرجى التواصل معنا لمراجعة تفاصيل التحويل.',
  };

  const message = [
    `أهلاً ${order.customerName}، تحية طيبة من دار LAZORD | لازورد.`,
    `تحديث حالة طلبك رقم ${order.orderNumber}:`,
    `الحالة الحالية: ${order.status}`,
    statusDetails[order.status],
    ...(order.trackingNumber ? [`رقم التتبع الخاص بك: ${order.trackingNumber}`] : []),
    `إجمالي الطلب: ${formatOmr(order.finalTotal)}`,
  ].join('\n');

  return buildWhatsAppUrl(customerPhone, message);
}

export interface CheckoutValidationInput {
  customerName: string;
  customerPhone: string;
  city: string;
  address: string;
  receiptImageUrl: string;
  itemCount: number;
}

export function validateCheckoutInput(input: CheckoutValidationInput): string | null {
  if (input.itemCount <= 0) {
    return 'سلة التسوق فارغة، يرجى إضافة منتج واحد على الأقل.';
  }
  if (input.customerName.trim().length < 2) {
    return 'يرجى إدخال الاسم الكامل بشكل صحيح.';
  }
  const phoneDigits = sanitizeWhatsAppDigits(input.customerPhone);
  if (phoneDigits.length < 8) {
    return 'يرجى إدخال رقم هاتف صحيح للتواصل.';
  }
  if (!OMAN_GOVERNORATES.includes(input.city.trim() as (typeof OMAN_GOVERNORATES)[number])) {
    return 'يرجى اختيار المحافظة داخل سلطنة عُمان.';
  }
  if (input.address.trim().length < 4) {
    return 'يرجى إدخال الولاية والمنطقة وتفاصيل العنوان.';
  }
  if (!input.receiptImageUrl.trim()) {
    return 'يرجى رفع صورة إيصال التحويل البنكي قبل تأكيد الطلب.';
  }
  return null;
}
