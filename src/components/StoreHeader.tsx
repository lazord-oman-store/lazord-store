import { Search, ShoppingBag } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface StoreHeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenTrackOrder: () => void;
  onFilterCategory: (cat: 'all' | 'perfume' | 'bukhoor') => void;
}

export function StoreHeader({
  cartCount,
  onOpenCart,
  onOpenTrackOrder,
  onFilterCategory,
}: StoreHeaderProps) {
  const scrollToCatalog = (cat: 'all' | 'perfume' | 'bukhoor') => {
    onFilterCategory(cat);
    const el = document.getElementById('catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F4] border-b border-[#E7E0D2]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-[88px] sm:h-[96px] flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Official Brand Logo Blended onto Header */}
        <a
          href="#top"
          aria-label="LAZORD | لازورد - الرئيسية"
          data-testid="header-brand-logo"
          className="inline-flex items-center shrink-0 focus-visible:outline-2 focus-visible:outline-[#8E6F2D] rounded-lg"
        >
          <BrandLogo
            variant="light"
            className="w-[78px] h-[78px] sm:w-[88px] sm:h-[88px]"
            imgClassName="scale-[1.06]"
          />
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="التنقل الرئيسي"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4F4A42]"
        >
          <a
            href="#top"
            className="hover:text-[#181715] hover:underline underline-offset-8 decoration-[#B59449] transition-colors whitespace-nowrap shrink-0"
          >
            الرئيسية
          </a>
          <button
            type="button"
            onClick={() => scrollToCatalog('all')}
            className="hover:text-[#181715] hover:underline underline-offset-8 decoration-[#B59449] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            المجموعة
          </button>
          <button
            type="button"
            onClick={() => scrollToCatalog('perfume')}
            className="hover:text-[#181715] hover:underline underline-offset-8 decoration-[#B59449] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            العطور
          </button>
          <button
            type="button"
            onClick={() => scrollToCatalog('bukhoor')}
            className="hover:text-[#181715] hover:underline underline-offset-8 decoration-[#B59449] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            البخور
          </button>
        </nav>

        {/* Zone 3: Track Order + Cart Action */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenTrackOrder}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 min-h-[40px] text-xs sm:text-sm font-medium text-[#181715] border border-[#D9CEB8] bg-white hover:bg-[#F2EDE3] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#8E6F2D]"
          >
            <Search className="w-4 h-4 text-[#8E6F2D]" aria-hidden="true" />
            <span>تتبع طلبك</span>
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`سلة التسوق (${cartCount})`}
            data-testid="cart-button"
            className="relative inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[40px] min-w-[44px] text-sm font-medium bg-[#141311] text-[#FAF8F4] hover:bg-[#2A2723] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B59449]"
          >
            <ShoppingBag className="w-4 h-4 text-[#B59449]" aria-hidden="true" />
            <span className="hidden sm:inline">السلة</span>
            <span
              data-testid="cart-badge"
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-mono font-semibold tabular-nums rounded-full bg-[#B59449] text-[#141311]"
            >
              {cartCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
