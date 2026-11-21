/**
 * LAZORD Firebase Integration Blueprint
 * -----------------------------------
 * The UI and domain layers depend exclusively on `LazordStoreRepository` in `src/services/storeRepository.ts`.
 * To connect Firebase Firestore, Storage, and Authentication:
 * 1. Initialize Firebase App (`initializeApp(firebaseConfig)`), `getFirestore`, `getStorage`, and `getAuth`.
 * 2. Map collections cleanly:
 *    - `products/{productId}`        -> Product documents
 *    - `orders/{orderId}`            -> Order documents (`orderNumber`, `trackingNumber`, `receiptImageUrl`, ...)
 *    - `promoCodes/{promoId}`        -> PromoCode documents
 *    - `settings/storefront`         -> StoreSettings document
 *    - `analytics/visits`            -> Atomic `increment(1)` store visit counter
 * 3. Upload receipts & product photos to Firebase Storage (`receipts/{orderNumber}/{fileName}`).
 * 4. Protect `orders`, `promoCodes`, `settings/storefront`, and `analytics` writes with Owner Firebase Auth UID rules.
 */
export const FIREBASE_COLLECTIONS = {
  products: 'products',
  orders: 'orders',
  promoCodes: 'promoCodes',
  settings: 'settings',
  analytics: 'analytics',
} as const;
