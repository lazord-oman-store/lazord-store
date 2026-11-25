import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { CartCheckoutDrawer } from './components/CartCheckoutDrawer';
import { OwnerLoginView } from './components/OwnerLoginView';
import { ProductCatalog, type CatalogFilter } from './components/ProductCatalog';
import { StoreFooter } from './components/StoreFooter';
import { StoreHeader } from './components/StoreHeader';
import { StoreHero } from './components/StoreHero';
import {
  SeasonalGreetingBanner,
  SeasonalPageCanvas,
  SeasonalSectionDivider,
} from './components/SeasonalDecorations';
import { TrackOrderModal } from './components/TrackOrderModal';
import { INITIAL_SEED_STATE } from './lib/seedData';
import { normalizeSeasonalTheme } from './lib/seasonalTheme';
import { isProductOutOfStock } from './lib/storeLogic';
import { storeRepository } from './services/storeRepository';
import type { CartItem, Product, StoreSettings } from './types/store';

function isAdminLocation(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hash === '#admin' ||
    window.location.pathname === '/admin' ||
    window.location.pathname === '/admin/'
  );
}

export default function App() {
  const [adminMode, setAdminMode] = useState<boolean>(() => isAdminLocation());
  const [checkingSession, setCheckingSession] = useState<boolean>(() => isAdminLocation());
  const [ownerAuthenticated, setOwnerAuthenticated] = useState(false);
  const [needsOwnerSetup, setNeedsOwnerSetup] = useState(false);

  // Public Storefront State
  const [products, setProducts] = useState<Product[]>(INITIAL_SEED_STATE.products);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SEED_STATE.settings);
  const [loadingStore, setLoadingStore] = useState(true);
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');

  // Cart & Modals State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [trackInitialNumber, setTrackInitialNumber] = useState('');
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  const loadStorefront = useCallback(async () => {
    try {
      const data = await storeRepository.getStorefront();
      setProducts(data.products);
      setSettings(data.settings);
      setCartItems((prev) =>
        prev
          .map((item) => {
            const latest = data.products.find((p) => p.id === item.product.id);
            return latest ? { ...item, product: latest } : null;
          })
          .filter((item): item is CartItem => item !== null)
      );
    } catch {
      // Keep initial seed fallback if transient error
    } finally {
      setLoadingStore(false);
    }
  }, []);

  useEffect(() => {
    loadStorefront();

    // Increment live store visits counter once per browser session when browsing storefront
    if (!isAdminLocation() && !sessionStorage.getItem('lazord_visit_recorded')) {
      sessionStorage.setItem('lazord_visit_recorded', '1');
      storeRepository.recordVisit().catch(() => {
        try {
          sessionStorage.removeItem('lazord_visit_recorded');
        } catch {
          // ignore storage errors
        }
      });
    }
  }, [loadStorefront]);

  // Listen to hash/path changes for secret #admin or /admin entry
  useEffect(() => {
    const syncRoute = () => {
      const nextIsAdmin = isAdminLocation();
      setAdminMode(nextIsAdmin);
      if (nextIsAdmin) {
        setCheckingSession(true);
        storeRepository
          .getOwnerSession()
          .then((res) => {
            setOwnerAuthenticated(Boolean(res.authenticated));
            setNeedsOwnerSetup(Boolean(res.needsSetup));
          })
          .catch(() => {
            setOwnerAuthenticated(false);
            setNeedsOwnerSetup(false);
          })
          .finally(() => setCheckingSession(false));
      }
    };

    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  const totalCartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const handleAddToCart = (product: Product) => {
    if (isProductOutOfStock(product)) {
      return;
    }
    setCartItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setAddedNotice(`تمت إضافة "${product.nameAr}" إلى سلة التسوق`);
    setTimeout(() => setAddedNotice(null), 2600);
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCartItems((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setCartItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleSecretAdminTrigger = () => {
    window.location.hash = '#admin';
    setAdminMode(true);
    setCheckingSession(true);
    storeRepository
      .getOwnerSession()
      .then((res) => {
        setOwnerAuthenticated(Boolean(res.authenticated));
        setNeedsOwnerSetup(Boolean(res.needsSetup));
      })
      .catch(() => {
        setOwnerAuthenticated(false);
        setNeedsOwnerSetup(false);
      })
      .finally(() => setCheckingSession(false));
  };

  const handleExitAdminToStore = () => {
    if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
      window.history.pushState({}, '', '/');
    } else {
      window.location.hash = '';
    }
    setAdminMode(false);
  };

  const activeSeasonalTheme = normalizeSeasonalTheme(settings.seasonalTheme);

  // --- Strict Protected Owner Route ---
  if (adminMode) {
    if (checkingSession) {
      return (
        <div className="min-h-screen bg-[#141311] text-[#FAF8F4] flex items-center justify-center">
          <p className="text-sm text-[#CFC7B8]">جاري التحقق من جلسة صاحب البراند...</p>
        </div>
      );
    }

    if (!ownerAuthenticated) {
      return (
        <OwnerLoginView
          initialNeedsSetup={needsOwnerSetup}
          seasonalTheme={activeSeasonalTheme}
          onLoginSuccess={() => {
            setNeedsOwnerSetup(false);
            setOwnerAuthenticated(true);
          }}
          onBackToStore={handleExitAdminToStore}
        />
      );
    }

    return (
      <AdminDashboard
        seasonalTheme={activeSeasonalTheme}
        onLogout={() => setOwnerAuthenticated(false)}
        onUnauthorized={() => setOwnerAuthenticated(false)}
        onExitToStore={handleExitAdminToStore}
        onStorefrontUpdated={loadStorefront}
      />
    );
  }

  // --- Public Customer Storefront ---
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#181715] overflow-x-clip">
      <SeasonalGreetingBanner theme={activeSeasonalTheme} />
      <SeasonalPageCanvas theme={activeSeasonalTheme} variant="storefront" />
      <StoreHeader
        cartCount={totalCartCount}
        onOpenCart={() => {
          setAddedNotice(null);
          setCartOpen(true);
        }}
        onOpenTrackOrder={() => {
          setTrackInitialNumber('');
          setTrackModalOpen(true);
        }}
        onFilterCategory={(cat) => setCatalogFilter(cat)}
      />

      <main className="flex-1">
        <StoreHero
          brandBio={settings.brandBio}
          seasonalTheme={activeSeasonalTheme}
          onExploreCatalog={() => {
            document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <SeasonalSectionDivider theme={activeSeasonalTheme} />

        {loadingStore ? (
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-96 rounded-xl bg-white border border-[#E7E0D2] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <ProductCatalog
            products={products}
            activeFilter={catalogFilter}
            onFilterChange={setCatalogFilter}
            onAddToCart={handleAddToCart}
          />
        )}
      </main>

      <StoreFooter
        settings={settings}
        seasonalTheme={activeSeasonalTheme}
        onSecretAdminTrigger={handleSecretAdminTrigger}
      />

      {/* Quick Add-to-Cart Toast Feedback */}
      {addedNotice && (
        <div
          role="status"
          className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:start-5 sm:max-w-md z-40 px-4 py-3 rounded-xl bg-[#141311] text-[#FAF8F4] border border-[#B59449] shadow-lg flex items-center justify-between gap-3 text-xs sm:text-sm"
        >
          <span className="leading-snug">{addedNotice}</span>
          <button
            type="button"
            onClick={() => {
              setAddedNotice(null);
              setCartOpen(true);
            }}
            className="text-xs font-semibold text-[#D4B774] hover:underline cursor-pointer whitespace-nowrap shrink-0"
          >
            عرض السلة
          </button>
        </div>
      )}

      <CartCheckoutDrawer
        isOpen={cartOpen}
        items={cartItems}
        settings={settings}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={() => setCartItems([])}
        onTrackNewOrder={(trk) => {
          setTrackInitialNumber(trk);
          setTrackModalOpen(true);
        }}
      />

      <TrackOrderModal
        isOpen={trackModalOpen}
        initialTrackingNumber={trackInitialNumber}
        onClose={() => setTrackModalOpen(false)}
      />
    </div>
  );
}
