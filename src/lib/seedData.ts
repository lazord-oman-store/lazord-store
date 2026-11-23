import type { Order, Product, PromoCode, StoreSettings } from '../types/store';

export interface PersistedStoreState {
  products: Product[];
  orders: Order[];
  promoCodes: PromoCode[];
  settings: StoreSettings;
  totalStoreVisits: number;
}

export const INITIAL_SEED_STATE: PersistedStoreState = {
  totalStoreVisits: 0,
  settings: {
    brandName: 'LAZORD | لازورد',
    brandBio:
      'دار لازورد للعطور الفاخرة والبخور الأصيل؛ ننسج خلاصة العود المعتّق والزعفران واللبان العماني والعنبر الدافئ في تركيبات راقية تعبّر عن الفخامة العربية الهادئة والحرفية العالية.',
    bankPhoneNumber: '92481750',
    bankAccountLabel: 'حساب تحويل بنكي مباشر — دار لازورد للعطور',
    whatsappNumber: '96879115527',
    currencyLabel: 'ر.ع',
  },
  products: [
    {
      id: 'prod-oud-sultani',
      nameAr: 'عود لازورد الملكي',
      category: 'perfume',
      notesAr: 'العود الكمبودي المعتّق · الزعفران الفاخر · العنبر الأسود وخشب الصندل',
      sizeLabel: '100 مل · Eau de Parfum',
      priceOmr: 34.0,
      imageUrl: '/src/assets/images/perfume_royal_oud_1795258094810.jpg',
      featured: true,
      outOfStock: false,
      createdAt: '2026-10-12T09:00:00.000Z',
    },
    {
      id: 'prod-amber-velvet',
      nameAr: 'عنبر مخملي',
      category: 'perfume',
      notesAr: 'العنبر الدافئ · الفانيليا المدغشقرية · الهيل المحمّص واللبان الحوجري',
      sizeLabel: '100 مل · Extrait de Parfum',
      priceOmr: 28.5,
      imageUrl: '/src/assets/images/perfume_amber_velvet_1795258095576.jpg',
      featured: true,
      outOfStock: false,
      createdAt: '2026-10-14T09:00:00.000Z',
    },
    {
      id: 'prod-musk-saffron',
      nameAr: 'مسك الزعفران الأبيض',
      category: 'perfume',
      notesAr: 'المسك الصافي · خيوط الزعفران · زهر البرتقال وخشب الأرز الناعم',
      sizeLabel: '75 مل · Eau de Parfum',
      priceOmr: 24.0,
      imageUrl: '/src/assets/images/perfume_musk_saffron_1795258094847.jpg',
      featured: false,
      outOfStock: false,
      createdAt: '2026-10-16T09:00:00.000Z',
    },
    {
      id: 'prod-bukhoor-diwan',
      nameAr: 'بخور الديوان الفاخر',
      category: 'bukhoor',
      notesAr: 'رقائق العود الطبيعي المشبعة بدهن الورد الطائفي والعنبر الملكي',
      sizeLabel: '60 جم · علبة محفوظة',
      priceOmr: 18.0,
      imageUrl: '/src/assets/images/bukhoor_royal_charcoal_1795258094434.jpg',
      featured: true,
      outOfStock: false,
      createdAt: '2026-10-18T09:00:00.000Z',
    },
    {
      id: 'prod-bukhoor-taif',
      nameAr: 'معمول الطائف المعتّق',
      category: 'bukhoor',
      notesAr: 'كرات بخور يدوية بمسك الغزال والورد الطائفي ودهن العود الهندي',
      sizeLabel: '80 جم · وعاء خزفي ذهبي',
      priceOmr: 21.5,
      imageUrl: '/src/assets/images/bukhoor_taif_incense_1795258094152.jpg',
      featured: false,
      outOfStock: false,
      createdAt: '2026-10-20T09:00:00.000Z',
    },
  ],
  promoCodes: [
    {
      id: 'promo-lazord15',
      code: 'LAZORD15',
      discountType: 'percentage',
      value: 15,
      active: true,
      createdAt: '2026-10-10T08:00:00.000Z',
    },
    {
      id: 'promo-oud5',
      code: 'OUD5',
      discountType: 'fixed',
      value: 5,
      active: true,
      createdAt: '2026-10-15T08:00:00.000Z',
    },
  ],
  orders: [],
};
